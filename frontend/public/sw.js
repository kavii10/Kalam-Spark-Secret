// ── Kalam Spark Service Worker ──────────────────────────────────────────────
// Strategy:
//   • Cache-First  → static assets (JS, CSS, fonts, images, icons)
//   • Network-First → API calls (Supabase, Gemini, external)
//   • Offline fallback → serve cached index.html for navigation requests
// ────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'kalam-spark-v2';
const OFFLINE_URL = '/';

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/tailwind.js',
  '/assets/logo.png',
  '/assets/logo-light.png',
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Non-fatal: some assets may not exist yet during dev
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin API requests, and APK downloads
  if (request.method !== 'GET') return;
  if (url.pathname.endsWith('.apk')) return;
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.hostname.includes('huggingface.co') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('google.com') ||
    url.pathname.startsWith('/api/')
  ) {
    // Network-only for external APIs
    return;
  }

  // Navigation requests → serve index.html (SPA fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Static assets → Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache valid same-origin responses
        if (
          !response ||
          response.status !== 200 ||
          response.type === 'opaque'
        ) {
          return response;
        }

        // Clone because response body can only be consumed once
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback for HTML requests
        if (request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── Message: force update from app ──────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
