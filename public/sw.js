// Service worker PharmaGuide : permet d'ouvrir l'appli et ses fiches déjà consultées sans connexion.
// Changer CACHE_NAME à chaque modification de ce fichier pour vider l'ancien cache.
const CACHE_NAME = 'pharmaguide-v5';
const APP_SHELL = ['./', './index.html', './manifest.json', './favicon.svg', './icon-192.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // L'API et le service worker lui-même ne passent jamais par le cache
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.endsWith('/sw.js'))) return;

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !isFont) return;

  // Pages : réseau d'abord pour avoir la dernière version, cache si hors ligne
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache('./index.html', response))
        .catch(async () => (await caches.match('./index.html')) || Response.error())
    );
    return;
  }

  // Fichiers statiques (JS/CSS versionnés, images, polices) : cache d'abord
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response)))
  );
});
