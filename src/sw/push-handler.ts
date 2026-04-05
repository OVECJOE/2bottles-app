/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

type PushPayload = {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    requireInteraction?: boolean;
    renotify?: boolean;
    data?: Record<string, string | number | boolean | null>;
};

const DEFAULT_NOTIFICATION_TITLE = '2bottles';
const DEFAULT_NOTIFICATION_BODY = 'You have a new rendezvous invite';
const DEFAULT_NOTIFICATION_URL = '/create-session';

function normalizeUrl(pathOrUrl: string | undefined): string {
    if (!pathOrUrl) return DEFAULT_NOTIFICATION_URL;

    try {
        const target = new URL(pathOrUrl, self.location.origin);
        if (target.origin !== self.location.origin) return DEFAULT_NOTIFICATION_URL;
        return `${target.pathname}${target.search}${target.hash}`;
    } catch {
        return DEFAULT_NOTIFICATION_URL;
    }
}

function parsePushPayload(event: PushEvent): PushPayload {
    if (!event.data) return {};

    try {
        return event.data.json() as PushPayload;
    } catch {
        return { title: DEFAULT_NOTIFICATION_TITLE, body: event.data.text() };
    }
}

function notificationOptions(payload: PushPayload): NotificationOptions {
    const targetUrl = normalizeUrl(payload.url);
    return {
        body: payload.body || DEFAULT_NOTIFICATION_BODY,
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/badge-72.png',
        tag: payload.tag || '2bottles-invite',
        silent: false,
        requireInteraction: payload.requireInteraction ?? false,
        data: {
            ...(payload.data || {}),
            url: targetUrl,
        },
    };
}

async function focusOrOpen(urlPath: string): Promise<void> {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windows) {
        const existing = new URL(client.url);
        if (existing.origin === self.location.origin && existing.pathname === urlPath) {
            await client.focus();
            return;
        }
    }

    const fallback = windows.find((client) => {
        const existing = new URL(client.url);
        return existing.origin === self.location.origin;
    });

    if (fallback) {
        await fallback.focus();
        return;
    }

    await self.clients.openWindow(urlPath);
}

export function registerPushHandlers(): void {
    self.addEventListener('push', (event) => {
        const payload = parsePushPayload(event);
        const title = payload.title || DEFAULT_NOTIFICATION_TITLE;
        event.waitUntil(self.registration.showNotification(title, notificationOptions(payload)));
    });

    self.addEventListener('notificationclick', (event) => {
        event.notification.close();

        const details = event.notification.data as { url?: string } | null;
        const urlPath = normalizeUrl(details?.url);

        event.waitUntil(focusOrOpen(urlPath));
    });
}
