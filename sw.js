// Service worker: l'app si apre anche senza rete.
// Ad ogni nuova versione dell'app cambiare VERSIONE (stesso numero di index.html).
const VERSIONE = '5.0';
const BUILD = 'b1';   // aumenta a ogni modifica ai file in cache, anche senza cambio di versione
const CACHE = 'sdm-eventi-' + VERSIONE + '-' + BUILD;
const SHELL = [
  './', 'index.html', 'assets/app.css', 'js/config.js', 'js/zip.js', 'js/app.js', 'vendor/supabase.js', 'vendor/sortable.min.js', 'vendor/xlsx.mini.min.js',
  'assets/logo.png', 'assets/notifica-icon.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('sdm-eventi-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Solo risorse dell'app (stessa origine): risponde subito dalla cache e aggiorna in background.
// Le chiamate a Supabase (altra origine) non passano di qui.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const rete = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(rete); return hit; }
      const res = await rete;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});

// Notifiche push delle scadenze (inviate dalla funzione "notifiche-scadenze")
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'SDM Eventi', body: e.data ? e.data.text() : '' }; }
  const icona = new URL('assets/notifica-icon.png', self.registration.scope).href;
  e.waitUntil(self.registration.showNotification(d.title || 'SDM Eventi', { body: d.body || '', icon: icona, badge: icona, tag: d.tag || undefined, data: { url: self.registration.scope } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    const aperta = l.find(c => c.url.startsWith(self.registration.scope));
    return aperta ? aperta.focus() : self.clients.openWindow(url);
  }));
});
