// =============================================================
// 2bottles — Location Store
//
// Owns GPS watching, own coordinates, partner coordinates
// (received over WebSocket), destination, and ETA values.
// =============================================================

import type { Coordinates, LocationState } from '../types/index.js';

type Listener = () => void;

class LocationStore {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    own: Coordinates | null = null;
    partner: Coordinates | null = null;
    destination: Coordinates | null = null;
    ownEtaMinutes: number | null = null;
    partnerEtaMinutes: number | null = null;
    isWatching: boolean = false;
    accuracy: number | null = null;

    private _watchId: number | null = null;
    private _listeners = new Set<Listener>();

    // -----------------------------------------------------------
    // Subscribe / notify
    // -----------------------------------------------------------

    subscribe(fn: Listener): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify() {
        this._listeners.forEach((fn) => fn());
    }

    // -----------------------------------------------------------
    // GPS watching
    // -----------------------------------------------------------

    startWatching() {
        if (this._watchId !== null) return;  // already watching

        if (!navigator.geolocation) {
            console.warn('[LocationStore] Geolocation not available');
            return;
        }

        this._watchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.own = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.accuracy = pos.coords.accuracy;
                this.isWatching = true;
                this._notify();
            },
            (err) => {
                console.error('[LocationStore] watchPosition error', err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5_000,   // accept 5s old cached position
                timeout: 10_000,
            }
        );
    }

    stopWatching() {
        if (this._watchId !== null) {
            navigator.geolocation.clearWatch(this._watchId);
            this._watchId = null;
        }
        this.isWatching = false;
        this._notify();
    }

    // -----------------------------------------------------------
    // One-shot location fetch (for session create)
    // -----------------------------------------------------------

    async fetchOnce(): Promise<Coordinates> {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    };
                    this.own = coords;
                    this.accuracy = pos.coords.accuracy;
                    this._notify();
                    resolve(coords);
                },
                reject,
                { enableHighAccuracy: true, timeout: 10_000 }
            );
        });
    }

    // -----------------------------------------------------------
    // Partner location (pushed via WebSocket)
    // -----------------------------------------------------------

    setPartnerLocation(coords: Coordinates) {
        this.partner = coords;
        this._notify();
    }

    clearPartnerLocation() {
        this.partner = null;
        this._notify();
    }

    // -----------------------------------------------------------
    // Destination
    // -----------------------------------------------------------

    setDestination(coords: Coordinates) {
        this.destination = coords;
        this._notify();
    }

    clearDestination() {
        this.destination = null;
        this._notify();
    }

    // -----------------------------------------------------------
    // ETA
    // -----------------------------------------------------------

    setEtas(own: number | null, partner: number | null) {
        this.ownEtaMinutes = own;
        this.partnerEtaMinutes = partner;
        this._notify();
    }

    // -----------------------------------------------------------
    // Snapshot (for passing to API / WebSocket)
    // -----------------------------------------------------------

    snapshot(): LocationState {
        return {
            own: this.own,
            partner: this.partner,
            destination: this.destination,
            ownEtaMinutes: this.ownEtaMinutes,
            partnerEtaMinutes: this.partnerEtaMinutes,
            isWatching: this.isWatching,
            accuracy: this.accuracy,
        };
    }

    reset() {
        this.stopWatching();
        this.own = null;
        this.partner = null;
        this.destination = null;
        this.ownEtaMinutes = null;
        this.partnerEtaMinutes = null;
        this.accuracy = null;
        this._notify();
    }
}

export const locationStore = new LocationStore();