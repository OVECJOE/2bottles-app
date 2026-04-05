export const SW_VERSION = 'v6';

export const CACHE_NAMES = {
    shell: `2bottles-shell-${SW_VERSION}`,
    runtime: `2bottles-runtime-${SW_VERSION}`,
} as const;

export const PRECACHE_URLS: readonly string[] = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/illustrations/landing-map-scene.svg',
    '/illustrations/landing-duo-flow.svg',
];

export const RUNTIME_CACHEABLE_PATH_PREFIXES: readonly string[] = [
    '/icons/',
    '/illustrations/',
];

export const ASSET_RELOAD_SIGNAL = 'ASSET_MISSING_RELOAD';
