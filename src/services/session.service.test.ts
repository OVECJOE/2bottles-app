import { describe, expect, it, vi, beforeEach } from 'vitest';

import { sessionService } from './session.service.js';
import { sessionStore } from '../store/index.js';
import { locationStore } from '../store/index.js';
import type { Venue } from '../types/index.js';

describe('sessionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStore.session = { id: 'sess-1', status: 'pending_partner', createdAt: Date.now(), link: '', venueId: null };
        locationStore.own = { lat: 10, lng: 12 };
        locationStore.partner = { lat: 11, lng: 13 };
    });

    it('creates session with own coordinates and toggles loading', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({
                session: {
                    id: 'new-1',
                    link: '/join/new-1',
                    status: 'pending_partner',
                    createdAt: Date.now(),
                    venueId: null,
                },
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sessionService.createSession();

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/sessions'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ lat: 10, lng: 12 }),
            })
        );
        expect(sessionStore.session?.id).toBe('new-1');
    });

    it('invites partner and opens websocket connection', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

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

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/sessions/invite'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ sessionId: 'sess-1', partnerId: 'p1' }),
            })
        );
        expect(sessionStore.partner?.id).toBe('p1');
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

        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ venues }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sessionService.fetchVenueSuggestions();

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/sessions/venues'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ lat1: 10, lng1: 12, lat2: 11, lng2: 13 }),
            })
        );
        expect(sessionStore.venueSuggestions).toEqual(venues);
    });

    it('ends session even when backend end call fails', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ message: 'error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        await sessionService.endSession();

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/sessions/sess-1'),
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(sessionStore.session).toBeNull();
    });
});
