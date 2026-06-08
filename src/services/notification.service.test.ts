import { describe, expect, it, vi, beforeEach } from 'vitest';

import { notificationService } from './notification.service.js';

describe('notificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns denied when Notification API is missing', async () => {
        Object.defineProperty(globalThis, 'Notification', {
            value: undefined,
            configurable: true,
        });
        const permission = await notificationService.requestPermission();
        expect(permission).toBe('denied');
    });

    it('posts unsubscribe payload when subscription exists', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        const unsubscribe = vi.fn(async () => true);
        const subscription = {
            endpoint: 'https://push.endpoint',
            expirationTime: null,
            options: { applicationServerKey: null, userVisibleOnly: true },
            unsubscribe,
            getKey: () => null,
            toJSON: () => ({ endpoint: 'https://push.endpoint' }),
        };

        const ready = {
            pushManager: {
                getSubscription: vi.fn(async () => subscription),
            },
        };

        Object.defineProperty(navigator, 'serviceWorker', {
            value: { ready },
            configurable: true,
        });

        await notificationService.unsubscribe();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/notifications/unsubscribe'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ endpoint: 'https://push.endpoint' }),
            })
        );
    });
});
