// =============================================================
// 2bottles — Session Store
//
// Holds the active session, partner info, and venue selection.
// Implemented as a plain reactive class — consume it via
// @lit/context in app-shell, then pass down with @provide.
// =============================================================

import type {
    Session,
    Partner,
    Venue,
    SessionStatus,
    PartnerStatus,
    ChatMessage,
} from '../types/index.js';

type Listener = () => void;

class SessionStore {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    session: Session | null = null;
    partner: Partner | null = null;
    venueSuggestions: Venue[] = [];
    selectedVenue: Venue | null = null;
    chatMessages: ChatMessage[] = [];

    private _listeners = new Set<Listener>();

    // -----------------------------------------------------------
    // Subscribe / notify (drives Lit context updates)
    // -----------------------------------------------------------

    subscribe(fn: Listener): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify() {
        this._listeners.forEach((fn) => fn());
    }

    // -----------------------------------------------------------
    // Session actions
    // -----------------------------------------------------------

    createSession(id: string) {
        this.session = {
            id,
            link: `2bottles.app/s/${id}`,
            status: 'pending_partner',
            createdAt: Date.now(),
            venueId: null,
        };
        this._notify();
    }

    setSessionStatus(status: SessionStatus) {
        if (!this.session) return;
        this.session = { ...this.session, status };
        this._notify();
    }

    setSessionLink(link: string) {
        if (!this.session) return;
        this.session = { ...this.session, link };
        this._notify();
    }

    setSessionVenue(venueId: string) {
        if (!this.session) return;
        this.session = { ...this.session, venueId };
        this._notify();
    }

    endSession() {
        this.session = null;
        this.partner = null;
        this.venueSuggestions = [];
        this.selectedVenue = null;
        this.chatMessages = [];
        this._notify();
    }

    // -----------------------------------------------------------
    // Partner actions
    // -----------------------------------------------------------

    setPartner(partner: Partner) {
        this.partner = partner;
        this._notify();
    }

    setPartnerStatus(status: PartnerStatus) {
        if (!this.partner) return;
        this.partner = { ...this.partner, status };
        this._notify();
    }

    clearPartner() {
        this.partner = null;
        this._notify();
    }

    // -----------------------------------------------------------
    // Venue actions
    // -----------------------------------------------------------

    setVenueSuggestions(venues: Venue[]) {
        this.venueSuggestions = venues;
        this._notify();
    }

    selectVenue(venue: Venue) {
        this.selectedVenue = venue;
        if (this.session) {
            this.session = { ...this.session, venueId: venue.id };
        }
        this._notify();
    }

    clearVenueSelection() {
        this.selectedVenue = null;
        this._notify();
    }

    // -----------------------------------------------------------
    // Chat actions
    // -----------------------------------------------------------

    addMessage(msg: ChatMessage) {
        this.chatMessages = [...this.chatMessages, msg];
        this._notify();
    }

    clearChat() {
        this.chatMessages = [];
        this._notify();
    }

    // -----------------------------------------------------------
    // Derived / selectors
    // -----------------------------------------------------------

    get isSessionActive(): boolean {
        return !!this.session && this.session.status !== 'ended';
    }

    get isPartnerAccepted(): boolean {
        return this.partner?.status === 'accepted' ||
            this.partner?.status === 'agreed' ||
            this.partner?.status === 'arrived';
    }

    get isVenueConfirmed(): boolean {
        return this.partner?.status === 'agreed';
    }
}

// Singleton — import this everywhere; do not reinstantiate.
export const sessionStore = new SessionStore();
