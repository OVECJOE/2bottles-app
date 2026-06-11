export * from './location.types.js';
export * from './session.types.js';
export * from './venue.types.js';

export type AppScreen =
    | 'landing'
    | 'create-session'
    | 'invite-partner'
    | 'partner-notified'     // waiting for partner response
    | 'partner-rejected'     // partner said no → end session
    | 'select-rendezvous'    // initiator picks venue
    | 'partner-agree-refuse' // partner sees suggestion + chat
    | 'session-link'         // both agreed → link generated
    | 'live-tracking'        // en route, real-time location
    | 'live-chat'            // full-screen chat during tracking
    | 'end-session';         // arrived, wrap up

export interface DialogConfig {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export interface UIState {
    screen: AppScreen;
    sheetOpen: boolean;
    isLoading: boolean;
    isPartnerOnline: boolean;
    toastMessage: string | null;
    dialogConfig: DialogConfig | null;
}
