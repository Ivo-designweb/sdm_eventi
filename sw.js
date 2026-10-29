// Service worker: l'app si apre anche senza rete.
// Ad ogni nuova versione dell'app cambiare VERSIONE (stesso numero di index.html).
const VERSIONE = '3.9';
const CACHE = 'sdm-eventi-' + VERSIONE;
const SHELL = [
  './', 'index.html', 'assets/app.css', 'js/config.js', 'js/app.js', 'vendor/supabase.js', 'vendor/sortable.min.js', 'vendor/xlsx.mini.min.js',
  'assets/logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
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
