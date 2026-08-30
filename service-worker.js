// service-worker.js
// Version 10.7 — Cache bump to pick up app.js's background-timer accuracy fix
const CACHE_NAME = 'fitness-app-v10.7';

const BASE = self.location.pathname.replace(/\/service-worker\.js$/, '');
const urlsToCache = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/styles.css',
    BASE + '/app.js',
    BASE + '/exercise-library.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// ── Install: cache all app files ─────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
    // Don't wait for old SW to finish — take over immediately on update
    self.skipWaiting();
});

// ── Activate: delete old caches, claim all clients ───────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: cache-first for app files, network-first for others ───
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// ── Message: force update on demand from the app ─────────────────
// When the app posts { action: 'skipWaiting' }, the new SW activates
// immediately and the app reloads to pick up fresh files.
self.addEventListener('message', event => {
    if (event.data?.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
