// =============================================================
// 2bottles — Location Store
//
// Owns GPS watching, own coordinates, partner coordinates
// (received over WebSocket), destination, and ETA values.
// =============================================================

import { get, set } from 'idb-keyval';
import { p2pService } from '../services/p2p.service.js';
import type { Coordinates, LocationState } from '../types/index.js';

const DB_KEY = '2b:location_store';

type Listener = () => void;

class LocationStore implements LocationState {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    own: Coordinates | null = null;
    partner: Coordinates | null = null;
    destination: Coordinates | null = null;
    ownEtaMinutes: number | null = null;
    partnerEtaMinutes: number | null = null;
    isWatching = false;
    accuracy: number | null = null;

    private _watchId: number | null = null;
    private _listeners = new Set<Listener>();

    // -----------------------------------------------------------
    // Init (load from IndexedDB)
    // -----------------------------------------------------------

    async init() {
        const saved = await get(DB_KEY);
        if (saved) {
            this.partner = saved.partner || null;
            this.destination = saved.destination || null;
            this.ownEtaMinutes = saved.ownEtaMinutes || null;
            this.partnerEtaMinutes = saved.partnerEtaMinutes || null;
            this._notify();
        }
    }

    private async _save() {
        await set(DB_KEY, {
            partner: this.partner,
            destination: this.destination,
            ownEtaMinutes: this.ownEtaMinutes,
            partnerEtaMinutes: this.partnerEtaMinutes,
        });
    }

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
    // Own location
    // -----------------------------------------------------------

    setOwnLocation(coords: Coordinates, accuracy?: number) {
        this.own = coords;
        this.accuracy = accuracy ?? null;
        this._notify();
        p2pService.broadcastLocation(coords);
    }

    // -----------------------------------------------------------
    // GPS watching
    // -----------------------------------------------------------

    startWatching() {
        if (this.isWatching) return;

        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            return;
        }

        this.isWatching = true;
        this._watchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.setOwnLocation(
                    { lat: pos.coords.latitude, lng: pos.coords.longitude },
                    pos.coords.accuracy
                );
            },
            (err) => {
                console.warn('[LocationStore] Watch error:', err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000,
            }
        );
        this._notify();
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
        this._save();
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
        this._save();
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
        this._save();
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