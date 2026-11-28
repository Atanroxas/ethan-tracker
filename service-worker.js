/* Ethan Tracker PWA service worker.
   Only the app shell and static icon assets are cached. User payroll data stays
   in localStorage and is never copied into the service-worker cache. */
const CACHE_NAME = "ethan-tracker-shell-v2";
const APP_SHELL = [
  "./ethan-tracker.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("ethan-tracker-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: try the latest page online, then fall back to the cached app.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./ethan-tracker.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./ethan-tracker.html"))
    );
    return;
  }

  // Cache only explicitly listed static app files; never cache arbitrary app data.
  const allowed = APP_SHELL.some(path => new URL(path, self.registration.scope).href === url.href);
  if (!allowed) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
