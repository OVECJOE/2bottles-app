import { get, set } from 'idb-keyval';
import { p2pService } from '../services/p2p.service.js';
import { uiStore } from './index.js';
import type { Coordinates, LocationState } from '../types/index.js';

const DB_KEY = '2b:location_store';

type Listener = () => void;

class LocationStore implements LocationState {
    own: Coordinates | null = null;
    partner: Coordinates | null = null;
    destination: Coordinates | null = null;
    ownEtaMinutes: number | null = null;
    partnerEtaMinutes: number | null = null;
    ownDistanceM: number | null = null;
    partnerDistanceM: number | null = null;
    isWatching = false;
    accuracy: number | null = null;
    lastErrorCode: number | null = null;
    isCoolingOff = false;

    private _watchId: number | null = null;
    private _listeners = new Set<Listener>();
    private _errorCount = 0;
    private _lastErrorLogTime = 0;
    private _lastPermissionToastAt = 0;

    private _canUseGeolocation(): boolean {
        return typeof window !== 'undefined' && !!navigator.geolocation && window.isSecureContext;
    }

    async init() {
        try {
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
        } catch (err) {
            console.error('[LocationStore] IDB Init Error:', err);
        }
    }

    private async _save() {
        try {
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
        } catch (err) {
            console.error('[LocationStore] IDB Save Error:', err);
        }
    }

    subscribe(fn: Listener): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify() {
        this._listeners.forEach((fn) => fn());
    }

    setOwnLocation(coords: Coordinates, accuracy?: number) {
        if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) return;
        this.own = coords;
        this.accuracy = accuracy ?? null;
        this._notify();
        this._save();
        p2pService.broadcastLocation(coords);
    }

    startWatching() {
        if (this.isWatching) return;

        if (!navigator.geolocation) {
            this.lastErrorCode = 2;
            console.error('[LocationStore] Geolocation not supported');
            uiStore.showToast('Geolocation is not supported on this device. Use manual location search.');
            this._notify();
            return;
        }

        if (!window.isSecureContext) {
            this.lastErrorCode = 3;
            console.warn('[LocationStore] Geolocation requires HTTPS or localhost secure context');
            uiStore.showToast('GPS requires HTTPS (or localhost). Use manual location search for now.');
            this._notify();
            return;
        }

        this.isWatching = true;
        this._notify();

        const options: PositionOptions = {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000,
        };

        if (this._watchId !== null) {
            navigator.geolocation.clearWatch(this._watchId);
        }

        const success = (pos: GeolocationPosition) => {
            this._errorCount = 0;
            this.isCoolingOff = false;
            this.lastErrorCode = null;
            this.setOwnLocation(
                { lat: pos.coords.latitude, lng: pos.coords.longitude },
                pos.coords.accuracy
            );
        };

        const error = (err: GeolocationPositionError) => {
            this.lastErrorCode = err.code;
            this._errorCount++;

            const now = Date.now();
            if (now - this._lastErrorLogTime > 2000) {
                console.warn(`[LocationStore] Watch error (${err.code}):`, err.message);
                this._lastErrorLogTime = now;
            }

            if (err.code === 1) {
                const nowToast = Date.now();
                if (nowToast - this._lastPermissionToastAt > 5000) {
                    uiStore.showToast('Location permission denied. Please enable GPS or use manual location search.');
                    this._lastPermissionToastAt = nowToast;
                }
                this.stopWatching();
                return;
            }

            if (this._errorCount > 3 && !this.isCoolingOff) {
                console.error('[LocationStore] Too many GPS errors. Cooling off...');
                this.isCoolingOff = true;
                this.stopWatching();
                this._notify();

                if (err.code === 2) {
                    uiStore.showToast('GPS signal is unstable. You can continue with manual location search.');
                    this.isCoolingOff = false;
                    return;
                }

                setTimeout(() => {
                    this.isCoolingOff = false;
                    this._errorCount = 0;
                    if (this._canUseGeolocation()) {
                        this.startWatching();
                    }
                }, 15000);
                return;
            }

            if (options.enableHighAccuracy) {
                console.info('[LocationStore] Retrying without High Accuracy...');
                options.enableHighAccuracy = false;
                if (this._watchId !== null) navigator.geolocation.clearWatch(this._watchId);
                this._watchId = navigator.geolocation.watchPosition(success, error, options);
            }
            this._notify();
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

    getErrorExplanation(): string {
        switch (this.lastErrorCode) {
            case 1: return 'Permission Denied';
            case 2: return 'Geolocation Unavailable';
            case 3: return 'HTTPS Required For GPS';
            default: return 'Search Failed';
        }
    }

    async fetchOnce(): Promise<Coordinates> {
        if (!navigator.geolocation) {
            this.lastErrorCode = 2;
            throw new Error('Geolocation not supported');
        }
        if (!window.isSecureContext) {
            this.lastErrorCode = 3;
            throw new Error('Geolocation requires secure context (HTTPS or localhost)');
        }

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

    setPartnerLocation(coords: Coordinates) {
        if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) return;
        this.partner = coords;
        this._notify();
        this._save();
    }

    clearPartnerLocation() {
        this.partner = null;
        this._notify();
        this._save();
    }

    setDestination(coords: Coordinates) {
        this.destination = coords;
        this._notify();
        this._save();
    }

    clearDestination() {
        this.destination = null;
        this._notify();
        this._save();
    }

    setEtas(own: number | null, partner: number | null) {
        if (this.ownEtaMinutes === own && this.partnerEtaMinutes === partner) return;
        this.ownEtaMinutes = own;
        this.partnerEtaMinutes = partner;
        this._notify();
        this._save();
    }

    setDistances(own: number | null, partner: number | null) {
        if (own === null && partner === null) return;

        const dOwn = Math.abs((this.ownDistanceM || 0) - (own || 0));
        const dPart = Math.abs((this.partnerDistanceM || 0) - (partner || 0));

        if (this.ownDistanceM !== null && this.partnerDistanceM !== null && dOwn < 5 && dPart < 5) return;

        this.ownDistanceM = own;
        this.partnerDistanceM = partner;
        this._notify();
        this._save();
    }

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
        this.lastErrorCode = null;
        this.isCoolingOff = false;
        this._errorCount = 0;
        this._notify();
        this._save();
    }
}

export const locationStore = new LocationStore();
