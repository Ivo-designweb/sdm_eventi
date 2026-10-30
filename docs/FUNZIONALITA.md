# SDM Eventi - funzionalità e storico delle versioni

Versione dell'app: **4.4** · Script database: **1.7** · Ultimo aggiornamento di questo file: versione 4.4

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
  - **Per persona / per ramo:** righe chiuse di default, si aprono una a una; con una cella-filtro le righe con risultati si aprono una volta sola; link **Apri tutti / Chiudi tutti**. Ogni attività mostra numero, percorso, area colorata e stato.
  - Avviso «senza incaricati», filtro per area.

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
- **Persone:** anagrafica completa, ricerca e filtri, contatto rapido (chiama, WhatsApp, mail), import/export Excel, eliminazione definitiva e dati della persona (GDPR).
- **Eventi:** titolo, date, aree con colore, duplicazione dell'evento (con date spostate, responsabili e incaricati opzionali).
- **Altro:** Excel della struttura (esporta, importa, modello), **Registro modifiche** (amministratori), Da rivedere, Impostazioni, Parametri (proprietario), Informativa privacy, Esci.
- **Registro modifiche** (amministratori): chi ha cambiato cosa e quando, filtri (testo, evento, azione, tipo, periodo), dettaglio «vecchio → nuovo», carica altri, esporta in Excel. Il registro si compila in automatico nel database e si conserva per i mesi indicati nei Parametri.
- **Da rivedere:** modifiche fatte offline che il server non ha potuto applicare.

## 4. Smartphone e PWA
- Barra in basso sempre ferma (Home/Attività, Persone, Eventi, Struttura per l'amministratore, Altro); su iPhone rispetta l'area sicura.
- **Freccia indietro** in alto a sinistra in ogni pagina (e tasto indietro del telefono), con cronologia: pulsante tondo da 44-46 px con bordo, staccato dal logo; uguale nella scheda attività.
- Telefono in verticale e in orizzontale con le stesse funzioni; nessuno scorrimento a destra.
- Numero di versione accanto all'icona del segnale; etichetta della modalità (Operatore / Responsabile / Amministratore) quando si hanno due ruoli.
- Installabile (manifest, icone anche maskable), funziona offline con service worker; si aggiorna alla riapertura (`VERSIONE` in `sw.js` = `app-version` in `index.html`).

## 5. Storico delle versioni

«DB» = serve rieseguire `db/01_schema_sdm_eventi.sql` (versione indicata).

| Versione | Novità | DB |
|---|---|---|
| 4.4 | Freccia indietro più grande (44-46 px, con bordo) e staccata dal logo in tutte le pagine e nella scheda attività | – |
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
Vedi `Readme.txt`. Le anteprime con dati finti sono in `anteprima/`; i controlli a schermo sono stati fatti con un Supabase simulato, quindi alcune funzioni vanno sempre verificate con dati reali.
