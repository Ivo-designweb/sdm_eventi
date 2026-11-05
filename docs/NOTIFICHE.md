# Notifiche push delle scadenze

Ogni mattina alle **08:00 (ora italiana)** responsabili e amministratori ricevono una notifica sul telefono (anche con l'app chiusa) per le attività in scadenza.

## Regole
- Si notificano le **attività** (foglie) con scadenza **entro N giorni da oggi** (N = *Giorni di anticipo per la notifica* nei Parametri, default 3), comprese quelle **già scadute**, finché non passano a *Fatto* o *Finito*.
- Un'attività **senza data di scadenza non scade mai**: non genera notifiche.
- Non si notificano le attività di eventi *conclusi* o *archiviati*.
- **Destinatari:** il responsabile dell'attività (proprio o ereditato dal ramo più vicino) e tutti gli amministratori attivi.
- Ogni notifica ha l'icona dell'app (`assets/notifica-icon.png`), il nome dell'attività, poi evento, ramo e scadenza. Al massimo **3 notifiche singole** per persona, poi «e altre N attività in scadenza». Si ripete ogni giorno.
- Parametri (solo proprietario): *Notifiche delle scadenze* (sì/no, default sì) e *Giorni di anticipo per la notifica*.
- Ogni persona deve **attivare le notifiche su ogni suo dispositivo**: *Impostazioni → Notifiche delle scadenze → Attiva* (il telefono chiede il permesso). Su **iPhone/iPad** l'app deve essere installata sulla schermata Home (iOS 16.4 o successivo) e aperta da lì.

## Installazione (una sola volta)
1. **Database:** esegui `db/01_schema_sdm_eventi.sql` (versione 1.9) nell'SQL Editor di Supabase.
2. **Segreto:** Supabase → *Edge Functions* → *Secrets* → aggiungi `CRON_SECRET` con una parola d'ordine lunga e casuale (scrivila da parte). Facoltativo: `VAPID_SUBJECT` = `mailto:ivotaffarel@gmail.com`.
3. **Funzione:** *Edge Functions* → *Deploy a new function* → *Via Editor* → nome `notifiche-scadenze` → incolla `supabase/functions/notifiche-scadenze/index.ts` → **disattiva *Verify JWT*** (la funzione si protegge con `CRON_SECRET`) → Deploy.
4. **Chiavi delle notifiche:** esegui la funzione una volta per creare le chiavi (restano nel database; la privata non esce dal server). Da terminale:
   ```bash
   curl -X POST "https://<progetto>.supabase.co/functions/v1/notifiche-scadenze" -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"azione":"chiavi"}'
   ```
   Risposta attesa: `{"chiavi":"pronte"}`. Senza questo passo l'app dice «notifiche non ancora configurate sul server».
5. **Esecuzione ogni ora:** Supabase → *Integrations* → *Cron* → nuovo job, schedule `0 * * * *`, tipo *Supabase Edge Function* → `notifiche-scadenze`, metodo POST, header `x-cron-secret: <CRON_SECRET>`. (Gira ogni ora ma la funzione invia solo alle 08:00 italiane, estate e inverno.)
6. **Dispositivi:** aggiorna l'app, poi *Impostazioni → Notifiche delle scadenze → Attiva* su ogni dispositivo.

## Prova
Per provare subito (ignora l'ora):
```bash
curl -X POST "https://<progetto>.supabase.co/functions/v1/notifiche-scadenze" -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"forza":true}'
```
Risposta: `{"inviate":N,"errori":0,"persone":M,"dispositivi_rimossi":0}`. Se non c'è nessuna attività in scadenza risponde `{"inviate":0,...}`: per provare imposta una scadenza vicina su un'attività non fatta.

## Note
- I dispositivi che non esistono più (app disinstallata, permesso tolto) vengono tolti da soli all'invio successivo.
- Per cambiare l'ora di invio: costante `ORA_INVIO` in `supabase/functions/notifiche-scadenze/index.ts`, poi ridistribuisci la funzione.
