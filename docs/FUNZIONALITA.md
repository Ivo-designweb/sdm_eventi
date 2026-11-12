# SDM Eventi - funzionalità e storico delle versioni

Versione dell'app: **5.6** · Script database: **2.0** · Ultimo aggiornamento di questo file: versione 5.6

> Questo file va aggiornato a ogni nuova versione: sezione «Funzionalità» se cambia il comportamento, tabella «Storico» con una riga per versione (e l'indicazione se serve rieseguire `db/01_schema_sdm_eventi.sql`).

## 1. Che cos'è

App per gestire eventi sportivi: struttura ad albero di rami e attività, persone incaricate, scadenze, stato di avanzamento e consuntivo. È una PWA (HTML + JavaScript) che si installa sul telefono, funziona anche senza rete per le operazioni principali e usa Supabase (database) e Vercel (pubblicazione). Vedi `docs/SETUP.md` per l'installazione.

## 2. Ruoli

| Ruolo | Cosa può fare |
|---|---|
| **Proprietario** | È un amministratore e in più è l'unico a gestire i Parametri. |
| **Amministratore** | Vede e gestisce tutti gli eventi: struttura, persone, eventi, conferma «Finito», registro modifiche, Excel. |
| **Responsabile** | Responsabile di uno o più rami: gestisce tutto ciò che sta sotto (il responsabile di un ramo vale per i sottorami che non ne hanno uno proprio). Può creare sottorami solo se il parametro lo consente. |
| **Operatore** | Incaricato di attività: cambia lo stato, consuntiva, scrive la nota e compila la check-list. |

- **Più ruoli nello stesso evento:** chi è sia incaricato di attività sia amministratore/responsabile sceglie all'ingresso se entrare come **Operatore** o come **Responsabile/Amministratore** (le interfacce sono diverse). La scelta vale per evento, si può ricordare sul dispositivo e si cambia da *Altro → Entri come…*. In modalità Operatore non si può modificare la struttura né confermare «Finito».
- **Accesso:** email + codice (OTP). Per gli utenti non amministratori l'accesso con la sola email si attiva da Parametri; l'amministratore entra sempre con il codice (`docs/ACCESSO_SENZA_OTP.md`).

## 3. Pagine

### Home
- **Operatore:** «Le mie attività», una riga per attività con menu dello stato e pulsante **📝 Consuntiva** (apre la scheda).
- **Responsabile / amministratore:**
  - **Totalizzatore** con cinque celle-filtro: Tutte, Da fare, In corso, Fatte (fatto + finito), In scadenza (scadute + in preavviso). La cella attiva ha un bordo colorato con una luce che gira 3 volte e poi si ferma. «Tutte» toglie il filtro.
  - **Avanzamento** in percentuale con barra.
  - **Da confermare** (amministratore) / **in attesa di conferma** (responsabile): l'amministratore conferma «Finito».
  - **Per persona / per ramo:** righe chiuse di default, si aprono una a una; con una cella-filtro le righe con risultati si aprono una volta sola; link **Apri tutti / Chiudi tutti**. Ogni attività mostra numero, ramo di primo livello, area colorata e stato; lo stesso in «Le mie attività» dell'operatore. Con il parametro **Mostra il percorso completo delle attività** (Parametri, default no) si vedono invece tutti i livelli sopra l'attività, su più righe.
  - Avviso «senza incaricati», filtro per area.
- **Ordine delle attività (v5.6):** bottone **⇅** per tutti i ruoli (operatore: accanto a «Le mie attività»; responsabile/amministratore: sopra l'elenco per persona / per ramo, e vale anche per «Da confermare» e «Le mie attività»). Alterna tra **Scadenza** (data crescente, senza scadenza in fondo; a parità, numero) e **Ramo + scadenza** (numero gerarchico dell'attività, es. 1.2 prima di 1.10; a parità, scadenza). Predefinito: Scadenza. La scelta è ricordata sul dispositivo (`sdm_home_ord`).
- **Cerca (solo smartphone):** pulsante con lente e scritta **Cerca** nella riga in alto della Home, per tutti i ruoli, senza occupare spazio in più: per l'**operatore** sta sulla stessa riga di «Ciao, nome» (tagliato con … se lungo) e del filtro «Tutte le aree» (ridotto); per **amministratore e responsabile** è una cella a destra dei cinque bottoni di stato (resi più piccoli). Apre sotto la riga un campo di ricerca libera che filtra in tempo reale le attività che l'utente vede in Home (le sue per l'operatore, quelle che gestisce per responsabile e amministratore): cerca in numero, titolo, descrizione, note, area, stato, scadenza (gg/mm/aaaa), percorso, incaricati, responsabile, note degli incaricati e check-list; più parole = devono esserci tutte, in qualsiasi ordine, senza distinguere maiuscole e accenti. Totali, percentuale ed elenchi seguono la ricerca; la **✕** a destra la cancella e chiude il campo, tornando alla vista standard. Si azzera cambiando evento o uscendo.

### Struttura (albero rami e attività)
- Modifica diretta, senza «modalità modifica»: ogni riga ha **✎** (modifica), **＋** (aggiungi sotto), **⧉** (duplica, solo amministratore), **🗑** (elimina). Su smartphone ✎ resta in vista e il resto sta nel menu **⋯**.
- **Trascinamento** solo dalla **maniglia ⋮⋮** a sinistra, tenendola premuta 140 ms (`DRAG_DELAY_MS` in `js/config.js`). Destinazione evidenziata (riquadro tratteggiato, ramo ricevente bordato, rosso se non permesso). **↶ Annulla spostamento** per gli ultimi 3 trascinamenti.
- **Rientri forti** (52 px per livello su PC, 20 px su smartphone) con guide verticali tratteggiate e colorate per livello. Rami in grassetto con barra blu; attività in tinta con il colore dell'area.
- **Riga del ramo:** «N sotto · fatte/totali», barra e responsabile (👤 impostato, ↳ ereditato dal ramo sopra).
- **Duplica a catena:** chiede titolo e descrizione della copia; la spunta «Duplica anche tutti i sottorami» (default sì) copia l'intera catena con le stesse caratteristiche.
- Numerazione gerarchica (01, 01.01, …), filtri (testo, stato, area, persona, scadenza), Espandi/Comprimi. Su smartphone solo per l'amministratore (voce *Struttura* della barra in basso).
- Max livelli e permessi dei responsabili dai Parametri.

### Scheda attività (consuntivo)
- Titolo, descrizione, note, scadenza, **stato** (da fare, in corso, fatto; «finito» solo l'amministratore), area, incaricati con nota per persona, **check-list** (voci con quantità prevista/rilevata), sponsor (solo amministratore).
- **Data e ora di chiusura** quando lo stato diventa «Fatto»: proposta adesso, modificabile, non nel futuro; vale anche dal menu rapido della Home.
- Su smartphone scheda compatta con stato a pulsanti e pulsanti di salvataggio in fondo.
- Offline si possono cambiare stato, propria nota e check-list: partono da sole alla riconnessione (vince la modifica più recente, campo per campo).

### Persone (amministratore) · Eventi · Altro · Impostazioni
- **Backup completo (ZIP)** (amministratori, in *Impostazioni → Backup*, serve la connessione): un unico file `sdm_eventi_backup_AAAA-MM-GG_HHMM.zip` con un file JSON per ogni tabella (`persone`, `eventi`, `nodi`, `incarichi`, `nodi_sponsor`, `parametri`, `movimenti`) più `_info.json` (versione, data, conteggi). I dati si leggono da Supabase a pacchetti di 500 record ordinati per chiave, ripartendo dall'ultima chiave letta, quindi nessun record è scritto due volte; `_info.json` segnala se i dati sono cambiati durante il backup. Il file contiene dati personali: va conservato in un posto protetto. Non esiste ancora il ripristino da file.
- **Notifiche delle scadenze (v5.0):** vedi `docs/NOTIFICHE.md`. Ogni mattina alle 08:00 (ora italiana) responsabili e amministratori ricevono una notifica push per le attività con scadenza entro N giorni (Parametri: interruttore, default attivo, e *Giorni di anticipo per la notifica*, default 3), comprese le scadute e non ancora «fatte»; senza data di scadenza l'attività non scade mai. Titolo = pallino di urgenza (🔴 scaduta, 🟠 oggi o domani, 🟡 dopo) + attività; testo su tre righe: evento, ramo, scadenza; icona dell'app; pulsante «Apri» su Android e PC; max 3 singole poi «e altre N attività in scadenza». **Al tocco** (anche con l'app chiusa) si apre la scheda di quell'attività in **sola lettura compatta** (anche su PC: chips con area e scadenza, descrizione, stato, check-list, incaricati), cambiando evento se serve; il pulsante **✏ Modifica** (per chi può cambiare qualcosa) la riapre nella scheda normale; il riepilogo apre la Home con la cella-filtro «In scadenza». Ogni dispositivo si attiva da *Impostazioni → Notifiche delle scadenze* (card visibile ad amministratori e a chi è responsabile di almeno un ramo; pulsante Attiva/Disattiva, su iPhone l'app deve essere installata sulla Home). Richiede la funzione `notifiche-scadenze` e il job Cron su Supabase.
  - **Parametri** (solo proprietario, card «Eventi e albero»): `notifiche_scadenze` (sì/no, default sì) e `notifiche_giorni_anticipo` (0-60, default 3); distinti da `giorni_preavviso_scadenza`, che serve solo alla visualizzazione nell'app.
  - **Regola dei destinatari** (funzione SQL `scadenze_da_notificare`): tutti gli **amministratori attivi** + **un solo responsabile**, quello effettivo dell'attività (il proprio, altrimenti quello del ramo più vicino sopra, a cascata; i responsabili dei rami più in alto **non** la ricevono). Mai gli operatori incaricati. Chi è sia amministratore sia responsabile la riceve una volta. Persone non attive escluse.
  - **Quali attività:** solo foglie, con scadenza (senza data non scade mai) entro i giorni di anticipo, comprese le scadute, stato Da fare o In corso (Fatto e Finito escluse), di eventi in preparazione o attivi.
  - **Invio:** il Cron chiama la funzione ogni ora (`0 * * * *`, header `x-cron-secret`), la funzione invia solo alle 08:00 italiane (ora legale gestita da sola); con `{"forza":true}` invia subito (prova), con `{"azione":"chiavi"}` crea solo le chiavi. Le chiavi VAPID le crea la funzione e restano nella tabella `push_chiavi` (la privata non esce dal server; l'app legge la pubblica con `vapid_pubblica()`). Dispositivi registrati in `push_sottoscrizioni` (`registra_push` / `rimuovi_push`); quelli non più validi si tolgono da soli. Notifiche con tag per attività (la stessa attività non si duplica sul dispositivo).
  - **Tocco:** il service worker (`sw.js`) apre l'app su `?attivita=ID&evento=ID` (o `?scadenze=1` per il riepilogo) oppure manda il comando all'app già aperta; l'app cambia evento se serve e apre la scheda in sola lettura.
- **Ultima connessione:** a ogni ingresso nell'app il server registra data e ora (colonna `persone.ultima_connessione`, non finisce nel registro modifiche). Nella lista Persone (amministratore) ogni nome ha un puntino a destra: grigio se la persona non si è mai connessa, verde se si è connessa almeno una volta (lampeggiante se è online adesso). Sotto il nome la riga «Connesso: gg/mm/aaaa hh:mm»: verde se online, blu se connessa almeno una volta, grigia con «—» se mai connessa. «Online» = app aperta, rilevato con la presenza in tempo reale di Supabase (canale `sdm-presenza`, chiave = id persona; la presenza la pubblicano tutti gli utenti collegati). Nella Home «Per persona» di amministratore e responsabile un puntino a sinistra del nome: verde se la persona si è connessa almeno una volta, **verde lampeggiante se è online adesso** (stessa logica della lista Persone, aggiornato sul posto senza ridisegnare la pagina), nessun puntino se mai connessa; il responsabile non vede data e ora, ma vede chi è online. Il dato è **della persona, non dell'evento**: un solo campo, aggiornato solo all'ingresso nell'app (non a ogni sincronizzazione). Per amministratori e responsabili l'elenco dei «collegati almeno una volta» arriva dalla funzione `persone_collegate()` (il responsabile non legge l'anagrafica). Se il salvataggio all'ingresso fallisce (es. script SQL non aggiornato) l'amministratore vede un avviso.
- **Persone:** anagrafica completa (i rami di cui una persona è responsabile vanno a capo, la pagina resta nella larghezza dello schermo), **Invita all'app** nella scheda di una persona salvata: apre WhatsApp (solo telefono e tablet, non PC; serve il cellulare) o la mail (serve l'email) con un messaggio già scritto («Ciao nome, questo è un invito a usare l'app… Apri l'app da qui: link… entra con la tua email»), il link è quello dell'app in uso; il logo (`assets/og-logo.png`, il logo in alto nella Home su fondo bianco) con la scritta «SdM Eventi» sotto il link lo mostra WhatsApp grazie ai tag `og:` di `index.html` (indirizzo fisso `https://sdmeventi.ivotaffarel.it/`; non segue un logo cambiato dai Parametri); disattivato per le persone non attive; ricerca e filtri, contatto rapido (chiama, WhatsApp, mail), import/export Excel, eliminazione definitiva e dati della persona (GDPR).
- **Eventi:** titolo, date, aree con colore, duplicazione dell'evento (con date spostate, responsabili e incaricati opzionali).
- **Guida all'uso (v5.3, logo v5.4, per ruolo v5.5):** pagina `help.html` con il manuale pratico per gli utenti (accesso, ruoli, attività, caricamento dati da Excel, ricerche, problemi frequenti) e schermate in `assets/help/` (da rigenerare se cambia molto l'interfaccia). Si apre da *Altro → Guida all'uso*, **toccando il logo SdM Eventi in qualsiasi videata** e dal link «Guida all'uso» nella schermata di accesso; funziona offline. **Si adatta da sola al ruolo** (v5.5): l'app apre `help.html?r=login|operatore|responsabile|admin` (più `&s=1` per il proprietario) con la funzione `urlGuida()` di `js/app.js`; prima dell'accesso mostra solo informazioni generali, accesso/registrazione e installazione; l'operatore vede le sue pagine, il responsabile anche quelle dell'operatore, l'amministratore tutte. Nell'HTML ogni blocco ha `data-min` (livello minimo 1-3), `data-max`, `data-solo="login"` o `data-super` (vedi lo script in fondo a `help.html`). Un nuovo paragrafo va marcato con il livello giusto. Va aggiornata quando cambia il comportamento dell'app.
- **Altro:** Guida all'uso, Excel della struttura (esporta, importa, modello), **Registro modifiche** (amministratori), Da rivedere, Impostazioni, Parametri (proprietario), Informativa privacy, Esci.
- **Registro modifiche** (amministratori): chi ha cambiato cosa e quando, filtri (testo, evento, azione, tipo, periodo), dettaglio «vecchio → nuovo», carica altri, esporta in Excel. Il registro si compila in automatico nel database e si conserva per i mesi indicati nei Parametri.
- **Da rivedere:** modifiche fatte offline che il server non ha potuto applicare.

## 4. Smartphone e PWA
- Barra in basso sempre ferma (Home/Attività, Persone, Eventi, Struttura per l'amministratore, Altro); su iPhone rispetta l'area sicura.
- **Freccia indietro** in alto solo nelle sottopagine aperte da un'altra pagina (Registro modifiche, Da rivedere, Impostazioni, Parametri, scheda attività); non c'è nelle pagine principali della barra in basso (Home, Persone, Eventi, Struttura, Altro). Il **tasto indietro del telefono** chiude prima la scheda o il dialogo aperto, poi torna pagina per pagina alla precedente; dall'app si esce solo dalla pagina principale. Pulsante rotondo di 44 px con bordo, staccato dal logo da uno spazio e da una linea verticale; stessa freccia nella scheda attività.
- Telefono in verticale e in orizzontale con le stesse funzioni; nessuno scorrimento a destra.
- Numero di versione accanto all'icona del segnale; etichetta della modalità (Operatore / Responsabile / Amministratore) quando si hanno due ruoli.
- Installabile (manifest, icone anche maskable), funziona offline con service worker; si aggiorna alla riapertura (`VERSIONE` in `sw.js` = `app-version` in `index.html`).

## 5. Storico delle versioni

«DB» = serve rieseguire `db/01_schema_sdm_eventi.sql` (versione indicata).

| Versione | Novità | DB |
|---|---|---|
| 5.6 | Home: bottone ⇅ per ordinare le attività per scadenza oppure per numero del ramo e scadenza, per operatore e responsabile/amministratore | – |
| 5.5 | La Guida all'uso si adatta al ruolo: prima dell'accesso solo info generali e accesso; operatore, responsabile (+ operatore) e amministratore (tutto) vedono solo le proprie pagine | – |
| 5.4 | Il logo SdM Eventi, in qualsiasi videata, apre la Guida all'uso; schermate della guida con nomi di esempio generici | – |
| 5.3 | Pagina «Guida all'uso» (`help.html`) con manuale per gli utenti e schermate; voce in Altro e link dall'accesso | – |
| 5.2 | Aprendo un'attività dalla notifica la scheda è in sola lettura e compatta (anche su PC), con pulsante «Modifica». Build b2: puntino verde lampeggiante per chi è online anche nella Home «Per persona» | – |
| 5.1 | Notifiche: pallino di urgenza, testo su tre righe (evento, ramo, scadenza), pulsante «Apri»; il tocco apre direttamente l'attività (o la Home «In scadenza» per il riepilogo) | 2.0 |
| 5.0 | Notifiche push delle scadenze a responsabili e amministratori (parametri, attivazione per dispositivo, funzione server alle 08:00) | 1.9 |
| 4.9 | Ultima connessione di ogni persona (riga «Connesso:» e puntino nella lista Persone, puntino verde nella Home «Per persona»), online in tempo reale | 1.8 |
| 4.8 | Invita all'app (WhatsApp / mail) nella scheda persona, anteprima del link con icona | – |
| 4.7 | Cerca compatta: nella riga del filtro area (operatore, con «Ciao, nome») e a destra dei bottoni di stato (amministratore/responsabile) | – |
| 4.6 | Ricerca libera (Cerca / ✕) nelle attività della Home su smartphone | – |
| 4.5 | Backup completo in ZIP (un file JSON per tabella) dalle Impostazioni, solo amministratori | – |
| 4.4 | Liste della Home con il solo ramo di primo livello; parametro per mostrare il percorso completo; tasto indietro del telefono chiude schede e dialoghi | – |
| 4.3 | L'operatore (anche in modalità scelta) può aprire e consuntivare le attività; freccia indietro in ogni pagina | – |
| 4.2 | Scelta Operatore / Responsabile per chi ha due ruoli | – |
| 4.1 | Home per persona/ramo: righe chiuse di default, Apri/Chiudi tutti | – |
| 4.0 | Rientri forti con guide colorate, maniglia di trascinamento anche su PC (140 ms) | – |
| 3.9 | Registro modifiche (amministratori) | – |
| 3.8 | Data e ora di chiusura, pulsante Consuntiva, pulsanti della scheda più alti | 1.7 |
| 3.7 | Correzione dei filtri della Home | – |
| 3.6 | Luce sulla cella in 3 giri, barra in basso più bassa, versione accanto al segnale | – |
| 3.5 | Pulsante «Annulla spostamento» con icona | – |
| 3.4 | Saluto su una riga, barra in basso sempre ferma, bottoni Struttura su una riga | – |
| 3.3 | Orizzontale uguale al verticale, filtri Struttura su una riga, luce sulla cella attiva | – |
| 3.2 | Smartphone senza scorrimento a destra, maniglia di trascinamento su smartphone | – |
| 3.1 | Annulla ultimi 3 spostamenti, titoli completi, dettagli al tocco | – |
| 3.0 | Struttura su smartphone solo per l'amministratore | – |
| 2.9 | Cella «Tutte» nel totalizzatore | – |
| 2.8 | Totalizzatore Home con celle-filtro, rami in evidenza, destinazione del trascinamento | – |
| 2.7 | Struttura con modifica diretta, duplica a catena, responsabile ereditato, menu ⋯ | 1.6 |
| 2.6 | Home di responsabile/amministratore compatta | – |
| 2.5 | Colore area in Home smartphone, scheda attività compatta | – |
| 2.4 | Colore per area, barra filtri in Struttura | 1.5 |
| 2.3 | Il menu non si blocca con l'index in cache vecchio | – |
| 2.2 | Numerazione gerarchica, duplica attività, aree, check-list, sponsor, «finito» solo admin | 1.4 |
| 2.1 | Proprietario unico per i Parametri | 1.3 |
| 2.0 | Disconnetti tutti gli utenti | 1.2 |
| 1.9 | Accesso con sola email per gli utenti non admin | – |
| 1.8 | Funzioni Excel in Altro (solo admin) | – |
| 1.7 | Intestazione compatta, Home operatore e gestione, pagina Eventi, navigazione smartphone | – |
| 1.6 | Messaggio se il database non è aggiornato (informativa) | – |
| 1.5 | Salvataggio parametri senza valori null | – |
| 1.4 | Funzioni GDPR (eliminazione, dati persona, conservazione, informativa) | 1.0 |
| 1.3 | Excel (persone e struttura), duplicazione evento | 0.9 |
| 1.2 | Modifiche offline in coda, sincronizzazione, Da rivedere, tempo reale | 0.8 |
| 1.1 | Home con avanzamento, scadenze, da confermare, le mie attività | – |
| 1.0 | Scheda attività | – |
| 0.7–0.9 | Struttura ad albero, responsabili, trascinamento | 0.6–0.7 |
| 0.4–0.6 | Persone, eventi, logo, durata del codice | 0.5 |
| 0.1–0.3 | PWA, accesso via mail, ruoli, Parametri | 0.4 |

## 6. File del progetto
Vedi `Readme.txt`. Le anteprime con dati finti sono in `anteprima/` (tra le ultime: `ultima_connessione.html`, `notifiche_scadenze.html`); i controlli a schermo sono stati fatti con un Supabase simulato, quindi alcune funzioni vanno sempre verificate con dati reali.
- Notifiche: `supabase/functions/notifiche-scadenze/index.ts` (funzione server), `docs/NOTIFICHE.md` (installazione e prova), `assets/notifica-icon.png` (icona della notifica, ricavata dal logo dell'invito).
- Accesso senza codice: `supabase/functions/accesso-email/index.ts` (vedi `docs/ACCESSO_SENZA_OTP.md`).

## 7. Cosa fare dopo ogni aggiornamento e punti aperti
**Dopo un aggiornamento che cambia il DB o la funzione:** rieseguire `db/01_schema_sdm_eventi.sql` in Supabase (è rieseguibile); se è cambiato `supabase/functions/notifiche-scadenze/index.ts`, ricreare la funzione (Edge Functions → Via Editor, *Verify JWT* disattivato); sul telefono riaprire l'app (nuova cache di `sw.js`). Il Cron e `CRON_SECRET` non cambiano.

**Punti aperti / idee già discusse:**
- Ultima connessione **per evento** (oggi è solo per persona): richiederebbe una tabella persona-evento aggiornata all'apertura dell'evento.
- Notifiche anche ai **responsabili dei rami superiori** (oggi solo il responsabile effettivo più vicino).
- Le notifiche non possono cambiare lo stato dell'attività: serve il tocco dentro l'app.
- Cancellazione dei vecchi branch su GitHub: non fatta (tutti uniti in `main` tranne `claude/serene-bell-ispd6y`, con un commit v4.4 non in `main`).
