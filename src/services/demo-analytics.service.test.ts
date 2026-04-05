import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initDemoAnalytics, stopDemoAnalytics } from './demo-analytics.service.js';

describe('demo analytics service', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('flushes queue with fetch when beacon is unavailable', async () => {
        vi.stubEnv('VITE_DEMO_ANALYTICS_ENDPOINT', '/api/analytics');
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        initDemoAnalytics();

        window.dispatchEvent(new CustomEvent('demo-analytics', {
            detail: { name: 'flow', step: 'a', stepIndex: 1, at: Date.now() },
        }));

        vi.advanceTimersByTime(5100);
        await Promise.resolve();

        expect(fetchSpy).toHaveBeenCalledTimes(1);

        stopDemoAnalytics();
        vi.useRealTimers();
    });

    it('uses sendBeacon on pagehide when available', async () => {
        vi.stubEnv('VITE_DEMO_ANALYTICS_ENDPOINT', '/api/analytics');
        const beaconSpy = vi.fn(() => true);
        Object.defineProperty(navigator, 'sendBeacon', {
            value: beaconSpy,
            configurable: true,
        });

        initDemoAnalytics();

        window.dispatchEvent(new CustomEvent('demo-analytics', {
            detail: { name: 'flow', step: 'b', stepIndex: 2, at: Date.now() },
        }));
        window.dispatchEvent(new Event('pagehide'));
        await Promise.resolve();

        expect(beaconSpy).toHaveBeenCalledTimes(1);

        stopDemoAnalytics();
        vi.useRealTimers();
    });
});
