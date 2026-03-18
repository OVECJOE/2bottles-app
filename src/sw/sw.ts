// =============================================================
// 2bottles — Service Worker
//
// Compiled as a separate Rollup entry → dist/sw.js
// Strategy: network-first for API, cache-first for assets.
// =============================================================

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = '2bottles-v3';
const ASSET_CACHE = '2bottles-assets-v3';

async function notifyAssetMissingReload() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
        client.postMessage({ type: 'ASSET_MISSING_RELOAD' });
    }
}

// Assets to precache on install (Vite injects the manifest
// in production via the rollup output; list key routes here)
const PRECACHE_URLS = [
    '/',
    '/index.html',
];

// ----------------------------------------------------------
// Install — precache shell
// ----------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    // Activate immediately without waiting for old tabs to close
    self.skipWaiting();
});

// ----------------------------------------------------------
// Activate — clean up old caches
// ----------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME && k !== ASSET_CACHE)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ----------------------------------------------------------
// Fetch — routing strategy
// ----------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Skip non-GET and cross-origin requests
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // 2. API calls → network-only (never cache live location data)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

    // 3. JS/CSS/image assets → network-first, fallback to cache.
    // This avoids stale-chunk failures after deploy when dynamic imports change.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith((async () => {
            const cache = await caches.open(ASSET_CACHE);
            try {
                const response = await fetch(request);
                if (response.ok) {
                    cache.put(request, response.clone());
                } else if (response.status === 404) {
                    await cache.delete(request);
                    // Deployed build changed and this hashed chunk no longer exists.
                    // Ask clients to refresh shell so module graph matches deployed assets.
                    event.waitUntil(notifyAssetMissingReload());
                }
                return response;
            } catch {
                const cached = await cache.match(request);
                if (cached) return cached;
                return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
            }
        })());
        return;
    }

    // 4. HTML navigation → network-first, fall back to cached shell
    event.respondWith(
        fetch(request).catch(() =>
            caches.match('/index.html').then((r) => r ?? new Response('Offline', { status: 503 }))
        )
    );
});

// ----------------------------------------------------------
// Push notifications
// ----------------------------------------------------------
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload: { title?: string; body?: string } = {};
    try {
        payload = event.data.json();
    } catch {
        payload = { title: '2bottles', body: event.data.text() };
    }

    event.waitUntil(
        self.registration.showNotification(payload.title ?? '2bottles', {
            body: payload.body ?? 'You have a new rendezvous invite',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: '2bottles-invite',     // replaces previous notification
            silent: false,
            data: payload,
        })
    );
});

// ----------------------------------------------------------
// Notification click — open / focus the app
// ----------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                const existing = clients.find((c) => c.url.startsWith(self.location.origin));
                if (existing) return existing.focus();
                return self.clients.openWindow('/');
            })
    );
});
