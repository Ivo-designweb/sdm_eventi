// Edge Function "notifiche-scadenze": invia le notifiche push delle attività in scadenza a responsabili e amministratori.
// Va richiamata ogni ora da un job (Supabase → Integrations → Cron): parte davvero solo alle 08:00 ora italiana
// (con {"forza": true} nel corpo parte subito, per le prove). Vedi docs/NOTIFICHE.md.
// Secret richiesto: CRON_SECRET (facoltativo VAPID_SUBJECT). Le chiavi VAPID le crea la funzione alla prima esecuzione e le conserva nel database (tabella push_chiavi).
// Con {"azione": "chiavi"} nel corpo crea solo le chiavi (da fare una volta, prima di attivare le notifiche sui dispositivi).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const MAX_SINGOLE = 3;
const ORA_INVIO = 8;   // ora italiana

const ggMm = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
function testoScadenza(iso: string, gg: number): string {
  const d = ggMm(iso);
  if (gg === 0) return 'scade oggi (' + d + ')';
  if (gg === 1) return 'scade domani (' + d + ')';
  if (gg > 1) return 'scade il ' + d + ' (tra ' + gg + ' giorni)';
  return 'scaduta il ' + d + ' (' + (gg === -1 ? '1 giorno' : -gg + ' giorni') + ' fa)';
}

Deno.serve(async (req: Request) => {
  const segreto = Deno.env.get('CRON_SECRET');
  if (!segreto || req.headers.get('x-cron-secret') !== segreto) return json({ errore: 'Non autorizzato' }, 401);
  let forza = false, azione = '';
  try { const c = await req.json(); forza = !!c.forza; azione = String(c.azione || ''); } catch (_e) { /* corpo vuoto */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false }, db: { schema: 'sdm_eventi' } });
  // chiavi VAPID: create una sola volta e conservate nel database
  let { data: chiavi } = await sb.from('push_chiavi').select('pubblica, privata').eq('id', 1).maybeSingle();
  if (!chiavi) {
    const k = webpush.generateVAPIDKeys();
    const { error: ek } = await sb.from('push_chiavi').insert({ id: 1, pubblica: k.publicKey, privata: k.privateKey });
    if (ek) return json({ errore: 'Chiavi non salvate: ' + ek.message }, 500);
    chiavi = { pubblica: k.publicKey, privata: k.privateKey };
  }
  if (azione === 'chiavi') return json({ chiavi: 'pronte' });

  const oraItalia = Number(new Intl.DateTimeFormat('it-IT', { hour: '2-digit', hour12: false, timeZone: 'Europe/Rome' }).format(new Date()));
  if (!forza && oraItalia !== ORA_INVIO) return json({ saltato: 'non sono le ' + ORA_INVIO + ':00 in Italia' });

  const { data: par } = await sb.from('parametri').select('chiave, valore').in('chiave', ['notifiche_scadenze', 'notifiche_giorni_anticipo', 'percorso_completo']);
  const P: Record<string, unknown> = {}; (par || []).forEach((x: { chiave: string; valore: unknown }) => { P[x.chiave] = x.valore; });
  if (P.notifiche_scadenze === false) return json({ saltato: 'notifiche disattivate nei Parametri' });
  const giorni = Math.max(0, parseInt(String(P.notifiche_giorni_anticipo ?? 3), 10) || 0);

  const { data: righe, error } = await sb.rpc('scadenze_da_notificare', { _giorni: giorni, _percorso_completo: P.percorso_completo === true });
  if (error) return json({ errore: error.message }, 500);
  if (!righe || !righe.length) return json({ inviate: 0, persone: 0 });

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:ivotaffarel@gmail.com', chiavi.pubblica, chiavi.privata);

  type Riga = { persona_id: string; nodo_id: string; titolo: string; evento: string; ramo: string | null; scadenza: string; giorni: number };
  const perPersona = new Map<string, Riga[]>();
  (righe as Riga[]).forEach(r => { if (!perPersona.has(r.persona_id)) perPersona.set(r.persona_id, []); perPersona.get(r.persona_id)!.push(r); });
  const { data: subs } = await sb.from('push_sottoscrizioni').select('id, persona_id, endpoint, p256dh, auth').in('persona_id', [...perPersona.keys()]);

  let inviate = 0, errori = 0; const morte: string[] = [];
  for (const s of (subs || []) as { id: string; persona_id: string; endpoint: string; p256dh: string; auth: string }[]) {
    const l = perPersona.get(s.persona_id) || [];
    const msg = l.slice(0, MAX_SINGOLE).map(r => ({ title: r.titolo, body: [r.evento, r.ramo].filter(Boolean).join(' · ') + ' · ' + testoScadenza(r.scadenza, r.giorni), tag: 'scad-' + r.nodo_id }));
    if (l.length > MAX_SINGOLE) { const n = l.length - MAX_SINGOLE; msg.push({ title: 'e altre ' + n + (n === 1 ? ' attività in scadenza' : ' attività in scadenza'), body: 'Tocca per aprire l\'elenco', tag: 'scad-altre' }); }
    for (const m of msg) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 12 * 3600, urgency: 'high' });
        inviate++;
      } catch (e) {
        const sc = (e as { statusCode?: number }).statusCode;
        if (sc === 404 || sc === 410) { morte.push(s.id); break; }   // dispositivo non più valido
        errori++;
      }
    }
  }
  if (morte.length) await sb.from('push_sottoscrizioni').delete().in('id', morte);
  return json({ inviate, errori, persone: perPersona.size, dispositivi_rimossi: morte.length });
});
