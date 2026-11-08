SDM Eventi - gestione eventi sportivi (PWA, HTML + JavaScript, Supabase + Vercel)

  index.html, assets/, js/, sw.js, manifest.webmanifest   l'applicazione
  db/01_schema_sdm_eventi.sql                              schema database (schema "sdm_eventi")
  db/99_rimozione_schema_sdm_eventi.sql                    elimina lo schema (solo per i test)
  anteprima/index.html                                     anteprima grafica (dati finti)
  anteprima/*.html                                         anteprime con dati finti (Struttura, rientri, Home, scelta ruolo, smartphone)
  supabase/functions/accesso-email/index.ts                funzione server: accesso senza codice OTP
  supabase/functions/notifiche-scadenze/index.ts           funzione server: notifiche push delle scadenze (Cron ogni ora, invio alle 08:00)
  docs/NOTIFICHE.md                                        notifiche push: regole, installazione su Supabase, prova
  docs/ACCESSO_SENZA_OTP.md                                accesso senza codice OTP
  docs/FUNZIONALITA.md                                     funzionalità e storico delle versioni (da aggiornare a ogni versione)
  docs/SETUP.md                                            installazione e configurazione
  docs/GDPR.md                                             guida pratica alla privacy (GDPR), informativa e registro
