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

  const stato = { sb: null, persona: null, evento: null, parametri: { ...PARAM_DEFAULT }, avviata: false };

  // ---------- schermate ----------
  function mostraLogin() {
    mostra('login');
    const att = LS.get('sdm_mail_attesa');
    if (att && att.mail && Date.now() - att.t < 3600 * 1000) mostraCodice(att.mail);
    else { $('#loginForm').classList.remove('hidden'); $('#loginOk').classList.add('hidden'); }
  }

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
  const MAIL_ATTESA = 'sdm_mail_attesa';   // mail a cui è stato inviato il codice (resta valida 1 ora)
  let ultimoInvio = 0;

  function mostraCodice(mail) {
    $('#mailInv').textContent = mail;
    $('#redirInfo').textContent = '';
    $('#loginForm').classList.add('hidden');
    $('#loginOk').classList.remove('hidden');
    $('#codice').value = '';
  }

  async function inviaCodice(mail) {
    if (!navigator.onLine) { errore('Sei offline: l\'accesso richiede la connessione.'); return false; }
    const prec = LS.get(MAIL_ATTESA);
    const attesa = 60 - Math.floor((Date.now() - Math.max(ultimoInvio, prec && prec.mail === mail ? prec.t : 0)) / 1000);
    if (attesa > 0) { errore('Attendi ' + attesa + ' secondi prima di richiedere un nuovo codice.'); return false; }
    const redirect = location.origin;   // senza "/" finale: coincide con la voce inserita in Redirect URLs
    const { error } = await stato.sb.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: redirect } });
    if (error) {
      errore(error.status === 429 ? 'Troppe richieste: attendi qualche minuto e riprova.' : 'Invio non riuscito: ' + error.message);
      return false;
    }
    ultimoInvio = Date.now();
    LS.set(MAIL_ATTESA, { mail, t: Date.now() });
    return true;
  }

  async function inviaLink(ev) {
    ev.preventDefault();
    errore('');
    const mail = $('#mail').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { errore('Inserisci un indirizzo email valido.'); return; }
    const b = $('#invia'); b.disabled = true;
    const ok = await inviaCodice(mail);
    b.disabled = false;
    if (ok) mostraCodice(mail);
  }

  async function reinvia() {
    errore('');
    const b = $('#reinvia'); b.disabled = true;
    const ok = await inviaCodice($('#mailInv').textContent);
    b.disabled = false;
    if (ok) errore('');
  }

  async function verificaCodice(ev) {
    ev.preventDefault();
    errore('');
    const token = $('#codice').value.replace(/\s/g, '');
    if (!token) { errore('Inserisci il codice ricevuto per mail.'); return; }
    if (!navigator.onLine) { errore('Sei offline: l\'accesso richiede la connessione.'); return; }
    const email = $('#mailInv').textContent;
    // il codice è valido per "email" (accesso) o "signup" (primo accesso): provo entrambi
    let { error } = await stato.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      const r = await stato.sb.auth.verifyOtp({ email, token, type: 'signup' });
      if (!r.error) error = null;
    }
    if (error) errore('Codice non accettato (' + error.message + '). Usa il codice dell\'ultima mail ricevuta.');
    else LS.del(MAIL_ATTESA);
    // in caso di successo parte onAuthStateChange
  }

  async function esci(ev) {
    if (ev) ev.preventDefault();
    try { await stato.sb.auth.signOut(); } catch (e) { /* offline: pulisco comunque */ }
    LS.del('sdm_profilo'); LS.del('sdm_persone'); LS.del(MAIL_ATTESA);
    stato.persona = null;
    stato.avviata = false;
    $('#loginForm').classList.remove('hidden');
    $('#loginOk').classList.add('hidden');
    mostraLogin();
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
        mostraLogin();
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
    if (p === 'persone') caricaPersone();
    window.scrollTo(0, 0);
  }

  function aggiornaRete() {
    const on = navigator.onLine, c = $('#rete');
    c.className = 'chip ' + (on ? 'on' : 'off');
    c.textContent = on ? '● Online' : '● Offline';
    document.body.classList.toggle('offline', !on);
  }


  // ---------- persone ----------
  const isAdmin = () => !!(stato.persona && stato.persona.ruolo === 'admin');
  const COLONNE = 'id, cognome, nome, email, cellulare, iscritto, numero_iscritto, data_nascita, note, ruolo, attivo';
  const P = { elenco: [], corrente: null, aggiornato: null };

  function h(tag, attr, ...figli) {
    const e = document.createElement(tag);
    Object.entries(attr || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) e.setAttribute(k, v); });
    figli.flat().forEach(f => e.append(f));
    return e;
  }
  const cifre = t => (t || '').replace(/[^0-9]/g, '');
  const tel = t => (t || '').replace(/[^0-9+]/g, '');
  function waNumero(t) {   // senza prefisso internazionale assumo l'Italia
    const c = cifre(t);
    if ((t || '').trim().startsWith('+')) return c;
    if (c.startsWith('00')) return c.slice(2);
    return '39' + c.replace(/^0+(?=3)/, '');
  }

  async function caricaPersone() {
    const lista = $('#perLista');
    if (!isAdmin()) {
      // gli altri vedono solo nome e cognome delle persone dell'evento scelto (la scelta evento arriva con lo step 3)
      $('#perSotto').textContent = 'Persone collegate alle attività a cui hai accesso';
      $('#perAgg').textContent = '';
      if (!stato.evento) {
        lista.replaceChildren(h('p', { class: 'sec' }, 'Scegli prima un evento: qui vedrai le persone collegate alle attività a cui hai accesso. (La scelta dell\'evento arriva con lo step 3.)'));
        return;
      }
      const { data, error } = await stato.sb.rpc('persone_evento', { _evento: stato.evento });
      if (error) { lista.replaceChildren(h('p', { class: 'sec' }, 'Elenco non disponibile: ' + error.message)); return; }
      lista.replaceChildren(...data.map(p => h('div', { class: 'row' }, h('b', {}, p.cognome + ' ' + p.nome))));
      return;
    }
    $('#perSotto').textContent = 'Anagrafica completa';
    const cache = LS.get('sdm_persone');
    if (navigator.onLine) {
      const { data, error } = await stato.sb.from('persone').select(COLONNE).order('cognome').order('nome');
      if (!error) {
        P.elenco = data; P.aggiornato = Date.now();
        LS.set('sdm_persone', { t: P.aggiornato, d: data });
      } else if (cache) { P.elenco = cache.d; P.aggiornato = cache.t; }
    } else if (cache) { P.elenco = cache.d; P.aggiornato = cache.t; }
    renderPersone();
  }

  function renderPersone() {
    if (!isAdmin()) return;
    const q = $('#perCerca').value.trim().toLowerCase(), f = $('#perFiltro').value, na = $('#perNonAttivi').checked;
    const l = P.elenco.filter(p => (na || p.attivo)
      && (!q || [p.cognome, p.nome, p.email, p.cellulare, p.numero_iscritto].join(' ').toLowerCase().includes(q))
      && (!f || (f === 'isc' && p.iscritto) || (f === 'non' && !p.iscritto) || (f === 'adm' && p.ruolo === 'admin')));
    const righe = l.map(p => {
      const az = h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
        p.iscritto ? h('span', { class: 'badge ok' }, 'iscritto ' + (p.numero_iscritto || '')) : h('span', { class: 'badge' }, 'non iscritto'),
        p.ruolo === 'admin' ? h('span', { class: 'badge w' }, 'admin') : '');
      const btn = (href, txt, titolo) => h('a', { class: 'btn sec', style: 'padding:4px 10px', href, title: titolo, 'aria-label': titolo }, txt);
      if (p.cellulare) {
        az.append(btn('tel:' + tel(p.cellulare), '📞', 'Chiama'), btn('https://wa.me/' + waNumero(p.cellulare), '💬', 'WhatsApp'));
        az.lastChild.setAttribute('target', '_blank'); az.lastChild.setAttribute('rel', 'noopener');
      }
      az.append(btn('mailto:' + p.email, '✉️', 'Scrivi una mail'));
      az.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
      const riga = h('div', { class: 'row', style: 'flex-wrap:wrap;cursor:pointer', tabindex: '0' },
        h('div', { style: 'flex:1;min-width:200px' },
          h('b', {}, p.cognome + ' ' + p.nome), ' ', p.attivo ? '' : h('span', { class: 'badge e' }, 'non attivo'),
          h('div', { class: 'sec' }, p.email + (p.cellulare ? ' · ' + p.cellulare : ''))), az);
      riga.addEventListener('click', () => apriPersona(p.id));
      riga.addEventListener('keydown', e => { if (e.key === 'Enter') apriPersona(p.id); });
      return riga;
    });
    $('#perLista').replaceChildren(...(righe.length ? righe : [h('p', { class: 'sec' }, 'Nessuna persona trovata.')]));
    $('#perAgg').textContent = l.length + ' persone' + (P.aggiornato ? ' · aggiornato alle ' + new Date(P.aggiornato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '')
      + (navigator.onLine ? '' : ' · copia salvata sul dispositivo');
  }

  function apriPersona(id) {
    const p = P.elenco.find(x => x.id === id);
    P.corrente = p || null;
    const v = p || { cognome: '', nome: '', email: '', cellulare: '', iscritto: false, numero_iscritto: '', data_nascita: '', note: '', ruolo: 'utente', attivo: true };
    $('#modTit').textContent = p ? 'Modifica persona' : 'Nuova persona';
    $('#fCog').value = v.cognome; $('#fNom').value = v.nome; $('#fMail').value = v.email;
    $('#fCel').value = v.cellulare || ''; $('#fNas').value = v.data_nascita || ''; $('#fRuo').value = v.ruolo;
    $('#fIsc').checked = v.iscritto; $('#fNum').value = v.numero_iscritto || '';
    $('#fNumW').classList.toggle('hidden', !v.iscritto);
    $('#fNot').value = v.note || ''; $('#fAtt').checked = v.attivo;
    $('#fErr').classList.add('hidden');
    $('#modPer').classList.remove('hidden');
    $('#fCog').focus();
  }
  const chiudiPersona = () => $('#modPer').classList.add('hidden');

  function erroreForm(msgs) {
    const e = $('#fErr');
    e.replaceChildren(...[].concat(msgs).flatMap((m, i) => (i ? [h('br'), m] : [m])));
    e.classList.remove('hidden');
  }

  async function salvaPersona(ev) {
    ev.preventDefault();
    const rec = {
      cognome: $('#fCog').value.trim(), nome: $('#fNom').value.trim(), email: $('#fMail').value.trim().toLowerCase(),
      cellulare: $('#fCel').value.trim() || null, iscritto: $('#fIsc').checked,
      numero_iscritto: $('#fIsc').checked ? ($('#fNum').value.trim() || null) : null,
      data_nascita: $('#fNas').value || null, note: $('#fNot').value.trim() || null,
      ruolo: $('#fRuo').value, attivo: $('#fAtt').checked
    };
    const err = [];
    if (!rec.cognome) err.push('Il cognome è obbligatorio.');
    if (!rec.nome) err.push('Il nome è obbligatorio.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) err.push('Email non valida.');
    if (rec.iscritto && !rec.numero_iscritto) err.push('Per un iscritto serve il numero di iscritto.');
    if (P.elenco.some(p => p.id !== (P.corrente && P.corrente.id) && p.email.toLowerCase() === rec.email)) err.push('Questa email è già presente in anagrafica.');
    if (rec.numero_iscritto && P.elenco.some(p => p.id !== (P.corrente && P.corrente.id) && p.numero_iscritto === rec.numero_iscritto)) err.push('Questo numero di iscritto è già assegnato.');
    if (err.length) { erroreForm(err); return; }
    if (!navigator.onLine) { erroreForm('Serve la connessione per salvare.'); return; }

    const sono = P.corrente && P.corrente.id === stato.persona.id;
    if (sono) {
      const avvisi = [];
      if (rec.email !== P.corrente.email.toLowerCase()) avvisi.push('cambiando la tua email dovrai accedere con quella nuova');
      if (rec.ruolo !== 'admin') avvisi.push('perderai i diritti di amministratore');
      if (!rec.attivo) avvisi.push('non potrai più accedere');
      if (avvisi.length && !confirm('Stai modificando la tua scheda: ' + avvisi.join('; ') + '. Continuare?')) return;
    }
    const b = $('#fSalva'); b.disabled = true;
    const q = stato.sb.from('persone');
    const { error } = P.corrente ? await q.update(rec).eq('id', P.corrente.id) : await q.insert(rec);
    b.disabled = false;
    if (error) {
      const m = error.message || '';
      if (error.code === '23505') erroreForm(m.includes('numero_iscritto') ? 'Questo numero di iscritto è già assegnato.' : 'Questa email è già presente in anagrafica.');
      else if (error.code === '23514') erroreForm('Per un iscritto serve il numero di iscritto.');
      else erroreForm('Salvataggio non riuscito: ' + m);
      return;
    }
    chiudiPersona();
    await caricaPersone();
    if (sono && (rec.email !== P.corrente.email.toLowerCase() || rec.ruolo !== 'admin' || !rec.attivo)) location.reload();
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
    $('#indietro').onclick = () => { LS.del(MAIL_ATTESA); $('#loginForm').classList.remove('hidden'); $('#loginOk').classList.add('hidden'); errore(''); };
    $('#reinvia').onclick = reinvia;
    $('#esci').onclick = esci; $('#esci2').onclick = esci; $('#naEsci').onclick = esci;
    $('#parForm').addEventListener('submit', salvaParametri);
    $('#perForm').addEventListener('submit', salvaPersona);
    $('#fAnnulla').onclick = chiudiPersona;
    $('#perNuova').onclick = () => apriPersona(null);
    $('#fIsc').onchange = () => $('#fNumW').classList.toggle('hidden', !$('#fIsc').checked);
    ['#perCerca', '#perFiltro', '#perNonAttivi'].forEach(id => $(id).addEventListener('input', renderPersone));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiPersona(); });
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
      if (evento === 'SIGNED_OUT') { stato.avviata = false; stato.persona = null; mostraLogin(); }
    });

    const { data } = await stato.sb.auth.getSession();
    if (data && data.session) await iniziaSessione(data.session);
    else mostraLogin();
  }

  avvia();
})();
