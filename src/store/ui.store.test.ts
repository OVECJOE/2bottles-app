import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('idb-keyval', () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
}));

vi.mock('@vaadin/router', () => ({
    Router: {
        go: vi.fn(),
    },
}));

import { get, set, del } from 'idb-keyval';
import { Router } from '@vaadin/router';
import { uiStore } from './ui.store.js';

describe('UIStore', () => {
    beforeEach(() => {
        uiStore.screen = 'create-session';
        uiStore.sheetOpen = true;
        uiStore.isLoading = false;
        uiStore.isPartnerOnline = false;
        uiStore.toastMessage = null;
        uiStore.dialogConfig = null;
        vi.clearAllMocks();
    });

    describe('navigate', () => {
        it('navigates to create-session screen', async () => {
            await uiStore.navigate('create-session');

            expect(uiStore.screen).toBe('create-session');
            expect(Router.go).toHaveBeenCalledWith('/create-session');
            expect(set).toHaveBeenCalled();
        });

        it('navigates to invite-partner screen', async () => {
            await uiStore.navigate('invite-partner');

            expect(uiStore.screen).toBe('invite-partner');
            expect(Router.go).toHaveBeenCalledWith('/invite');
        });

        it('navigates to partner-notified screen with peerId', async () => {
            await uiStore.navigate('partner-notified', { peerId: 'abc123' });

            expect(uiStore.screen).toBe('partner-notified');
            expect(Router.go).toHaveBeenCalledWith('/join/abc123');
        });

        it('navigates to partner-rejected screen', async () => {
            await uiStore.navigate('partner-rejected');

            expect(uiStore.screen).toBe('partner-rejected');
            expect(Router.go).toHaveBeenCalledWith('/rejected');
        });

        it('navigates to select-rendezvous screen', async () => {
            await uiStore.navigate('select-rendezvous');

            expect(uiStore.screen).toBe('select-rendezvous');
            expect(Router.go).toHaveBeenCalledWith('/select-venue');
        });

        it('navigates to partner-agree-refuse screen', async () => {
            await uiStore.navigate('partner-agree-refuse');

            expect(uiStore.screen).toBe('partner-agree-refuse');
            expect(Router.go).toHaveBeenCalledWith('/coordinate');
        });

        it('navigates to live-tracking screen', async () => {
            await uiStore.navigate('live-tracking');

            expect(uiStore.screen).toBe('live-tracking');
            expect(Router.go).toHaveBeenCalledWith('/tracking');
        });

        it('navigates to live-chat screen', async () => {
            await uiStore.navigate('live-chat');

            expect(uiStore.screen).toBe('live-chat');
            expect(Router.go).toHaveBeenCalledWith('/chat');
        });

        it('navigates to session-link screen', async () => {
            await uiStore.navigate('session-link');

            expect(uiStore.screen).toBe('session-link');
            expect(Router.go).toHaveBeenCalledWith('/session-link');
        });

        it('navigates to end-session screen', async () => {
            await uiStore.navigate('end-session');

            expect(uiStore.screen).toBe('end-session');
            expect(Router.go).toHaveBeenCalledWith('/ended');
        });

        it('opens bottom sheet on navigation', async () => {
            uiStore.sheetOpen = false;

            await uiStore.navigate('create-session');

            expect(uiStore.sheetOpen).toBe(true);
        });
    });

    describe('convenience navigation methods', () => {
        it('goToInvite navigates to invite screen', async () => {
            await uiStore.goToInvite();
            expect(Router.go).toHaveBeenCalledWith('/invite');
        });

        it('goToPartnerNotified navigates with peerId', async () => {
            await uiStore.goToPartnerNotified('peer-xyz');
            expect(Router.go).toHaveBeenCalledWith('/join/peer-xyz');
        });

        it('goToRejected navigates to rejected screen', async () => {
            await uiStore.goToRejected();
            expect(Router.go).toHaveBeenCalledWith('/rejected');
        });

        it('goToSelectVenue navigates to venue selection', async () => {
            await uiStore.goToSelectVenue();
            expect(Router.go).toHaveBeenCalledWith('/select-venue');
        });

        it('goToAgreeRefuse navigates to coordinate screen', async () => {
            await uiStore.goToAgreeRefuse();
            expect(Router.go).toHaveBeenCalledWith('/coordinate');
        });

        it('goToSessionLink navigates to session link screen', async () => {
            await uiStore.goToSessionLink();
            expect(Router.go).toHaveBeenCalledWith('/session-link');
        });

        it('goToLiveTracking navigates to tracking screen', async () => {
            await uiStore.goToLiveTracking();
            expect(Router.go).toHaveBeenCalledWith('/tracking');
        });

        it('goToLiveChat navigates to chat screen', async () => {
            await uiStore.goToLiveChat();
            expect(Router.go).toHaveBeenCalledWith('/chat');
        });

        it('goToEndSession navigates to ended screen', async () => {
            await uiStore.goToEndSession();
            expect(Router.go).toHaveBeenCalledWith('/ended');
        });
    });

    describe('goHome', () => {
        it('navigates to landing page by default', async () => {
            await uiStore.goHome();

            expect(Router.go).toHaveBeenCalledWith('/');
            expect(uiStore.screen).toBe('landing');
            expect(del).toHaveBeenCalled();
        });

        it('navigates to create-session when beyond is true', async () => {
            await uiStore.goHome(true);

            expect(Router.go).toHaveBeenCalledWith('/create-session');
            expect(uiStore.screen).toBe('landing');
        });
    });

    describe('bottom sheet', () => {
        it('opens sheet', () => {
            uiStore.sheetOpen = false;

            uiStore.openSheet();

            expect(uiStore.sheetOpen).toBe(true);
        });

        it('closes sheet', () => {
            uiStore.sheetOpen = true;

            uiStore.closeSheet();

            expect(uiStore.sheetOpen).toBe(false);
        });

        it('toggles sheet', () => {
            uiStore.sheetOpen = true;

            uiStore.toggleSheet();

            expect(uiStore.sheetOpen).toBe(false);

            uiStore.toggleSheet();

            expect(uiStore.sheetOpen).toBe(true);
        });
    });

    describe('loading', () => {
        it('sets loading state', () => {
            uiStore.setLoading(true);

            expect(uiStore.isLoading).toBe(true);

            uiStore.setLoading(false);

            expect(uiStore.isLoading).toBe(false);
        });
    });

    describe('partner online', () => {
        it('sets partner online state', () => {
            uiStore.setPartnerOnline(true);

            expect(uiStore.isPartnerOnline).toBe(true);

            uiStore.setPartnerOnline(false);

            expect(uiStore.isPartnerOnline).toBe(false);
        });
    });

    describe('toast', () => {
        it('shows toast message', () => {
            vi.useFakeTimers();

            uiStore.showToast('Test message');

            expect(uiStore.toastMessage).toBe('Test message');

            vi.runAllTimers();
            vi.useRealTimers();
        });

        it('clears toast after duration', () => {
            vi.useFakeTimers();

            uiStore.showToast('Test message', 3000);

            expect(uiStore.toastMessage).toBe('Test message');

            vi.advanceTimersByTime(3000);

            expect(uiStore.toastMessage).toBeNull();

            vi.useRealTimers();
        });

        it('dismisses toast immediately', () => {
            vi.useFakeTimers();

            uiStore.showToast('Test message');

            expect(uiStore.toastMessage).toBe('Test message');

            uiStore.dismissToast();

            expect(uiStore.toastMessage).toBeNull();

            vi.useRealTimers();
        });

        it('resets timer when new toast shown', () => {
            vi.useFakeTimers();

            uiStore.showToast('First message', 3000);

            vi.advanceTimersByTime(2000);

            uiStore.showToast('Second message', 3000);

            vi.advanceTimersByTime(2000);

            expect(uiStore.toastMessage).toBe('Second message');

            vi.advanceTimersByTime(1000);

            expect(uiStore.toastMessage).toBeNull();

            vi.useRealTimers();
        });
    });

    describe('dialog', () => {
        it('shows confirm dialog and resolves with true', async () => {
            const promise = uiStore.confirm({
                title: 'Confirm',
                message: 'Are you sure?',
                confirmLabel: 'Yes',
                cancelLabel: 'No',
            });

            expect(uiStore.dialogConfig).toEqual({
                title: 'Confirm',
                message: 'Are you sure?',
                confirmLabel: 'Yes',
                cancelLabel: 'No',
            });

            uiStore.handleDialogResult(true);

            const result = await promise;

            expect(result).toBe(true);
            expect(uiStore.dialogConfig).toBeNull();
        });

        it('shows confirm dialog and resolves with false', async () => {
            const promise = uiStore.confirm({
                title: 'Delete',
                message: 'This cannot be undone',
            });

            uiStore.handleDialogResult(false);

            const result = await promise;

            expect(result).toBe(false);
        });
    });

    describe('subscribe', () => {
        it('notifies listeners on state changes', () => {
            const listener = vi.fn();
            uiStore.subscribe(listener);

            uiStore.setLoading(true);

            expect(listener).toHaveBeenCalled();
        });

        it('returns unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = uiStore.subscribe(listener);

            unsubscribe();
            uiStore.setLoading(true);

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('init', () => {
        it('loads screen from IndexedDB', async () => {
            vi.mocked(get).mockResolvedValue({ screen: 'live-tracking' });

            await uiStore.init();

            expect(uiStore.screen).toBe('live-tracking');
        });

        it('uses default screen when no saved data', async () => {
            vi.mocked(get).mockResolvedValue(undefined);

            await uiStore.init();

            expect(uiStore.screen).toBe('create-session');
        });

        it('sets loading to false after init', async () => {
            uiStore.isLoading = true;

            await uiStore.init();

            expect(uiStore.isLoading).toBe(false);
        });
    });
});
