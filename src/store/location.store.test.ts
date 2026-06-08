import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('idb-keyval', () => ({
    get: vi.fn(),
    set: vi.fn(),
}));

vi.mock('../services/p2p.service.js', () => ({
    p2pService: {
        broadcastLocation: vi.fn(),
    },
}));

vi.mock('./index.js', () => ({
    uiStore: {
        showToast: vi.fn(),
    },
}));

import { get, set } from 'idb-keyval';
import { locationStore } from './location.store.js';

describe('LocationStore', () => {
    beforeEach(() => {
        locationStore.own = null;
        locationStore.partner = null;
        locationStore.destination = null;
        locationStore.ownEtaMinutes = null;
        locationStore.partnerEtaMinutes = null;
        locationStore.ownDistanceM = null;
        locationStore.partnerDistanceM = null;
        locationStore.isWatching = false;
        locationStore.accuracy = null;
        locationStore.lastErrorCode = null;
        locationStore.isCoolingOff = false;
        vi.clearAllMocks();
    });

    describe('setOwnLocation', () => {
        it('sets own coordinates and accuracy', () => {
            locationStore.setOwnLocation({ lat: 52.52, lng: 13.405 }, 15);

            expect(locationStore.own).toEqual({ lat: 52.52, lng: 13.405 });
            expect(locationStore.accuracy).toBe(15);
        });

        it('ignores invalid coordinates', () => {
            locationStore.setOwnLocation({ lat: NaN, lng: 13.405 });

            expect(locationStore.own).toBeNull();
        });

        it('ignores null-like coordinates', () => {
            locationStore.setOwnLocation({ lat: Infinity, lng: 13.405 });

            expect(locationStore.own).toBeNull();
        });

        it('saves to IndexedDB', () => {
            locationStore.setOwnLocation({ lat: 52.52, lng: 13.405 });

            expect(set).toHaveBeenCalled();
        });
    });

    describe('setPartnerLocation', () => {
        it('sets partner coordinates', () => {
            locationStore.setPartnerLocation({ lat: 48.856, lng: 2.352 });

            expect(locationStore.partner).toEqual({ lat: 48.856, lng: 2.352 });
        });

        it('ignores invalid coordinates', () => {
            locationStore.setPartnerLocation({ lat: NaN, lng: 2.352 });

            expect(locationStore.partner).toBeNull();
        });
    });

    describe('clearPartnerLocation', () => {
        it('clears partner coordinates', () => {
            locationStore.partner = { lat: 48.856, lng: 2.352 };

            locationStore.clearPartnerLocation();

            expect(locationStore.partner).toBeNull();
        });
    });

    describe('setDestination', () => {
        it('sets destination coordinates', () => {
            locationStore.setDestination({ lat: 51.507, lng: -0.127 });

            expect(locationStore.destination).toEqual({ lat: 51.507, lng: -0.127 });
        });

        it('ignores invalid coordinates', () => {
            locationStore.setDestination({ lat: NaN, lng: -0.127 });

            expect(locationStore.destination).toBeNull();
        });
    });

    describe('clearDestination', () => {
        it('clears destination', () => {
            locationStore.destination = { lat: 51.507, lng: -0.127 };

            locationStore.clearDestination();

            expect(locationStore.destination).toBeNull();
        });
    });

    describe('setEtas', () => {
        it('sets own and partner ETAs', () => {
            locationStore.setEtas(10, 15);

            expect(locationStore.ownEtaMinutes).toBe(10);
            expect(locationStore.partnerEtaMinutes).toBe(15);
        });

        it('does not notify when values are unchanged', () => {
            locationStore.ownEtaMinutes = 10;
            locationStore.partnerEtaMinutes = 15;

            const listener = vi.fn();
            locationStore.subscribe(listener);

            locationStore.setEtas(10, 15);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('setDistances', () => {
        it('sets own and partner distances', () => {
            locationStore.setDistances(500, 800);

            expect(locationStore.ownDistanceM).toBe(500);
            expect(locationStore.partnerDistanceM).toBe(800);
        });

        it('does not notify for negligible changes (< 5m)', () => {
            locationStore.ownDistanceM = 500;
            locationStore.partnerDistanceM = 800;

            const listener = vi.fn();
            locationStore.subscribe(listener);

            locationStore.setDistances(502, 803);

            expect(listener).not.toHaveBeenCalled();
        });

        it('notifies for significant changes', () => {
            locationStore.ownDistanceM = 500;
            locationStore.partnerDistanceM = 800;

            const listener = vi.fn();
            locationStore.subscribe(listener);

            locationStore.setDistances(510, 810);

            expect(listener).toHaveBeenCalled();
        });

        it('ignores when both values are null', () => {
            locationStore.setDistances(null, null);

            expect(locationStore.ownDistanceM).toBeNull();
            expect(locationStore.partnerDistanceM).toBeNull();
        });
    });

    describe('snapshot', () => {
        it('returns current location state', () => {
            locationStore.own = { lat: 52.52, lng: 13.405 };
            locationStore.partner = { lat: 48.856, lng: 2.352 };
            locationStore.destination = { lat: 51.507, lng: -0.127 };
            locationStore.ownEtaMinutes = 10;
            locationStore.partnerEtaMinutes = 15;
            locationStore.ownDistanceM = 500;
            locationStore.partnerDistanceM = 800;
            locationStore.isWatching = true;
            locationStore.accuracy = 20;

            const snap = locationStore.snapshot();

            expect(snap).toEqual({
                own: { lat: 52.52, lng: 13.405 },
                partner: { lat: 48.856, lng: 2.352 },
                destination: { lat: 51.507, lng: -0.127 },
                ownEtaMinutes: 10,
                partnerEtaMinutes: 15,
                ownDistanceM: 500,
                partnerDistanceM: 800,
                isWatching: true,
                accuracy: 20,
            });
        });
    });

    describe('reset', () => {
        it('clears all location state', () => {
            locationStore.own = { lat: 52.52, lng: 13.405 };
            locationStore.partner = { lat: 48.856, lng: 2.352 };
            locationStore.destination = { lat: 51.507, lng: -0.127 };
            locationStore.ownEtaMinutes = 10;
            locationStore.partnerEtaMinutes = 15;
            locationStore.ownDistanceM = 500;
            locationStore.partnerDistanceM = 800;
            locationStore.accuracy = 20;
            locationStore.lastErrorCode = 1;
            locationStore.isCoolingOff = true;

            locationStore.reset();

            expect(locationStore.own).toBeNull();
            expect(locationStore.partner).toBeNull();
            expect(locationStore.destination).toBeNull();
            expect(locationStore.ownEtaMinutes).toBeNull();
            expect(locationStore.partnerEtaMinutes).toBeNull();
            expect(locationStore.ownDistanceM).toBeNull();
            expect(locationStore.partnerDistanceM).toBeNull();
            expect(locationStore.accuracy).toBeNull();
            expect(locationStore.lastErrorCode).toBeNull();
            expect(locationStore.isCoolingOff).toBe(false);
            expect(locationStore.isWatching).toBe(false);
        });
    });

    describe('getErrorExplanation', () => {
        it('returns "Permission Denied" for error code 1', () => {
            locationStore.lastErrorCode = 1;
            expect(locationStore.getErrorExplanation()).toBe('Permission Denied');
        });

        it('returns "Geolocation Unavailable" for error code 2', () => {
            locationStore.lastErrorCode = 2;
            expect(locationStore.getErrorExplanation()).toBe('Geolocation Unavailable');
        });

        it('returns "HTTPS Required For GPS" for error code 3', () => {
            locationStore.lastErrorCode = 3;
            expect(locationStore.getErrorExplanation()).toBe('HTTPS Required For GPS');
        });

        it('returns "Search Failed" for unknown error codes', () => {
            locationStore.lastErrorCode = 99;
            expect(locationStore.getErrorExplanation()).toBe('Search Failed');
        });

        it('returns "Search Failed" when no error code', () => {
            locationStore.lastErrorCode = null;
            expect(locationStore.getErrorExplanation()).toBe('Search Failed');
        });
    });

    describe('subscribe', () => {
        it('notifies listeners on state changes', () => {
            const listener = vi.fn();
            locationStore.subscribe(listener);

            locationStore.setOwnLocation({ lat: 52.52, lng: 13.405 });

            expect(listener).toHaveBeenCalled();
        });

        it('returns unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = locationStore.subscribe(listener);

            unsubscribe();
            locationStore.setOwnLocation({ lat: 52.52, lng: 13.405 });

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('init', () => {
        it('loads location data from IndexedDB', async () => {
            const savedData = {
                own: { lat: 52.52, lng: 13.405 },
                accuracy: 15,
                partner: { lat: 48.856, lng: 2.352 },
                destination: { lat: 51.507, lng: -0.127 },
                ownEtaMinutes: 10,
                partnerEtaMinutes: 15,
                ownDistanceM: 500,
                partnerDistanceM: 800,
            };

            vi.mocked(get).mockResolvedValue(savedData);

            await locationStore.init();

            expect(locationStore.own).toEqual({ lat: 52.52, lng: 13.405 });
            expect(locationStore.partner).toEqual({ lat: 48.856, lng: 2.352 });
            expect(locationStore.destination).toEqual({ lat: 51.507, lng: -0.127 });
            expect(locationStore.ownEtaMinutes).toBe(10);
            expect(locationStore.partnerEtaMinutes).toBe(15);
            expect(locationStore.ownDistanceM).toBe(500);
            expect(locationStore.partnerDistanceM).toBe(800);
            expect(locationStore.accuracy).toBe(15);
        });

        it('handles missing saved data gracefully', async () => {
            vi.mocked(get).mockResolvedValue(undefined);

            await locationStore.init();

            expect(locationStore.own).toBeNull();
            expect(locationStore.partner).toBeNull();
        });
    });
});
