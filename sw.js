const CACHE_NAME = 'baki-tracker-v3';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192x192.svg',
  './icon-512x512.svg',
  'https://cdn.tailwindcss.com',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.jsdelivr.net/npm/pouchdb@8.0.1/dist/pouchdb.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request).then(function(response) {
          // Cache successful fetches
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
