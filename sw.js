const CACHE_NAME = 'iwork-v3';
// Rimosso lo slash iniziale "/" per compatibilità con sottocartelle GitHub
const assets = [
    './', 
    'index.html', 
    'ferie.html', 
    'malattia.html', 
    'style.css', 
    'app.js', 
    'manifest.json'
];

// Installazione e caching
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usiamo addAll ma con un catch per debuggare se un file manca
      return cache.addAll(ASSETS).catch(err => console.error("Errore cache:", err));
    })
  );
  self.skipWaiting(); // Forza l'attivazione immediata
});

// Pulizia vecchie cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// Strategia: Cache First, poi Network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});