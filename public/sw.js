// Service worker d'OptiCross 3D : rend l'application installable et utilisable hors ligne.
// - Page HTML : réseau d'abord (pour recevoir les mises à jour), copie en cache en secours.
// - Fichiers du build (/assets, noms hachés donc immuables) et icônes : cache d'abord.
// - Polices Google : copie en cache, rafraîchie en arrière-plan.
const CACHE = 'opticross3d-v2';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

// Fichiers JS/CSS référencés par une page HTML (pour les mettre en cache dès l'installation)
const assetsOf = (html) =>
  [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => './' + m[1]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      const html = await (await cache.match('./')).text();
      await cache.addAll(assetsOf(html));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put('./', response.clone());
          return response;
        } catch {
          return (await cache.match('./', { ignoreVary: true })) || Response.error();
        }
      })()
    );
    return;
  }

  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreVary : le serveur répond « Vary: Origin », or le navigateur ajoute un en-tête
      // Origin aux scripts modules ; sans cette option, la copie en cache n'est jamais trouvée.
      const cached = await cache.match(request, { ignoreVary: true });
      const fromNetwork = () =>
        fetch(request)
          .then(async (response) => {
            if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
            return response;
          })
          .catch(() => undefined); // hors ligne : on retombe sur Response.error() ci-dessous
      // Fichiers hachés : la copie en cache suffit. Polices : on rafraîchit en arrière-plan.
      if (cached) {
        if (isFont) event.waitUntil(fromNetwork());
        return cached;
      }
      return (await fromNetwork()) || Response.error();
    })()
  );
});
