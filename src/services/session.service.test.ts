import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/sessions.api.js', () => ({
    sessionsApi: {
        create: vi.fn(),
        invite: vi.fn(),
        getVenueSuggestions: vi.fn(),
        confirmVenue: vi.fn(),
        end: vi.fn(),
    },
}));

vi.mock('./websocket.service.js', () => ({
    wsService: {
        connect: vi.fn(),
        disconnect: vi.fn(),
    },
}));

vi.mock('../store/index.js', () => ({
    sessionStore: {
        session: { id: 'sess-1', status: 'pending_partner', createdAt: Date.now(), link: '', venueId: null },
        createSession: vi.fn(),
        setPartner: vi.fn(),
        setVenueSuggestions: vi.fn(),
        selectVenue: vi.fn(),
        endSession: vi.fn(),
    },
    locationStore: {
        own: { lat: 10, lng: 12 },
        partner: { lat: 11, lng: 13 },
        fetchOnce: vi.fn(async () => ({ lat: 10, lng: 12 })),
        setDestination: vi.fn(),
        reset: vi.fn(),
    },
    uiStore: {
        setLoading: vi.fn(),
    },
}));

import { sessionsApi } from '../api/sessions.api.js';
import { wsService } from './websocket.service.js';
import { sessionStore, locationStore, uiStore } from '../store/index.js';
import { sessionService } from './session.service.js';
import type { Venue } from '../types/index.js';

describe('sessionService', () => {
    it('creates session with own coordinates and toggles loading', async () => {
        vi.mocked(sessionsApi.create).mockResolvedValue({
            session: {
                id: 'new-1',
                link: '/join/new-1',
                status: 'pending_partner',
                createdAt: Date.now(),
                venueId: null,
            },
        });

        await sessionService.createSession();

        expect(sessionsApi.create).toHaveBeenCalledWith({ lat: 10, lng: 12 });
        expect(sessionStore.createSession).toHaveBeenCalledWith('new-1');
        expect(uiStore.setLoading).toHaveBeenCalledWith(true);
        expect(uiStore.setLoading).toHaveBeenLastCalledWith(false);
    });

    it('invites partner and opens websocket connection', async () => {
        vi.mocked(sessionsApi.invite).mockResolvedValue({ ok: true });

        await sessionService.invitePartner({
            id: 'p1',
            name: 'Ada',
            initials: 'AD',
            avatarBg: '#fff',
            avatarColor: '#000',
            status: 'invited',
            location: null,
            etaMinutes: null,
        });

        expect(sessionsApi.invite).toHaveBeenCalledWith({ sessionId: 'sess-1', partnerId: 'p1' });
        expect(wsService.connect).toHaveBeenCalledWith('sess-1');
    });

    it('fetches venue suggestions and stores them', async () => {
        const venues: Venue[] = [{
            id: 'v1',
            name: 'Cafe',
            category: 'cafe',
            emoji: '☕',
            address: 'Main street',
            coordinates: { lat: 10.2, lng: 11.4 },
            distanceKm: 2,
            etaMinutesFromYou: 7,
            etaMinutesFromPartner: 8,
        }];

        vi.mocked(sessionsApi.getVenueSuggestions).mockResolvedValue({ venues });

        await sessionService.fetchVenueSuggestions();

        expect(sessionsApi.getVenueSuggestions).toHaveBeenCalledWith({
            lat1: 10,
            lng1: 12,
            lat2: 11,
            lng2: 13,
        });
        expect(sessionStore.setVenueSuggestions).toHaveBeenCalledWith(venues);
    });

    it('ends session even when backend end call fails', async () => {
        vi.mocked(sessionsApi.end).mockRejectedValue(new Error('offline'));

        await sessionService.endSession();

        expect(sessionsApi.end).toHaveBeenCalledWith('sess-1');
        expect(wsService.disconnect).toHaveBeenCalledTimes(1);
        expect(sessionStore.endSession).toHaveBeenCalledTimes(1);
        expect(locationStore.reset).toHaveBeenCalledTimes(1);
    });
});
