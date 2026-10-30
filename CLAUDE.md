# Regole di lavoro per questo progetto (SDM Eventi)

- App in HTML + JavaScript (PWA). Lingua dell'interfaccia e dei messaggi: italiano.
- Ad ogni modifica dell'app incrementare la versione di 0.1 in `index.html` (`meta app-version`) e in `sw.js` (`VERSIONE`): devono coincidere. La versione compare anche in Impostazioni.
- Se cambia `db/01_schema_sdm_eventi.sql` aggiornare il numero di versione dello script nella sua intestazione e dire all'utente di rieseguirlo in Supabase.
- **Ad ogni versione aggiornare `docs/FUNZIONALITA.md`**: sezione «Funzionalità» se cambia il comportamento, una riga nella tabella «Storico», e la riga di intestazione con versione app, versione DB e ultimo aggiornamento.
- Nelle Impostazioni e in fondo alle pagine l'indirizzo dello sviluppatore è ivotaffarel@gmail.com (cliccabile).
- Sviluppare su un branch separato e pubblicare su `main` solo quando l'utente lo chiede. Per le modifiche grandi mostrare prima un'anteprima in `anteprima/`.
- In caso di dubbi, fare domande prima di sviluppare.
