// service-worker.js
const CACHE_NAME = 'fitness-app-v4.2';

// FIXED: use relative paths so they resolve correctly under the /workoutapp/ subpath
const BASE = self.location.pathname.replace(/\/service-worker\.js$/, '');
const urlsToCache = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/styles.css',
    BASE + '/app.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
