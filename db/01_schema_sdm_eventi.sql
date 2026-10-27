-- =====================================================================
-- SDM Eventi - schema database (Supabase / PostgreSQL)
-- Versione script: 1.5
--
-- Crea lo schema dedicato "sdm_eventi" dentro un database già esistente.
-- Non tocca lo schema "public" né altri schemi.
-- Lo script è rieseguibile (idempotente) sulle parti strutturali.
--
-- DOPO l'esecuzione, in Supabase:
--   Project Settings > API > "Exposed schemas": aggiungere  sdm_eventi
--   (altrimenti il client JS non può usare .schema('sdm_eventi'))
--
-- Offline-first: l'app lavora su una copia locale. Offline si modificano solo
--   lo stato di una foglia (nodi.stato) e la nota dell'incarico (incarichi.nota);
--   la funzione applica_modifiche() riceve la coda e risolve i conflitti
--   "vince la modifica più recente, campo per campo" (colonne stato_il / nota_il).
--   La struttura (eventi, rami, incarichi, persone) si modifica solo online.
--
-- Ruoli applicativi:
--   admin       -> persone.ruolo = 'admin' (gestisce tutto)
--   responsabile-> persona indicata in nodi.responsabile_id: gestisce il
--                  ramo (e tutto ciò che sta sotto). Non è un ruolo globale.
--   utente      -> persone.ruolo = 'utente'; vede e aggiorna solo le foglie
--                  in cui è incaricato (più il percorso dei rami sopra).
-- =====================================================================

create schema if not exists sdm_eventi;
set search_path = sdm_eventi, public;

-- ---------------------------------------------------------------------
-- TABELLE
-- ---------------------------------------------------------------------

