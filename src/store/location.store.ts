// =============================================================
// 2bottles — Location Store
//
// Owns GPS watching, own coordinates, partner coordinates
// (received over WebSocket), destination, and ETA values.
// =============================================================

import { get, set } from 'idb-keyval';
import { p2pService } from '../services/p2p.service.js';
import { uiStore } from './index.js';
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
    ownDistanceM: number | null = null;
    partnerDistanceM: number | null = null;
    isWatching = false;
    accuracy: number | null = null;

    private _watchId: number | null = null;
    private _listeners = new Set<Listener>();
    private _errorCount = 0;
    private _coolingOff = false;

    // -----------------------------------------------------------
    // Init (load from IndexedDB)
    // -----------------------------------------------------------

    async init() {
        const saved = await get(DB_KEY);
        if (saved) {
            this.partner = saved.partner || null;
            this.own = saved.own || null;
            this.accuracy = saved.accuracy || null;
            this.destination = saved.destination || null;
            this.ownEtaMinutes = saved.ownEtaMinutes || null;
            this.partnerEtaMinutes = saved.partnerEtaMinutes || null;
            this.ownDistanceM = saved.ownDistanceM || null;
            this.partnerDistanceM = saved.partnerDistanceM || null;
            this._notify();
        }
    }

    private async _save() {
        await set(DB_KEY, {
            own: this.own,
            accuracy: this.accuracy,
            partner: this.partner,
            destination: this.destination,
            ownEtaMinutes: this.ownEtaMinutes,
            partnerEtaMinutes: this.partnerEtaMinutes,
            ownDistanceM: this.ownDistanceM,
            partnerDistanceM: this.partnerDistanceM,
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
        if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) return;
        this.own = coords;
        this.accuracy = accuracy ?? null;
        this._notify();
        this._save(); 
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

        const options: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000, // Increased timeout for slower locks
        };

        if (this._watchId !== null) {
            navigator.geolocation.clearWatch(this._watchId);
        }


        const success = (pos: GeolocationPosition) => {
            this.isWatching = true; 
            this._errorCount = 0; // Reset on success
            this._coolingOff = false;
            this.setOwnLocation(
                { lat: pos.coords.latitude, lng: pos.coords.longitude },
                pos.coords.accuracy
            );
        };

        const error = (err: GeolocationPositionError) => {
            this._errorCount++;

            console.warn(`[LocationStore] Watch error (${err.code}):`, err.message);
            
            if (err.code === 1) { // PERMISSION_DENIED
                uiStore.showToast('Location permission denied. Please enable GPS.');
                this.stopWatching();
                return;
            }

            // Cooling off logic: If we get many errors quickly, stop for a bit
            if (this._errorCount > 3 && !this._coolingOff) {
                console.error('[LocationStore] Too many GPS errors. Cooling off for 15s...');
                this._coolingOff = true;
                this.stopWatching();
                setTimeout(() => {
                    this._coolingOff = false;
                    this._errorCount = 0;
                    this.startWatching();
                }, 15000);
                return;
            }

            // Fallback: If High Accuracy fails, try without it
            if (options.enableHighAccuracy) {
                console.info('[LocationStore] Retrying with High Accuracy disabled...');
                options.enableHighAccuracy = false;
                if (this._watchId !== null) navigator.geolocation.clearWatch(this._watchId);
                this._watchId = navigator.geolocation.watchPosition(success, error, options);
            }
        };

        this._watchId = navigator.geolocation.watchPosition(success, error, options);
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
        if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) return;
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
        if (this.ownEtaMinutes === own && this.partnerEtaMinutes === partner) return;
        this.ownEtaMinutes = own;
        this.partnerEtaMinutes = partner;
        this._notify();
        this._save();
    }

    setDistances(own: number | null, partner: number | null) {
        if (own === null && partner === null) return; // Bug 18
        // Only update if change is > 1 meter (prevents micro-update loops)
        const dOwn = Math.abs((this.ownDistanceM || 0) - (own || 0));
        const dPart = Math.abs((this.partnerDistanceM || 0) - (partner || 0));
        
        if (dOwn < 1 && dPart < 1 && this.ownDistanceM !== null && own !== null) return;

        this.ownDistanceM = own;
        this.partnerDistanceM = partner;
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
            ownDistanceM: this.ownDistanceM,
            partnerDistanceM: this.partnerDistanceM,
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
        this.ownDistanceM = null;
        this.partnerDistanceM = null;
        this.accuracy = null;
        this._notify();
    }
}

export const locationStore = new LocationStore();