const CACHE_NAME = 'lab-accounts-v1';
const ASSETS = [
  './',
  './index.html',
  './student.html',
  './login.html',
  './register.html',
  './css/style.css',
  './js/storage.service.js',
  './js/admin.js',
  './js/student.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});
