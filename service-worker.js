/**
 * Service Worker for Chicken Tracker
 * Enables offline support and caching
 */

const CACHE_VERSION = "chicken-tracker-v1";
const CACHEABLE_ASSETS = [
  "./" ,
  "./index.html",
  "./styles.css",
  "./utils.js",
  "./data.js",
  "./firebase.js",
  "./charts.js",
  "./ui.js",
  "./app-new.js"
];

/**
 * Install event - cache assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CACHEABLE_ASSETS).catch((error) => {
        console.warn("Some assets could not be cached:", error);
        // Don't fail installation if some assets can't be cached
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - clean old caches
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // For external CDN requests (Chart.js, Firebase, fonts), use network-first strategy
  const url = new URL(event.request.url);
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses for offline
          if (response && response.status === 200) {
            const cache = caches.open(CACHE_VERSION);
            cache.then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // For local assets, use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

/**
 * Handle messages from clients
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
