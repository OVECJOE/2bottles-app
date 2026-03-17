import { api } from './client.js';
import type { Session, Partner, Venue } from '../types/index.js';

export interface CreateSessionPayload {
    lat: number;
    lng: number;
}

export interface InvitePayload {
    sessionId: string;
    partnerId: string;
}

export interface VenueSearchPayload {
    lat1: number; lng1: number;
    lat2: number; lng2: number;
}

export const sessionsApi = {
    create: (payload: CreateSessionPayload) =>
        api.post<{ session: Session }>('/sessions', payload),

    invite: (payload: InvitePayload) =>
        api.post<{ ok: boolean }>('/sessions/invite', payload),

    getStatus: (sessionId: string) =>
        api.get<{ session: Session; partner: Partner | null }>(`/sessions/${sessionId}`),

    confirmVenue: (sessionId: string, venueId: string) =>
        api.patch<{ ok: boolean }>(`/sessions/${sessionId}/venue`, { venueId }),

    end: (sessionId: string) =>
        api.delete<{ ok: boolean }>(`/sessions/${sessionId}`),

    getVenueSuggestions: (payload: VenueSearchPayload) =>
        api.post<{ venues: Venue[] }>('/sessions/venues', payload),
};