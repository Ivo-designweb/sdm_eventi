# Regole di sviluppo del progetto

Queste regole valgono per ogni sessione di lavoro su questo repository.

## Tecnologie

- Quando si chiede di scrivere una APP, usare di default **HTML e JavaScript**, salvo diversa indicazione.
- Ogni app è sviluppata come **PWA** (Progressive Web App) con interfaccia adatta sia a **smartphone sia a PC**, come descritto nelle sezioni seguenti.

## Interfaccia smartphone e PC

- Approccio **mobile-first**, ma l'interfaccia deve essere pienamente usabile anche su PC (schermi larghi, mouse e tastiera).
- Includere sempre nell'HTML:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#...">
  <link rel="manifest" href="manifest.webmanifest">
  ```
- Layout fluido con Flexbox o Grid e media query; niente larghezze fisse in pixel che causino scroll orizzontale.
- Smartphone: elementi touch di almeno 44x44 px, testo leggibile senza zoom, nessuna funzione disponibile solo con l'hover, rispetto delle aree sicure (`env(safe-area-inset-*)`), funzionamento in verticale e in orizzontale.
- PC: contenuto non troppo allargato (larghezza massima o layout a colonne), supporto alla tastiera (Tab, Invio, Esc) e stati di focus visibili.
- Se l'app ha menu o navigazione, adattarli ai due formati (ad esempio barra in basso su smartphone, barra laterale o in alto su PC).
- Verificare il risultato almeno a ~360 px, ~768 px e ~1280 px di larghezza.

## File PWA (service worker e manifest)

Ogni app deve avere, nella stessa cartella dell'`index.html`:

- `index.html`: pagina principale, che registra il service worker.
- `manifest.webmanifest`: manifest dell'app.
- `sw.js`: service worker per il funzionamento offline.
- `icons/`: icone dell'app, almeno 192x192 e 512x512 px (con versione "maskable").

### Manifest

Campi minimi: `name`, `short_name`, `description`, `lang` ("it"), `start_url`, `scope`, `display` ("standalone"), `orientation` ("any"), `background_color`, `theme_color`, `icons`.

Usare **percorsi relativi** (ad esempio `./` e `icons/icon-192.png`), così l'app funziona anche se pubblicata in una sottocartella (GitHub Pages: `utente.github.io/nome-repo/`).

### Service worker

- Definire una costante per il nome della cache (ad esempio `const CACHE_NAME = 'nomeapp-v1.0-b1'`) e l'elenco dei file da mettere in cache (`index.html`, JavaScript, CSS, manifest, icone).
- `install`: precache dei file dell'elenco.
- `activate`: eliminare le cache con nome diverso da quello corrente.
- `fetch`: strategia *cache-first* per i file statici, con ripiego sulla rete; per `index.html` si può usare *network-first* con ripiego sulla cache.
- Usare percorsi relativi anche nel service worker.
- Registrazione in `index.html`:
  ```js
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
  ```

## Aggiornamento di sw.js e manifest

Ogni volta che si genera o si modifica un'app:

- Aggiornare l'elenco dei file in `sw.js` se vengono aggiunti, rinominati o rimossi file.
- **Cambiare il nome della cache in `sw.js` a ogni modifica ai file in cache**, anche minima. Altrimenti gli utenti continuano a vedere la vecchia versione.
- Il nome della cache usa il numero di versione dell'app più un suffisso di build (ad esempio `v1.3-b2`). Il suffisso di build aumenta a ogni modifica; il numero di versione cambia solo secondo le regole della sezione "Versioni".
- Aggiornare `manifest.webmanifest` quando cambiano nome, colori, icone, percorsi o descrizione.
- Controllare che le icone indicate nel manifest esistano davvero.
- Segnalare sempre quali file PWA sono stati modificati.
- Se cambia db/01_schema_sdm_eventi.sql aggiornare il numero di versione dello script nella sua intestazione e dire all'utente di rieseguirlo in Supabase.
- Per le modifiche grandi mostrare prima un'anteprima in anteprima/

## Requisiti di test e pubblicazione

- Il service worker funziona solo in **HTTPS** (o su `localhost`): GitHub Pages va bene.
- Per provare in locale usare un piccolo server (ad esempio `python -m http.server`), non aprire il file con doppio clic.
- Controllare nella console del browser (scheda Application) che manifest e service worker siano riconosciuti e che l'app sia installabile.
- Provare il funzionamento offline.
- Dopo un aggiornamento, ricaricare o chiudere e riaprire l'app per ricevere il nuovo service worker; se utile, prevedere un avviso "Nuova versione disponibile" con pulsante di aggiornamento.
- Salvare i dati dell'utente in `localStorage` o IndexedDB; senza backend, avvisare che i dati restano solo sul dispositivo.

## Prima di iniziare

- Se ci sono parti dubbie o ambigue nella richiesta, **fare domande prima di iniziare lo sviluppo**.
- Non partire con ipotesi proprie su aspetti poco chiari: chiedere conferma.

## Versioni

- Ogni file HTML ha un numero di versione.
- Incrementare la versione di **0.1** solo quando vengono aggiunte **funzionalità nuove o diverse**.
- Non incrementare la versione per correzioni minime (refusi, piccoli ritocchi grafici, sistemazione di commenti) che non cambiano le funzionalità.
- Quando si incrementa la versione, riportare il nuovo numero:
  - nel file `index`;
  - nella sezione impostazioni, se presente;
  - nel nome della cache di `sw.js` (vedi sezione "Aggiornamento di sw.js e manifest").
- Comunicare sempre il numero di versione quando si modifica un file HTML.
- Ad ogni versione aggiornare docs/FUNZIONALITA.md: sezione «Funzionalità» se cambia il comportamento, una riga nella tabella «Storico», e la riga di intestazione con versione app, versione DB e ultimo aggiornamento.

## Pagina impostazioni

- Se l'app o la pagina HTML ha una pagina o sezione di impostazioni, aggiungere **in fondo alla pagina** la dicitura:

  `Contatta lo sviluppatore:` seguita dall'indirizzo **ivotaffarel@gmail.com** come link cliccabile per inviare una mail, ad esempio:

  ```html
  <p>Contatta lo sviluppatore: <a href="mailto:ivotaffarel@gmail.com">ivotaffarel@gmail.com</a></p>
  ```

## Git e commit

- **Non fare commit automatici.**
- Fare commit sul branch `main` **solo su richiesta esplicita**.
- Le modifiche rischiose o sperimentali vanno proposte su un branch separato, senza toccare `main`.

