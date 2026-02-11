const CACHE_NAME = 'iwork-v1';
const ASSETS = [
  'index.html',
  'ferie.html',
  'malattia.html',
  'style.css',
  'app.js',
  'manifest.json'
];

// Installazione: salva i file in cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Intercetta le richieste: se sei offline, usa la cache
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});