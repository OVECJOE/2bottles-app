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

export interface InviteResponsePayload {
    action: 'accept' | 'reject';
}

export interface PendingInvite {
    sessionId: string;
    inviterUserId: string;
    status: 'pending';
    createdAt: number;
    sessionStatus: string | null;
}

export interface VenueSearchPayload {
    lat1: number; lng1: number;
    lat2: number; lng2: number;
}

export const sessionsApi = {
    create: (payload: CreateSessionPayload) =>
        api.post<{ session: Session }>('/sessions', payload),

    invite: (payload: InvitePayload) =>
        api.post<{ ok: boolean; deliveryTargets: number }>('/sessions/invite', payload),

    listPendingInvites: () =>
        api.get<{ invites: PendingInvite[] }>('/me/invites'),

    respondToInvite: (sessionId: string, payload: InviteResponsePayload) =>
        api.post<{ ok: boolean; status: 'accepted' | 'rejected'; sessionStatus: string }>(`/sessions/${sessionId}/invite/respond`, payload),

    getStatus: (sessionId: string) =>
        api.get<{ session: Session; partner: Partner | null }>(`/sessions/${sessionId}`),

    confirmVenue: (sessionId: string, venueId: string) =>
        api.patch<{ ok: boolean }>(`/sessions/${sessionId}/venue`, { venueId }),

    end: (sessionId: string) =>
        api.delete<{ ok: boolean }>(`/sessions/${sessionId}`),

    getVenueSuggestions: (payload: VenueSearchPayload) =>
        api.post<{ venues: Venue[] }>('/sessions/venues', payload),
};