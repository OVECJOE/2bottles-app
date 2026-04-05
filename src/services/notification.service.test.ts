import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', () => ({
    api: {
        post: vi.fn(async () => ({ ok: true })),
    },
}));

import { api } from '../api/client.js';
import { notificationService } from './notification.service.js';

describe('notificationService', () => {
    it('returns denied when Notification API is missing', async () => {
        Object.defineProperty(globalThis, 'Notification', {
            value: undefined,
            configurable: true,
        });
        const permission = await notificationService.requestPermission();
        expect(permission).toBe('denied');
    });

    it('posts unsubscribe payload when subscription exists', async () => {
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
        expect(api.post).toHaveBeenCalledWith('/notifications/unsubscribe', { endpoint: 'https://push.endpoint' });
    });
});
