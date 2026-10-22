# SDM Eventi - installazione (step 0-2)

## 1. Database (Supabase, progetto già esistente)
1. Apri **SQL Editor** ed esegui il contenuto di `db/01_schema_sdm_eventi.sql`.
   Crea lo schema `sdm_eventi` senza toccare gli altri schemi. Si può rieseguire.
2. **Project Settings > API > Exposed schemas**: aggiungi `sdm_eventi` e salva.
3. **Authentication > URL Configuration**: imposta *Site URL* sull'indirizzo Vercel dell'app
   (es. `https://sdm-eventi.vercel.app`) e aggiungilo anche in *Redirect URLs*.
4. **Authentication > Email Templates**: nei modelli **Magic Link** e **Confirm signup** (chi accede la prima volta
   riceve "Confirm signup") incolla questo testo nel campo *Message body* (scheda **Source**) e imposta
   l'oggetto `Il tuo codice SDM Eventi: {{ .Token }}`. L'app usa il **codice**, valido su qualsiasi dispositivo.
   Il link è stato tolto di proposito: i programmi di posta lo aprono in anteprima e lo rendono inutilizzabile.

   ```html
   <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c2333">
     <h2 style="margin:0 0 8px;color:#1d4ed8">SDM Eventi</h2>
     <p style="font-size:16px;margin:0 0 16px">Il tuo codice di accesso è:</p>
     <p style="font-size:38px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;background:#eef2ff;border-radius:10px;padding:16px;text-align:center;margin:0 0 16px">{{ .Token }}</p>
     <p style="font-size:14px;color:#5b6578;margin:0">Digitalo nell'app entro un'ora. Se non hai chiesto tu l'accesso, ignora questa mail.</p>
   </div>
   ```
   **Authentication > Providers > Email**: *Email OTP Length* può essere 6 (predefinito) fino a 10 cifre.
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

## 6. Aggiornare il database
Quando `db/01_schema_sdm_eventi.sql` cambia (versione indicata nell'intestazione), riesegui l'intero script
nell'SQL Editor: è pensato per poter essere rieseguito senza perdere dati.
