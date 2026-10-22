# SDM Eventi - installazione (step 0-1)

## 1. Database (Supabase, progetto già esistente)
1. Apri **SQL Editor** ed esegui il contenuto di `db/01_schema_sdm_eventi.sql`.
   Crea lo schema `sdm_eventi` senza toccare gli altri schemi. Si può rieseguire.
2. **Project Settings > API > Exposed schemas**: aggiungi `sdm_eventi` e salva.
3. **Authentication > URL Configuration**: imposta *Site URL* sull'indirizzo Vercel dell'app
   (es. `https://sdm-eventi.vercel.app`) e aggiungilo anche in *Redirect URLs*.
4. **Authentication > Email Templates > Magic Link**: aggiungi nel testo il codice
   `{{ .Token }}` (es. "Oppure inserisci il codice: {{ .Token }}"). Serve su iPhone, dove il
   link si apre in Safari e non nell'app installata: il codice si digita nell'app.
5. **Authentication > SMTP Settings**: configura un servizio di posta (Resend, Brevo, ecc.).
   Il mittente predefinito di Supabase invia pochissime mail all'ora ed è solo per prove.
6. Il primo amministratore è `ivotaffarel@gmail.com` (inserito dallo script).

## 2. Configurazione dell'app
Apri `js/config.js` e inserisci:
- `SUPABASE_URL`: Project Settings > API > Project URL
- `SUPABASE_ANON_KEY`: Project Settings > API > `anon` `public`

La chiave `anon` è pubblica per progetto; la protezione dei dati è nelle regole RLS dello schema.
**Non inserire la chiave `service_role`.**

## 3. Pubblicazione su Vercel
1. Vercel > *Add New Project* > importa il repository `sdm_eventi`.
2. *Framework Preset*: **Other**. Nessun build command, nessuna output directory (sito statico).
3. *Production Branch*: il branch che vuoi pubblicare. Ogni push lo aggiorna.

## 4. Aggiornare l'app
Ad ogni nuova versione si cambiano insieme: `meta app-version` in `index.html` e `VERSIONE` in `sw.js`.
Gli utenti ricevono la nuova versione alla riapertura dell'app (l'app si ricarica da sola una volta).

## 5. Provare in locale
Serve un server statico (il service worker non funziona da `file://`):
`python3 -m http.server 8000` e apri http://localhost:8000
