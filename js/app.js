/* SDM Eventi - step 0-1: PWA, accesso con link/codice via mail, ruoli, impostazioni e parametri */
(function () {
  'use strict';

  const cfg = window.SDM_CONFIG || {};
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const VERSIONE = (document.querySelector('meta[name=app-version]') || {}).content || '';

  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* memoria piena o bloccata */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* niente */ } }
  };

  const PARAM_DEFAULT = {
    nome_app: 'SDM Eventi', tema: 'chiaro', colore_primario: '#1d4ed8',
    max_livelli: 10, giorni_preavviso_scadenza: 7, responsabile_crea_rami: false
  };
  const RUOLI = { admin: 'Amministratore', utente: 'Utente' };

  const stato = { sb: null, persona: null, parametri: { ...PARAM_DEFAULT }, avviata: false };

  // ---------- schermate ----------
  function mostra(id) {
    ['boot', 'setup', 'login', 'noaccess', 'app'].forEach(x => $('#' + x).classList.toggle('hidden', x !== id));
    $('#footLogin').classList.toggle('hidden', id === 'app');
  }

  function errore(msg) {
    const e = $('#loginErr');
    e.textContent = msg || '';
    e.classList.toggle('hidden', !msg);
  }

  // ---------- parametri e tema ----------
  function applicaParametri(p) {
    const par = { ...PARAM_DEFAULT, ...p };
    stato.parametri = par;
    const r = document.documentElement.style, scuro = par.tema === 'scuro';
    r.setProperty('--bg', scuro ? '#0f1523' : '#f4f6fa');
    r.setProperty('--card', scuro ? '#18202f' : '#ffffff');
    r.setProperty('--testo', scuro ? '#e6eaf2' : '#1c2333');
    r.setProperty('--sec', scuro ? '#9aa6bd' : '#5b6578');
    r.setProperty('--bordo', scuro ? '#2b3649' : '#dde2ec');
    r.setProperty('--primario', par.colore_primario);
    document.body.classList.toggle('scuro', scuro);
    const tc = document.querySelector('meta[name=theme-color]');
    if (tc) tc.content = par.colore_primario;
    document.title = par.nome_app;
    $$('.nome-app').forEach(e => { e.textContent = par.nome_app; });
    $('#iTema').textContent = scuro ? 'Scuro' : 'Chiaro';
  }

  async function caricaParametri() {
    const { data, error } = await stato.sb.from('parametri').select('chiave, valore');
    if (error) throw error;
    const p = {};
    (data || []).forEach(r => { p[r.chiave] = r.valore; });
    LS.set('sdm_parametri', p);
    applicaParametri(p);
    return Object.keys(p).length;
  }

  // ---------- accesso ----------
  async function inviaLink(ev) {
    ev.preventDefault();
    errore('');
    const mail = $('#mail').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { errore('Inserisci un indirizzo email valido.'); return; }
    if (!navigator.onLine) { errore('Sei offline: il primo accesso richiede la connessione.'); return; }
    const b = $('#invia'); b.disabled = true;
    const redirect = location.origin;   // senza "/" finale: coincide con la voce inserita in Redirect URLs
    const { error } = await stato.sb.auth.signInWithOtp({
      email: mail, options: { emailRedirectTo: redirect }
    });
    b.disabled = false;
    if (error) {
      errore(error.status === 429 ? 'Troppe richieste: attendi qualche minuto e riprova.' : 'Invio non riuscito: ' + error.message);
      return;
    }
    $('#mailInv').textContent = mail;
    $('#redirInfo').textContent = 'Il link della mail porta a: ' + redirect;
    $('#loginForm').classList.add('hidden');
    $('#loginOk').classList.remove('hidden');
  }

  async function verificaCodice(ev) {
    ev.preventDefault();
    errore('');
    const token = $('#codice').value.trim();
    if (!token) { errore('Inserisci il codice ricevuto per mail.'); return; }
    const email = $('#mailInv').textContent;
    // il codice è valido per "email" (accesso) o "signup" (primo accesso): provo entrambi
    let { error } = await stato.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      const r = await stato.sb.auth.verifyOtp({ email, token, type: 'signup' });
      if (!r.error) error = null;
    }
    if (error) errore('Codice non accettato (' + error.message + '). Usa il codice dell\'ultima mail ricevuta, senza aver cliccato il link.');
    // in caso di successo parte onAuthStateChange
  }

  async function esci(ev) {
    if (ev) ev.preventDefault();
    try { await stato.sb.auth.signOut(); } catch (e) { /* offline: pulisco comunque */ }
    LS.del('sdm_profilo');
    stato.persona = null;
    stato.avviata = false;
    $('#loginForm').classList.remove('hidden');
    $('#loginOk').classList.add('hidden');
    mostra('login');
  }

  async function iniziaSessione(session) {
    if (stato.avviata) return;
    stato.avviata = true;
    const uid = session.user.id, mail = session.user.email;
    let persona = null;
    try {
      const { data: pid, error } = await stato.sb.rpc('collega_utente');
      if (error) throw error;
      if (!pid) {
        $('#naMail').textContent = mail;
        stato.avviata = false;
        mostra('noaccess');
        return;
      }
      const { data, error: e2 } = await stato.sb.from('persone')
        .select('id, cognome, nome, email, ruolo').eq('id', pid).single();
      if (e2) throw e2;
      persona = { ...data, uid };
      LS.set('sdm_profilo', persona);
      stato.persona = persona;
      let nPar = 0, parErr = false;
      try { nPar = await caricaParametri(); } catch (e) { parErr = true; }
      avviaApp(true, nPar, parErr);
    } catch (e) {
      // rete assente o server non raggiungibile: uso il profilo salvato dell'ultimo accesso
      const salvato = LS.get('sdm_profilo');
      if (salvato && salvato.uid === uid) {
        stato.persona = salvato;
        applicaParametri(LS.get('sdm_parametri') || {});
        avviaApp(false, 0, true);
      } else {
        stato.avviata = false;
        mostra('login');
        errore('Impossibile completare l\'accesso: ' + (e && e.message ? e.message : 'connessione assente'));
      }
    }
  }

  // ---------- app ----------
  function avviaApp(online, nPar, parErr) {
    const p = stato.persona, admin = p.ruolo === 'admin';
    const nome = p.nome + ' ' + p.cognome;
    $('#uNome').textContent = nome;
    $('#uRuolo').textContent = RUOLI[p.ruolo] || p.ruolo;
    $('#saluto').textContent = p.nome;
    $('#sottoSaluto').textContent = admin ? 'Vedi e gestisci tutti gli eventi.' : 'Vedi le attività in cui sei incaricato.';
    $('#iNome').textContent = nome;
    $('#iMail').textContent = p.email;
    $('#iRuolo').textContent = RUOLI[p.ruolo] || p.ruolo;
    $$('.adminOnly').forEach(e => e.classList.toggle('hidden', !admin));
    $('#stConn').textContent = online ? 'Connesso' : 'Non raggiungibile (dati salvati)';
    $('#stUtente').textContent = nome + ' (' + (RUOLI[p.ruolo] || p.ruolo) + ')';
    $('#stPar').textContent = parErr ? 'Non aggiornati' : (nPar + ' parametri');
    mostra('app');
    vai(admin && location.hash === '#par' ? 'par' : 'home');
    aggiornaRete();
  }

  function vai(p) {
    if (p === 'par' && !(stato.persona && stato.persona.ruolo === 'admin')) p = 'home';
    $$('.pg').forEach(e => e.classList.add('hidden'));
    $('#p-' + p).classList.remove('hidden');
    $$('.nv, .bottom button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    if (p === 'par') riempiParametri();
    window.scrollTo(0, 0);
  }

  function aggiornaRete() {
    const on = navigator.onLine, c = $('#rete');
    c.className = 'chip ' + (on ? 'on' : 'off');
    c.textContent = on ? '● Online' : '● Offline';
  }

  // ---------- parametri (admin) ----------
  function riempiParametri() {
    const p = stato.parametri;
    $('#pNome').value = p.nome_app; $('#pTema').value = p.tema; $('#pCol').value = p.colore_primario;
    $('#pLiv').value = p.max_livelli; $('#pGg').value = p.giorni_preavviso_scadenza;
    $('#pResp').checked = !!p.responsabile_crea_rami;
    $('#parMsg').textContent = '';
  }

  async function salvaParametri(ev) {
    ev.preventDefault();
    const msg = $('#parMsg');
    const liv = parseInt($('#pLiv').value, 10), gg = parseInt($('#pGg').value, 10);
    const nome = $('#pNome').value.trim();
    if (!nome) { msg.textContent = 'Il nome applicazione è obbligatorio.'; return; }
    if (!(liv >= 1 && liv <= 10)) { msg.textContent = 'I livelli devono essere da 1 a 10.'; return; }
    if (!(gg >= 0 && gg <= 60)) { msg.textContent = 'I giorni di preavviso devono essere da 0 a 60.'; return; }
    if (!navigator.onLine) { msg.textContent = 'Serve la connessione per salvare i parametri.'; return; }
    const nuovi = {
      nome_app: nome, tema: $('#pTema').value, colore_primario: $('#pCol').value,
      max_livelli: liv, giorni_preavviso_scadenza: gg, responsabile_crea_rami: $('#pResp').checked
    };
    const righe = Object.entries(nuovi).map(([chiave, valore]) => ({ chiave, valore }));
    $('#salva').disabled = true;
    const { error } = await stato.sb.from('parametri').upsert(righe, { onConflict: 'chiave' });
    $('#salva').disabled = false;
    if (error) { msg.textContent = 'Salvataggio non riuscito: ' + error.message; return; }
    LS.set('sdm_parametri', nuovi);
    applicaParametri(nuovi);
    msg.textContent = '✔ Salvato';
  }

  // ---------- installazione PWA ----------
  let promptInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstall = e; });
  function installa() {
    if (promptInstall) { promptInstall.prompt(); promptInstall = null; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
      alert('L\'app è già installata su questo dispositivo.');
    } else if (ios) {
      $('#iosHint').classList.remove('hidden');
    } else {
      alert('Usa il menu del browser e scegli "Installa app" o "Aggiungi a schermata Home".');
    }
  }

  // ---------- avvio ----------
  function registraSW() {
    if (!('serviceWorker' in navigator)) return;
    const aveva = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => { /* fuori da https o file:// */ });
    let ricaricata = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (aveva && !ricaricata) { ricaricata = true; location.reload(); }   // nuova versione attivata
    });
  }

  async function avvia() {
    $$('.vers').forEach(e => { e.textContent = VERSIONE; });
    $('#iVers').textContent = VERSIONE;
    applicaParametri(LS.get('sdm_parametri') || {});
    registraSW();

    $('#loginForm').addEventListener('submit', inviaLink);
    $('#codeForm').addEventListener('submit', verificaCodice);
    $('#indietro').onclick = () => { $('#loginForm').classList.remove('hidden'); $('#loginOk').classList.add('hidden'); errore(''); };
    $('#esci').onclick = esci; $('#esci2').onclick = esci; $('#naEsci').onclick = esci;
    $('#parForm').addEventListener('submit', salvaParametri);
    $('#installa').onclick = installa;
    $('#vaiPar').onclick = () => vai('par');
    $$('.nv, .bottom button').forEach(b => { b.onclick = () => vai(b.dataset.p); });
    window.addEventListener('online', aggiornaRete);
    window.addEventListener('offline', aggiornaRete);

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { mostra('setup'); return; }

    stato.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      db: { schema: cfg.SCHEMA || 'sdm_eventi' },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    stato.sb.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_IN' && session) setTimeout(() => iniziaSessione(session), 0);
      if (evento === 'SIGNED_OUT') { stato.avviata = false; stato.persona = null; mostra('login'); }
    });

    const { data } = await stato.sb.auth.getSession();
    if (data && data.session) await iniziaSessione(data.session);
    else mostra('login');
  }

  avvia();
})();
