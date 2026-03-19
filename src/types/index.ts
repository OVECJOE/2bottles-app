export * from './location.types';
export * from './session.types';
export * from './venue.types';

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

export interface UIState {
    screen: AppScreen;
    sheetOpen: boolean;
    isLoading: boolean;
    toastMessage: string | null;
}