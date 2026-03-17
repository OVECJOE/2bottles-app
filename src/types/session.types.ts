import type { Coordinates } from "./location.types";

export type SessionStatus =
    | 'idle'
    | 'pending_partner'
    | 'selecting_venue'
    | 'pending_agreement'
    | 'agreed'
    | 'live'
    | 'ended';

export interface Session {
    id: string;
    link: string;              // e.g. "2bottles.app/s/xK9mT3"
    status: SessionStatus;
    createdAt: number;         // unix ms
    venueId: string | null;
}

export type PartnerStatus =
    | 'invited'
    | 'accepted'
    | 'rejected'
    | 'agreed'
    | 'refused'
    | 'arrived';

export interface Partner {
    id: string;
    name: string;
    initials: string;
    avatarBg: string;
    avatarColor: string;
    status: PartnerStatus;
    location: Coordinates | null;
    etaMinutes: number | null;
}

export interface ChatMessage {
    id: string;
    senderId: 'me' | string;   // 'me' or partner id
    text: string;
    timestamp: number;         // unix ms
}