create table if not exists sdm_eventi.persone (
  id             uuid primary key default gen_random_uuid(),
  cognome        text not null,
  nome           text not null,
  email          text not null,
  cellulare      text,
  iscritto       boolean not null default false,
  numero_iscritto text,
  data_nascita   date,
  note           text,
  ruolo          text not null default 'utente' check (ruolo in ('admin','utente')),
  attivo         boolean not null default true,
  auth_user_id   uuid unique references auth.users(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  constraint persone_iscritto_numero check (iscritto = false or numero_iscritto is not null)
);
create unique index if not exists persone_email_uq on sdm_eventi.persone (lower(email));
create unique index if not exists persone_numero_iscritto_uq on sdm_eventi.persone (numero_iscritto)
  where numero_iscritto is not null;

create table if not exists sdm_eventi.eventi (
  id             uuid primary key default gen_random_uuid(),
  titolo         text not null,
  descrizione    text,
  luogo          text,
  data_inizio    date,
  data_fine      date,
  stato          text not null default 'in_preparazione'
                 check (stato in ('in_preparazione','attivo','concluso','archiviato')),
  creato_da      uuid references sdm_eventi.persone(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  constraint eventi_date check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);

-- Albero dei sottoargomenti. Una "foglia" è un nodo senza figli:
-- solo le foglie hanno incaricati, stato e scadenza significativi.
create table if not exists sdm_eventi.nodi (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references sdm_eventi.eventi(id) on delete cascade,
  parent_id      uuid references sdm_eventi.nodi(id) on delete cascade,
  livello        smallint not null default 1 check (livello between 1 and 10),
  percorso       uuid[] not null default '{}',     -- antenati, dalla radice al padre
  posizione      integer not null default 0,       -- ordine tra fratelli
  titolo         text not null,
  descrizione    text,
  note           text,
  scadenza       date,
  stato          text not null default 'da_fare'
                 check (stato in ('da_fare','in_corso','fatto','finito')),
  responsabile_id uuid references sdm_eventi.persone(id) on delete set null,
  creato_da      uuid references sdm_eventi.persone(id) on delete set null,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now()
);
create index if not exists nodi_evento_idx on sdm_eventi.nodi (evento_id);
create index if not exists nodi_parent_idx on sdm_eventi.nodi (parent_id, posizione);
create index if not exists nodi_percorso_idx on sdm_eventi.nodi using gin (percorso);
create index if not exists nodi_responsabile_idx on sdm_eventi.nodi (responsabile_id);

create table if not exists sdm_eventi.incarichi (
  id             uuid primary key default gen_random_uuid(),
  nodo_id        uuid not null references sdm_eventi.nodi(id) on delete cascade,
  persona_id     uuid not null references sdm_eventi.persone(id) on delete cascade,
  nota           text,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now(),
  unique (nodo_id, persona_id)
);
create index if not exists incarichi_persona_idx on sdm_eventi.incarichi (persona_id);

create table if not exists sdm_eventi.parametri (
  chiave         text primary key,
  valore         jsonb not null,
  descrizione    text,
  aggiornato_il  timestamptz not null default now()
);

-- Registro dei movimenti: una riga per ogni inserimento/modifica/eliminazione.
-- Operatore, evento e ramo sono copiati come testo, così restano leggibili
-- anche se il record originale viene poi eliminato (nessuna chiave esterna).
create table if not exists sdm_eventi.movimenti (
  id             bigint generated always as identity primary key,
  data_ora       timestamptz not null default now(),
  utente_id      uuid,                 -- utente Supabase Auth
  persona_id     uuid,                 -- operatore in anagrafica
  operatore      text not null,        -- "Cognome Nome" al momento del movimento
  tabella        text not null,        -- persone | eventi | nodi | incarichi
  record_id      uuid,
  azione         text not null check (azione in ('INSERT','UPDATE','DELETE')),
  evento_id      uuid,
  evento         text,                 -- titolo evento
  nodo_id        uuid,
  ramo           text,                 -- percorso testuale: "Logistica > Sedie"
  descrizione    text not null,        -- frase leggibile
  dettaglio      jsonb                 -- INSERT/DELETE: valori; UPDATE: {campo: {"da":..,"a":..}}
);
create index if not exists movimenti_data_idx   on sdm_eventi.movimenti (data_ora desc);
create index if not exists movimenti_evento_idx on sdm_eventi.movimenti (evento_id, data_ora desc);
create index if not exists movimenti_nodo_idx   on sdm_eventi.movimenti (nodo_id, data_ora desc);
create index if not exists movimenti_record_idx on sdm_eventi.movimenti (tabella, record_id, data_ora desc);

-- Colonne per la sincronizzazione offline (aggiunte anche a installazioni precedenti)
alter table sdm_eventi.nodi      add column if not exists stato_il timestamptz not null default now();

-- v1.4: aree dell'evento, area / check-list delle attività, sponsor
alter table sdm_eventi.eventi add column if not exists aree text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'eventi_aree_max10') then
    alter table sdm_eventi.eventi add constraint eventi_aree_max10 check (cardinality(aree) <= 10);
  end if;
end $$;
alter table sdm_eventi.eventi add column if not exists aree_colori jsonb not null default '{}'::jsonb;   -- {"<area>":"#rrggbb"}
alter table sdm_eventi.nodi add column if not exists area text;                     -- null = "Tutte"
alter table sdm_eventi.nodi add column if not exists checklist jsonb;               -- {"descrizione":"..","righe":[{"id":"..","testo":"..","qta":0}]}
alter table sdm_eventi.nodi add column if not exists checklist_esito jsonb not null default '{}'::jsonb;
                                                                                    -- {"<id riga>":{"ok":true,"qta":3,"ts":"..."}}

-- Sponsor di un'attività: tabella separata, leggibile e modificabile solo dagli amministratori
create table if not exists sdm_eventi.nodi_sponsor (
  nodo_id        uuid primary key references sdm_eventi.nodi(id) on delete cascade,
  fornitore      text,
  referente      text,
  cellulare      text,
  importo        numeric(12,2),
  aggiornato_il  timestamptz not null default now()
);
alter table sdm_eventi.incarichi add column if not exists nota_il  timestamptz not null default now();
alter table sdm_eventi.movimenti add column if not exists data_ora_dispositivo timestamptz;
alter table sdm_eventi.persone   add column if not exists informativa_ver integer not null default 0;
alter table sdm_eventi.persone   add column if not exists informativa_il  timestamptz;
-- Proprietario dell'app: l'unico a poter gestire i Parametri; è sempre un amministratore
alter table sdm_eventi.persone   add column if not exists superadmin boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'persone_superadmin_admin' and conrelid = 'sdm_eventi.persone'::regclass) then
    alter table sdm_eventi.persone add constraint persone_superadmin_admin check (not superadmin or ruolo = 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- FUNZIONI DI SUPPORTO (security definer: evitano ricorsioni nelle RLS)
-- ---------------------------------------------------------------------

create or replace function sdm_eventi.persona_corrente() returns uuid
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select id from sdm_eventi.persone where auth_user_id = auth.uid() and attivo limit 1
$$;

create or replace function sdm_eventi.is_admin() returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select exists (select 1 from sdm_eventi.persone
                 where auth_user_id = auth.uid() and ruolo = 'admin' and attivo)
$$;

create or replace function sdm_eventi.is_superadmin() returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select exists (select 1 from sdm_eventi.persone
                 where auth_user_id = auth.uid() and ruolo = 'admin' and superadmin and attivo)
$$;

-- true se l'utente è responsabile del nodo (se _incluso) o di un suo antenato
create or replace function sdm_eventi.is_responsabile_di(_nodo uuid, _incluso boolean default true) returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select exists (
    select 1
    from sdm_eventi.nodi n
    join sdm_eventi.nodi r
      on r.responsabile_id = sdm_eventi.persona_corrente()
     and ((_incluso and r.id = n.id) or r.id = any(n.percorso))
    where n.id = _nodo)
$$;

create or replace function sdm_eventi.param_bool(_chiave text) returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select coalesce((select (valore #>> '{}')::boolean from sdm_eventi.parametri where chiave = _chiave), false)
$$;

create or replace function sdm_eventi.is_incaricato_in(_nodo uuid) returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select exists (select 1 from sdm_eventi.incarichi
                 where nodo_id = _nodo and persona_id = sdm_eventi.persona_corrente())
$$;

-- Un nodo è visibile a: admin; responsabile del nodo/di un antenato;
-- antenati dei propri rami; foglie in cui si è incaricati e relativi antenati.
create or replace function sdm_eventi.puo_vedere_nodo(_nodo uuid) returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select sdm_eventi.is_admin()
      or sdm_eventi.is_responsabile_di(_nodo, true)
      or exists (select 1
                 from sdm_eventi.incarichi i
                 join sdm_eventi.nodi f on f.id = i.nodo_id
                 where i.persona_id = sdm_eventi.persona_corrente()
                   and (f.id = _nodo or _nodo = any(f.percorso)))
      or exists (select 1
                 from sdm_eventi.nodi r
                 where r.responsabile_id = sdm_eventi.persona_corrente()
                   and _nodo = any(r.percorso))
$$;

create or replace function sdm_eventi.puo_vedere_evento(_evento uuid) returns boolean
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select sdm_eventi.is_admin()
      or exists (select 1 from sdm_eventi.nodi n
                 where n.evento_id = _evento and sdm_eventi.puo_vedere_nodo(n.id))
$$;

-- Da chiamare dopo il login (supabase.rpc): collega l'utente di Supabase Auth
-- alla persona in anagrafica con la stessa mail. Restituisce l'id persona
-- oppure null se la mail non è in anagrafica (o la persona non è attiva).
create or replace function sdm_eventi.collega_utente() returns uuid
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_id uuid;
begin
  if auth.uid() is null then return null; end if;
  select id into v_id from sdm_eventi.persone where auth_user_id = auth.uid() and attivo;
  if found then return v_id; end if;
  update sdm_eventi.persone set auth_user_id = auth.uid()
   where lower(email) = v_email and auth_user_id is null and attivo
   returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- TRIGGER
-- ---------------------------------------------------------------------

create or replace function sdm_eventi.trg_aggiornato_il() returns trigger
language plpgsql as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['persone','eventi','nodi','incarichi','parametri'] loop
    execute format('drop trigger if exists z_aggiornato_il on sdm_eventi.%I', t);
    execute format('create trigger z_aggiornato_il before update on sdm_eventi.%I
                    for each row execute function sdm_eventi.trg_aggiornato_il()', t);
  end loop;
end $$;

-- PERSONE: non si può togliere l'ultimo amministratore attivo (cancellazione, declassamento,
-- disattivazione) e cambiando l'email si perde il collegamento con l'utente di accesso:
-- la persona dovrà accedere con la nuova email (il collegamento si rifà al primo accesso).
create or replace function sdm_eventi.trg_persone_controllo() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.superadmin and auth.uid() is not null and not sdm_eventi.is_superadmin() then
      raise exception 'Solo il proprietario può assegnare il ruolo di proprietario';
    end if;
    return new;
  end if;
  -- l'ultimo amministratore / proprietario attivo non si tocca
  if old.ruolo = 'admin' and old.attivo
     and (tg_op = 'DELETE' or new.ruolo <> 'admin' or not new.attivo)
     and not exists (select 1 from sdm_eventi.persone p
                     where p.id <> old.id and p.ruolo = 'admin' and p.attivo) then
    raise exception 'Deve restare almeno un amministratore attivo';
  end if;
  if old.superadmin and old.attivo
     and (tg_op = 'DELETE' or not new.superadmin or new.ruolo <> 'admin' or not new.attivo)
     and not exists (select 1 from sdm_eventi.persone p
                     where p.id <> old.id and p.superadmin and p.ruolo = 'admin' and p.attivo) then
    raise exception 'Deve restare almeno un proprietario attivo';
  end if;
  -- solo il proprietario può toccare un proprietario o cambiare il flag
  -- (sono sempre ammessi il collegamento all'accesso e la presa visione dell'informativa)
  if auth.uid() is not null and not sdm_eventi.is_superadmin() then
    if tg_op = 'DELETE' and old.superadmin then
      raise exception 'Solo il proprietario può eliminare un proprietario';
    end if;
    if tg_op = 'UPDATE' then
      if new.superadmin is distinct from old.superadmin then
        raise exception 'Solo il proprietario può assegnare o togliere il ruolo di proprietario';
      end if;
      if old.superadmin and (to_jsonb(new) - 'auth_user_id' - 'aggiornato_il' - 'informativa_ver' - 'informativa_il')
                           is distinct from (to_jsonb(old) - 'auth_user_id' - 'aggiornato_il' - 'informativa_ver' - 'informativa_il') then
        raise exception 'Solo il proprietario può modificare un proprietario';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if lower(new.email) is distinct from lower(old.email) then
    new.auth_user_id := null;
  end if;
  return new;
end $$;
drop trigger if exists a_controllo on sdm_eventi.persone;
create trigger a_controllo before insert or update or delete on sdm_eventi.persone
  for each row execute function sdm_eventi.trg_persone_controllo();

-- Momento dell'ultima modifica dei due campi modificabili offline
create or replace function sdm_eventi.trg_nodi_stato_il() returns trigger
language plpgsql as $$
begin
  if new.stato is distinct from old.stato then new.stato_il := now(); end if;
  return new;
end $$;
drop trigger if exists b_stato_il on sdm_eventi.nodi;
create trigger b_stato_il before update on sdm_eventi.nodi
  for each row execute function sdm_eventi.trg_nodi_stato_il();

create or replace function sdm_eventi.trg_incarichi_nota_il() returns trigger
language plpgsql as $$
begin
  if new.nota is distinct from old.nota then new.nota_il := now(); end if;
  return new;
end $$;
drop trigger if exists b_nota_il on sdm_eventi.incarichi;
create trigger b_nota_il before update on sdm_eventi.incarichi
  for each row execute function sdm_eventi.trg_incarichi_nota_il();

-- NODI: calcolo livello/percorso, profondità massima, anti-cicli, coerenza evento
create or replace function sdm_eventi.trg_nodi_prepara() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare
  p sdm_eventi.nodi%rowtype;
  v_max int;
  v_altezza int;
begin
  if tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id then
    -- non ricalcolo (anche nei ricalcoli a cascata dei discendenti)
    if new.evento_id is distinct from old.evento_id then
      raise exception 'L''evento di un nodo non può essere modificato';
    end if;
    return new;
  end if;

  if new.parent_id is null then
    new.livello := 1;
    new.percorso := '{}';
    if tg_op = 'UPDATE' and new.evento_id is distinct from old.evento_id then
      raise exception 'L''evento di un nodo non può essere modificato';
    end if;
  else
    select * into p from sdm_eventi.nodi where id = new.parent_id;
    if not found then raise exception 'Nodo padre inesistente'; end if;
    if tg_op = 'UPDATE' and (new.parent_id = new.id or new.id = any(p.percorso)) then
      raise exception 'Spostamento non valido: il nodo non può stare sotto sé stesso';
    end if;
    if exists (select 1 from sdm_eventi.incarichi where nodo_id = new.parent_id) then
      raise exception 'Il nodo padre ha persone incaricate: rimuovere gli incarichi prima di aggiungere sottorami';
    end if;
    if tg_op = 'UPDATE' and p.evento_id is distinct from old.evento_id then
      raise exception 'Non si può spostare un nodo in un altro evento';
    end if;
    new.evento_id := p.evento_id;
    new.livello := p.livello + 1;
    new.percorso := p.percorso || p.id;
  end if;

  select least(10, coalesce((select (valore #>> '{}')::int from sdm_eventi.parametri
                             where chiave = 'max_livelli'), 10)) into v_max;
  v_altezza := 0;
  if tg_op = 'UPDATE' then
    select coalesce(max(livello), old.livello) - old.livello into v_altezza
      from sdm_eventi.nodi where old.id = any(percorso);
  end if;
  if new.livello + v_altezza > v_max then
    raise exception 'Profondità massima dell''albero superata (max % livelli)', v_max;
  end if;

  if tg_op = 'INSERT' and new.responsabile_id is null and not sdm_eventi.is_admin() then
    new.responsabile_id := sdm_eventi.persona_corrente();
  end if;
  if tg_op = 'INSERT' and new.creato_da is null then
    new.creato_da := sdm_eventi.persona_corrente();
  end if;
  if tg_op = 'INSERT' and new.stato = 'finito' and auth.uid() is not null and not sdm_eventi.is_admin() then
    raise exception 'Lo stato "finito" è impostabile solo dall''amministratore';
  end if;
  return new;
end $$;

drop trigger if exists b_prepara on sdm_eventi.nodi;
create trigger b_prepara before insert or update on sdm_eventi.nodi
  for each row execute function sdm_eventi.trg_nodi_prepara();

-- NODI: dopo uno spostamento ricalcola livello/percorso dei discendenti
create or replace function sdm_eventi.trg_nodi_ricalcola() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
begin
  update sdm_eventi.nodi d set
    percorso = new.percorso || new.id
               || d.percorso[array_position(d.percorso, new.id) + 1 :],
    livello  = cardinality(new.percorso) + 1
               + (cardinality(d.percorso) - array_position(d.percorso, new.id)) + 1
  where new.id = any(d.percorso);
  return null;
end $$;

drop trigger if exists c_ricalcola on sdm_eventi.nodi;
create trigger c_ricalcola after update on sdm_eventi.nodi
  for each row when (old.parent_id is distinct from new.parent_id)
  execute function sdm_eventi.trg_nodi_ricalcola();

-- NODI: permessi sulle modifiche (colonne consentite per ruolo)
-- auth.uid() null = accesso diretto/service role: nessun controllo.
create or replace function sdm_eventi.trg_nodi_permessi() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if sdm_eventi.is_admin() then return new; end if;

  -- lo stato "finito" lo imposta (e lo toglie) solo l'amministratore
  if new.stato is distinct from old.stato and (new.stato = 'finito' or old.stato = 'finito') then
    raise exception 'Lo stato "finito" è impostabile solo dall''amministratore';
  end if;

  if sdm_eventi.is_responsabile_di(old.id, true) then
    if new.parent_id is distinct from old.parent_id then
      if new.parent_id is null or not sdm_eventi.is_responsabile_di(new.parent_id, true) then
        raise exception 'Puoi spostare i nodi solo all''interno dei rami di cui sei responsabile';
      end if;
    end if;
    return new;
  end if;

  if sdm_eventi.is_incaricato_in(old.id) then
    -- gli incaricati possono cambiare solo lo stato e compilare la check-list
    if (to_jsonb(new) - 'stato' - 'stato_il' - 'aggiornato_il' - 'checklist_esito')
       is distinct from (to_jsonb(old) - 'stato' - 'stato_il' - 'aggiornato_il' - 'checklist_esito') then
      raise exception 'Gli incaricati possono modificare solo lo stato e la check-list';
    end if;
    return new;
  end if;

  raise exception 'Permessi insufficienti';
end $$;

drop trigger if exists a_permessi on sdm_eventi.nodi;
create trigger a_permessi before update on sdm_eventi.nodi
  for each row execute function sdm_eventi.trg_nodi_permessi();

-- INCARICHI: solo su foglie; l'incaricato può modificare solo la propria nota
create or replace function sdm_eventi.trg_incarichi_controllo() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from sdm_eventi.nodi where parent_id = new.nodo_id) then
      raise exception 'Gli incarichi si assegnano solo alle foglie dell''albero';
    end if;
    return new;
  end if;
  -- UPDATE
  if new.nodo_id is distinct from old.nodo_id or new.persona_id is distinct from old.persona_id then
    raise exception 'Nodo e persona di un incarico non sono modificabili';
  end if;
  if auth.uid() is null or sdm_eventi.is_admin() or sdm_eventi.is_responsabile_di(old.nodo_id, true) then
    return new;
  end if;
  if old.persona_id = sdm_eventi.persona_corrente() then
    return new;     -- unica colonna modificabile: nota (le altre sono bloccate sopra)
  end if;
  raise exception 'Permessi insufficienti';
end $$;

drop trigger if exists a_controllo on sdm_eventi.incarichi;
create trigger a_controllo before insert or update on sdm_eventi.incarichi
  for each row execute function sdm_eventi.trg_incarichi_controllo();

-- MOVIMENTI: registra ogni variazione con operatore, evento, ramo e dettaglio
create or replace function sdm_eventi.percorso_testo(_nodo uuid) returns text
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select string_agg(a.titolo, ' > ' order by x.ord)
  from sdm_eventi.nodi n
  cross join lateral unnest(n.percorso || n.id) with ordinality as x(id, ord)
  join sdm_eventi.nodi a on a.id = x.id
  where n.id = _nodo
$$;

create or replace function sdm_eventi.trg_movimenti() returns trigger
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare
  r       jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o       jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_id    uuid  := (r ->> 'id')::uuid;
  v_ev    uuid;
  v_evt   text;
  v_nodo  uuid;
  v_ramo  text;
  v_etich text;
  v_tipo  text;
  v_det   jsonb;
  v_campi text;
  v_oper  text;
  v_pers  uuid := sdm_eventi.persona_corrente();
begin
  -- ricalcoli a cascata (spostamento rami, eliminazioni a cascata): niente righe in più
  if tg_table_name in ('nodi','incarichi') and tg_op <> 'INSERT' and pg_trigger_depth() > 1 then
    return null;
  end if;

  select coalesce(cognome || ' ' || nome, 'Sistema') into v_oper
    from sdm_eventi.persone where id = v_pers;
  v_oper := coalesce(v_oper, case when auth.uid() is null then 'Sistema' else 'Utente non collegato' end);

  if tg_table_name = 'persone' then
    v_tipo := 'persona'; v_etich := r ->> 'cognome' || ' ' || (r ->> 'nome');
  elsif tg_table_name = 'eventi' then
    v_tipo := 'evento'; v_etich := r ->> 'titolo';
    v_ev := v_id; v_evt := v_etich;
  elsif tg_table_name = 'nodi' then
    v_tipo := 'ramo/attività'; v_etich := r ->> 'titolo';
    v_ev := (r ->> 'evento_id')::uuid; v_nodo := v_id;
    v_ramo := sdm_eventi.percorso_testo(v_id);
    if v_ramo is null then                                   -- nodo appena eliminato
      select string_agg(a.titolo, ' > ' order by x.ord) into v_ramo
        from unnest(array(select jsonb_array_elements_text(r -> 'percorso')::uuid)) with ordinality as x(id, ord)
        join sdm_eventi.nodi a on a.id = x.id;
      v_ramo := coalesce(v_ramo || ' > ', '') || v_etich;
    end if;
  else  -- incarichi
    v_tipo := 'incarico';
    select cognome || ' ' || nome into v_etich from sdm_eventi.persone where id = (r ->> 'persona_id')::uuid;
    v_nodo := (r ->> 'nodo_id')::uuid;
    select evento_id into v_ev from sdm_eventi.nodi where id = v_nodo;
    v_ramo := sdm_eventi.percorso_testo(v_nodo);
  end if;

  if v_evt is null and v_ev is not null then
    select titolo into v_evt from sdm_eventi.eventi where id = v_ev;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('da', o2.value, 'a', n.value)),
           string_agg(n.key, ', ' order by n.key)
      into v_det, v_campi
      from jsonb_each(r) n
      join jsonb_each(o) o2 using (key)
     where n.value is distinct from o2.value
       and n.key not in ('aggiornato_il','livello','percorso','posizione','auth_user_id','stato_il','nota_il');
    if v_det is null then return null; end if;     -- nessuna variazione significativa
    if tg_table_name = 'nodi' and (o ->> 'parent_id') is distinct from (r ->> 'parent_id') then
      v_det := v_det || jsonb_build_object('ramo_precedente',
                 (select string_agg(a.titolo, ' > ' order by x.ord)
                    from unnest(array(select jsonb_array_elements_text(o -> 'percorso')::uuid) || v_id)
                         with ordinality as x(id, ord)
                    join sdm_eventi.nodi a on a.id = x.id));
    end if;
  else
    v_det := r - 'aggiornato_il' - 'creato_il' - 'auth_user_id' - 'stato_il' - 'nota_il';
  end if;

  insert into sdm_eventi.movimenti
    (utente_id, persona_id, operatore, tabella, record_id, azione,
     evento_id, evento, nodo_id, ramo, data_ora_dispositivo, descrizione, dettaglio)
  values
    (auth.uid(), v_pers, v_oper, tg_table_name, v_id, tg_op,
     v_ev, v_evt, v_nodo, v_ramo,
     nullif(current_setting('sdm_eventi.ts_dispositivo', true), '')::timestamptz,
     case tg_op when 'INSERT' then 'Inserito '
                when 'UPDATE' then 'Modificato '
                else 'Eliminato ' end
       || v_tipo || ': ' || coalesce(v_etich, '?')
       || case when tg_op = 'UPDATE' then ' (' || v_campi || ')' else '' end,
     v_det);
  return null;
end $$;

-- sostituisce il vecchio registro "log_modifiche" delle versioni precedenti dello script
do $$
declare t text;
begin
  foreach t in array array['persone','eventi','nodi','incarichi'] loop
    execute format('drop trigger if exists z_log on sdm_eventi.%I', t);
    execute format('drop trigger if exists z_movimenti on sdm_eventi.%I', t);
    execute format('create trigger z_movimenti after insert or update or delete on sdm_eventi.%I
                    for each row execute function sdm_eventi.trg_movimenti()', t);
  end loop;
end $$;
drop function if exists sdm_eventi.trg_log();
drop table if exists sdm_eventi.log_modifiche;

-- SINCRONIZZAZIONE OFFLINE
-- Riceve la coda delle modifiche fatte offline:
--   [{"op_id":"...","tipo":"nodo_stato","id":"<uuid>","valore":"fatto","ts":"<ora sul dispositivo>"},
--    {"op_id":"...","tipo":"incarico_nota","id":"<uuid>","valore":"testo","ts":"..."}]
-- Gira con i diritti di chi la chiama (RLS e trigger valgono come online).
-- Per ogni operazione restituisce {op_id, esito, motivo}:
--   ok         applicata
--   superata   un altro ha modificato lo stesso campo dopo l'ora indicata (vince il più recente)
--   rifiutata  non permessa o record non più esistente/accessibile
create or replace function sdm_eventi.applica_modifiche(_ops jsonb) returns jsonb
language plpgsql set search_path = sdm_eventi, public, pg_temp as $$
declare
  op      jsonb;
  res     jsonb := '[]'::jsonb;
  v_ts    timestamptz;
  v_cur   timestamptz;
  v_n     int;
  v_esito text;
  v_mot   text;
  v_es    jsonb;
begin
  for op in select value from jsonb_array_elements(_ops) with ordinality as t(value, n)
            order by (value ->> 'ts')::timestamptz nulls last, n
  loop
    v_esito := 'ok'; v_mot := null;
    begin
      v_ts := least(coalesce((op ->> 'ts')::timestamptz, now()), now());
      perform set_config('sdm_eventi.ts_dispositivo', v_ts::text, true);
      if op ->> 'tipo' = 'nodo_stato' then
        select stato_il into v_cur from sdm_eventi.nodi where id = (op ->> 'id')::uuid;
        if not found then
          v_esito := 'rifiutata'; v_mot := 'Attività non trovata, eliminata o non più accessibile';
        elsif v_cur > v_ts then
          v_esito := 'superata'; v_mot := 'Lo stato è stato modificato da altri dopo la tua modifica';
        else
          update sdm_eventi.nodi set stato = op ->> 'valore' where id = (op ->> 'id')::uuid;
          get diagnostics v_n = row_count;
          if v_n = 0 then v_esito := 'rifiutata'; v_mot := 'Modifica non permessa'; end if;
        end if;
      elsif op ->> 'tipo' = 'incarico_nota' then
        select nota_il into v_cur from sdm_eventi.incarichi where id = (op ->> 'id')::uuid;
        if not found then
          v_esito := 'rifiutata'; v_mot := 'Incarico non trovato, rimosso o non più accessibile';
        elsif v_cur > v_ts then
          v_esito := 'superata'; v_mot := 'La nota è stata modificata da altri dopo la tua modifica';
        else
          update sdm_eventi.incarichi set nota = op ->> 'valore' where id = (op ->> 'id')::uuid;
          get diagnostics v_n = row_count;
          if v_n = 0 then v_esito := 'rifiutata'; v_mot := 'Modifica non permessa'; end if;
        end if;
      elsif op ->> 'tipo' = 'nodo_check' then
        -- una riga della check-list: vince la modifica più recente, riga per riga
        select checklist_esito into v_es from sdm_eventi.nodi where id = (op ->> 'id')::uuid;
        if not found then
          v_esito := 'rifiutata'; v_mot := 'Attività non trovata, eliminata o non più accessibile';
        elsif nullif(v_es -> (op ->> 'sub') ->> 'ts', '')::timestamptz > v_ts then
          v_esito := 'superata'; v_mot := 'La riga della check-list è stata modificata da altri dopo la tua modifica';
        else
          update sdm_eventi.nodi set checklist_esito = jsonb_set(coalesce(checklist_esito, '{}'::jsonb), array[op ->> 'sub'],
                 jsonb_build_object('ok', coalesce((op -> 'valore' ->> 'ok')::boolean, false), 'qta', op -> 'valore' -> 'qta', 'ts', v_ts))
           where id = (op ->> 'id')::uuid;
          get diagnostics v_n = row_count;
          if v_n = 0 then v_esito := 'rifiutata'; v_mot := 'Modifica non permessa'; end if;
        end if;
      else
        v_esito := 'rifiutata'; v_mot := 'Tipo di modifica non ammesso offline';
      end if;
    exception when others then
      v_esito := 'rifiutata'; v_mot := sqlerrm;
    end;
    res := res || jsonb_build_object('op_id', op ->> 'op_id', 'esito', v_esito, 'motivo', v_mot);
  end loop;
  perform set_config('sdm_eventi.ts_dispositivo', '', true);
  return res;
end $$;

-- STRUTTURA: sposta o riordina un nodo in un'unica operazione.
-- _padre null = primo livello; _indice = posizione tra i fratelli (0 = primo).
-- Gira con i diritti di chi la chiama: RLS e trigger (permessi, cicli, profondità massima,
-- foglie con incaricati) valgono come per le modifiche dirette.
create or replace function sdm_eventi.sposta_nodo(_nodo uuid, _padre uuid, _indice integer)
returns void
language plpgsql set search_path = sdm_eventi, public, pg_temp as $$
declare
  v_ev  uuid;
  r     record;
  i     integer := 0;
  messo boolean := false;
begin
  select evento_id into v_ev from sdm_eventi.nodi where id = _nodo;
  if not found then raise exception 'Elemento non trovato o non più accessibile'; end if;
  if _padre is not null and not exists (select 1 from sdm_eventi.nodi where id = _padre and evento_id = v_ev) then
    raise exception 'Destinazione non valida';
  end if;
  update sdm_eventi.nodi set parent_id = _padre where id = _nodo and parent_id is distinct from _padre;
  for r in select id from sdm_eventi.nodi
           where evento_id = v_ev and parent_id is not distinct from _padre and id <> _nodo
           order by posizione, creato_il, id
  loop
    if i = greatest(_indice, 0) and not messo then
      update sdm_eventi.nodi set posizione = i where id = _nodo; messo := true; i := i + 1;
    end if;
    update sdm_eventi.nodi set posizione = i where id = r.id and posizione <> i;
    i := i + 1;
  end loop;
  if not messo then update sdm_eventi.nodi set posizione = i where id = _nodo; end if;
end $$;

-- DUPLICA EVENTO (solo admin): copia titolo/date nuovi, rami, descrizioni, note, scadenze
-- (spostate in base alla nuova data di inizio se richiesto). Gli stati ripartono da "da fare".
-- Responsabili e incaricati si copiano solo su richiesta; le note degli incaricati non si copiano.
-- Aree, area e check-list (senza gli esiti) si copiano; gli sponsor no.
create or replace function sdm_eventi.duplica_evento(
  _evento uuid, _titolo text, _data_inizio date, _data_fine date,
  _copia_incaricati boolean default false, _sposta_scadenze boolean default true, _copia_responsabili boolean default true)
returns uuid
language plpgsql set search_path = sdm_eventi, public, pg_temp as $$
declare
  v_old   sdm_eventi.eventi%rowtype;
  v_new   uuid;
  v_nid   uuid;
  v_delta integer := 0;
  r       record;
begin
  if not sdm_eventi.is_admin() then raise exception 'Solo l''amministratore può duplicare un evento'; end if;
  select * into v_old from sdm_eventi.eventi where id = _evento;
  if not found then raise exception 'Evento non trovato'; end if;
  if coalesce(trim(_titolo), '') = '' then raise exception 'Il titolo è obbligatorio'; end if;
  if v_old.data_inizio is not null and _data_inizio is not null then v_delta := _data_inizio - v_old.data_inizio; end if;
  insert into sdm_eventi.eventi (titolo, descrizione, luogo, data_inizio, data_fine, aree, aree_colori, creato_da)
  values (trim(_titolo), v_old.descrizione, v_old.luogo, _data_inizio, _data_fine, v_old.aree, v_old.aree_colori, sdm_eventi.persona_corrente())
  returning id into v_new;
  drop table if exists pg_temp._dup_map;
  create temp table _dup_map (old_id uuid primary key, new_id uuid) on commit drop;
  for r in select * from sdm_eventi.nodi where evento_id = _evento order by livello, posizione, creato_il loop
    insert into sdm_eventi.nodi (evento_id, parent_id, titolo, descrizione, note, scadenza, stato, posizione, responsabile_id, area, checklist)
    values (v_new, (select new_id from _dup_map where old_id = r.parent_id), r.titolo, r.descrizione, r.note,
            case when r.scadenza is null then null when _sposta_scadenze then r.scadenza + v_delta else r.scadenza end,
            'da_fare', r.posizione, case when _copia_responsabili then r.responsabile_id end, r.area, r.checklist)
    returning id into v_nid;
    insert into _dup_map values (r.id, v_nid);
  end loop;
  if _copia_incaricati then
    insert into sdm_eventi.incarichi (nodo_id, persona_id)
    select m.new_id, i.persona_id from sdm_eventi.incarichi i join _dup_map m on m.old_id = i.nodo_id;
  end if;
  return v_new;
end $$;

-- IMPORTA PERSONE da Excel (solo admin): inserisce le nuove e, su richiesta, aggiorna quelle con la
-- stessa email. Tutto in un'unica transazione: se una riga non è valida non viene importato nulla.
create or replace function sdm_eventi.importa_persone(_righe jsonb, _aggiorna boolean default true)
returns jsonb
language plpgsql set search_path = sdm_eventi, public, pg_temp as $$
declare
  r jsonb; v_id uuid; v_isc boolean;
  n_nuove integer := 0; n_agg integer := 0; n_salt integer := 0;
begin
  if not sdm_eventi.is_admin() then raise exception 'Solo l''amministratore può importare persone'; end if;
  for r in select value from jsonb_array_elements(_righe) loop
    select id into v_id from sdm_eventi.persone where lower(email) = lower(r ->> 'email');
    v_isc := coalesce((r ->> 'iscritto')::boolean, false);
    if v_id is null then
      insert into sdm_eventi.persone (cognome, nome, email, cellulare, iscritto, numero_iscritto, data_nascita, note, ruolo, attivo)
      values (r ->> 'cognome', r ->> 'nome', lower(r ->> 'email'), nullif(r ->> 'cellulare', ''), v_isc,
              case when v_isc then nullif(r ->> 'numero_iscritto', '') end, nullif(r ->> 'data_nascita', '')::date,
              nullif(r ->> 'note', ''), coalesce(nullif(r ->> 'ruolo', ''), 'utente'), coalesce((r ->> 'attivo')::boolean, true));
      n_nuove := n_nuove + 1;
    elsif _aggiorna then
      update sdm_eventi.persone set
        cognome = r ->> 'cognome', nome = r ->> 'nome',
        cellulare = coalesce(nullif(r ->> 'cellulare', ''), cellulare),
        iscritto = case when r ? 'iscritto' then v_isc else iscritto end,
        numero_iscritto = case when (case when r ? 'iscritto' then v_isc else iscritto end)
                               then coalesce(nullif(r ->> 'numero_iscritto', ''), numero_iscritto) end,
        data_nascita = coalesce(nullif(r ->> 'data_nascita', '')::date, data_nascita),
        note = coalesce(nullif(r ->> 'note', ''), note),
        ruolo = coalesce(nullif(r ->> 'ruolo', ''), ruolo),
        attivo = case when r ? 'attivo' then (r ->> 'attivo')::boolean else attivo end
      where id = v_id;
      n_agg := n_agg + 1;
    else
      n_salt := n_salt + 1;
    end if;
  end loop;
  return jsonb_build_object('nuove', n_nuove, 'aggiornate', n_agg, 'saltate', n_salt);
end $$;

-- IMPORTA STRUTTURA da Excel (solo admin) in un evento: il piano è calcolato dall'app dopo
-- l'anteprima. {"creazioni":[{k,parent_id,parent_k,titolo,descrizione,note,scadenza,stato,
-- responsabile_id,posizione}], "aggiornamenti":[{id,descrizione,note,scadenza,responsabile_id}],
-- "incarichi":[{nodo_id,nodo_k,persona_id}]}. Un'unica transazione: tutto o niente.
create or replace function sdm_eventi.importa_struttura(_evento uuid, _piano jsonb)
returns jsonb
language plpgsql set search_path = sdm_eventi, public, pg_temp as $$
declare
  c jsonb; v_id uuid; v_nodo uuid;
  n_cre integer := 0; n_agg integer := 0; n_inc integer := 0;
begin
  if not sdm_eventi.is_admin() then raise exception 'Solo l''amministratore può importare la struttura'; end if;
  if not exists (select 1 from sdm_eventi.eventi where id = _evento) then raise exception 'Evento non trovato'; end if;
  drop table if exists pg_temp._imp_map;
  create temp table _imp_map (k text primary key, id uuid) on commit drop;
  for c in select value from jsonb_array_elements(coalesce(_piano -> 'creazioni', '[]'::jsonb)) loop
    insert into sdm_eventi.nodi (evento_id, parent_id, titolo, descrizione, note, scadenza, stato, responsabile_id, posizione)
    values (_evento,
            coalesce(nullif(c ->> 'parent_id', '')::uuid, (select m.id from _imp_map m where m.k = c ->> 'parent_k')),
            c ->> 'titolo', nullif(c ->> 'descrizione', ''), nullif(c ->> 'note', ''), nullif(c ->> 'scadenza', '')::date,
            coalesce(nullif(c ->> 'stato', ''), 'da_fare'), nullif(c ->> 'responsabile_id', '')::uuid,
            coalesce((c ->> 'posizione')::integer, 0))
    returning id into v_id;
    insert into _imp_map values (c ->> 'k', v_id);
    n_cre := n_cre + 1;
  end loop;
  for c in select value from jsonb_array_elements(coalesce(_piano -> 'aggiornamenti', '[]'::jsonb)) loop
    update sdm_eventi.nodi set
      descrizione = coalesce(nullif(c ->> 'descrizione', ''), descrizione),
      note = coalesce(nullif(c ->> 'note', ''), note),
      scadenza = coalesce(nullif(c ->> 'scadenza', '')::date, scadenza),
      responsabile_id = coalesce(nullif(c ->> 'responsabile_id', '')::uuid, responsabile_id)
    where id = (c ->> 'id')::uuid and evento_id = _evento;
    n_agg := n_agg + 1;
  end loop;
  for c in select value from jsonb_array_elements(coalesce(_piano -> 'incarichi', '[]'::jsonb)) loop
    v_nodo := coalesce(nullif(c ->> 'nodo_id', '')::uuid, (select m.id from _imp_map m where m.k = c ->> 'nodo_k'));
    insert into sdm_eventi.incarichi (nodo_id, persona_id) values (v_nodo, (c ->> 'persona_id')::uuid)
    on conflict (nodo_id, persona_id) do nothing;
    n_inc := n_inc + 1;
  end loop;
  return jsonb_build_object('creati', n_cre, 'aggiornati', n_agg, 'incarichi', n_inc);
end $$;

-- NUMERAZIONE gerarchica (01, 01.01, 01.01.01 ...): derivata dall'ordine dei fratelli, quindi
-- si aggiorna da sola quando si spostano, riordinano, aggiungono o eliminano rami e attività.
-- Calcolata sull'albero completo dell'evento, così ogni utente vede lo stesso numero
-- anche se per lui sono visibili solo alcuni rami.
create or replace function sdm_eventi.numerazione(_evento uuid)
returns table (nodo_id uuid, numero text)
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  with recursive t as (
    select n.id, n.parent_id,
           row_number() over (partition by n.parent_id order by n.posizione, n.creato_il, n.id) as rn
    from sdm_eventi.nodi n where n.evento_id = _evento
  ), r as (
    select t.id, lpad(t.rn::text, 2, '0') as num from t where t.parent_id is null
    union all
    select t.id, r.num || '.' || lpad(t.rn::text, 2, '0') from t join r on t.parent_id = r.id
  )
  select r.id, r.num from r where sdm_eventi.puo_vedere_nodo(r.id)
$$;

-- =====================================================================
-- PRIVACY / GDPR
-- =====================================================================

-- Informativa pubblica (leggibile anche prima dell'accesso, per il link nella pagina di login)
create or replace function sdm_eventi.informativa_pubblica() returns jsonb
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select jsonb_build_object(
    'url',      coalesce((select valore #>> '{}' from sdm_eventi.parametri where chiave = 'privacy_url'), ''),
    'testo',    coalesce((select valore #>> '{}' from sdm_eventi.parametri where chiave = 'privacy_testo'), ''),
    'versione', coalesce((select (valore #>> '{}')::int from sdm_eventi.parametri where chiave = 'informativa_versione'), 1))
$$;

-- Presa visione dell'informativa da parte dell'utente collegato
create or replace function sdm_eventi.registra_presa_visione(_versione integer) returns void
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare v_id uuid := sdm_eventi.persona_corrente();
begin
  if v_id is null then raise exception 'Utente non collegato all''anagrafica'; end if;
  update sdm_eventi.persone set informativa_ver = greatest(informativa_ver, _versione), informativa_il = now() where id = v_id;
end $$;

-- Diritto di accesso/portabilità: tutti i dati di una persona (admin: chiunque; gli altri: solo i propri)
create or replace function sdm_eventi.dati_persona(_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
declare v_id uuid := coalesce(_id, sdm_eventi.persona_corrente());
begin
  if v_id is null then raise exception 'Persona non indicata'; end if;
  if not (sdm_eventi.is_admin() or v_id = sdm_eventi.persona_corrente()) then raise exception 'Permessi insufficienti'; end if;
  return jsonb_build_object(
    'anagrafica', (select to_jsonb(p) - 'auth_user_id' - 'id' from sdm_eventi.persone p where p.id = v_id),
    'incarichi', coalesce((select jsonb_agg(jsonb_build_object('evento', e.titolo, 'percorso', sdm_eventi.percorso_testo(n.id),
                  'stato', n.stato, 'scadenza', n.scadenza, 'nota', i.nota) order by e.titolo)
                  from sdm_eventi.incarichi i join sdm_eventi.nodi n on n.id = i.nodo_id join sdm_eventi.eventi e on e.id = n.evento_id
                  where i.persona_id = v_id), '[]'::jsonb),
    'responsabile_di', coalesce((select jsonb_agg(jsonb_build_object('evento', e.titolo, 'percorso', sdm_eventi.percorso_testo(n.id)) order by e.titolo)
                  from sdm_eventi.nodi n join sdm_eventi.eventi e on e.id = n.evento_id where n.responsabile_id = v_id), '[]'::jsonb),
    'movimenti', coalesce((select jsonb_agg(jsonb_build_object('data', m.data_ora, 'tabella', m.tabella, 'azione', m.azione,
                  'evento', m.evento, 'ramo', m.ramo, 'descrizione', m.descrizione) order by m.data_ora desc)
                  from (select * from sdm_eventi.movimenti where persona_id = v_id order by data_ora desc limit 1000) m), '[]'::jsonb));
end $$;

-- Diritto alla cancellazione (solo admin): elimina la persona, il suo utente di accesso e rende
-- anonimi i movimenti che la riguardano. Non si può eliminare sé stessi né l'ultimo admin.
create or replace function sdm_eventi.elimina_persona(_id uuid) returns jsonb
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare
  v_p    sdm_eventi.persone%rowtype;
  v_inc  uuid[];
  n_mov  integer := 0;
  n_x    integer;
begin
  if not sdm_eventi.is_admin() then raise exception 'Solo l''amministratore può eliminare una persona'; end if;
  select * into v_p from sdm_eventi.persone where id = _id;
  if not found then raise exception 'Persona non trovata'; end if;
  if _id = sdm_eventi.persona_corrente() then raise exception 'Non puoi eliminare te stesso'; end if;
  select coalesce(array_agg(x), '{}') into v_inc from (
    select id as x from sdm_eventi.incarichi where persona_id = _id
    union
    select record_id from sdm_eventi.movimenti where tabella = 'incarichi' and dettaglio ->> 'persona_id' = _id::text) t;
  delete from sdm_eventi.persone where id = _id;       -- (il trigger impedisce di togliere l'ultimo admin)
  -- anonimizza il registro dei movimenti
  update sdm_eventi.movimenti set operatore = 'Utente eliminato', persona_id = null, utente_id = null
   where persona_id = _id or (v_p.auth_user_id is not null and utente_id = v_p.auth_user_id);
  get diagnostics n_x = row_count; n_mov := n_mov + n_x;
  update sdm_eventi.movimenti set descrizione = 'Persona eliminata', dettaglio = null
   where tabella = 'persone' and record_id = _id;
  get diagnostics n_x = row_count; n_mov := n_mov + n_x;
  update sdm_eventi.movimenti set
      descrizione = case azione when 'INSERT' then 'Inserito incarico: (persona eliminata)'
                                when 'UPDATE' then 'Modificato incarico: (persona eliminata)'
                                else 'Eliminato incarico: (persona eliminata)' end,
      dettaglio = case when jsonb_typeof(dettaglio) = 'object' then dettaglio - 'persona_id' - 'nota' else null end
   where tabella = 'incarichi' and record_id = any(v_inc);
  get diagnostics n_x = row_count; n_mov := n_mov + n_x;
  -- elimina l'utente di accesso (se il database lo consente) e le richieste di accesso con quella email
  begin
    delete from auth.users where id = v_p.auth_user_id or lower(email) = lower(v_p.email);
  exception when others then
    raise warning 'Utente di accesso non eliminato: %', sqlerrm;
  end;
  return jsonb_build_object('movimenti_anonimizzati', n_mov);
end $$;

-- Conservazione: elimina i movimenti più vecchi di N mesi (parametro conservazione_movimenti_mesi, 0 = mai)
create or replace function sdm_eventi.pulisci_movimenti() returns integer
language plpgsql security definer set search_path = sdm_eventi, public, pg_temp as $$
declare v_mesi integer; n integer;
begin
  if auth.uid() is not null and not sdm_eventi.is_superadmin() then raise exception 'Solo il proprietario'; end if;
  select coalesce((valore #>> '{}')::int, 0) into v_mesi from sdm_eventi.parametri where chiave = 'conservazione_movimenti_mesi';
  if coalesce(v_mesi, 0) <= 0 then return 0; end if;
  delete from sdm_eventi.movimenti where data_ora < now() - make_interval(months => v_mesi);
  get diagnostics n = row_count;
  return n;
end $$;

-- Disconnette gli utenti (revoca le sessioni di accesso). L'amministratore che la usa resta collegato,
-- salvo _anche_io = true. Serve, ad esempio, quando si riattiva il codice OTP dopo un periodo senza.
create or replace function sdm_eventi.disconnetti_tutti(_anche_io boolean default false) returns integer
language plpgsql security definer set search_path = sdm_eventi, public, auth, pg_temp as $$
declare n integer; v_sess uuid;
begin
  if not sdm_eventi.is_superadmin() then raise exception 'Solo il proprietario può disconnettere gli utenti'; end if;
  begin v_sess := nullif(auth.jwt() ->> 'session_id', '')::uuid; exception when others then v_sess := null; end;
  if v_sess is null and not _anche_io then raise exception 'Impossibile identificare la sessione corrente: riprova dopo aver rifatto l''accesso'; end if;
  delete from auth.sessions where _anche_io or id <> v_sess;
  get diagnostics n = row_count;
  return n;
end $$;

-- Ora del server: l'app la usa per correggere lo scarto dell'orologio del dispositivo
create or replace function sdm_eventi.ora_server() returns timestamptz
language sql stable as $$ select now() $$;

-- Aggiornamenti in tempo reale (Supabase Realtime), se la publication esiste
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['eventi','nodi','incarichi','parametri'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'sdm_eventi' and tablename = t) then
        execute format('alter publication supabase_realtime add table sdm_eventi.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table sdm_eventi.persone      enable row level security;
alter table sdm_eventi.eventi       enable row level security;
alter table sdm_eventi.nodi         enable row level security;
alter table sdm_eventi.incarichi    enable row level security;
alter table sdm_eventi.parametri    enable row level security;
alter table sdm_eventi.nodi_sponsor enable row level security;
alter table sdm_eventi.movimenti    enable row level security;

-- PERSONE: anagrafica completa solo all'admin (e la propria scheda in lettura).
-- Gli altri vedono nome e cognome dei colleghi tramite la funzione persone_evento().
drop policy if exists persone_select on sdm_eventi.persone;
create policy persone_select on sdm_eventi.persone for select to authenticated
  using (sdm_eventi.is_admin() or auth_user_id = auth.uid());
drop policy if exists persone_insert on sdm_eventi.persone;
create policy persone_insert on sdm_eventi.persone for insert to authenticated
  with check (sdm_eventi.is_admin());
drop policy if exists persone_update on sdm_eventi.persone;
create policy persone_update on sdm_eventi.persone for update to authenticated
  using (sdm_eventi.is_admin()) with check (sdm_eventi.is_admin());
drop policy if exists persone_delete on sdm_eventi.persone;
create policy persone_delete on sdm_eventi.persone for delete to authenticated
  using (sdm_eventi.is_admin());

-- EVENTI: li gestisce solo l'admin; gli altri vedono quelli in cui hanno nodi visibili
drop policy if exists eventi_select on sdm_eventi.eventi;
create policy eventi_select on sdm_eventi.eventi for select to authenticated
  using (sdm_eventi.puo_vedere_evento(id));
drop policy if exists eventi_insert on sdm_eventi.eventi;
create policy eventi_insert on sdm_eventi.eventi for insert to authenticated
  with check (sdm_eventi.is_admin());
drop policy if exists eventi_update on sdm_eventi.eventi;
create policy eventi_update on sdm_eventi.eventi for update to authenticated
  using (sdm_eventi.is_admin()) with check (sdm_eventi.is_admin());
drop policy if exists eventi_delete on sdm_eventi.eventi;
create policy eventi_delete on sdm_eventi.eventi for delete to authenticated
  using (sdm_eventi.is_admin());

-- NODI
drop policy if exists nodi_select on sdm_eventi.nodi;
create policy nodi_select on sdm_eventi.nodi for select to authenticated
  using (sdm_eventi.puo_vedere_nodo(id));
drop policy if exists nodi_insert on sdm_eventi.nodi;
create policy nodi_insert on sdm_eventi.nodi for insert to authenticated
  with check (sdm_eventi.is_admin()
              or (parent_id is not null
                  and sdm_eventi.param_bool('responsabile_crea_rami')
                  and sdm_eventi.is_responsabile_di(parent_id, true)));
drop policy if exists nodi_update on sdm_eventi.nodi;
create policy nodi_update on sdm_eventi.nodi for update to authenticated
  using (sdm_eventi.is_admin() or sdm_eventi.is_responsabile_di(id, true) or sdm_eventi.is_incaricato_in(id))
  with check (true);   -- il dettaglio dei permessi è nel trigger a_permessi
drop policy if exists nodi_delete on sdm_eventi.nodi;
create policy nodi_delete on sdm_eventi.nodi for delete to authenticated
  using (sdm_eventi.is_admin() or sdm_eventi.is_responsabile_di(id, false));

-- INCARICHI
drop policy if exists incarichi_select on sdm_eventi.incarichi;
create policy incarichi_select on sdm_eventi.incarichi for select to authenticated
  using (sdm_eventi.is_admin()
         or persona_id = sdm_eventi.persona_corrente()
         or sdm_eventi.is_responsabile_di(nodo_id, true)
         or sdm_eventi.is_incaricato_in(nodo_id));
drop policy if exists incarichi_insert on sdm_eventi.incarichi;
create policy incarichi_insert on sdm_eventi.incarichi for insert to authenticated
  with check (sdm_eventi.is_admin() or sdm_eventi.is_responsabile_di(nodo_id, true));
drop policy if exists incarichi_update on sdm_eventi.incarichi;
create policy incarichi_update on sdm_eventi.incarichi for update to authenticated
  using (sdm_eventi.is_admin()
         or sdm_eventi.is_responsabile_di(nodo_id, true)
         or persona_id = sdm_eventi.persona_corrente())
  with check (true);
drop policy if exists incarichi_delete on sdm_eventi.incarichi;
create policy incarichi_delete on sdm_eventi.incarichi for delete to authenticated
  using (sdm_eventi.is_admin() or sdm_eventi.is_responsabile_di(nodo_id, true));

-- SPONSOR delle attività: dati economici e contatti, solo amministratori
drop policy if exists sponsor_admin on sdm_eventi.nodi_sponsor;
create policy sponsor_admin on sdm_eventi.nodi_sponsor for all to authenticated
  using (sdm_eventi.is_admin()) with check (sdm_eventi.is_admin());

-- PARAMETRI: lettura per tutti gli utenti autenticati (es. tema), scrittura solo admin
drop policy if exists parametri_select on sdm_eventi.parametri;
create policy parametri_select on sdm_eventi.parametri for select to authenticated using (true);
drop policy if exists parametri_write on sdm_eventi.parametri;
create policy parametri_write on sdm_eventi.parametri for all to authenticated
  using (sdm_eventi.is_superadmin()) with check (sdm_eventi.is_superadmin());

-- MOVIMENTI: lettura per admin e, per il proprio ramo, per i responsabili;
-- le scritture avvengono solo dal trigger
drop policy if exists log_select on sdm_eventi.movimenti;
drop policy if exists movimenti_select on sdm_eventi.movimenti;
create policy movimenti_select on sdm_eventi.movimenti for select to authenticated
  using (sdm_eventi.is_admin()
         or (nodo_id is not null and sdm_eventi.is_responsabile_di(nodo_id, true)));

-- ---------------------------------------------------------------------
-- VISTE
-- ---------------------------------------------------------------------

-- Persone visibili nella pagina "Persone" (solo cognome e nome) per l'evento scelto.
-- Admin: tutte le persone attive. Gli altri: sé stessi, gli incaricati delle foglie
-- che possono vedere e i responsabili dei rami che possono vedere, in quell'evento.
create or replace function sdm_eventi.persone_evento(_evento uuid)
returns table (id uuid, cognome text, nome text)
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select p.id, p.cognome, p.nome
  from sdm_eventi.persone p
  where p.attivo
    and ( sdm_eventi.is_admin()
       or p.id = sdm_eventi.persona_corrente()
       or exists (select 1 from sdm_eventi.incarichi i
                  join sdm_eventi.nodi n on n.id = i.nodo_id
                  where i.persona_id = p.id and n.evento_id = _evento
                    and sdm_eventi.puo_vedere_nodo(n.id))
       or exists (select 1 from sdm_eventi.nodi n
                  where n.responsabile_id = p.id and n.evento_id = _evento
                    and sdm_eventi.puo_vedere_nodo(n.id)) )
  order by p.cognome, p.nome
$$;

-- Persone tra cui scegliere quando si assegna un incarico o un responsabile:
-- admin e responsabili di almeno un ramo vedono tutti i nomi, gli altri nessuno.
create or replace function sdm_eventi.persone_assegnabili()
returns table (id uuid, cognome text, nome text)
language sql stable security definer set search_path = sdm_eventi, public, pg_temp as $$
  select p.id, p.cognome, p.nome
  from sdm_eventi.persone p
  where p.attivo
    and ( sdm_eventi.is_admin()
       or exists (select 1 from sdm_eventi.nodi r
                  where r.responsabile_id = sdm_eventi.persona_corrente()) )
  order by p.cognome, p.nome
$$;
drop view if exists sdm_eventi.v_persone_elenco;

-- Movimenti con data e ora separate (fuso orario italiano), più recenti per primi
create or replace view sdm_eventi.v_movimenti with (security_invoker = true) as
  select id,
         (data_ora at time zone 'Europe/Rome')::date as data,
         (data_ora at time zone 'Europe/Rome')::time(0) as ora,
         operatore, evento, ramo, azione, tabella, descrizione, dettaglio,
         evento_id, nodo_id, persona_id, data_ora, data_ora_dispositivo
  from sdm_eventi.movimenti
  order by data_ora desc, id desc;

-- Avanzamento per nodo: foglie totali e completate ("finito")
create or replace view sdm_eventi.v_avanzamento_nodi with (security_invoker = true) as
  select n.id as nodo_id, n.evento_id,
         count(f.id)                                    as foglie_totali,
         count(f.id) filter (where f.stato = 'finito')  as foglie_finite,
         round(100.0 * count(f.id) filter (where f.stato = 'finito')
               / nullif(count(f.id), 0), 1)             as percentuale
  from sdm_eventi.nodi n
  join sdm_eventi.nodi f on (f.id = n.id or n.id = any(f.percorso))
  where not exists (select 1 from sdm_eventi.nodi c where c.parent_id = f.id)
  group by n.id, n.evento_id;

-- Avanzamento per evento
create or replace view sdm_eventi.v_avanzamento_eventi with (security_invoker = true) as
  select f.evento_id,
         count(*)                                    as foglie_totali,
         count(*) filter (where f.stato = 'finito')  as foglie_finite,
         round(100.0 * count(*) filter (where f.stato = 'finito')
               / nullif(count(*), 0), 1)             as percentuale
  from sdm_eventi.nodi f
  where not exists (select 1 from sdm_eventi.nodi c where c.parent_id = f.id)
  group by f.evento_id;

-- ---------------------------------------------------------------------
-- PERMESSI (GRANT)
-- ---------------------------------------------------------------------

revoke all on schema sdm_eventi from public, anon;
grant usage on schema sdm_eventi to authenticated, service_role;

grant select, insert, update, delete on sdm_eventi.persone, sdm_eventi.eventi, sdm_eventi.nodi,
      sdm_eventi.incarichi, sdm_eventi.parametri, sdm_eventi.nodi_sponsor to authenticated;
grant select on sdm_eventi.movimenti to authenticated;
grant select on sdm_eventi.v_movimenti, sdm_eventi.v_avanzamento_nodi,
      sdm_eventi.v_avanzamento_eventi to authenticated;
grant all on all tables in schema sdm_eventi to service_role;
grant usage, select on all sequences in schema sdm_eventi to authenticated, service_role;
revoke execute on all functions in schema sdm_eventi from public, anon;
grant execute on all functions in schema sdm_eventi to authenticated, service_role;
grant usage on schema sdm_eventi to anon;
grant execute on function sdm_eventi.informativa_pubblica() to anon;

-- ---------------------------------------------------------------------
-- DATI INIZIALI
-- ---------------------------------------------------------------------

insert into sdm_eventi.parametri (chiave, valore, descrizione) values
  ('nome_app',                 '"SDM Eventi"',  'Nome mostrato nell''applicazione'),
  ('tema',                     '"chiaro"',      'Tema grafico: chiaro | scuro'),
  ('colore_primario',          '"#1d4ed8"',     'Colore principale dell''interfaccia'),
  ('max_livelli',              '10',            'Livelli massimi dell''albero (da 1 a 10)'),
  ('giorni_preavviso_scadenza','7',             'Giorni prima della scadenza per evidenziare una foglia'),
  ('responsabile_crea_rami',   'false',         'Se true i responsabili possono creare sottorami nel proprio ramo (altrimenti solo l''admin)'),
  ('privacy_url',              '""',            'Indirizzo dell''informativa privacy (facoltativo)'),
  ('privacy_testo',            '""',            'Testo dell''informativa privacy mostrato nell''app'),
  ('otp_obbligatorio',         'true',          'Se false le persone (non admin) entrano con la sola email, senza codice OTP (serve la funzione accesso-email)'),
  ('informativa_versione',     '1',             'Versione dell''informativa: cambiandola gli utenti devono rileggerla'),
  ('informativa_obbligatoria', 'false',         'Se true chiede la presa visione dell''informativa al primo accesso'),
  ('conservazione_movimenti_mesi', '24',        'Mesi di conservazione del registro dei movimenti (0 = senza limite)')
on conflict (chiave) do nothing;

-- Primo amministratore.
-- Al primo login con questa mail l'utente viene collegato (rpc collega_utente).
insert into sdm_eventi.persone (cognome, nome, email, ruolo)
values ('Taffarel', 'Ivo', 'ivotaffarel@gmail.com', 'admin')
on conflict ((lower(email))) do nothing;

-- Proprietario dell'app: se non ce n'è uno, lo diventa il primo amministratore (Ivo Taffarel)
update sdm_eventi.persone set superadmin = true
 where lower(email) = 'ivotaffarel@gmail.com' and ruolo = 'admin'
   and not exists (select 1 from sdm_eventi.persone where superadmin);

-- Fa rileggere all'API di Supabase lo schema (nuove funzioni e tabelle diventano subito utilizzabili)
notify pgrst, 'reload schema';
