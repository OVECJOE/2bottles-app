/**
 * Session service — single place that coordinates session lifecycle.
 * Components call these methods; they never touch the API or WS directly.
 */
import { sessionsApi } from '../api/sessions.api.js';
import { wsService } from './websocket.service.js';
import { sessionStore, locationStore, uiStore } from '../store/index.js';
import type { Partner, Venue } from '../types/index.js';

export const sessionService = {

    async createSession(): Promise<void> {
        const coords = locationStore.own ?? await locationStore.fetchOnce();

        uiStore.setLoading(true);
        try {
            const { session } = await sessionsApi.create({ lat: coords.lat, lng: coords.lng });
            sessionStore.createSession(session.id);
            sessionStore.setSessionLink(session.link);
        } finally {
            uiStore.setLoading(false);
        }
    },

    async invitePartner(partner: Partner): Promise<void> {
        const sessionId = sessionStore.session?.id;
        if (!sessionId) throw new Error('No active session');

        uiStore.setLoading(true);
        try {
            await sessionsApi.invite({ sessionId, partnerId: partner.id });
            sessionStore.setPartner(partner);
            wsService.connect(sessionId);
        } finally {
            uiStore.setLoading(false);
        }
    },

    async fetchVenueSuggestions(): Promise<void> {
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (!own || !partner) return;

        uiStore.setLoading(true);
        try {
            const { venues } = await sessionsApi.getVenueSuggestions({
                lat1: own.lat, lng1: own.lng,
                lat2: partner.lat, lng2: partner.lng,
            });
            sessionStore.setVenueSuggestions(venues);
        } finally {
            uiStore.setLoading(false);
        }
    },

    async confirmVenue(venue: Venue): Promise<void> {
        const sessionId = sessionStore.session?.id;
        if (!sessionId) return;

        sessionStore.selectVenue(venue);
        locationStore.setDestination(venue.coordinates);

        uiStore.setLoading(true);
        try {
            await sessionsApi.confirmVenue(sessionId, venue.id);
        } finally {
            uiStore.setLoading(false);
        }
    },

    async endSession(): Promise<void> {
        const sessionId = sessionStore.session?.id;
        if (sessionId) {
            await sessionsApi.end(sessionId).catch(() => { });
        }
        wsService.disconnect();
        sessionStore.endSession();
        locationStore.reset();
    },
};