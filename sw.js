const CACHE_NAME = 'iwork-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/ferie.html',
  '/malattia.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Fase di installazione: scarica i file e li salva nella memoria del telefono
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache creata: file salvati per l\'offline');
      return cache.addAll(ASSETS);
    })
  );
});

// Fase di attivazione: pulisce vecchie versioni della cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// Gestione delle richieste: se non c'è internet, usa i file in cache
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});