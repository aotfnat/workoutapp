// service-worker.js
const CACHE_NAME = 'fitness-app-v1';
const urlsToCache = [
    'https://aotfnat.github.io/workoutapp/styles.css/',
    'https://aotfnat.github.io/workoutapp/styles.css/index.html',
    'https://aotfnat.github.io/workoutapp/styles.css/styles.css',
    'https://aotfnat.github.io/workoutapp/styles.css/app.js',
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
