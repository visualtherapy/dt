// =====================================================
// Cikgu Mata — Service Worker (PWA Offline Support)
// =====================================================
const CACHE_NAME = 'cikgumata-v1';

// Semua fail yang nak di-cache untuk offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo8.png',
    './icon-192.png',
    './icon-512.png',
    // Google Fonts — cache supaya boleh pakai offline lepas load pertama
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600;700&display=swap',
    'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyKS6BogtI.woff2',
    'https://fonts.gstatic.com/s/exo2/v21/7cH1v4okm5zmbvwkAx_sfcEuiD8jvvKcPtq6H.woff2'
];

// ===== INSTALL — cache semua assets =====
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache core files dulu (kritikal)
            return cache.addAll(['./', './index.html', './manifest.json'])
                .then(() => {
                    // Cache optional files (logo, fonts) — tak fail kalau takde
                    return Promise.allSettled(
                        ['./logo8.png', './icon-192.png', './icon-512.png'].map(url =>
                            cache.add(url).catch(() => {})
                        )
                    );
                });
        }).then(() => self.skipWaiting())
    );
});

// ===== ACTIVATE — buang cache lama =====
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ===== FETCH — serve dari cache, fallback ke network =====
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Strategy: Cache First untuk assets tempatan
    // Strategy: Network First dengan cache fallback untuk Google Fonts
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        // Fonts — Network first, simpan dalam cache
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Semua fail lain — Cache first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache response baru untuk guna offline nanti
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Fallback — return index.html untuk navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
