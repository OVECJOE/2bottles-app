import { get, set, del } from 'idb-keyval';
import type {
    Session,
    Partner,
    Venue,
    SessionStatus,
    PartnerStatus,
    ChatMessage,
} from '../types/index.js';
import { locationStore } from './index.js';

type Listener = () => void;

const DB_KEY = '2b:session_store';

class SessionStore {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    session: Session | null = null;
    partner: Partner | null = null;
    venueSuggestions: Venue[] = [];
    selectedVenue: Venue | null = null;
    chatMessages: ChatMessage[] = [];
    isHost: boolean = false;
    ownName: string = '';
    partnerName: string = '';
    ownAgreed: boolean = false;
    partnerAgreed: boolean = false;

    private _listeners = new Set<Listener>();

    // -----------------------------------------------------------
    // Init (load from IndexedDB)
    // -----------------------------------------------------------

    async init() {
        const saved = await get(DB_KEY);
        if (saved) {
            this.session = saved.session;
            this.partner = saved.partner;
            this.selectedVenue = saved.selectedVenue;
            this.isHost = saved.isHost || false;
            this.ownName = saved.ownName || '';
            this.partnerName = saved.partnerName || '';
            this.ownAgreed = saved.ownAgreed || false;
            this.partnerAgreed = saved.partnerAgreed || false;
            this.chatMessages = saved.chatMessages || [];
            this._notify();
        }
    }

    private async _save() {
        await set(DB_KEY, {
            session: this.session,
            partner: this.partner,
            selectedVenue: this.selectedVenue,
            isHost: this.isHost,
            ownName: this.ownName,
            partnerName: this.partnerName,
            ownAgreed: this.ownAgreed,
            partnerAgreed: this.partnerAgreed,
            chatMessages: this.chatMessages,
        });
    }

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

    async createSession(id: string) {
        this.session = {
            id,
            link: `${window.location.origin}/join/${id}`,
            status: 'pending_partner',
            createdAt: Date.now(),
            venueId: null,
        };
        this.isHost = true;
        this._notify();
        await this._save();
    }

    async joinSession(id: string) {
        this.session = {
            id,
            link: `${window.location.origin}/join/${id}`,
            status: 'pending_partner',
            createdAt: Date.now(),
            venueId: null,
        };
        this.isHost = false;
        this._notify();
        await this._save();
    }

    async setSessionStatus(status: SessionStatus) {
        if (!this.session) return;
        this.session = { ...this.session, status };
        this._notify();
        await this._save();
    }

    async setSessionVenue(venueId: string) {
        if (!this.session) return;
        this.session = { ...this.session, venueId };
        this._notify();
        await this._save();
    }

    async endSession() {
        this.session = null;
        this.partner = null;
        this.venueSuggestions = [];
        this.selectedVenue = null;
        this.chatMessages = [];
        this.isHost = false;
        this.ownName = '';
        this.partnerName = '';
        this.ownAgreed = false;
        this.partnerAgreed = false;
        this._notify();
        await del(DB_KEY);
    }

    // -----------------------------------------------------------
    // Partner actions
    // -----------------------------------------------------------

    async setPartner(partner: Partner) {
        this.partner = partner;
        this._notify();
        await this._save();
    }

    async setPartnerStatus(status: PartnerStatus) {
        if (!this.partner) return;
        this.partner = { ...this.partner, status };
        this._notify();
        await this._save();
    }

    async clearPartner() {
        this.partner = null;
        this.partnerName = '';
        this.partnerAgreed = false;
        this._notify();
        await this._save();
    }

    setOwnName(name: string) {
        this.ownName = name.trim();
        this._notify();
        this._save();
    }

    setPartnerName(name: string) {
        this.partnerName = name;
        this._notify();
        this._save();
    }

    setOwnAgreed(val: boolean) {
        this.ownAgreed = val;
        this._notify();
        this._save();
    }

    setPartnerAgreed(val: boolean) {
        this.partnerAgreed = val;
        this._notify();
        this._save();
    }

    // -----------------------------------------------------------
    // Venue actions
    // -----------------------------------------------------------

    setVenueSuggestions(venues: Venue[]) {
        this.venueSuggestions = venues;
        this._notify();
    }

    async selectVenue(venue: Venue) {
        this.selectedVenue = venue;
        if (this.session) {
            this.session = { ...this.session, venueId: venue.id };
        }
        this._notify();
        await this._save();
    }

    async clearVenueSelection() {
        this.selectedVenue = null;
        this._notify();
        await this._save();
    }

    // -----------------------------------------------------------
    // Chat actions
    // -----------------------------------------------------------

    addMessage(msg: ChatMessage) {
        this.chatMessages = [...this.chatMessages, msg];
        this._notify();
        this._save();
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
        return this.ownAgreed && this.partnerAgreed;
    }

    get midpoint(): { lat: number, lng: number } | null {
        const own = locationStore.own;
        const part = locationStore.partner;

        if (!own || !part) return null;

        // Helper to convert degrees to radians and back
        const toRad = (angle: number) => (angle * Math.PI) / 180;
        const toDeg = (angle: number) => (angle * 180) / Math.PI;

        const dLng = toRad(part.lng - own.lng);

        const lat1Rad = toRad(own.lat);
        const lat2Rad = toRad(part.lat);

        const Bx = Math.cos(lat2Rad) * Math.cos(dLng);
        const By = Math.cos(lat2Rad) * Math.sin(dLng);

        const midLatRad = Math.atan2(
            Math.sin(lat1Rad) + Math.sin(lat2Rad),
            Math.sqrt((Math.cos(lat1Rad) + Bx) * (Math.cos(lat1Rad) + Bx) + By * By)
        );

        let midLngRad = toRad(own.lng) + Math.atan2(By, Math.cos(lat1Rad) + Bx);

        // Normalize longitude and convert back to degrees
        const lat = toDeg(midLatRad);
        const lng = ((toDeg(midLngRad) + 540) % 360) - 180;

        return { lat, lng };
    }
}

// Singleton — import this everywhere; do not reinstantiate.
export const sessionStore = new SessionStore();
