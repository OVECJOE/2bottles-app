/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { registerFetchHandler } from './fetch-handler.js';
import { registerPushHandlers } from './push-handler.js';
import { CACHE_NAMES, PRECACHE_URLS } from './sw.constants.js';

async function cleanOldCaches(): Promise<void> {
    const keys = await caches.keys();
    const active = new Set<string>(Object.values(CACHE_NAMES));
    await Promise.all(
        keys
            .filter((cacheName) => !active.has(cacheName))
            .map((cacheName) => caches.delete(cacheName))
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const shell = await caches.open(CACHE_NAMES.shell);
            await shell.addAll(PRECACHE_URLS);
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            await cleanOldCaches();
            await self.clients.claim();
        })()
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        void self.skipWaiting();
    }
});

registerFetchHandler();
registerPushHandlers();
