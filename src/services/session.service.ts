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
        let coords;
        try {
            coords = locationStore.own ?? await locationStore.fetchOnce();
        } catch {
            uiStore.showToast('Could not get your location. Please enable GPS or search manually.');
            throw new Error('Location unavailable');
        }

        uiStore.setLoading(true);
        try {
            const { session } = await sessionsApi.create({ lat: coords.lat, lng: coords.lng });
            await sessionStore.createSession(session.id);
        } catch (err) {
            uiStore.showToast('Failed to create session. Please try again.');
            throw err;
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
            await sessionStore.setPartner(partner);
            wsService.connect(sessionId);
        } catch (err) {
            uiStore.showToast('Failed to invite partner. Please try again.');
            throw err;
        } finally {
            uiStore.setLoading(false);
        }
    },

    async fetchVenueSuggestions(): Promise<void> {
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (!own || !partner) {
            uiStore.showToast('Waiting for both locations...');
            return;
        }

        uiStore.setLoading(true);
        try {
            const { venues } = await sessionsApi.getVenueSuggestions({
                lat1: own.lat, lng1: own.lng,
                lat2: partner.lat, lng2: partner.lng,
            });
            sessionStore.setVenueSuggestions(venues);
        } catch (err) {
            uiStore.showToast('Could not fetch venue suggestions. Please try again.');
            throw err;
        } finally {
            uiStore.setLoading(false);
        }
    },

    async confirmVenue(venue: Venue): Promise<void> {
        const sessionId = sessionStore.session?.id;
        if (!sessionId) return;

        const previousVenue = sessionStore.selectedVenue;
        const previousDestination = locationStore.destination;
        const previousVenueId = sessionStore.session?.venueId;

        sessionStore.selectVenue(venue);
        locationStore.setDestination(venue.coordinates);

        uiStore.setLoading(true);
        try {
            await sessionsApi.confirmVenue(sessionId, venue.id);
        } catch (err) {
            sessionStore.selectVenue(previousVenue!);
            if (previousDestination) {
                locationStore.setDestination(previousDestination);
            } else {
                locationStore.clearDestination();
            }
            if (sessionStore.session) {
                sessionStore.session = { ...sessionStore.session, venueId: previousVenueId ?? null };
            }
            uiStore.showToast('Failed to confirm venue. Please try again.');
            throw err;
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
        await sessionStore.endSession();
        locationStore.reset();
    },
};
