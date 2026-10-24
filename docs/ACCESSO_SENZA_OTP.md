# Accesso senza codice OTP (solo email)

> **Attenzione di sicurezza.** Con il codice disattivato, chiunque conosca l'email di una persona in anagrafica può entrare
> come quella persona (vedere attività e nomi dei colleghi, cambiare stato e note). Per questo è **spento per impostazione
> predefinita** e **non vale mai per l'amministratore**, che entra sempre con il codice.

## Come funziona
1. In **Parametri → Accesso all'app** togli la spunta a *Richiedi il codice OTP per entrare* e salva (conferma richiesta).
2. Nella pagina di accesso l'utente scrive la sua email: se è in anagrafica ed è attiva, entra subito. Se non è in anagrafica,
   compare "Email non presente in anagrafica o non attiva". L'email non deve necessariamente esistere come casella di posta.
3. Se l'email è di un **amministratore**, o se il parametro è attivo, o se la funzione non è installata, si usa il codice via mail.
4. Per tornare all'accesso con codice per tutti: rimetti la spunta e salva.

## Installazione della funzione (una sola volta)
La funzione apre la sessione lato server (serve il permesso del server di Supabase, non disponibile nella pagina web).
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome: `accesso-email`.
3. Incolla il contenuto del file `supabase/functions/accesso-email/index.ts` di questo repository.
4. **Deploy**. Lascia attiva l'opzione *Verify JWT* (l'app invia la chiave pubblica `anon`).
5. Le chiavi del server (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) sono fornite in automatico da Supabase: non scriverle da nessuna parte.

Prova: disattiva il codice, apri l'app in una finestra anonima e accedi con l'email di una persona (non amministratore).
