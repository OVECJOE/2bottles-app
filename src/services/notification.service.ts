/**
 * Notification service — requests push permission and manages
 * the PushSubscription lifecycle. Sends the subscription endpoint
 * to the backend so it can deliver partner invite notifications.
 */
import { api } from '../api/client.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export const notificationService = {

    async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) return 'denied';
        if (Notification.permission === 'granted') return 'granted';
        return Notification.requestPermission();
    },

    async subscribe(): Promise<PushSubscription | null> {
        if (!('serviceWorker' in navigator) || !VAPID_PUBLIC_KEY) return null;

        const permission = await this.requestPermission();
        if (permission !== 'granted') return null;

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return existing;

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await api.post('/notifications/subscribe', subscription.toJSON());
        return subscription;
    },

    async unsubscribe(): Promise<void> {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            await sub.unsubscribe();
            await api.post('/notifications/unsubscribe', { endpoint: sub.endpoint }).catch(() => { });
        }
    },
};