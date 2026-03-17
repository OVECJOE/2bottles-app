// =============================================================
// 2bottles — UI Store
//
// Controls which screen is active, bottom sheet open/close,
// loading state, and transient toast messages.
// =============================================================

import type { AppScreen } from '../types/index.js';

type Listener = () => void;

class UIStore {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    screen: AppScreen = 'create-session';
    sheetOpen: boolean = true;
    isLoading: boolean = false;
    toastMessage: string | null = null;

    private _toastTimer: ReturnType<typeof setTimeout> | null = null;
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
    // Screen navigation
    // -----------------------------------------------------------

    navigate(screen: AppScreen) {
        this.screen = screen;
        this.sheetOpen = true;  // new screen always opens the sheet
        this._notify();
    }

    // Convenience aliases that follow the flow diagram
    goToInvite() { this.navigate('invite-partner'); }
    goToPartnerNotified() { this.navigate('partner-notified'); }
    goToRejected() { this.navigate('partner-rejected'); }
    goToSelectVenue() { this.navigate('select-rendezvous'); }
    goToAgreeRefuse() { this.navigate('partner-agree-refuse'); }
    goToSessionLink() { this.navigate('session-link'); }
    goToLiveTracking() { this.navigate('live-tracking'); }
    goToEndSession() { this.navigate('end-session'); }
    goHome() { this.navigate('create-session'); }

    // -----------------------------------------------------------
    // Bottom sheet
    // -----------------------------------------------------------

    openSheet() { this.sheetOpen = true; this._notify(); }
    closeSheet() { this.sheetOpen = false; this._notify(); }
    toggleSheet() {
        this.sheetOpen = !this.sheetOpen;
        this._notify();
    }

    // -----------------------------------------------------------
    // Loading
    // -----------------------------------------------------------

    setLoading(val: boolean) {
        this.isLoading = val;
        this._notify();
    }

    // -----------------------------------------------------------
    // Toast
    // -----------------------------------------------------------

    showToast(message: string, durationMs = 3000) {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this.toastMessage = message;
        this._notify();

        this._toastTimer = setTimeout(() => {
            this.toastMessage = null;
            this._notify();
        }, durationMs);
    }

    dismissToast() {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this.toastMessage = null;
        this._notify();
    }
}

export const uiStore = new UIStore();