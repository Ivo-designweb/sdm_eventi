// Edge Function "accesso-email" - accesso senza codice OTP (solo email in anagrafica).
// Funziona SOLO se il parametro "otp_obbligatorio" dell'app è disattivato (Parametri → Accesso) e
// SOLO per persone attive che non sono il proprietario: il proprietario (Ivo Taffarel) entra sempre con il codice.
// Risposte: { modo: 'otp' } -> usa il codice via mail | { modo: 'diretto', token_hash } -> accesso immediato.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { email } = await req.json();
    const mail = String(email || '').trim().toLowerCase();
    if (!/^[^@\s*%]+@[^@\s*%]+\.[^@\s*%]+$/.test(mail)) return json({ errore: 'Email non valida' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
      db: { schema: 'sdm_eventi' }
    });

    // il codice OTP è obbligatorio salvo parametro esplicitamente disattivato
    const { data: par } = await sb.from('parametri').select('valore').eq('chiave', 'otp_obbligatorio').maybeSingle();
    if (!par || par.valore !== false) return json({ modo: 'otp' });

    // la persona deve esistere in anagrafica ed essere attiva
    const esatta = mail.replace(/[\\%_]/g, '\\$&');
    let { data: pers, error: errCol } = await sb.from('persone').select('email, ruolo, attivo, superadmin').ilike('email', esatta).maybeSingle();
    if (errCol) ({ data: pers } = await sb.from('persone').select('email, ruolo, attivo').ilike('email', esatta).maybeSingle());   // database non ancora aggiornato
    if (!pers || !pers.attivo || String(pers.email).toLowerCase() !== mail) return json({ errore: 'Email non presente in anagrafica o non attiva' }, 403);
    // il proprietario entra sempre con il codice (se il database non ha ancora il campo, vale per tutti gli amministratori)
    if (pers.superadmin ?? pers.ruolo === 'admin') return json({ modo: 'otp' });

    // utente di accesso: lo crea se manca (nessuna mail inviata), poi genera il token per aprire la sessione
    await sb.auth.admin.createUser({ email: mail, email_confirm: true });   // se esiste già l'errore si ignora
    const { data: link, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: mail });
    const token = link?.properties?.hashed_token;
    if (error || !token) return json({ errore: 'Accesso non riuscito, riprova o usa il codice' }, 500);
    return json({ modo: 'diretto', token_hash: token });
  } catch (_e) {
    return json({ errore: 'Richiesta non valida' }, 400);
  }
});
