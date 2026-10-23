# SDM Eventi - Guida pratica al GDPR

> Questa guida è un aiuto operativo, **non una consulenza legale**. Prima dell'uso con persone reali, fai verificare
> informativa e nomine da un consulente privacy o dal tuo DPO/studio di riferimento.

## 1. Chi è chi
| Ruolo GDPR | Chi |
|---|---|
| **Titolare del trattamento** | L'associazione/società che organizza gli eventi e decide perché e come si trattano i dati. |
| **Responsabile del trattamento (art. 28)** | Chi gestisce l'app per conto del titolare (se lo sviluppatore/gestore è un soggetto diverso dal titolare serve un **contratto/nomina**). |
| **Sub-responsabili (fornitori)** | Supabase (database e accesso), Vercel (hosting dell'app), Resend (invio mail del codice), GitHub (codice, senza dati personali). |
| **Persone autorizzate (art. 29)** | Amministratori e responsabili di ramo che usano l'app: vanno **istruiti e incaricati per iscritto**. |
| **Interessati** | Le persone in anagrafica (soci, volontari, collaboratori, eventuali minori). |

## 2. Quali dati tratta l'app
- Anagrafica: cognome, nome, email, cellulare, data di nascita, iscrizione e numero iscritto, note.
- Accesso: email e codici monouso (gestiti da Supabase Auth).
- Attività: incarichi, stati, scadenze, note personali sulle attività.
- Registro dei movimenti: chi ha fatto cosa e quando (dati personali dell'operatore).
- Sul dispositivo: copia locale dei dati visibili all'utente (per l'uso offline).
- **Nessun dato particolare (art. 9)** va inserito (salute, convinzioni, ecc.): non usare il campo Note per questo.
- Se ci sono **minorenni**: informativa ai genitori e raccolta solo dei dati strettamente necessari.

## 3. Base giuridica e informativa
- Gestione organizzativa di soci/volontari: di norma **esecuzione del rapporto associativo/di collaborazione** (art. 6.1.b) o
  **legittimo interesse** (6.1.f). Il **consenso non serve** per l'organizzazione degli eventi, ma serve per usi ulteriori
  (marketing, foto, newsletter): vanno chiesti a parte.
- **Informativa (art. 13)** obbligatoria, consegnata all'iscrizione/primo incarico e disponibile nell'app (vedi bozza sotto).
- Registro del consenso solo per ciò che si basa sul consenso.

## 4. Fornitori e trasferimenti fuori UE
1. **Firma/accetta il DPA** (Data Processing Addendum) di Supabase, Vercel e Resend (sono disponibili online nei rispettivi
   pannelli o siti, sezione "Legal/Privacy").
2. **Regione dei dati**: in Supabase → *Project Settings → General* controlla la regione del progetto; per i dati personali
   preferisci una regione **UE**. Per Resend scegli la regione UE se disponibile.
3. Per i fornitori con sede extra-UE verifica le garanzie (Data Privacy Framework o Clausole Contrattuali Standard) e citale
   nell'informativa.

## 5. Misure di sicurezza (art. 32)
Già presenti nell'app:
- accesso con codice monouso via email, sessione a scadenza, HTTPS;
- permessi nel database (RLS): ogni utente vede solo ciò che gli serve; i non amministratori vedono dei colleghi solo nome e cognome;
- ultimo amministratore protetto, registro dei movimenti.

Da fare tu (organizzative):
- **Autenticazione a due fattori** su Supabase, Vercel, GitHub e sulla casella email dell'amministratore.
- Pochi account con accesso alla dashboard di Supabase; mai condividere la chiave `service_role`.
- **Backup**: i piani gratuiti di Supabase non hanno backup giornalieri garantiti; esporta periodicamente le persone in Excel e
  conserva i file cifrati, oppure usa un piano con backup.
- Telefoni/PC di amministratori e responsabili con **blocco schermo** e aggiornamenti: sul dispositivo resta una copia dei dati
  visibili (offline). All'uscita dall'app le copie dei dati personali vengono eliminate, ma **le modifiche in attesa restano**
  fino all'invio.
- File Excel esportati contengono dati personali: **conservali al sicuro, non inviarli per email non protetta, cancellali dopo l'uso**.
- Elenco delle **persone autorizzate** (chi è admin/responsabile) aggiornato; revoca immediata (disattiva la persona) quando smette il ruolo.

## 6. Diritti degli interessati (artt. 15-22) - risposta entro 1 mese
| Diritto | Come lo gestisci oggi nell'app |
|---|---|
| Accesso / portabilità | *Persone → Esporta Excel* (filtra la riga della persona) e le sue attività da *Struttura → Esporta*. |
| Rettifica | *Persone* → scheda → modifica. |
| Limitazione / opposizione | Disattiva la persona (non compare più negli elenchi e non può accedere). |
| **Cancellazione** | Oggi: disattivazione. La **cancellazione definitiva** (con eliminazione dell'utente di accesso e anonimizzazione dei movimenti) non è ancora automatica: vedi "Migliorie consigliate". |

Tieni un **registro delle richieste** ricevute (data, richiesta, risposta).

## 7. Conservazione
Definisci e scrivi nell'informativa i tempi, per esempio:
- anagrafica: per la durata del rapporto + il periodo necessario per obblighi di legge/difesa (es. 5-10 anni, secondo il tuo statuto);
- persone non più attive: eliminazione o anonimizzazione dopo X mesi;
- registro dei movimenti: 12-24 mesi.

## 8. Violazione dei dati (data breach)
Se perdi/espone dati (telefono rubato con app aperta, file Excel inviato per errore, account compromesso): annota l'evento nel
**registro delle violazioni** e, se c'è rischio per le persone, **notifica al Garante entro 72 ore** (https://www.garanteprivacy.it);
se il rischio è elevato informa anche gli interessati. Cambia subito le credenziali e disattiva gli utenti coinvolti.

## 9. Altri adempimenti
- **Registro dei trattamenti (art. 30)**: tienilo (modello sotto). Per un trattamento non occasionale di dati di soci/volontari è
  di fatto necessario anche per le piccole organizzazioni.
- **DPIA**: normalmente non necessaria (nessun dato particolare, nessuna larga scala); riconsidera se ci fossero molti minori.
- **DPO**: di norma non obbligatorio per una piccola associazione sportiva.
- **Cookie/storage**: l'app usa solo memoria tecnica (sessione, copia locale per l'uso offline), nessun tracciamento o statistica:
  non serve un banner di consenso, ma va indicato nell'informativa.
- **Minimizzazione**: raccogli solo ciò che serve davvero. Se la **data di nascita** o il **cellulare** non servono a una finalità
  precisa, non compilarli.
- **Comunicazioni**: il codice di accesso è un messaggio di servizio. Per newsletter o promozioni serve il consenso.

## 10. Migliorie consigliate all'app (da decidere)
1. **Eliminazione definitiva di una persona** (admin): rimuove anagrafica e utente di accesso e anonimizza i movimenti.
2. **Pulizia automatica dei movimenti** oltre N mesi (parametro configurabile).
3. **Link all'informativa privacy** nella pagina di accesso e nelle Impostazioni.
4. **Esportazione dei dati di una singola persona** con un solo pulsante (accesso/portabilità).
5. Opzionale: registrazione dell'avvenuta presa visione dell'informativa al primo accesso.

---

## Bozza di informativa (da adattare e far verificare)
**Titolare:** [Nome associazione], [indirizzo], [email/PEC]. **Contatto privacy:** [email].
**Dati trattati:** dati anagrafici e di contatto, data di nascita, dati di iscrizione, incarichi e attività svolte negli eventi,
dati di accesso all'app (email) e registro delle operazioni svolte nell'app.
**Finalità e basi giuridiche:** gestione del rapporto associativo/di collaborazione e organizzazione degli eventi sportivi
(art. 6.1.b GDPR, art. 6.1.f); adempimenti di legge (6.1.c); sicurezza e prevenzione abusi (6.1.f). Eventuali comunicazioni
promozionali o pubblicazione di immagini solo con consenso (6.1.a), revocabile.
**Destinatari:** le persone autorizzate dell'associazione (amministratori e responsabili di ramo, con accesso limitato alle
attività di loro competenza); fornitori tecnici nominati responsabili del trattamento: Supabase (database), Vercel (hosting),
Resend (invio email). **Trasferimenti extra UE:** [indicare regione dati e garanzie: DPF/SCC].
**Conservazione:** [tempi].
**Diritti:** accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, revoca del consenso, reclamo al Garante
(www.garanteprivacy.it). Per esercitarli scrivi a [email].
**Strumenti:** l'app utilizza solo strumenti tecnici (sessione e copia locale dei dati per l'uso offline); non usa cookie di
profilazione né strumenti di analisi.

## Modello di registro dei trattamenti (art. 30)
| Campo | Contenuto |
|---|---|
| Titolare / contatti | [...] |
| Trattamento | Gestione soci/volontari e organizzazione eventi (app SDM Eventi) |
| Finalità | Organizzazione eventi, assegnazione compiti, comunicazioni di servizio |
| Categorie di interessati | Soci, volontari, collaboratori, [minori] |
| Categorie di dati | Anagrafici, contatto, data di nascita, iscrizione, attività svolte, log di accesso |
| Destinatari | Amministratori e responsabili di ramo; Supabase, Vercel, Resend (responsabili) |
| Trasferimenti extra UE | [Sì/No, garanzie] |
| Termini di cancellazione | [...] |
| Misure di sicurezza | Accesso con codice, permessi per ruolo, HTTPS, 2FA su account amministrativi, backup, dispositivi protetti |
