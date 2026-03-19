import { get, set, del } from 'idb-keyval';
import { Router } from '@vaadin/router';
import type { AppScreen } from '../types/index.js';

type Listener = () => void;

const DB_KEY = '2b:ui_store';

class UIStore {
    // -----------------------------------------------------------
    // State
    // -----------------------------------------------------------

    screen: AppScreen = 'create-session';
    sheetOpen: boolean = true;
    isLoading: boolean = false;
    isPartnerOnline: boolean = false;
    toastMessage: string | null = null;
    dialogConfig: { title: string; message: string; confirmLabel?: string; cancelLabel?: string } | null = null;

    private _dialogResolver: ((val: boolean) => void) | null = null;

    private _toastTimer: ReturnType<typeof setTimeout> | null = null;
    private _listeners = new Set<Listener>();

    // -----------------------------------------------------------
    // Init (load from IndexedDB)
    // -----------------------------------------------------------

    async init() {
        try {
            const saved = await get(DB_KEY);
            if (saved) {
                this.screen = saved.screen || 'create-session';
                this._notify();
            }
        } catch (err) {
            console.error('[UIStore] Navigation Error:', err);
            this.isLoading = false;
        } finally {
            this.isLoading = false;
        }
    }

    private async _save() {
        await set(DB_KEY, { screen: this.screen });
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
    // Screen navigation
    // -----------------------------------------------------------

    async navigate(screen: AppScreen, params?: Record<string, string>) {
        this.screen = screen;
        this.sheetOpen = true; 
        
        let path = '/';
        switch (screen) {
            case 'create-session': path = '/create-session'; break;
            case 'invite-partner': path = '/invite'; break;
            case 'partner-notified': path = `/join/${params?.peerId || ''}`; break;
            case 'partner-rejected': path = '/rejected'; break;
            case 'select-rendezvous': path = '/select-venue'; break;
            case 'partner-agree-refuse': path = '/coordinate'; break;
            case 'live-tracking': path = '/tracking'; break;
            case 'live-chat': path = '/chat'; break;
            case 'session-link': path = '/session-link'; break;
            case 'end-session': path = '/ended'; break;
        }

        Router.go(path);
        this._notify();
        await this._save();
    }

    // Convenience aliases
    goToInvite() { this.navigate('invite-partner'); }
    goToPartnerNotified(peerId: string) { this.navigate('partner-notified', { peerId }); }
    goToRejected() { this.navigate('partner-rejected'); }
    goToSelectVenue() { this.navigate('select-rendezvous'); }
    goToAgreeRefuse() { this.navigate('partner-agree-refuse'); }
    goToSessionLink() { this.navigate('session-link'); }
    goToLiveTracking() { this.navigate('live-tracking'); }
    goToLiveChat() { this.navigate('live-chat'); }
    goToEndSession() { this.navigate('end-session'); }
    async goHome(beyond: boolean = false) { 
        await del(DB_KEY);
        Router.go(beyond ? '/create-session' : '/');
        this.screen = 'landing';
        this.sheetOpen = true;
        this._notify();
    }

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

    setPartnerOnline(val: boolean) {
        this.isPartnerOnline = val;
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

    // -----------------------------------------------------------
    // Dialog
    // -----------------------------------------------------------

    confirm(config: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }): Promise<boolean> {
        return new Promise((resolve) => {
            this.dialogConfig = config;
            this._dialogResolver = resolve;
            this._notify();
        });
    }

    handleDialogResult(confirmed: boolean) {
        if (this._dialogResolver) {
            this._dialogResolver(confirmed);
            this._dialogResolver = null;
        }
        this.dialogConfig = null;
        this._notify();
    }
}

export const uiStore = new UIStore();