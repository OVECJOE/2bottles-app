import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('idb-keyval', () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
}));

vi.mock('../services/p2p.service.js', () => ({
    p2pService: {
        broadcastLocation: vi.fn(),
    },
}));

import { get, set, del } from 'idb-keyval';
import { sessionStore } from './session.store.js';
import type { Partner, Venue, ChatMessage } from '../types/index.js';

describe('SessionStore', () => {
    beforeEach(() => {
        sessionStore.session = null;
        sessionStore.partner = null;
        sessionStore.venueSuggestions = [];
        sessionStore.selectedVenue = null;
        sessionStore.chatMessages = [];
        sessionStore.isHost = false;
        sessionStore.ownName = '';
        sessionStore.partnerName = '';
        sessionStore.ownAgreed = false;
        sessionStore.partnerAgreed = false;
        vi.clearAllMocks();
    });

    describe('createSession', () => {
        it('creates a new session with correct properties', async () => {
            await sessionStore.createSession('test-session-123');

            expect(sessionStore.session).toBeDefined();
            expect(sessionStore.session?.id).toBe('test-session-123');
            expect(sessionStore.session?.status).toBe('pending_partner');
            expect(sessionStore.session?.link).toContain('/join/test-session-123');
            expect(sessionStore.isHost).toBe(true);
            expect(set).toHaveBeenCalled();
        });
    });

    describe('joinSession', () => {
        it('joins an existing session as non-host', async () => {
            await sessionStore.joinSession('partner-session-456');

            expect(sessionStore.session).toBeDefined();
            expect(sessionStore.session?.id).toBe('partner-session-456');
            expect(sessionStore.isHost).toBe(false);
            expect(set).toHaveBeenCalled();
        });
    });

    describe('setSessionStatus', () => {
        it('updates session status', async () => {
            await sessionStore.createSession('sess-1');
            await sessionStore.setSessionStatus('live');

            expect(sessionStore.session?.status).toBe('live');
        });

        it('does nothing when no session exists', async () => {
            await sessionStore.setSessionStatus('live');
            expect(sessionStore.session).toBeNull();
        });
    });

    describe('setSessionVenue', () => {
        it('sets venue ID on session', async () => {
            await sessionStore.createSession('sess-1');
            await sessionStore.setSessionVenue('venue-abc');

            expect(sessionStore.session?.venueId).toBe('venue-abc');
        });
    });

    describe('endSession', () => {
        it('clears all session data and removes from IDB', async () => {
            await sessionStore.createSession('sess-1');
            sessionStore.partner = { id: 'p1', name: 'Test', initials: 'TE', avatarBg: '#fff', avatarColor: '#000', status: 'accepted', location: null, etaMinutes: null };
            sessionStore.chatMessages = [{ id: 'm1', senderId: 'p1', text: 'Hello', timestamp: Date.now() }];

            await sessionStore.endSession();

            expect(sessionStore.session).toBeNull();
            expect(sessionStore.partner).toBeNull();
            expect(sessionStore.chatMessages).toEqual([]);
            expect(sessionStore.selectedVenue).toBeNull();
            expect(sessionStore.isHost).toBe(false);
            expect(del).toHaveBeenCalled();
        });
    });

    describe('partner actions', () => {
        it('sets partner data', async () => {
            const partner: Partner = {
                id: 'partner-1',
                name: 'Alice',
                initials: 'AL',
                avatarBg: '#ff0000',
                avatarColor: '#ffffff',
                status: 'invited',
                location: { lat: 52.5, lng: 13.4 },
                etaMinutes: 10,
            };

            await sessionStore.setPartner(partner);

            expect(sessionStore.partner).toEqual(partner);
            expect(set).toHaveBeenCalled();
        });

        it('creates partner object when setting status without existing partner', async () => {
            await sessionStore.createSession('sess-1');
            sessionStore.partnerName = 'Bob';

            await sessionStore.setPartnerStatus('accepted');

            expect(sessionStore.partner).toBeDefined();
            expect(sessionStore.partner?.status).toBe('accepted');
            expect(sessionStore.partner?.name).toBe('Bob');
        });

        it('clears partner data', async () => {
            sessionStore.partner = { id: 'p1', name: 'Test', initials: 'TE', avatarBg: '#fff', avatarColor: '#000', status: 'accepted', location: null, etaMinutes: null };
            sessionStore.partnerName = 'Test';
            sessionStore.partnerAgreed = true;

            await sessionStore.clearPartner();

            expect(sessionStore.partner).toBeNull();
            expect(sessionStore.partnerName).toBe('');
            expect(sessionStore.partnerAgreed).toBe(false);
        });
    });

    describe('venue actions', () => {
        it('sets venue suggestions', () => {
            const venues: Venue[] = [
                { id: 'v1', name: 'Cafe', category: 'cafe', emoji: '☕', address: 'Street 1', coordinates: { lat: 52.5, lng: 13.4 }, distanceKm: 1, etaMinutesFromYou: 5, etaMinutesFromPartner: 6 },
                { id: 'v2', name: 'Bar', category: 'bar', emoji: '🍺', address: 'Street 2', coordinates: { lat: 52.6, lng: 13.5 }, distanceKm: 2, etaMinutesFromYou: 8, etaMinutesFromPartner: 7 },
            ];

            sessionStore.setVenueSuggestions(venues);

            expect(sessionStore.venueSuggestions).toEqual(venues);
            expect(sessionStore.venueSuggestions).toHaveLength(2);
        });

        it('clears venue selection', async () => {
            sessionStore.selectedVenue = { id: 'v1', name: 'Cafe', category: 'cafe', emoji: '☕', address: 'Street 1', coordinates: { lat: 52.5, lng: 13.4 }, distanceKm: 1, etaMinutesFromYou: 5, etaMinutesFromPartner: 6 };

            await sessionStore.clearVenueSelection();

            expect(sessionStore.selectedVenue).toBeNull();
        });
    });

    describe('chat actions', () => {
        it('adds message to chat', () => {
            const msg: ChatMessage = { id: 'msg-1', senderId: 'user-1', text: 'Hello!', timestamp: Date.now() };

            sessionStore.addMessage(msg);

            expect(sessionStore.chatMessages).toHaveLength(1);
            expect(sessionStore.chatMessages[0]).toEqual(msg);
        });

        it('appends multiple messages', () => {
            sessionStore.addMessage({ id: 'm1', senderId: 'u1', text: 'Hi', timestamp: 1 });
            sessionStore.addMessage({ id: 'm2', senderId: 'u2', text: 'Hey', timestamp: 2 });

            expect(sessionStore.chatMessages).toHaveLength(2);
        });

        it('clears chat', () => {
            sessionStore.chatMessages = [
                { id: 'm1', senderId: 'u1', text: 'Hi', timestamp: 1 },
                { id: 'm2', senderId: 'u2', text: 'Hey', timestamp: 2 },
            ];

            sessionStore.clearChat();

            expect(sessionStore.chatMessages).toEqual([]);
        });
    });

    describe('derived properties', () => {
        it('isSessionActive returns true when session exists and not ended', async () => {
            await sessionStore.createSession('sess-1');

            expect(sessionStore.isSessionActive).toBe(true);
        });

        it('isSessionActive returns false when session is ended', async () => {
            await sessionStore.createSession('sess-1');
            await sessionStore.setSessionStatus('ended');

            expect(sessionStore.isSessionActive).toBe(false);
        });

        it('isSessionActive returns false when no session', () => {
            expect(sessionStore.isSessionActive).toBe(false);
        });

        it('isPartnerAccepted returns true for accepted status', async () => {
            await sessionStore.setPartner({
                id: 'p1', name: 'Test', initials: 'TE', avatarBg: '#fff', avatarColor: '#000',
                status: 'accepted', location: null, etaMinutes: null,
            });

            expect(sessionStore.isPartnerAccepted).toBe(true);
        });

        it('isPartnerAccepted returns true for agreed status', async () => {
            await sessionStore.setPartner({
                id: 'p1', name: 'Test', initials: 'TE', avatarBg: '#fff', avatarColor: '#000',
                status: 'agreed', location: null, etaMinutes: null,
            });

            expect(sessionStore.isPartnerAccepted).toBe(true);
        });

        it('isPartnerAccepted returns false for invited status', async () => {
            await sessionStore.setPartner({
                id: 'p1', name: 'Test', initials: 'TE', avatarBg: '#fff', avatarColor: '#000',
                status: 'invited', location: null, etaMinutes: null,
            });

            expect(sessionStore.isPartnerAccepted).toBe(false);
        });

        it('isVenueConfirmed requires venue, own agreement, and partner agreement', async () => {
            sessionStore.selectedVenue = { id: 'v1', name: 'Cafe', category: 'cafe', emoji: '☕', address: 'St', coordinates: { lat: 0, lng: 0 }, distanceKm: 1, etaMinutesFromYou: 5, etaMinutesFromPartner: 5 };
            sessionStore.ownAgreed = true;
            sessionStore.partnerAgreed = true;

            expect(sessionStore.isVenueConfirmed).toBe(true);
        });

        it('isVenueConfirmed returns false when partner has not agreed', () => {
            sessionStore.selectedVenue = { id: 'v1', name: 'Cafe', category: 'cafe', emoji: '☕', address: 'St', coordinates: { lat: 0, lng: 0 }, distanceKm: 1, etaMinutesFromYou: 5, etaMinutesFromPartner: 5 };
            sessionStore.ownAgreed = true;
            sessionStore.partnerAgreed = false;

            expect(sessionStore.isVenueConfirmed).toBe(false);
        });
    });

    describe('subscribe', () => {
        it('notifies listeners on state changes', async () => {
            const listener = vi.fn();
            sessionStore.subscribe(listener);

            await sessionStore.createSession('sess-1');

            expect(listener).toHaveBeenCalled();
        });

        it('returns unsubscribe function', async () => {
            const listener = vi.fn();
            const unsubscribe = sessionStore.subscribe(listener);

            unsubscribe();
            await sessionStore.createSession('sess-1');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('init', () => {
        it('loads session from IndexedDB', async () => {
            const savedData = {
                session: { id: 'saved-1', link: '/join/saved-1', status: 'active', createdAt: Date.now(), venueId: null },
                partner: { id: 'p1', name: 'Saved Partner', initials: 'SP', avatarBg: '#fff', avatarColor: '#000', status: 'accepted', location: null, etaMinutes: null },
                selectedVenue: null,
                isHost: true,
                ownName: 'Host',
                partnerName: 'Partner',
                ownAgreed: true,
                partnerAgreed: false,
                chatMessages: [{ id: 'm1', senderId: 'p1', text: 'Hi', timestamp: 1 }],
            };

            vi.mocked(get).mockResolvedValue(savedData);

            await sessionStore.init();

            expect(sessionStore.session?.id).toBe('saved-1');
            expect(sessionStore.partner?.name).toBe('Saved Partner');
            expect(sessionStore.isHost).toBe(true);
            expect(sessionStore.ownName).toBe('Host');
            expect(sessionStore.chatMessages).toHaveLength(1);
        });

        it('clears stale sessions older than 24 hours', async () => {
            const staleData = {
                session: { id: 'stale-1', link: '/join/stale-1', status: 'active', createdAt: Date.now() - 25 * 60 * 60 * 1000, venueId: null },
                partner: null,
                selectedVenue: null,
                isHost: false,
                ownName: '',
                partnerName: '',
                ownAgreed: false,
                partnerAgreed: false,
                chatMessages: [],
            };

            vi.mocked(get).mockResolvedValue(staleData);

            await sessionStore.init();

            expect(sessionStore.session).toBeNull();
            expect(del).toHaveBeenCalled();
        });
    });
});
