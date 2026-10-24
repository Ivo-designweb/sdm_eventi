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
    max_livelli: 10, giorni_preavviso_scadenza: 7, responsabile_crea_rami: false, logo: null,
    privacy_url: '', privacy_testo: '', informativa_versione: 1, informativa_obbligatoria: false, conservazione_movimenti_mesi: 24
  };
  const RUOLI = { admin: 'Amministratore', utente: 'Operatore' };

  const stato = { sb: null, persona: null, evento: null, eventi: [], avanz: {}, parametri: { ...PARAM_DEFAULT }, avviata: false };

  // ---------- schermate ----------
  function mostraLogin() {
    mostra('login');
    const att = LS.get('sdm_mail_attesa');
    if (att && att.mail && Date.now() - att.t < (cfg.OTP_MINUTI || 5) * 60 * 1000) mostraCodice(att.mail);
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
    const logo = par.logo || 'assets/logo.png';
    $$('.brandimg').forEach(i => { if (i.getAttribute('src') !== logo) i.setAttribute('src', logo); });
    $('#lgPrev').setAttribute('src', logo);
    aggiornaPrivacy();
  }

  async function caricaParametri() {
    const { data, error } = await stato.sb.from('parametri').select('chiave, valore');
    if (error) throw error;
    const p = {};
    (data || []).forEach(r => { p[r.chiave] = r.valore; });
    LS.set('sdm_parametri', p);
    LS.set('sdm_privacy', { url: p.privacy_url || '', testo: p.privacy_testo || '' });
    applicaParametri(p);
    return Object.keys(p).length;
  }

  // ---------- accesso ----------
  const MAIL_ATTESA = 'sdm_mail_attesa';   // mail a cui è stato inviato il codice (resta valida quanto il codice)
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
    const inAttesa = stato.persona ? codaMia().length : 0;
    if (inAttesa && !confirm('Hai ' + inAttesa + ' modifiche non ancora inviate. Se esci ora restano salvate su questo dispositivo e partiranno al prossimo accesso con lo stesso utente. Uscire?')) return;
    try { await stato.sb.auth.signOut(); } catch (e) { /* offline: pulisco comunque */ }
    LS.del('sdm_profilo'); LS.del('sdm_persone'); LS.del('sdm_pulizia'); LS.del('sdm_eventi'); LS.del('sdm_evento'); Object.keys(localStorage).filter(k => k.startsWith('sdm_struttura_')).forEach(k => LS.del(k)); LS.del(MAIL_ATTESA);
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
      persona = { ...data, uid, informativa_ver: 0 };
      try { const iv = await stato.sb.from('persone').select('informativa_ver').eq('id', pid).single(); if (!iv.error) persona.informativa_ver = iv.data.informativa_ver || 0; } catch (e) { /* colonna non ancora presente */ }
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
    mostra('app');
    vai('eventi');
    aggiornaRete();
    caricaEventi().then(() => vai(stato.evento !== null ? 'home' : 'eventi'));
    avviaSincronizzazione();
    verificaInformativa(); pulizieAutomatiche();
  }

  function vai(p) {
    if ((p === 'home' || p === 'str') && stato.evento === null && stato.persona) p = 'eventi';
    if (p === 'par' && !(stato.persona && stato.persona.ruolo === 'admin')) p = 'home';
    $$('.pg').forEach(e => e.classList.add('hidden'));
    $('#p-' + p).classList.remove('hidden');
    $$('.nv, .bottom button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    if (p === 'par') riempiParametri();
    if (p === 'persone') caricaPersone();
    if (p === 'str' || p === 'home') caricaStruttura();
    if (p === 'rev') renderRivedere();
    window.scrollTo(0, 0);
  }

  function aggiornaRete() { aggiornaChip(); }


  // ---------- persone ----------
  const isAdmin = () => !!(stato.persona && stato.persona.ruolo === 'admin');
  const COLONNE = 'id, cognome, nome, email, cellulare, iscritto, numero_iscritto, data_nascita, note, ruolo, attivo';
  const P = { elenco: [], corrente: null, aggiornato: null, resp: {} };

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
        P.elenco = data; P.aggiornato = Date.now(); P.resp = {};
        const r = await stato.sb.from('nodi').select('responsabile_id, titolo').not('responsabile_id', 'is', null);
        (r.data || []).forEach(x => { (P.resp[x.responsabile_id] = P.resp[x.responsabile_id] || []).push(x.titolo); });
        LS.set('sdm_persone', { t: P.aggiornato, d: data, r: P.resp });
      } else if (cache) { P.elenco = cache.d; P.aggiornato = cache.t; P.resp = cache.r || {}; }
    } else if (cache) { P.elenco = cache.d; P.aggiornato = cache.t; P.resp = cache.r || {}; }
    renderPersone();
  }

  function renderPersone() {
    if (!isAdmin()) return;
    const q = $('#perCerca').value.trim().toLowerCase(), f = $('#perFiltro').value, na = $('#perNonAttivi').checked;
    const l = P.elenco.filter(p => (na || p.attivo)
      && (!q || [p.cognome, p.nome, p.email, p.cellulare, p.numero_iscritto].join(' ').toLowerCase().includes(q))
      && (!f || (f === 'isc' && p.iscritto) || (f === 'non' && !p.iscritto) || (f === 'adm' && p.ruolo === 'admin') || (f === 'resp' && P.resp[p.id])));
    const righe = l.map(p => {
      const az = h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
        p.iscritto ? h('span', { class: 'badge ok' }, 'iscritto ' + (p.numero_iscritto || '')) : h('span', { class: 'badge' }, 'non iscritto'),
        p.ruolo === 'admin' ? h('span', { class: 'badge w' }, 'admin') : '',
        P.resp[p.id] ? h('span', { class: 'badge', title: P.resp[p.id].join(', ') }, 'Responsabile: ' + P.resp[p.id].slice(0, 2).join(', ') + (P.resp[p.id].length > 2 ? ' +' + (P.resp[p.id].length - 2) : '')) : '');
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
    $('#fGdpr').classList.toggle('hidden', !p);
    $('#fElimina').classList.toggle('hidden', !p || p.id === stato.persona.id);
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


  // ---------- eventi ----------
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function fmtData(iso) { const [y, m, d] = iso.split('-').map(Number); return d + ' ' + MESI[m - 1] + ' ' + y; }
  function fmtRange(e) {
    if (!e.data_inizio) return 'Data da definire';
    if (!e.data_fine || e.data_fine === e.data_inizio) return fmtData(e.data_inizio);
    const [y1, m1, d1] = e.data_inizio.split('-').map(Number), [y2, m2] = e.data_fine.split('-').map(Number);
    return (y1 === y2 && m1 === m2) ? d1 + '-' + e.data_fine.split('-')[2].replace(/^0/, '') + ' ' + MESI[m1 - 1] + ' ' + y1 : fmtData(e.data_inizio) + ' – ' + fmtData(e.data_fine);
  }
  const oggi = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const concluso = e => (e.data_fine || e.data_inizio || '9999') < oggi();
  const eventoCorrente = () => stato.eventi.find(e => e.id === stato.evento) || null;

  async function caricaEventi() {
    const cache = LS.get('sdm_eventi');
    let ok = false;
    if (navigator.onLine) {
      const { data, error } = await stato.sb.from('eventi').select('id, titolo, data_inizio, data_fine')
        .order('data_inizio', { ascending: false, nullsFirst: false }).order('titolo');
      if (!error) {
        stato.eventi = data; ok = true;
        stato.avanz = {};
        const r = await stato.sb.from('v_avanzamento_eventi').select('evento_id, foglie_totali, percentuale');
        if (!r.error) (r.data || []).forEach(x => { stato.avanz[x.evento_id] = x; });
        LS.set('sdm_eventi', { d: data, a: stato.avanz });
      }
    }
    if (!ok && cache) { stato.eventi = cache.d; stato.avanz = cache.a || {}; }
    // evento scelto: ricordato per utente; se è l'unico disponibile lo seleziono io
    const mem = LS.get('sdm_evento');
    if (stato.evento === null && mem && stato.persona && mem.uid === stato.persona.uid) stato.evento = mem.id;
    if (stato.evento !== null && !eventoCorrente()) stato.evento = null;
    if (stato.evento === null && stato.eventi.length === 1) selezionaEvento(stato.eventi[0].id, false);
    renderEvBar(); renderEventi();
  }

  function selezionaEvento(id, vaiHome) {
    stato.evento = id; S.mod = false; S.collassati = new Set();
    LS.set('sdm_evento', { uid: stato.persona.uid, id });
    renderEvBar(); renderEventi();
    if (vaiHome) vai('home');
  }

  function barraAvanz(e) {
    const a = stato.avanz[e.id];
    if (!a || !a.foglie_totali || (stato.persona && stato.persona.ruolo === 'utente')) return null;
    return h('div', { style: 'min-width:110px' }, h('div', { class: 'sec', style: 'font-size:12px' }, 'Avanzamento ' + a.percentuale + '%'),
      h('div', { class: 'prog' }, h('i', { style: 'width:' + a.percentuale + '%' })));
  }

  function renderEvBar() {
    const e = eventoCorrente();
    $('#evTit').className = 'tt' + (e ? '' : ' nessuno');
    $('#evTit').replaceChildren(...(e
      ? [h('span', {}, 'EVENTO'), h('b', {}, e.titolo), h('span', {}, fmtRange(e))]
      : [h('b', {}, 'Nessun evento selezionato'), h('span', {}, 'Scegli un evento per iniziare')]));
    const av = e ? barraAvanz(e) : null;
    $('#evProg').replaceChildren(...(av ? [av] : []));
    $('#cambiaEv').classList.toggle('hidden', !e);
  }

  function renderEventi() {
    const adm = isAdmin(), l = stato.eventi;
    $('#evInfo').textContent = stato.evento !== null ? 'L\'evento di lavoro è evidenziato. Per cambiarlo, selezionane un altro.'
      : (l.length ? 'Scegli l\'evento su cui lavorare: resterà selezionato in tutte le pagine.'
        : (adm ? 'Nessun evento: creane uno con "+ Nuovo evento".' : 'Nessun evento disponibile: quando ti verranno assegnate delle attività compariranno qui.'));
    $('#evLista').replaceChildren(...l.map(e => {
      const sel = e.id === stato.evento, av = barraAvanz(e);
      const card = h('div', { class: 'evc' + (sel ? ' sel' : '') },
        h('div', { class: 'inf' }, h('b', {}, e.titolo), ' ', concluso(e) ? h('span', { class: 'badge' }, 'concluso') : '', h('div', { class: 'sec' }, fmtRange(e))),
        av || '');
      if (sel) card.append(h('span', { class: 'badge ok' }, '● Selezionato'));
      else { const b = h('button', { class: 'btn', type: 'button' }, 'Seleziona'); b.addEventListener('click', () => selezionaEvento(e.id, true)); card.append(b); }
      if (adm) { const m = h('button', { class: 'btn sec need-net', type: 'button' }, 'Modifica'); m.addEventListener('click', () => apriEvento(e.id)); card.append(m);
        const d = h('button', { class: 'btn sec need-net', type: 'button' }, 'Duplica'); d.addEventListener('click', () => apriDuplica(e.id)); card.append(d); }
      return card;
    }));
  }

  let evCorr = null;
  function apriEvento(id) {
    evCorr = stato.eventi.find(x => x.id === id) || null;
    const e = evCorr || { titolo: '', data_inizio: '', data_fine: '' };
    $('#evModTit').textContent = evCorr ? 'Modifica evento' : 'Nuovo evento';
    $('#eTit').value = e.titolo; $('#eIni').value = e.data_inizio || ''; $('#eFin').value = e.data_fine || '';
    $('#eDel').classList.toggle('hidden', !evCorr);
    $('#eErr').classList.add('hidden');
    $('#modEv').classList.remove('hidden'); $('#eTit').focus();
  }
  const chiudiEvento = () => $('#modEv').classList.add('hidden');
  function erroreEv(m) { $('#eErr').textContent = m; $('#eErr').classList.remove('hidden'); }

  async function salvaEvento(ev) {
    ev.preventDefault();
    const rec = { titolo: $('#eTit').value.trim(), data_inizio: $('#eIni').value || null, data_fine: $('#eFin').value || null };
    if (!rec.titolo) { erroreEv('Il titolo è obbligatorio.'); return; }
    if (!rec.data_inizio) { erroreEv('La data è obbligatoria.'); return; }
    if (rec.data_fine && rec.data_fine < rec.data_inizio) { erroreEv('La data fine non può precedere la data di inizio.'); return; }
    if (!navigator.onLine) { erroreEv('Serve la connessione per salvare.'); return; }
    const b = $('#eSalva'); b.disabled = true;
    const q = stato.sb.from('eventi');
    const { error } = evCorr ? await q.update(rec).eq('id', evCorr.id) : await q.insert({ ...rec, creato_da: stato.persona.id });
    b.disabled = false;
    if (error) { erroreEv('Salvataggio non riuscito: ' + error.message); return; }
    chiudiEvento(); await caricaEventi();
  }

  async function eliminaEvento() {
    if (!evCorr) return;
    if (!navigator.onLine) { erroreEv('Serve la connessione per eliminare.'); return; }
    if (!confirm('Eliminare definitivamente l\'evento "' + evCorr.titolo + '" con tutti i suoi rami, attività e incarichi? L\'operazione non si può annullare.')) return;
    const { error } = await stato.sb.from('eventi').delete().eq('id', evCorr.id);
    if (error) { erroreEv('Eliminazione non riuscita: ' + error.message); return; }
    if (stato.evento === evCorr.id) stato.evento = null;
    chiudiEvento(); await caricaEventi();
  }


  // ---------- struttura (rami e attività) ----------
  const S = { pend: new Set(), nodi: [], inc: {}, nomi: {}, assegnabili: [], byId: {}, byParent: {}, mod: false, collassati: new Set(), corr: null, padre: null, sort: [] };
  const maxLivelli = () => Math.min(10, Math.max(1, parseInt(stato.parametri.max_livelli, 10) || 10));
  const nomeP = id => S.nomi[id] || '—';
  const figli = id => S.byParent[id || 'root'] || [];
  const nodo = id => S.byId[id] || null;
  const isLeaf = n => !figli(n.id).length;
  const antenati = n => { const r = []; let x = n.parent_id ? nodo(n.parent_id) : null; while (x) { r.push(x); x = x.parent_id ? nodo(x.parent_id) : null; } return r; };
  const sottoalbero = n => figli(n.id).flatMap(c => [c, ...sottoalbero(c)]);
  const altezza = n => 1 + Math.max(0, ...figli(n.id).map(altezza));
  const foglie = n => isLeaf(n) ? [n] : figli(n.id).flatMap(foglie);
  const dentro = (a, b) => antenati(b).some(x => x.id === a.id);   // b è sotto a
  const respDi = (n, incl) => { const me = stato.persona.id; return (incl && n.responsabile_id === me) || antenati(n).some(a => a.responsabile_id === me); };
  const canEdit = n => isAdmin() || respDi(n, true);
  const canDel = n => isAdmin() || respDi(n, false);
  const canAdd = n => isAdmin() || (!!stato.parametri.responsabile_crea_rami && respDi(n, true));
  const nIncarichi = n => (S.inc[n.id] || []).length;
  const percorsoTxt = n => [...antenati(n).reverse(), n].map(x => x.titolo).join(' › ');

  function ordina() {
    S.byId = {}; S.byParent = {};
    S.nodi.forEach(n => { S.byId[n.id] = n; const k = n.parent_id || 'root'; (S.byParent[k] = S.byParent[k] || []).push(n); });
    Object.values(S.byParent).forEach(a => a.sort((x, y) => (x.posizione - y.posizione) || x.titolo.localeCompare(y.titolo)));
  }

  async function caricaStruttura() {
    if (stato.evento === null) return;
    const chiave = 'sdm_struttura_' + stato.evento;
    let ok = false;
    if (navigator.onLine) {
      const [n, i, pe, pa] = await Promise.all([
        stato.sb.from('nodi').select('id, parent_id, livello, posizione, titolo, descrizione, note, scadenza, stato, responsabile_id').eq('evento_id', stato.evento),
        stato.sb.from('incarichi').select('id, nodo_id, persona_id, nota'),
        stato.sb.rpc('persone_evento', { _evento: stato.evento }),
        stato.sb.rpc('persone_assegnabili')
      ]);
      if (!n.error) {
        ok = true;
        S.nodi = n.data;
        const ids = new Set(S.nodi.map(x => x.id)); S.inc = {};
        (i.data || []).filter(x => ids.has(x.nodo_id)).forEach(x => { (S.inc[x.nodo_id] = S.inc[x.nodo_id] || []).push({ id: x.id, persona_id: x.persona_id, nota: x.nota }); });
        S.nomi = {}; S.assegnabili = (pa.data || []);
        [...(pe.data || []), ...S.assegnabili].forEach(p => { S.nomi[p.id] = p.cognome + ' ' + p.nome; });
        sovrapponiCoda();
        LS.set(chiave, { n: S.nodi, i: S.inc, m: S.nomi, a: S.assegnabili });
      }
    }
    if (!ok) { const c = LS.get(chiave); if (c) { S.nodi = c.n; S.inc = c.i; S.nomi = c.m; S.assegnabili = c.a || []; } else S.nodi = []; sovrapponiCoda(); }
    renderStruttura(); renderHome();
  }

  function badgeStato(st) {
    const t = { da_fare: ['badge', 'da fare'], in_corso: ['badge w', 'in corso'], fatto: ['badge ok', 'fatto'], finito: ['badge ok', '✔ finito'] }[st] || ['badge', st];
    return h('span', { class: t[0] }, t[1]);
  }
  function badgeScad(n) {
    if (!n.scadenza) return '';
    const o = oggi(), chiuso = n.stato === 'finito' || n.stato === 'fatto', d = n.scadenza.split('-').reverse().slice(0, 2).join('/');
    if (!chiuso && n.scadenza < o) return h('span', { class: 'badge e' }, 'scaduta ' + d);
    const gg = (new Date(n.scadenza) - new Date(o)) / 864e5;
    if (!chiuso && gg <= (parseInt(stato.parametri.giorni_preavviso_scadenza, 10) || 7)) return h('span', { class: 'badge w' }, 'scade ' + d);
    return h('span', { class: 'badge' }, 'scad. ' + d);
  }

  function rigaNodo(n) {
    const lf = isLeaf(n), aperto = !S.collassati.has(n.id), lv = n.livello;
    const meta = h('div', { class: 'meta' });
    if (S.pend && S.pend.has(n.id)) meta.append(h('span', { class: 'badge w' }, '⏳ in attesa'));
    if (n.responsabile_id) meta.append(h('span', { class: 'badge' }, '👤 ' + nomeP(n.responsabile_id)));
    if (lf) meta.append(badgeStato(n.stato), badgeScad(n), h('span', { class: 'badge' }, '👥 ' + nIncarichi(n)));
    else {
      const ls = foglie(n), f = ls.filter(x => x.stato === 'finito').length, p = ls.length ? Math.round(100 * f / ls.length) : 0;
      meta.append(h('span', { class: 'sec', style: 'font-size:12px' }, f + '/' + ls.length + ' ', h('span', { class: 'mini' }, h('i', { style: 'width:' + p + '%' })), ' ' + p + '%'));
    }
    const btns = h('div', { style: 'display:flex;gap:6px' });
    const ib = (txt, titolo, fn, cl) => { const b = h('button', { class: 'ib' + (cl ? ' ' + cl : ''), type: 'button', title: titolo, 'aria-label': titolo }, txt); b.addEventListener('click', fn); return b; };
    let handle = '';
    if (S.mod) {
      if (canEdit(n)) handle = h('span', { class: 'hd', title: 'Trascina' }, '☰');
      if (canAdd(n) && lv < maxLivelli()) btns.append(ib('＋', 'Aggiungi sottoramo', () => apriNodo(null, n.id)));
      if (canEdit(n)) btns.append(ib('✎', 'Modifica', () => apriNodo(n.id, null)), ib('⇄', 'Sposta in…', () => apriSposta(n.id)));
      if (canDel(n)) btns.append(ib('🗑', 'Elimina', () => eliminaNodo(n.id), 'dn'));
    }
    let tg;
    if (lf) tg = h('span', { style: 'width:26px;display:inline-block' });
    else { tg = h('button', { class: 'tg', type: 'button', 'aria-label': aperto ? 'Comprimi' : 'Espandi' }, aperto ? '▼' : '▶'); tg.addEventListener('click', () => { if (aperto) S.collassati.add(n.id); else S.collassati.delete(n.id); renderStruttura(); }); }
    const row = h('div', { class: 'tn' + (lf ? '' : ' br') }, handle, tg,
      h('div', { class: 'tt2' }, h('b', {}, n.titolo), n.descrizione ? h('div', { class: 'sec', style: 'font-size:13px' }, n.descrizione) : ''), meta, btns);
    if (lf && !S.mod) { row.style.cursor = 'pointer'; row.setAttribute('tabindex', '0'); row.addEventListener('click', () => apriScheda(n.id)); row.addEventListener('keydown', e => { if (e.key === 'Enter') apriScheda(n.id); }); }
    const li = h('li', { 'data-id': n.id }, row);
    if (!lf && aperto) { const ul = h('ul', { class: 'trl', 'data-parent': n.id }); figli(n.id).forEach(c => ul.append(rigaNodo(c))); li.append(ul); }
    else if (lf && S.mod) li.append(h('ul', { class: 'trl vuoto', 'data-parent': n.id }));
    return li;
  }

  function renderStruttura() {
    if (!navigator.onLine) S.mod = false;
    ordina(); S.pend = nodiInAttesa();
    const adm = isAdmin();
    const puoMod = adm || S.nodi.some(n => n.responsabile_id === stato.persona.id);
    $('#strModBtn').classList.toggle('hidden', !puoMod);
    $('#strModBtn').textContent = S.mod ? '✔ Fine modifica' : '✎ Modifica struttura';
    const lista = $('#strLista');
    $('#strInfo').textContent = adm ? 'Albero completo dell\'evento · max ' + maxLivelli() + ' livelli'
      : (puoMod ? 'I rami di cui sei responsabile e le tue attività' : 'Le attività in cui sei incaricato');
    S.sort.forEach(x => x.destroy()); S.sort = [];
    const nuovo = adm && S.mod ? h('div', { style: 'margin-bottom:10px' }, (() => { const b = h('button', { class: 'btn need-net', type: 'button' }, '+ Nuovo ramo di primo livello'); b.addEventListener('click', () => apriNodo(null, null)); return b; })()) : '';
    const radice = h('ul', { class: 'trl' });
    figli(null).forEach(n => radice.append(rigaNodo(n)));
    lista.replaceChildren(...[nuovo, S.nodi.length ? radice : h('p', { class: 'sec' }, adm ? 'Nessun ramo: crea il primo con "Modifica struttura".' : 'Nessuna attività assegnata per questo evento.')].filter(Boolean));
    if (S.mod && window.Sortable) lista.querySelectorAll('ul.trl').forEach(ul => S.sort.push(new window.Sortable(ul, {
      group: 'albero', handle: '.hd', animation: 150, forceFallback: true, fallbackOnBody: true, swapThreshold: 0.65, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
      delay: cfg.DRAG_DELAY_MS === undefined ? 500 : cfg.DRAG_DELAY_MS, delayOnTouchOnly: true, touchStartThreshold: 8,
      onStart: () => { if (navigator.vibrate) navigator.vibrate(25); },
      onMove: e => { const n = nodo(e.dragged.dataset.id), d = e.to.dataset.parent ? nodo(e.to.dataset.parent) : null; return !motivoNo(n, d); },
      onEnd: e => { if (e.from === e.to && e.oldIndex === e.newIndex) return; spostaNodo(e.item.dataset.id, e.to.dataset.parent || null, e.newIndex); }
    })));
  }

  function motivoNo(n, dest) {
    if (dest) {
      if (dest.id === n.id || dentro(n, dest)) return 'dentro sé stesso';
      if (isLeaf(dest) && nIncarichi(dest)) return 'ha persone incaricate';
      if (dest.livello + altezza(n) > maxLivelli()) return 'supera ' + maxLivelli() + ' livelli';
      if (!isAdmin() && !respDi(dest, true)) return 'fuori dal tuo ramo';
    } else {
      if (!isAdmin()) return 'solo l\'amministratore';
      if (altezza(n) > maxLivelli()) return 'supera ' + maxLivelli() + ' livelli';
    }
    return '';
  }

  async function spostaNodo(id, padre, indice) {
    if (!navigator.onLine) { alert('Serve la connessione per spostare.'); await caricaStruttura(); return; }
    const { error } = await stato.sb.rpc('sposta_nodo', { _nodo: id, _padre: padre, _indice: indice });
    if (error) alert(/find the function|schema cache/i.test(error.message || '')
      ? 'Spostamento non possibile: il database non è aggiornato. Riesegui lo script db/01_schema_sdm_eventi.sql nell\'SQL Editor di Supabase e riprova.'
      : 'Spostamento non riuscito: ' + error.message);
    if (padre) S.collassati.delete(padre);
    await caricaStruttura();
  }

  function apriSposta(id) {
    const n = nodo(id);
    $('#mvDa').textContent = 'Elemento: ' + percorsoTxt(n);
    const out = [];
    const voce = (dest, etich, lv) => {
      const m = motivoNo(n, dest);
      const b = h('button', { class: 'btn sec', type: 'button', style: 'padding:4px 12px' }, 'Qui'); if (m) b.disabled = true;
      b.addEventListener('click', async () => { $('#modMove').classList.add('hidden'); await spostaNodo(id, dest ? dest.id : null, 9999); });
      out.push(h('div', { class: 'mv' + (m ? ' no' : ''), style: 'margin-left:' + (lv * 18) + 'px' }, b, h('span', {}, etich, m ? h('span', { class: 'sec' }, ' · ' + m) : '')));
    };
    voce(null, 'Primo livello', 0);
    const giu = (pid, lv) => figli(pid).forEach(x => { voce(x, x.titolo, lv); giu(x.id, lv + 1); });
    giu(null, 1);
    $('#mvLista').replaceChildren(...out);
    $('#modMove').classList.remove('hidden');
  }

  function apriNodo(id, padre) {
    S.corr = id ? nodo(id) : null; S.padre = padre;
    if (!S.corr && padre) { const p = nodo(padre); if (isLeaf(p) && nIncarichi(p)) { alert('"' + p.titolo + '" ha persone incaricate: rimuovile prima di aggiungere dei sottorami.'); return; } }
    const n = S.corr || { titolo: '', descrizione: '', note: '', responsabile_id: null };
    $('#nTitM').textContent = S.corr ? 'Modifica' : (padre ? 'Nuovo sottoramo' : 'Nuovo ramo');
    $('#nPercorso').textContent = S.corr ? percorsoTxt(S.corr) : (padre ? 'Dentro: ' + percorsoTxt(nodo(padre)) : 'Primo livello');
    $('#nTit').value = n.titolo; $('#nDes').value = n.descrizione || ''; $('#nNot').value = n.note || '';
    const op = [h('option', { value: '' }, '— (nessuno)')];
    const elenco = [...S.assegnabili];
    if (n.responsabile_id && !elenco.some(p => p.id === n.responsabile_id)) elenco.push({ id: n.responsabile_id, cognome: nomeP(n.responsabile_id), nome: '' });
    elenco.forEach(p => op.push(h('option', { value: p.id }, (p.cognome + ' ' + p.nome).trim())));
    $('#nResp').replaceChildren(...op); $('#nResp').value = n.responsabile_id || '';
    $('#nRespW').classList.toggle('hidden', !S.assegnabili.length);
    $('#nErr').classList.add('hidden');
    $('#modNodo').classList.remove('hidden'); $('#nTit').focus();
  }
  const chiudiNodo = () => $('#modNodo').classList.add('hidden');
  function erroreNodo(m) { $('#nErr').textContent = m; $('#nErr').classList.remove('hidden'); }

  async function salvaNodo(ev) {
    ev.preventDefault();
    const rec = { titolo: $('#nTit').value.trim(), descrizione: $('#nDes').value.trim() || null, note: $('#nNot').value.trim() || null };
    if (!rec.titolo) { erroreNodo('Il titolo è obbligatorio.'); return; }
    if (!navigator.onLine) { erroreNodo('Serve la connessione per salvare.'); return; }
    if (!$('#nRespW').classList.contains('hidden')) rec.responsabile_id = $('#nResp').value || null;
    const b = $('#nSalva'); b.disabled = true;
    let error;
    if (S.corr) ({ error } = await stato.sb.from('nodi').update(rec).eq('id', S.corr.id));
    else {
      const sorelle = figli(S.padre);
      const pos = sorelle.length ? Math.max(...sorelle.map(x => x.posizione)) + 1 : 0;
      ({ error } = await stato.sb.from('nodi').insert({ ...rec, evento_id: stato.evento, parent_id: S.padre, posizione: pos }));
      if (S.padre) S.collassati.delete(S.padre);
    }
    b.disabled = false;
    if (error) { erroreNodo('Salvataggio non riuscito: ' + error.message); return; }
    chiudiNodo(); await caricaStruttura();
  }

  async function eliminaNodo(id) {
    const n = nodo(id), ds = sottoalbero(n), inc = [n, ...ds].reduce((a, x) => a + nIncarichi(x), 0);
    if (!navigator.onLine) { alert('Serve la connessione per eliminare.'); return; }
    if (!confirm('Eliminare "' + n.titolo + '"' + (ds.length ? ' e i ' + ds.length + ' elementi sottostanti' : '') + (inc ? ' (' + inc + ' incarichi)' : '') + '? L\'operazione non si può annullare.')) return;
    const { error } = await stato.sb.from('nodi').delete().eq('id', id);
    if (error) alert('Eliminazione non riuscita: ' + error.message);
    await caricaStruttura();
  }


  // ---------- scheda attività (foglia) ----------
  S.att = null; S.attInc = [];
  const STATI = { da_fare: 'Da fare', in_corso: 'In corso', fatto: 'Fatto', finito: 'Finito (confermato dal responsabile)' };
  const chiudiScheda = () => $('#modAtt').classList.add('hidden');
  function erroreScheda(m) { $('#aErr').textContent = m; $('#aErr').classList.remove('hidden'); }

  function campo(etich, el) { return h('div', {}, h('label', {}, etich), el); }
  function testo(v, vuoto) { return h('div', { style: 'padding:8px 0' }, v || h('span', { class: 'sec' }, vuoto || '—')); }

  function apriScheda(id) {
    const n = nodo(id); if (!n) return;
    S.att = n; S.attInc = (S.inc[id] || []).map(x => ({ ...x }));
    const me = stato.persona.id, ed = canEdit(n), isInc = S.attInc.some(x => x.persona_id === me), chiuso = n.stato === 'finito';
    const puoStato = ed || (isInc && !chiuso);
    const corpo = [];
    if (ed) {
      corpo.push(campo('Titolo *', h('input', { type: 'text', id: 'aTit', maxlength: '120', value: n.titolo })),
        campo('Descrizione', h('input', { type: 'text', id: 'aDes', maxlength: '500', value: n.descrizione || '' })),
        campo('Note', h('input', { type: 'text', id: 'aNot', maxlength: '1000', value: n.note || '' })));
    } else {
      corpo.push(campo('Attività', testo(h('b', {}, n.titolo))), campo('Descrizione', testo(n.descrizione)), campo('Note', testo(n.note)));
    }
    const selStato = h('select', { class: 'f', id: 'aStato' }, ...['da_fare', 'in_corso', 'fatto', ...(ed || chiuso ? ['finito'] : [])]
      .map(k => { const o = h('option', { value: k }, STATI[k]); if (n.stato === k) o.selected = true; return o; }));
    if (!puoStato) selStato.disabled = true;
    corpo.push(h('div', { class: 'grid2' },
      campo('Scadenza', ed ? h('input', { type: 'date', id: 'aScad', value: n.scadenza || '' }) : testo(n.scadenza ? fmtData(n.scadenza) : '')),
      campo('Stato', selStato)));
    if (!ed && chiuso) corpo.push(h('p', { class: 'note' }, 'Questa attività è stata confermata come finita dal responsabile: solo lui può riaprirla.'));
    if (!ed && !chiuso && isInc) corpo.push(h('p', { class: 'note' }, 'Puoi indicare "Fatto": sarà il responsabile a confermare "Finito".'));
    corpo.push(h('label', {}, 'Persone incaricate'), h('div', { id: 'aInc' }));
    if (ed) corpo.push(h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, h('select', { class: 'f', id: 'aIncSel', style: 'flex:1' }),
      (() => { const b = h('button', { class: 'btn sec need-net', type: 'button' }, '+ Aggiungi'); b.addEventListener('click', aggiungiIncarico); return b; })()));
    $('#aTitH').textContent = n.titolo; $('#aPerc').textContent = percorsoTxt(n);
    $('#aCorpo').replaceChildren(...corpo); $('#aErr').classList.add('hidden');
    if (!navigator.onLine) $('#aCorpo').querySelectorAll('#aTit,#aDes,#aNot,#aScad').forEach(i => { i.disabled = true; });
    $('#aSalva').classList.toggle('hidden', !(ed || puoStato || isInc));
    renderIncarichi();
    $('#modAtt').classList.remove('hidden');
  }

  function leggiNoteScheda() { $('#aInc').querySelectorAll('[data-pid]').forEach(i => { const w = S.attInc.find(x => x.persona_id === i.dataset.pid); if (w) w.nota = i.value; }); }

  function renderIncarichi() {
    const n = S.att, me = stato.persona.id, ed = canEdit(n);
    const righe = S.attInc.map(x => {
      const mia = x.persona_id === me, modif = ed || mia;
      const riga = h('div', { class: 'row', style: 'align-items:flex-start;flex-wrap:wrap' },
        h('div', { style: 'min-width:150px' }, h('b', {}, nomeP(x.persona_id)), mia ? ' ' : '', mia ? h('span', { class: 'badge' }, 'tu') : ''),
        h('div', { style: 'flex:1;min-width:200px' }, modif
          ? h('input', { type: 'text', 'data-pid': x.persona_id, maxlength: '500', value: x.nota || '', placeholder: 'Nota di ' + (mia ? 'tua' : nomeP(x.persona_id)) + '…', ...(!navigator.onLine && !mia ? { disabled: 'disabled' } : {}) })
          : h('span', { class: 'sec' }, x.nota || '—')));
      if (ed) { const b = h('button', { class: 'ib dn need-net', type: 'button', title: 'Togli dall\'attività' }, '✕'); b.addEventListener('click', () => { leggiNoteScheda(); S.attInc = S.attInc.filter(y => y.persona_id !== x.persona_id); renderIncarichi(); }); riga.append(b); }
      return riga;
    });
    $('#aInc').replaceChildren(...(righe.length ? righe : [h('p', { class: 'sec' }, 'Nessuna persona incaricata.')]));
    if (ed) {
      const gia = new Set(S.attInc.map(x => x.persona_id));
      $('#aIncSel').replaceChildren(h('option', { value: '' }, 'Scegli una persona…'),
        ...S.assegnabili.filter(p => !gia.has(p.id)).map(p => h('option', { value: p.id }, (p.cognome + ' ' + p.nome).trim())));
    }
  }

  function aggiungiIncarico() {
    const v = $('#aIncSel').value; if (!v) return;
    leggiNoteScheda();
    S.attInc.push({ id: null, persona_id: v, nota: '' });
    renderIncarichi();
  }

  async function salvaScheda(ev) {
    ev.preventDefault();
    const n = S.att, ed = canEdit(n), me = stato.persona.id;
    leggiNoteScheda();
    const rec = {};
    if (ed) {
      rec.titolo = $('#aTit').value.trim();
      if (!rec.titolo) { erroreScheda('Il titolo è obbligatorio.'); return; }
      rec.descrizione = $('#aDes').value.trim() || null; rec.note = $('#aNot').value.trim() || null; rec.scadenza = $('#aScad').value || null;
    }
    const st = $('#aStato');
    const statoNuovo = (!st.disabled && st.value !== n.stato) ? st.value : null;
    const diff = Object.fromEntries(Object.entries(rec).filter(([k, v]) => (v === undefined ? null : v) !== (n[k] === undefined ? null : n[k])));
    const orig = S.inc[n.id] || [];
    let tolti = [], aggiunti = [], cambiatiAltri = [], miaNota = null;
    const mioW = S.attInc.find(w => w.persona_id === me), mioO = orig.find(o => o.persona_id === me);
    if (mioW && mioO && (mioO.nota || '') !== (mioW.nota || '')) miaNota = mioW;
    if (ed) {
      tolti = orig.filter(o => !S.attInc.some(w => w.persona_id === o.persona_id));
      aggiunti = S.attInc.filter(w => !orig.some(o => o.persona_id === w.persona_id));
      cambiatiAltri = S.attInc.filter(w => { const o = orig.find(o => o.persona_id === w.persona_id); return w.persona_id !== me && o && (o.nota || '') !== (w.nota || ''); });
    }
    const strutturale = Object.keys(diff).length || tolti.length || aggiunti.length || cambiatiAltri.length;
    if (strutturale && !navigator.onLine) { erroreScheda('Senza connessione puoi cambiare solo lo stato e la tua nota. Per le altre modifiche serve la rete.'); return; }
    const b = $('#aSalva'); b.disabled = true;
    let errore = null;
    const esegui = async p => { if (errore) return; const r = await p; if (r.error) errore = r.error.message; };
    if (Object.keys(diff).length) await esegui(stato.sb.from('nodi').update(diff).eq('id', n.id));
    for (const o of tolti) await esegui(stato.sb.from('incarichi').delete().eq('id', o.id));
    if (aggiunti.length) await esegui(stato.sb.from('incarichi').insert(aggiunti.map(w => ({ nodo_id: n.id, persona_id: w.persona_id, nota: (w.nota || '').trim() || null }))));
    for (const w of cambiatiAltri) await esegui(stato.sb.from('incarichi').update({ nota: (w.nota || '').trim() || null }).eq('id', w.id));
    b.disabled = false;
    if (errore) { erroreScheda('Salvataggio non riuscito: ' + errore); await aggiornaTutto(); return; }
    chiudiScheda();
    if (strutturale) await aggiornaTutto();
    // stato e propria nota passano dalla coda: funzionano anche offline
    if (miaNota) accodaModifica('incarico_nota', miaNota.id, (miaNota.nota || '').trim() || null, { nodo: n.id, titolo: n.titolo, percorso: percorsoTxt(n), etichetta: 'Nota' });
    if (statoNuovo) accodaStato(n, statoNuovo);
  }

  // ---------- sincronizzazione offline ----------
  // Offline-first: stato delle attività e nota dell'incarico si cambiano sempre in locale (coda) e
  // partono da soli appena c'è rete. La struttura (eventi, rami, incaricati, scadenze) resta solo online.
  const CODA = 'sdm_coda', RIVEDERE = 'sdm_rivedere';
  let sincronizzando = false, richiestaSync = false, erroreSync = '', sincAvviata = false;
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'op-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  const codaMia = () => (LS.get(CODA) || []).filter(o => stato.persona && o.uid === stato.persona.uid);
  const rivedereMio = () => (LS.get(RIVEDERE) || []).filter(o => stato.persona && o.uid === stato.persona.uid);
  const nodiInAttesa = () => new Set(codaMia().map(o => o.nodo));

  function aggiornaChip() {
    const c = $('#rete'); if (!c) return;
    const on = navigator.onLine, n = stato.persona ? codaMia().length : 0, r = stato.persona ? rivedereMio().length : 0;
    c.className = 'chip ' + (sincronizzando ? 'run' : on ? 'on' : 'off');
    c.textContent = sincronizzando ? '⟳ Sincronizzazione…' : (on ? '● Online' : '● Offline') + (n ? ' · ' + n + ' in attesa' : '');
    document.body.classList.toggle('offline', !on);
    const cr = $('#cntRev'); cr.textContent = r; cr.classList.toggle('hidden', !r);
    $('#iCoda').textContent = n; $('#iRevN').textContent = r;
    const u = LS.get('sdm_ultima_sync'); $('#iUlt').textContent = u ? new Date(u).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  function applicaOpLocale(o) {
    if (o.tipo === 'nodo_stato') { const n = S.nodi.find(x => x.id === o.id); if (n) n.stato = o.valore; }
    else Object.values(S.inc).forEach(l => { const x = l.find(i => i.id === o.id); if (x) x.nota = o.valore; });
  }
  const sovrapponiCoda = () => codaMia().filter(o => o.ev === stato.evento).forEach(applicaOpLocale);
  const salvaCacheStruttura = () => LS.set('sdm_struttura_' + stato.evento, { n: S.nodi, i: S.inc, m: S.nomi, a: S.assegnabili });

  function accodaModifica(tipo, id, valore, extra) {
    const coda = LS.get(CODA) || [], uid = stato.persona.uid;
    const resto = coda.filter(o => !(o.uid === uid && o.tipo === tipo && o.id === id));
    const op = { op_id: uuid(), uid, tipo, id, valore, ts: new Date().toISOString(), ev: stato.evento, ...extra };
    resto.push(op); LS.set(CODA, resto);
    applicaOpLocale(op); salvaCacheStruttura();
    renderStruttura(); renderHome(); aggiornaChip();
    sincronizza();
  }

  function accodaStato(n, v) {
    accodaModifica('nodo_stato', n.id, v, { nodo: n.id, titolo: n.titolo, percorso: percorsoTxt(n), etichetta: 'Stato' });
    toast(navigator.onLine ? 'Stato aggiornato' : 'Salvato sul dispositivo: partirà appena c\'è rete');
  }

  async function misuraOffset() {
    try {
      const t0 = Date.now();
      const { data, error } = await stato.sb.rpc('ora_server');
      if (error || !data) return;
      LS.set('sdm_offset', Date.parse(data) - (t0 + Date.now()) / 2);
    } catch (e) { /* uso l'ultimo valore noto */ }
  }

  async function sincronizza(manuale) {
    if (!stato.sb || !stato.persona) return;
    if (sincronizzando) { richiestaSync = true; return; }   // nuove modifiche durante un invio: riparto appena finisce
    if (!navigator.onLine) { aggiornaChip(); if (manuale) toast('Sei offline: la sincronizzazione parte appena c\'è rete'); return; }
    sincronizzando = true; erroreSync = ''; aggiornaChip();
    try {
      const mie = codaMia();
      if (mie.length) {
        await misuraOffset();
        const off = LS.get('sdm_offset') || 0;
        const ops = mie.map(o => ({ op_id: o.op_id, tipo: o.tipo, id: o.id, valore: o.valore, ts: new Date(Date.parse(o.ts) + off).toISOString() }));
        const { data, error } = await stato.sb.rpc('applica_modifiche', { _ops: ops });
        if (error) throw error;
        const esiti = new Map((data || []).map(r => [r.op_id, r]));
        const inviati = new Set(mie.map(o => o.op_id));
        const rev = LS.get(RIVEDERE) || [];
        mie.forEach(o => {
          const e = esiti.get(o.op_id);
          if (e && e.esito !== 'ok') rev.push({ id: o.op_id, uid: o.uid, tipo: o.tipo, rif: o.id, nodo: o.nodo, ev: o.ev, titolo: o.titolo, percorso: o.percorso, etichetta: o.etichetta, valore: o.valore, t: o.ts, esito: e.esito, motivo: e.motivo });
        });
        LS.set(RIVEDERE, rev);
        LS.set(CODA, (LS.get(CODA) || []).filter(o => !(inviati.has(o.op_id) && esiti.has(o.op_id))));
      }
      LS.set('sdm_ultima_sync', Date.now());
      await aggiornaTutto();
    } catch (e) {
      erroreSync = /find the function|schema cache/i.test((e && e.message) || '') ? 'Database non aggiornato: riesegui lo script SQL.' : '';
      if (erroreSync && manuale) alert(erroreSync);
    } finally {
      sincronizzando = false; aggiornaChip();
      if (!$('#p-rev').classList.contains('hidden')) renderRivedere();
      if (richiestaSync) { richiestaSync = false; sincronizza(); }
    }
  }

  function dettaglioOp(o) {
    return o.tipo === 'nodo_stato' ? (STATI[o.valore] || o.valore).replace(' (confermato dal responsabile)', '') : (o.valore ? '“' + String(o.valore).slice(0, 80) + '”' : '(nota vuota)');
  }
  function renderRivedere() {
    const l = rivedereMio().sort((a, b) => Date.parse(b.t) - Date.parse(a.t));
    const rimuovi = id => { LS.set(RIVEDERE, (LS.get(RIVEDERE) || []).filter(x => x.id !== id)); aggiornaChip(); renderRivedere(); };
    $('#revLista').replaceChildren(...(l.length ? l.map(o => {
      const bt = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
      if (o.esito === 'superata') {
        const r = h('button', { class: 'btn sec', type: 'button' }, 'Riapplica la mia modifica');
        r.addEventListener('click', () => { rimuovi(o.id); if (o.ev === stato.evento) accodaModifica(o.tipo, o.rif, o.valore, { nodo: o.nodo, titolo: o.titolo, percorso: o.percorso, etichetta: o.etichetta }); else toast('Apri l\'evento "' + o.percorso + '" per riapplicare'); });
        bt.append(r);
      }
      const ok = h('button', { class: 'btn sec', type: 'button' }, 'Ho capito'); ok.addEventListener('click', () => rimuovi(o.id)); bt.append(ok);
      return h('div', { class: 'card' }, h('div', { class: 'row', style: 'align-items:flex-start;flex-wrap:wrap' },
        h('div', { style: 'flex:1;min-width:200px' }, h('b', {}, o.titolo || 'Attività'),
          h('div', { class: 'sec', style: 'font-size:13px' }, (o.percorso || '') + ' · ' + o.etichetta + ': ' + dettaglioOp(o) + ' · ' + new Date(o.t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
          h('div', { class: 'badge ' + (o.esito === 'superata' ? 'w' : 'e'), style: 'margin-top:6px;white-space:normal' }, (o.esito === 'superata' ? 'Superata: ' : 'Rifiutata: ') + o.motivo)), bt));
    }) : [h('p', { class: 'sec' }, 'Nessuna modifica da rivedere.')]));
  }

  function avviaSincronizzazione() {
    if (sincAvviata) return; sincAvviata = true;
    window.addEventListener('online', () => { aggiornaChip(); sincronizza(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) sincronizza(); });
    setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible' && stato.persona) sincronizza(); }, 60000);
    try {   // aggiornamenti in tempo reale: quando altri cambiano i dati
      let t; const rif = () => { clearTimeout(t); t = setTimeout(() => { if (navigator.onLine && !sincronizzando && stato.persona) aggiornaTutto(); }, 800); };
      const ch = stato.sb.channel('sdm-aggiornamenti');
      ['nodi', 'incarichi', 'eventi'].forEach(tb => ch.on('postgres_changes', { event: '*', schema: cfg.SCHEMA || 'sdm_eventi', table: tb }, rif));
      ch.subscribe();
    } catch (e) { /* senza realtime restano gli aggiornamenti periodici */ }
    sincronizza();
  }

  // ---------- home: avanzamento e le mie attività ----------
  let homeFinite = false;
  const aggiornaTutto = () => Promise.all([caricaStruttura(), caricaEventi()]);
  function toast(m) { const t = h('div', { class: 'toastm' }, '✔ ' + m); document.body.append(t); setTimeout(() => t.remove(), 1600); }
  function conteggio(ls) {
    const c = { da_fare: 0, in_corso: 0, fatto: 0, finito: 0 };
    ls.forEach(n => { c[n.stato] = (c[n.stato] || 0) + 1; });
    c.tot = ls.length; c.perc = c.tot ? Math.round(100 * c.finito / c.tot) : 0; return c;
  }
  function barraStack(c) {
    const w = k => (c.tot ? (100 * c[k] / c.tot).toFixed(1) : 0) + '%';
    return h('div', { class: 'stk', title: c.finito + ' finite, ' + c.fatto + ' da confermare, ' + c.in_corso + ' in corso, ' + c.da_fare + ' da fare' },
      h('i', { class: 's-fin', style: 'width:' + w('finito') }), h('i', { class: 's-fat', style: 'width:' + w('fatto') }), h('i', { class: 's-cor', style: 'width:' + w('in_corso') }));
  }
  const legenda = () => h('div', { class: 'leg' }, h('span', { class: 'l-fin' }, 'Finito'), h('span', { class: 'l-fat' }, 'Fatto (da confermare)'), h('span', { class: 'l-cor' }, 'In corso'), h('span', { class: 'l-dar' }, 'Da fare'));
  function scadClasse(n) {
    if (!n.scadenza || n.stato === 'finito' || n.stato === 'fatto') return '';
    const o = oggi();
    if (n.scadenza < o) return 'e';
    return (new Date(n.scadenza) - new Date(o)) / 864e5 <= (parseInt(stato.parametri.giorni_preavviso_scadenza, 10) || 7) ? 'w' : '';
  }
  const card = (titolo, ...figli) => h('div', { class: 'card' }, titolo ? h('h2', {}, titolo) : '', ...figli);
  const tile = (n, etich, cl) => h('div', { class: 'tile ' + (n ? cl : '') }, h('b', {}, String(n)), h('span', { class: 'sec' }, etich));

  const statoRapido = (n, v) => accodaStato(n, v);

  function renderHome() {
    const box = $('#homeCorpo');
    if (!box) return;
    if (stato.evento === null || !stato.persona) { box.replaceChildren(); return; }
    ordina(); S.pend = nodiInAttesa();
    const adm = isAdmin(), me = stato.persona.id;
    const tutte = S.nodi.filter(isLeaf);
    const gestisco = adm ? tutte : tutte.filter(canEdit);
    const sonoResp = adm || S.nodi.some(n => n.responsabile_id === me);
    const out = [];
    if (sonoResp) {
      const c = conteggio(gestisco);
      out.push(card(adm ? 'Avanzamento dell\'evento' : 'Avanzamento dei tuoi rami',
        h('div', { style: 'display:flex;gap:18px;align-items:center;flex-wrap:wrap' },
          h('div', {}, h('div', { class: 'big' }, c.perc + '%'), h('div', { class: 'sec', style: 'font-size:13px' }, 'completato (' + c.finito + ' su ' + c.tot + ')')),
          h('div', { style: 'flex:1;min-width:220px' }, barraStack(c), legenda()))));
      const scad = gestisco.filter(n => scadClasse(n) === 'e').length, prox = gestisco.filter(n => scadClasse(n) === 'w').length;
      const senza = gestisco.filter(n => !nIncarichi(n) && n.stato !== 'finito').length;
      out.push(h('div', { class: 'tiles' }, tile(scad, 'Scadute', 'e'), tile(prox, 'In scadenza (' + (parseInt(stato.parametri.giorni_preavviso_scadenza, 10) || 7) + ' giorni)', 'w'), tile(senza, 'Senza persone incaricate', 'w'), tile(c.fatto, 'Da confermare', '')));
      const dc = gestisco.filter(n => n.stato === 'fatto');
      out.push(card('Da confermare', ...(dc.length ? dc.map(n => {
        const b = h('button', { class: 'btn', type: 'button' }, '✔ Conferma finito');
        b.addEventListener('click', () => statoRapido(n, 'finito'));
        return h('div', { class: 'row', style: 'flex-wrap:wrap' }, h('div', { style: 'flex:1;min-width:180px' }, h('b', {}, n.titolo),
          h('div', { class: 'sec', style: 'font-size:13px' }, percorsoTxt(n) + ' · ' + ((S.inc[n.id] || []).map(x => nomeP(x.persona_id)).join(', ') || 'nessun incaricato'))), b);
      }) : [h('p', { class: 'sec', style: 'margin:0' }, 'Nessuna attività in attesa di conferma.')])));
      const rami = adm ? figli(null).filter(n => !isLeaf(n)) : S.nodi.filter(n => n.responsabile_id === me && !isLeaf(n) && !antenati(n).some(a => a.responsabile_id === me));
      if (rami.length) out.push(card('Avanzamento per ramo', ...rami.map(n => {
        const cc = conteggio(foglie(n)), riga = h('div', { class: 'row', style: 'flex-wrap:wrap;cursor:pointer' },
          h('div', { style: 'min-width:170px;flex:1' }, h('b', {}, n.titolo), n.responsabile_id ? h('div', { class: 'sec', style: 'font-size:13px' }, '👤 ' + nomeP(n.responsabile_id)) : ''),
          h('div', { style: 'flex:2;min-width:200px' }, barraStack(cc)),
          h('div', { style: 'min-width:90px;text-align:right' }, h('b', {}, cc.perc + '%'), ' ', h('span', { class: 'sec', style: 'font-size:12px' }, cc.finito + '/' + cc.tot)));
        riga.addEventListener('click', () => vai('str')); return riga;
      }), legenda()));
    }
    // le mie attività
    const ordine = n => (n.stato === 'finito' ? '3' : scadClasse(n) === 'e' ? '0' : scadClasse(n) === 'w' ? '1' : '2') + (n.scadenza || '9999');
    const mie = tutte.filter(n => (S.inc[n.id] || []).some(x => x.persona_id === me)).sort((a, b) => ordine(a).localeCompare(ordine(b)));
    const nFin = mie.filter(n => n.stato === 'finito').length;
    const lista = homeFinite ? mie : mie.filter(n => n.stato !== 'finito');
    const testa = h('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center' }, h('h2', { style: 'margin:0' }, 'Le mie attività'));
    if (nFin) {
      const cb = h('input', { type: 'checkbox' }); cb.checked = homeFinite; cb.addEventListener('change', () => { homeFinite = cb.checked; renderHome(); });
      testa.append(h('label', { style: 'margin:0;font-weight:400;display:flex;gap:6px;align-items:center' }, cb, ' mostra anche le finite (' + nFin + ')'));
    }
    const righe = lista.map(n => {
      const chiuso = n.stato === 'finito', puoFin = canEdit(n), sc = scadClasse(n);
      const sel = h('select', { class: 'st' }, ...['da_fare', 'in_corso', 'fatto', ...(puoFin || chiuso ? ['finito'] : [])].map(k => { const o = h('option', { value: k }, STATI[k].replace(' (confermato dal responsabile)', '')); if (n.stato === k) o.selected = true; return o; }));
      if (chiuso && !puoFin) sel.disabled = true;
      sel.addEventListener('change', () => statoRapido(n, sel.value));
      const ctrl = h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap' }, S.pend.has(n.id) ? h('span', { class: 'badge w' }, '⏳ in attesa') : '', n.scadenza ? h('span', { class: 'badge ' + sc }, (sc === 'e' ? 'scaduta ' : sc === 'w' ? 'scade ' : 'scad. ') + n.scadenza.split('-').reverse().slice(0, 2).join('/')) : '', sel);
      ctrl.addEventListener('click', e => e.stopPropagation());
      const riga = h('div', { class: 'row', style: 'flex-wrap:wrap;cursor:pointer', tabindex: '0' }, h('div', { style: 'flex:1;min-width:170px' }, h('b', {}, n.titolo), h('div', { class: 'sec', style: 'font-size:13px' }, percorsoTxt(n))), ctrl);
      riga.addEventListener('click', () => apriScheda(n.id));
      return riga;
    });
    out.push(card('', testa, ...(righe.length ? righe : [h('p', { class: 'sec', style: 'margin:12px 0 0' }, mie.length ? 'Tutte le tue attività sono finite. 🎉' : 'Non hai attività assegnate in questo evento.')]),
      h('p', { class: 'note' }, 'Tocca un\'attività per aprire la scheda con scadenza, note e colleghi.')));
    box.replaceChildren(...out);
  }


  // ---------- Excel: esporta, importa, duplica ----------
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const siNo = v => { const t = norm(v); if (['si', 's', 'true', '1', 'x', 'yes', 'y', 'vero'].includes(t)) return true; if (['no', 'n', 'false', '0', '', 'falso'].includes(t)) return false; return null; };
  const ddmmyyyy = iso => (iso ? iso.split('-').reverse().join('/') : '');
  function dataISO(v) {
    const t = String(v == null ? '' : v).trim(); if (!t) return '';
    let y, m, d, x;
    if ((x = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/))) { d = +x[1]; m = +x[2]; y = +x[3]; if (y < 100) y += 2000; }
    else return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function scaricaFile(nome, fogli) {
    const wb = XLSX.utils.book_new();
    fogli.forEach(fg => {
      const ws = XLSX.utils.aoa_to_sheet(fg.righe);
      ws['!cols'] = (fg.larghezze || fg.righe[0].map(() => 18)).map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, fg.nome);
    });
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = h('a', { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function leggiFile(file) {
    let wb;
    if (/\.csv$/i.test(file.name)) {
      const t = await file.text(), prima = t.split(/\r?\n/)[0] || '';
      wb = XLSX.read(t, { type: 'string', FS: (prima.split(';').length > prima.split(',').length) ? ';' : ',' });
    } else wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
  }
  const mappaColonne = (intest, alias) => {
    const out = {}; intest.forEach((c, i) => { const n = norm(c); Object.entries(alias).forEach(([k, lista]) => { if (out[k] === undefined && lista.includes(n)) out[k] = i; }); }); return out;
  };

  async function personeDB() {
    const { data, error } = await stato.sb.from('persone').select('id, cognome, nome, email, numero_iscritto, ruolo, attivo');
    if (error) throw error; return data;
  }

  // --- dialogo di importazione generico ---
  const IMP = { esegui: null };
  function apriImport(titolo, aiuto, opzioni, analizza) {
    $('#impTit').textContent = titolo; $('#impAiuto').textContent = aiuto;
    $('#impOpz').replaceChildren(...(opzioni || [])); $('#impRis').replaceChildren(); $('#impTab').replaceChildren(); $('#impErr').classList.add('hidden');
    $('#impFile').value = ''; $('#impOk').disabled = true; IMP.esegui = null; IMP.analizza = analizza;
    $('#modImp').classList.remove('hidden');
  }
  const chiudiImport = () => $('#modImp').classList.add('hidden');
  function impErrore(m) { $('#impErr').textContent = m; $('#impErr').classList.remove('hidden'); }
  async function impAnalizza() {
    const file = $('#impFile').files[0]; if (!file) return;
    $('#impErr').classList.add('hidden'); $('#impOk').disabled = true; IMP.esegui = null;
    try {
      const r = await IMP.analizza(file);
      $('#impRis').replaceChildren(...r.sommario.map(t => h('div', {}, t)));
      const colore = { ok: 'ok', agg: '', err: 'e', avv: 'w' };
      $('#impTab').replaceChildren(h('table', { style: 'width:100%;border-collapse:collapse;font-size:13px' },
        h('thead', {}, h('tr', {}, ...r.colonne.map(c => h('th', { style: 'text-align:left;padding:4px 6px;border-bottom:1px solid var(--bordo)' }, c)))),
        h('tbody', {}, ...r.righe.slice(0, 80).map(x => h('tr', {}, ...x.celle.map((c, i) => h('td', { style: 'padding:4px 6px;border-bottom:1px solid var(--bordo);vertical-align:top' },
          i === x.celle.length - 1 ? h('span', { class: 'badge ' + (colore[x.tipo] || '') }, c) : c)))))),
        r.righe.length > 80 ? h('p', { class: 'note' }, 'Mostrate le prime 80 righe su ' + r.righe.length + '.') : '');
      IMP.esegui = r.esegui; $('#impOk').disabled = !(r.nOk > 0); $('#impOk').textContent = r.nOk > 0 ? 'Importa (' + r.nOk + ')' : 'Importa';
    } catch (e) { impErrore('File non leggibile: ' + (e && e.message ? e.message : e)); }
  }
  async function impEsegui() {
    if (!IMP.esegui) return;
    if (!navigator.onLine) { impErrore('Serve la connessione per importare.'); return; }
    $('#impOk').disabled = true;
    try { const m = await IMP.esegui(); chiudiImport(); toast(m); }
    catch (e) { impErrore('Importazione non riuscita (non è stato importato nulla): ' + (e && e.message ? e.message : e)); $('#impOk').disabled = false; }
  }

  // --- PERSONE ---
  const COL_PERS = ['Cognome', 'Nome', 'Email', 'Cellulare', 'Iscritto', 'Numero iscritto', 'Data di nascita', 'Ruolo', 'Attivo', 'Note'];
  function esportaPersone() {
    const righe = [COL_PERS, ...P.elenco.map(p => [p.cognome, p.nome, p.email, p.cellulare || '', p.iscritto ? 'Sì' : 'No', p.numero_iscritto || '', ddmmyyyy(p.data_nascita), p.ruolo === 'admin' ? 'Amministratore' : 'Operatore', p.attivo ? 'Sì' : 'No', p.note || ''])];
    scaricaFile('persone.xlsx', [{ nome: 'Persone', righe, larghezze: [18, 16, 30, 16, 9, 14, 15, 15, 8, 30] }]);
  }
  function modelloPersone() {
    scaricaFile('modello_persone.xlsx', [
      { nome: 'Persone', righe: [COL_PERS, ['Rossi', 'Anna', 'anna.rossi@esempio.it', '333 1234567', 'Sì', '0102', '05/09/1982', 'Operatore', 'Sì', 'Esempio: cancella questa riga']], larghezze: [18, 16, 30, 16, 9, 14, 15, 15, 8, 30] },
      { nome: 'Istruzioni', righe: [['Colonne obbligatorie: Cognome, Nome, Email.'], ['Iscritto: Sì / No. Se Sì, il Numero iscritto è obbligatorio e deve essere univoco.'], ['Data di nascita: gg/mm/aaaa.'], ['Ruolo: Operatore (predefinito) o Amministratore. Attivo: Sì (predefinito) / No.'], ['Una persona con la stessa email già presente viene aggiornata (se lo scegli all\'importazione).']], larghezze: [100] }]);
  }
  function importaPersone() {
    const opt = h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:400' }, h('input', { type: 'checkbox', id: 'impAgg' }), ' Aggiorna le persone già presenti con la stessa email');
    opt.querySelector('input').checked = true;
    apriImport('Importa persone', 'Il file deve avere una riga di intestazione con Cognome, Nome ed Email (altre colonne: Cellulare, Iscritto, Numero iscritto, Data di nascita, Ruolo, Attivo, Note). Scarica il modello vuoto se ti serve un esempio.', [opt], async file => {
      const rows = await leggiFile(file);
      if (rows.length < 2) throw new Error('il file non contiene righe di dati');
      const col = mappaColonne(rows[0], { cognome: ['cognome'], nome: ['nome'], email: ['email', 'mail', 'emailaddress', 'posta', 'indirizzoemail'], cellulare: ['cellulare', 'telefono', 'tel', 'cell'], iscritto: ['iscritto', 'socio', 'iscrizione'], numero: ['numeroiscritto', 'numiscritto', 'nriscritto', 'numerosocio', 'matricola', 'nsocio', 'numero'], nascita: ['datanascita', 'nascita', 'datadinascita'], ruolo: ['ruolo'], attivo: ['attivo'], note: ['note'] });
      const manca = ['cognome', 'nome', 'email'].filter(k => col[k] === undefined);
      if (manca.length) throw new Error('mancano le colonne: ' + manca.join(', '));
      const db = await personeDB(), perMail = new Map(db.map(p => [p.email.toLowerCase(), p]));
      const aggiorna = $('#impAgg').checked, viste = new Set(), numeri = new Map();
      const val = (r, k) => (col[k] === undefined ? '' : String(r[col[k]] == null ? '' : r[col[k]]).trim());
      const righe = [], ok = [];
      rows.slice(1).forEach((r, i) => {
        if (r.every(c => String(c).trim() === '')) return;
        const e = [], o = { cognome: val(r, 'cognome'), nome: val(r, 'nome'), email: val(r, 'email').toLowerCase() };
        if (!o.cognome) e.push('cognome mancante'); if (!o.nome) e.push('nome mancante');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)) e.push('email non valida'); else if (viste.has(o.email)) e.push('email ripetuta nel file'); else viste.add(o.email);
        const cel = val(r, 'cellulare'); if (cel) o.cellulare = cel;
        if (col.iscritto !== undefined) { const b = siNo(val(r, 'iscritto')); if (b === null) e.push('"Iscritto" non riconosciuto'); else o.iscritto = b; }
        const num = val(r, 'numero'); if (num) o.numero_iscritto = num;
        if (o.iscritto === undefined && num) o.iscritto = true;
        if (o.iscritto && !num && !(perMail.get(o.email) || {}).numero_iscritto) e.push('iscritto senza numero');
        if (num) {
          if (numeri.has(num)) e.push('numero iscritto ripetuto nel file'); else numeri.set(num, 1);
          const altro = db.find(p => p.numero_iscritto === num && p.email.toLowerCase() !== o.email); if (altro) e.push('numero iscritto già assegnato a ' + altro.cognome + ' ' + altro.nome);
        }
        const nas = dataISO(val(r, 'nascita')); if (nas === null) e.push('data di nascita non valida'); else if (nas) o.data_nascita = nas;
        const ru = norm(val(r, 'ruolo')); if (ru) { if (['amministratore', 'admin'].includes(ru)) o.ruolo = 'admin'; else if (['operatore', 'utente'].includes(ru)) o.ruolo = 'utente'; else e.push('ruolo non riconosciuto'); }
        if (col.attivo !== undefined && val(r, 'attivo') !== '') { const b = siNo(val(r, 'attivo')); if (b === null) e.push('"Attivo" non riconosciuto'); else o.attivo = b; }
        const nt = val(r, 'note'); if (nt) o.note = nt;
        const esiste = perMail.has(o.email);
        const tipo = e.length ? 'err' : (esiste ? (aggiorna ? 'agg' : 'avv') : 'ok');
        const testo = e.length ? e.join('; ') : (esiste ? (aggiorna ? 'Aggiorna' : 'Già presente: saltata') : 'Nuova');
        righe.push({ tipo, celle: [String(i + 2), (o.cognome + ' ' + o.nome).trim() + ' · ' + o.email, testo] });
        if (!e.length && (!esiste || aggiorna)) ok.push(o);
      });
      const n = { err: righe.filter(x => x.tipo === 'err').length, ok: righe.filter(x => x.tipo === 'ok').length, agg: righe.filter(x => x.tipo === 'agg').length };
      return {
        colonne: ['Riga', 'Persona', 'Esito'], righe, nOk: ok.length,
        sommario: [`Nuove: ${n.ok} · Da aggiornare: ${n.agg} · Righe con errori (saltate): ${n.err}`, ...(n.err ? ['Correggi gli errori nel file e ricarica, oppure importa solo le righe valide.'] : [])].map(t => t),
        esegui: async () => {
          const { data, error } = await stato.sb.rpc('importa_persone', { _righe: ok, _aggiorna: aggiorna });
          if (error) throw error;
          await caricaPersone();
          return 'Persone importate: ' + data.nuove + ' nuove, ' + data.aggiornate + ' aggiornate';
        }
      };
    });
  }

  // --- STRUTTURA ---
  const COL_STR = [...Array.from({ length: 10 }, (_, i) => 'Livello ' + (i + 1)), 'Descrizione', 'Note', 'Responsabile (email)', 'Scadenza', 'Stato', 'Incaricati (email)'];
  const LAB_STATO = { da_fare: 'Da fare', in_corso: 'In corso', fatto: 'Fatto', finito: 'Finito' };
  async function esportaStruttura() {
    if (stato.evento === null) return;
    let pers = []; try { pers = await personeDB(); } catch (e) { /* senza rete: niente email */ }
    const mail = new Map(pers.map(p => [p.id, p.email]));
    ordina();
    const righe = [COL_STR];
    const giu = (pid, path) => figli(pid).forEach(n => {
      const p = [...path, n.titolo], lv = Array.from({ length: 10 }, (_, i) => p[i] || '');
      righe.push([...lv, n.descrizione || '', n.note || '', mail.get(n.responsabile_id) || '', ddmmyyyy(n.scadenza), isLeaf(n) ? LAB_STATO[n.stato] : '', (S.inc[n.id] || []).map(x => mail.get(x.persona_id) || nomeP(x.persona_id)).join('; ')]);
      giu(n.id, p);
    });
    giu(null, []);
    scaricaFile('struttura_' + (eventoCorrente() ? eventoCorrente().titolo.replace(/[^\w\-]+/g, '_') : 'evento') + '.xlsx', [{ nome: 'Struttura', righe, larghezze: [...Array(10).fill(16), 30, 30, 26, 12, 10, 40] }]);
  }
  function modelloStruttura() {
    scaricaFile('modello_struttura.xlsx', [
      { nome: 'Struttura', righe: [COL_STR,
        ['Logistica', '', '', '', '', '', '', '', '', '', 'Tutto l\'allestimento', '', 'anna.rossi@esempio.it', '', '', ''],
        ['Logistica', 'Sedie', '', '', '', '', '', '', '', '', 'Sedie per il pubblico', 'Ne servono 300', '', '30/10/2027', 'Da fare', 'marco.bianchi@esempio.it; luca.verdi@esempio.it'],
        ['Logistica', 'Trasporti', 'Furgone', '', '', '', '', '', '', '', '', '', '', '01/11/2027', '', 'marco.bianchi@esempio.it']], larghezze: [...Array(10).fill(16), 30, 30, 26, 12, 10, 40] },
      { nome: 'Istruzioni', righe: [['Una riga per ogni ramo o attività. I livelli (Livello 1 … Livello 10) descrivono il percorso: nell\'ultima cella riempita c\'è il nome dell\'elemento.'], ['Le righe dei rami sono facoltative: se manca, il ramo viene creato dal percorso delle sue attività.'], ['Elementi già esistenti con lo stesso percorso vengono riconosciuti: si aggiornano solo i campi compilati, non si cancella nulla.'], ['Incaricati e Responsabile: email di persone già presenti in anagrafica (più incaricati separati da ;). Gli incaricati valgono solo per le attività (ultimo livello).'], ['Scadenza: gg/mm/aaaa. Stato (solo per elementi nuovi): Da fare, In corso, Fatto, Finito.']], larghezze: [120] }]);
  }
  function importaStruttura() {
    if (stato.evento === null) return;
    apriImport('Importa la struttura dell\'evento', 'Aggiunge rami e attività all\'evento "' + (eventoCorrente() ? eventoCorrente().titolo : '') + '". Non cancella e non sposta nulla di quello che c\'è già. Scarica il modello vuoto per vedere il formato.', [], async file => {
      const rows = await leggiFile(file);
      if (rows.length < 2) throw new Error('il file non contiene righe di dati');
      const intest = rows[0].map(norm), liv = [];
      intest.forEach((c, i) => { const m = c.match(/^livello(\d+)$/); if (m && +m[1] >= 1 && +m[1] <= 10) liv[+m[1] - 1] = i; });
      if (liv[0] === undefined) throw new Error('manca la colonna "Livello 1"');
      const col = mappaColonne(rows[0], { descrizione: ['descrizione'], note: ['note'], resp: ['responsabileemail', 'responsabile', 'emailresponsabile'], scad: ['scadenza', 'datascadenza'], stato: ['stato'], inc: ['incaricatiemail', 'incaricati', 'emailincaricati'] });
      const pers = await personeDB(), perMail = new Map(pers.map(p => [p.email.toLowerCase(), p.id]));
      ordina();
      const maxL = maxLivelli(), chiave = path => path.map(norm).join('\u0001');
      const esist = new Map(); const reg = (pid, path) => figli(pid).forEach(n => { const p = [...path, n.titolo]; esist.set(chiave(p), n); reg(n.id, p); }); reg(null, []);
      const piano = new Map();   // chiave -> {path, esistente, dati, incaricati[], riga}
      const nodoPiano = (path, i) => { const k = chiave(path); if (!piano.has(k)) piano.set(k, { k, path, esistente: esist.get(k) || null, dati: {}, inc: new Set(), ordine: piano.size, riga: i }); return piano.get(k); };
      const righe = []; let nErr = 0, nAvv = 0;
      rows.slice(1).forEach((r, i) => {
        if (r.every(c => String(c).trim() === '')) return;
        const livelli = liv.map(ix => (ix === undefined ? '' : String(r[ix] == null ? '' : r[ix]).trim()));
        let ult = -1; livelli.forEach((t, x) => { if (t) ult = x; });
        const e = [], avv = [];
        if (ult < 0) { e.push('nessun livello compilato'); }
        else { for (let x = 0; x <= ult; x++) if (!livelli[x]) { e.push('livelli non contigui'); break; } }
        if (ult + 1 > maxL) e.push('supera ' + maxL + ' livelli');
        if (livelli.some(t => t.length > 120)) e.push('titolo oltre 120 caratteri');
        const v = k => (col[k] === undefined ? '' : String(r[col[k]] == null ? '' : r[col[k]]).trim());
        const dati = {}; if (v('descrizione')) dati.descrizione = v('descrizione'); if (v('note')) dati.note = v('note');
        const sc = dataISO(v('scad')); if (sc === null) e.push('scadenza non valida'); else if (sc) dati.scadenza = sc;
        if (v('stato')) { const s2 = { dafare: 'da_fare', incorso: 'in_corso', fatto: 'fatto', finito: 'finito' }[norm(v('stato'))]; if (s2) dati.stato = s2; else avv.push('stato non riconosciuto (uso "Da fare")'); }
        if (v('resp')) { const id = perMail.get(v('resp').toLowerCase()); if (id) dati.responsabile_id = id; else avv.push('responsabile non in anagrafica'); }
        const incs = []; v('inc').split(/[;,\n]+/).map(t => t.trim().toLowerCase()).filter(Boolean).forEach(m => { const id = perMail.get(m); if (id) incs.push(id); else avv.push('incaricato non in anagrafica: ' + m); });
        const percorso = livelli.slice(0, ult + 1).join(' › ');
        if (e.length) { nErr++; righe.push({ tipo: 'err', celle: [String(i + 2), percorso || '—', e.join('; ')] }); return; }
        const path = livelli.slice(0, ult + 1);
        for (let x = 1; x < path.length; x++) nodoPiano(path.slice(0, x), i);   // rami intermedi
        const np = nodoPiano(path, i); Object.assign(np.dati, dati); incs.forEach(id => np.inc.add(id)); np.conRiga = true;
        const nuovo = !np.esistente;
        if (avv.length) nAvv++;
        righe.push({ tipo: avv.length ? 'avv' : (nuovo ? 'ok' : 'agg'), celle: [String(i + 2), percorso, (nuovo ? 'Nuovo' : 'Esistente: aggiorna i campi compilati') + (avv.length ? ' · ' + avv.join('; ') : '')] });
      });
      // calcolo del piano
      const haFigli = new Set(); piano.forEach(n => { if (n.path.length > 1) haFigli.add(chiave(n.path.slice(0, -1))); });
      esist.forEach((n, k) => { if (figli(n.id).length) haFigli.add(k); });
      const creazioni = [], agg = [], incs = [], posiz = new Map();
      const prossimaPos = (pk, pid) => { if (!posiz.has(pk)) posiz.set(pk, figli(pid).length ? Math.max(...figli(pid).map(x => x.posizione)) + 1 : 0); const v = posiz.get(pk); posiz.set(pk, v + 1); return v; };
      let nInc = 0, scartati = 0;
      [...piano.values()].sort((a, b) => a.path.length - b.path.length || a.ordine - b.ordine).forEach(n => {
        const padreK = n.path.length > 1 ? chiave(n.path.slice(0, -1)) : '';
        const padre = n.path.length > 1 ? (esist.get(padreK) || null) : null;
        let incIds = [...n.inc];
        const foglia = !haFigli.has(n.k);
        if (incIds.length && !foglia) { incIds = []; scartati++; }
        if (n.esistente) {
          if (Object.keys(n.dati).filter(k => k !== 'stato').length) agg.push({ id: n.esistente.id, ...n.dati });
          incIds.forEach(pid => { if (!(S.inc[n.esistente.id] || []).some(x => x.persona_id === pid)) { incs.push({ nodo_id: n.esistente.id, persona_id: pid }); nInc++; } });
        } else {
          if (padre && isLeaf(padre) && nIncarichi(padre)) { scartati++; return; }
          creazioni.push({ k: n.k, parent_id: padre ? padre.id : null, parent_k: (n.path.length > 1 && !padre) ? padreK : null, titolo: n.path[n.path.length - 1], ...n.dati, posizione: prossimaPos(padreK, padre ? padre.id : null) });
          incIds.forEach(pid => { incs.push({ nodo_k: n.k, persona_id: pid }); nInc++; });
        }
      });
      const sommario = [`Nuovi elementi: ${creazioni.length} · Esistenti da aggiornare: ${agg.length} · Incaricati da aggiungere: ${nInc}`, `Righe con errori (saltate): ${nErr} · Righe con avvisi: ${nAvv}` + (scartati ? ` · Elementi/incarichi scartati (non attività): ${scartati}` : '')];
      return {
        colonne: ['Riga', 'Percorso', 'Esito'], righe, nOk: creazioni.length + agg.length + incs.length, sommario,
        esegui: async () => {
          const { data, error } = await stato.sb.rpc('importa_struttura', { _evento: stato.evento, _piano: { creazioni, aggiornamenti: agg, incarichi: incs } });
          if (error) throw error;
          await aggiornaTutto();
          return 'Struttura importata: ' + data.creati + ' nuovi, ' + data.aggiornati + ' aggiornati, ' + data.incarichi + ' incarichi';
        }
      };
    });
  }

  // --- DUPLICA EVENTO ---
  let dupDa = null;
  function apriDuplica(id) {
    dupDa = stato.eventi.find(e => e.id === id); if (!dupDa) return;
    $('#dupDa').textContent = 'Da: ' + dupDa.titolo + ' (' + fmtRange(dupDa) + ')';
    $('#dTit').value = dupDa.titolo + ' (copia)'; $('#dIni').value = ''; $('#dFin').value = '';
    $('#dScad').checked = true; $('#dResp').checked = true; $('#dInc').checked = false;
    $('#dErr').classList.add('hidden'); $('#modDup').classList.remove('hidden'); $('#dTit').focus();
  }
  async function eseguiDuplica(ev) {
    ev.preventDefault();
    const t = $('#dTit').value.trim(), i = $('#dIni').value, f = $('#dFin').value, er = m => { $('#dErr').textContent = m; $('#dErr').classList.remove('hidden'); };
    if (!t) return er('Il titolo è obbligatorio.'); if (!i) return er('La data è obbligatoria.'); if (f && f < i) return er('La data fine non può precedere la data di inizio.');
    if (!navigator.onLine) return er('Serve la connessione per duplicare.');
    $('#dOk').disabled = true;
    const { error } = await stato.sb.rpc('duplica_evento', { _evento: dupDa.id, _titolo: t, _data_inizio: i, _data_fine: f || null, _copia_incaricati: $('#dInc').checked, _sposta_scadenze: $('#dScad').checked, _copia_responsabili: $('#dResp').checked });
    $('#dOk').disabled = false;
    if (error) return er('Duplicazione non riuscita: ' + error.message);
    $('#modDup').classList.add('hidden'); await caricaEventi(); toast('Evento duplicato');
  }


  // ---------- privacy / GDPR ----------
  const infoPrivacy = () => {
    const p = stato.parametri;
    if (p.privacy_url || p.privacy_testo) return { url: p.privacy_url || '', testo: p.privacy_testo || '' };
    return LS.get('sdm_privacy') || { url: '', testo: '' };
  };
  function aggiornaPrivacy() {
    const i = infoPrivacy(), on = !!(i.url || i.testo);
    $$('.lnkPriv').forEach(e => e.classList.toggle('hidden', !on));
    $$('.lnkPrivSep').forEach(e => e.classList.toggle('hidden', !on));
  }
  function apriInformativa(ev) {
    if (ev) ev.preventDefault();
    const i = infoPrivacy();
    if (i.url && !i.testo) { window.open(i.url, '_blank', 'noopener'); return; }
    $('#privTesto').textContent = i.testo || 'L\'informativa non è ancora disponibile.';
    $('#modPriv').classList.remove('hidden');
  }
  function verificaInformativa() {
    const p = stato.parametri, pers = stato.persona, i = infoPrivacy();
    if (!p.informativa_obbligatoria || !(i.url || i.testo) || !navigator.onLine) return;
    const ver = parseInt(p.informativa_versione, 10) || 1;
    if ((pers.informativa_ver || 0) >= ver) return;
    $('#infoTesto').textContent = i.testo || '';
    $('#infoLink').classList.toggle('hidden', !i.url); if (i.url) $('#infoUrl').setAttribute('href', i.url);
    $('#infoErr').classList.add('hidden'); $('#modInfo').classList.remove('hidden');
  }
  async function confermaInformativa() {
    const ver = parseInt(stato.parametri.informativa_versione, 10) || 1;
    if (!navigator.onLine) { $('#infoErr').textContent = 'Serve la connessione per confermare.'; $('#infoErr').classList.remove('hidden'); return; }
    const { error } = await stato.sb.rpc('registra_presa_visione', { _versione: ver });
    if (error) { $('#infoErr').textContent = 'Operazione non riuscita: ' + error.message; $('#infoErr').classList.remove('hidden'); return; }
    stato.persona.informativa_ver = ver; LS.set('sdm_profilo', stato.persona);
    $('#modInfo').classList.add('hidden');
  }

  // diritto di accesso/portabilità: scarica tutti i dati di una persona (admin: chiunque; altri: i propri)
  async function scaricaDatiPersona(id) {
    if (!navigator.onLine) { alert('Serve la connessione.'); return; }
    const { data, error } = await stato.sb.rpc('dati_persona', { _id: id });
    if (error) { alert('Download non riuscito: ' + error.message); return; }
    const a = data.anagrafica || {}, sn = v => (v ? 'Sì' : 'No');
    const anag = [['Campo', 'Valore'], ['Cognome', a.cognome], ['Nome', a.nome], ['Email', a.email], ['Cellulare', a.cellulare || ''], ['Iscritto', sn(a.iscritto)], ['Numero iscritto', a.numero_iscritto || ''],
      ['Data di nascita', ddmmyyyy(a.data_nascita)], ['Ruolo', a.ruolo === 'admin' ? 'Amministratore' : 'Operatore'], ['Attivo', sn(a.attivo)], ['Note', a.note || ''],
      ['Registrato il', a.creato_il ? new Date(a.creato_il).toLocaleString('it-IT') : ''], ['Informativa letta (versione)', a.informativa_ver || ''], ['Informativa letta il', a.informativa_il ? new Date(a.informativa_il).toLocaleString('it-IT') : '']];
    const fogli = [
      { nome: 'Anagrafica', righe: anag, larghezze: [30, 50] },
      { nome: 'Attività', righe: [['Evento', 'Percorso', 'Stato', 'Scadenza', 'Nota'], ...(data.incarichi || []).map(x => [x.evento, (x.percorso || '').replace(/ > /g, ' › '), LAB_STATO[x.stato] || x.stato, ddmmyyyy(x.scadenza), x.nota || ''])], larghezze: [24, 40, 12, 12, 40] },
      { nome: 'Responsabile di', righe: [['Evento', 'Ramo'], ...(data.responsabile_di || []).map(x => [x.evento, (x.percorso || '').replace(/ > /g, ' › ')])], larghezze: [24, 50] },
      { nome: 'Movimenti', righe: [['Data', 'Tabella', 'Azione', 'Evento', 'Ramo', 'Descrizione'], ...(data.movimenti || []).map(x => [new Date(x.data).toLocaleString('it-IT'), x.tabella, x.azione, x.evento || '', x.ramo || '', x.descrizione])], larghezze: [20, 12, 10, 24, 36, 60] }
    ];
    scaricaFile('dati_' + [a.cognome, a.nome].filter(Boolean).join('_').replace(/[^\w\-]+/g, '_') + '.xlsx', fogli);
  }

  // diritto alla cancellazione (admin)
  async function eliminaPersonaDef() {
    const p = P.corrente; if (!p) return;
    if (!navigator.onLine) { erroreForm('Serve la connessione.'); return; }
    if (!confirm('Eliminare DEFINITIVAMENTE ' + p.cognome + ' ' + p.nome + '?\n\nVerranno cancellati anagrafica, incarichi e utente di accesso, e i movimenti che la riguardano diventeranno anonimi. L\'operazione NON si può annullare.\n\nSe serve, scarica prima i suoi dati.')) return;
    const t = prompt('Per confermare scrivi ELIMINA');
    if (!t || t.trim().toUpperCase() !== 'ELIMINA') return;
    const { error } = await stato.sb.rpc('elimina_persona', { _id: p.id });
    if (error) { erroreForm('Eliminazione non riuscita: ' + error.message); return; }
    chiudiPersona(); await caricaPersone(); toast('Persona eliminata definitivamente');
  }

  // conservazione dei movimenti
  async function pulisciMovimenti(manuale) {
    const { data, error } = await stato.sb.rpc('pulisci_movimenti');
    if (!manuale) { if (!error) LS.set('sdm_pulizia', Date.now()); return; }
    $('#pPulMsg').textContent = error ? 'Operazione non riuscita: ' + error.message : (data ? 'Eliminati ' + data + ' movimenti.' : 'Nessun movimento da eliminare.');
  }
  function pulizieAutomatiche() {
    if (!isAdmin() || !navigator.onLine || !(parseInt(stato.parametri.conservazione_movimenti_mesi, 10) > 0)) return;
    const u = LS.get('sdm_pulizia'); if (u && Date.now() - u < 20 * 3600 * 1000) return;
    pulisciMovimenti(false).catch(() => {});
  }

  const MODELLO_INFORMATIVA = `INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI (artt. 13-14 GDPR)

Titolare del trattamento: [Nome associazione], [indirizzo], [email/PEC]. Contatto privacy: [email].

Dati trattati: dati anagrafici e di contatto, data di nascita, dati di iscrizione, incarichi e attività svolte negli eventi, dati di accesso all'app (email) e registro delle operazioni svolte nell'app.

Finalità e basi giuridiche: gestione del rapporto associativo/di collaborazione e organizzazione degli eventi sportivi (art. 6.1.b e 6.1.f GDPR); adempimenti di legge (6.1.c); sicurezza dell'app (6.1.f). Eventuali comunicazioni promozionali o la pubblicazione di immagini solo con il tuo consenso (6.1.a), revocabile in ogni momento.

Destinatari: le persone autorizzate dell'associazione (amministratori e responsabili di ramo, con accesso limitato alle attività di loro competenza) e i fornitori tecnici nominati responsabili del trattamento: Supabase (database), Vercel (hosting), Resend (invio email). Trasferimenti extra UE: [indicare regione dei dati e garanzie].

Conservazione: [indicare i tempi, es. durata del rapporto + X anni; registro delle operazioni per N mesi].

Diritti: puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti al trattamento scrivendo a [email]; hai diritto di reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

Strumenti: l'app usa solo strumenti tecnici (sessione e copia locale dei dati per l'uso offline); non usa cookie di profilazione né strumenti di analisi.`;

  // ---------- logo (admin) ----------
  function leggiLogo(file) {
    return new Promise((ok, ko) => {
      const rd = new FileReader();
      rd.onerror = () => ko(new Error('file non leggibile'));
      rd.onload = () => {
        const im = new Image();
        im.onerror = () => ko(new Error('il file non è un\'immagine valida'));
        im.onload = () => {
          let max = 512, url;
          do {
            const k = Math.min(1, max / Math.max(im.naturalWidth || max, im.naturalHeight || max));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round((im.naturalWidth || max) * k)); c.height = Math.max(1, Math.round((im.naturalHeight || max) * k));
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            url = c.toDataURL('image/png'); max = Math.round(max * 0.75);
          } while (url.length > 400000 && max > 128);
          ok(url);
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  async function caricaLogo(ev) {
    const f = ev.target.files[0], msg = $('#lgMsg');
    if (!f) return;
    msg.textContent = '';
    if (f.size > 5 * 1024 * 1024) { msg.textContent = 'Immagine troppo grande (max 5 MB).'; return; }
    if (!navigator.onLine) { msg.textContent = 'Serve la connessione per salvare il logo.'; return; }
    try {
      const url = await leggiLogo(f);
      const { error } = await stato.sb.from('parametri').upsert({ chiave: 'logo', valore: url }, { onConflict: 'chiave' });
      if (error) throw error;
      const nuovi = { ...stato.parametri, logo: url };
      LS.set('sdm_parametri', nuovi); applicaParametri(nuovi);
      msg.textContent = '✔ Logo salvato';
    } catch (e) { msg.textContent = 'Logo non salvato: ' + e.message; }
    ev.target.value = '';
  }

  async function ripristinaLogo() {
    const msg = $('#lgMsg');
    if (!navigator.onLine) { msg.textContent = 'Serve la connessione.'; return; }
    const { error } = await stato.sb.from('parametri').delete().eq('chiave', 'logo');
    if (error) { msg.textContent = 'Operazione non riuscita: ' + error.message; return; }
    const nuovi = { ...stato.parametri, logo: null };
    LS.set('sdm_parametri', nuovi); applicaParametri(nuovi);
    msg.textContent = '✔ Logo predefinito ripristinato';
  }

  // ---------- parametri (admin) ----------
  function riempiParametri() {
    const p = stato.parametri;
    $('#pNome').value = p.nome_app; $('#pTema').value = p.tema; $('#pCol').value = p.colore_primario;
    $('#pLiv').value = p.max_livelli; $('#pGg').value = p.giorni_preavviso_scadenza;
    $('#pResp').checked = !!p.responsabile_crea_rami;
    $('#pPrivUrl').value = p.privacy_url || ''; $('#pPrivTesto').value = p.privacy_testo || ''; $('#pInfoObb').checked = !!p.informativa_obbligatoria;
    $('#pInfoVer').value = p.informativa_versione || 1; $('#pMesi').value = p.conservazione_movimenti_mesi === undefined ? 24 : p.conservazione_movimenti_mesi; $('#pPulMsg').textContent = '';
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
    const mesi = parseInt($('#pMesi').value, 10), iver = parseInt($('#pInfoVer').value, 10), purl = $('#pPrivUrl').value.trim();
    if (!(mesi >= 0 && mesi <= 120)) { msg.textContent = 'I mesi di conservazione devono essere da 0 a 120.'; return; }
    if (!(iver >= 1)) { msg.textContent = 'La versione dell\'informativa deve essere almeno 1.'; return; }
    if (purl && !/^https?:\/\//i.test(purl)) { msg.textContent = 'L\'indirizzo dell\'informativa deve iniziare con http:// o https://'; return; }
    if (!navigator.onLine) { msg.textContent = 'Serve la connessione per salvare i parametri.'; return; }
    const nuovi = {
      ...stato.parametri,
      nome_app: nome, tema: $('#pTema').value, colore_primario: $('#pCol').value,
      max_livelli: liv, giorni_preavviso_scadenza: gg, responsabile_crea_rami: $('#pResp').checked,
      privacy_url: purl, privacy_testo: $('#pPrivTesto').value.trim(), informativa_obbligatoria: $('#pInfoObb').checked, informativa_versione: iver, conservazione_movimenti_mesi: mesi
    };
    // il logo si gestisce a parte; i valori vuoti (null) non si salvano: la colonna "valore" non accetta null
    const righe = Object.entries(nuovi).filter(([k, v]) => k !== 'logo' && v !== null && v !== undefined).map(([chiave, valore]) => ({ chiave, valore }));
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
    $('#evForm').addEventListener('submit', salvaEvento);
    $('#eAnnulla').onclick = chiudiEvento; $('#eDel').onclick = eliminaEvento;
    $('#evNuovo').onclick = () => apriEvento(null);
    $('#cambiaEv').onclick = () => vai('eventi');
    $$('.lnkPriv').forEach(e => e.addEventListener('click', apriInformativa)); $('#privChiudi').onclick = () => $('#modPriv').classList.add('hidden');
    $('#infoOk').onclick = confermaInformativa; $('#iDati').onclick = () => scaricaDatiPersona(null);
    $('#fDati').onclick = () => P.corrente && scaricaDatiPersona(P.corrente.id); $('#fElimina').onclick = eliminaPersonaDef;
    $('#pPulisci').onclick = () => { if (confirm('Eliminare definitivamente i movimenti più vecchi del periodo di conservazione impostato (e già salvato)?')) pulisciMovimenti(true); };
    $('#pPrivModello').onclick = () => { if (!$('#pPrivTesto').value.trim() || confirm('Sostituire il testo attuale con il modello?')) $('#pPrivTesto').value = MODELLO_INFORMATIVA; };
    $('#perEsporta').onclick = esportaPersone; $('#perImporta').onclick = importaPersone; $('#perModello').onclick = modelloPersone;
    $('#strEsporta').onclick = esportaStruttura; $('#strImporta').onclick = importaStruttura; $('#strModello').onclick = modelloStruttura;
    $('#impFile').addEventListener('change', impAnalizza); $('#impOk').onclick = impEsegui; $('#impAnnulla').onclick = chiudiImport;
    $('#dupForm').addEventListener('submit', eseguiDuplica); $('#dAnnulla').onclick = () => $('#modDup').classList.add('hidden');
    $('#nodoForm').addEventListener('submit', salvaNodo);
    $('#attForm').addEventListener('submit', salvaScheda); $('#aChiudi').onclick = chiudiScheda;
    $('#nAnnulla').onclick = chiudiNodo; $('#mvAnnulla').onclick = () => $('#modMove').classList.add('hidden');
    $('#strModBtn').onclick = () => { S.mod = !S.mod; renderStruttura(); };
    $('#strEspandi').onclick = () => { S.collassati = new Set(); renderStruttura(); };
    $('#strComprimi').onclick = () => { S.collassati = new Set(S.nodi.filter(n => S.nodi.some(x => x.parent_id === n.id)).map(n => n.id)); renderStruttura(); };
    $('#lgFile').addEventListener('change', caricaLogo); $('#lgDel').onclick = ripristinaLogo;
    $$('.ver').forEach(e => { e.textContent = 'v' + VERSIONE; });
    $('#otpMin').textContent = cfg.OTP_MINUTI || 5;
    $('#fAnnulla').onclick = chiudiPersona;
    $('#perNuova').onclick = () => apriPersona(null);
    $('#fIsc').onchange = () => $('#fNumW').classList.toggle('hidden', !$('#fIsc').checked);
    ['#perCerca', '#perFiltro', '#perNonAttivi'].forEach(id => $(id).addEventListener('input', renderPersone));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { chiudiPersona(); chiudiEvento(); chiudiNodo(); chiudiScheda(); chiudiImport(); $('#modDup').classList.add('hidden'); $('#modPriv').classList.add('hidden'); } });
    $('#installa').onclick = installa;
    $('#vaiPar').onclick = () => vai('par');
    $('#rete').onclick = () => sincronizza(true); $('#iSync').onclick = () => sincronizza(true); $('#iRev').onclick = () => vai('rev');
    $$('.nv, .bottom button').forEach(b => { b.onclick = () => vai(b.dataset.p); });
    window.addEventListener('online', aggiornaRete);
    window.addEventListener('offline', aggiornaRete);

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { mostra('setup'); return; }

    stato.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      db: { schema: cfg.SCHEMA || 'sdm_eventi' },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    aggiornaPrivacy();
    stato.sb.rpc('informativa_pubblica').then(r => { if (r && r.data) { LS.set('sdm_privacy', { url: r.data.url || '', testo: r.data.testo || '' }); aggiornaPrivacy(); } }).catch(() => {});
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
