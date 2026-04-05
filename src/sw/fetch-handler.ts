/// <reference lib="webworker" />

import { ASSET_RELOAD_SIGNAL, CACHE_NAMES, RUNTIME_CACHEABLE_PATH_PREFIXES } from './sw.constants.js';

declare const self: ServiceWorkerGlobalScope;

function isSameOriginGet(request: Request): boolean {
    const url = new URL(request.url);
    return request.method === 'GET' && url.origin === self.location.origin;
}

function shouldBypass(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws');
}

function isHashedBuildAsset(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname.startsWith('/assets/');
}

function isRuntimeCacheable(request: Request): boolean {
    const url = new URL(request.url);
    return RUNTIME_CACHEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isHtmlNavigation(request: Request): boolean {
    return request.mode === 'navigate';
}

async function notifyAssetMissingReload(): Promise<void> {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
        client.postMessage({ type: ASSET_RELOAD_SIGNAL });
    }
}

async function networkOnlyBuildAsset(request: Request): Promise<Response> {
    try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.status === 404 || response.status === 410) {
            await notifyAssetMissingReload();
        }
        return response;
    } catch {
        await notifyAssetMissingReload();
        return new Response('Asset unavailable', {
            status: 503,
            statusText: 'Asset unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

async function staleWhileRevalidateRuntime(request: Request): Promise<Response> {
    const runtimeCache = await caches.open(CACHE_NAMES.runtime);
    const cached = await runtimeCache.match(request);

    const networkPromise = fetch(request)
        .then(async (response) => {
            if (response.ok) {
                await runtimeCache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        void networkPromise;
        return cached;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) return networkResponse;

    return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

async function networkFirstNavigation(request: Request): Promise<Response> {
    try {
        const response = await fetch(request);
        const shellCache = await caches.open(CACHE_NAMES.shell);
        await shellCache.put('/index.html', response.clone());
        return response;
    } catch {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) return cachedShell;
        return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

export function registerFetchHandler(): void {
    self.addEventListener('fetch', (event) => {
        const { request } = event;

        if (!isSameOriginGet(request)) return;
        if (shouldBypass(request)) return;

        if (isHashedBuildAsset(request)) {
            event.respondWith(networkOnlyBuildAsset(request));
            return;
        }

        if (isRuntimeCacheable(request)) {
            event.respondWith(staleWhileRevalidateRuntime(request));
            return;
        }

        if (isHtmlNavigation(request)) {
            event.respondWith(networkFirstNavigation(request));
        }
    });
}
