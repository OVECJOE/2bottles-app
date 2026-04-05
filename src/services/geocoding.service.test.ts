import { describe, expect, it } from 'vitest';
import { getDistance, haversineMeters } from './geocoding.service.js';

describe('geocoding math utilities', () => {
    it('returns zero when distance inputs are null', () => {
        expect(getDistance(null, 1, 2, 3)).toBe(0);
        expect(getDistance(1, null, 2, 3)).toBe(0);
    });

    it('computes near-known city distance in kilometers', () => {
        const lagosToAbujaKm = getDistance(6.5244, 3.3792, 9.0765, 7.3986);
        expect(lagosToAbujaKm).toBeGreaterThan(500);
        expect(lagosToAbujaKm).toBeLessThan(550);
    });

    it('returns symmetric meter distance', () => {
        const a = { lat: 51.5007, lng: -0.1246 };
        const b = { lat: 48.8584, lng: 2.2945 };

        const d1 = haversineMeters(a, b);
        const d2 = haversineMeters(b, a);

        expect(d1).toBeGreaterThan(300000);
        expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });
});
