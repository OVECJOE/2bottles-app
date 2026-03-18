import { usersApi, type MembershipTier } from '../api/users.api.js';
import { ApiError, clearAuthToken, getAuthDisplayNameFromToken, getAuthToken, setAuthToken } from '../api/client.js';

type Listener = () => void;

class AuthStore {
    signedIn = false;
    loading = false;
    initialized = false;
    requiresSignIn = false;

    membership: MembershipTier = 'free';
    maxParticipants = 2;
    displayName = 'Friend';

    private _listeners = new Set<Listener>();

    subscribe(fn: Listener): () => void {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    private _notify() {
        this._listeners.forEach((fn) => fn());
    }

    private _updateDisplayNameFromToken() {
        this.displayName = getAuthDisplayNameFromToken() || 'Friend';
    }

    async init() {
        this._hydrateTokenFromUrl();
        this._updateDisplayNameFromToken();
        await this.refreshEntitlements();
        this.initialized = true;
        this._notify();
    }

    async refreshEntitlements() {
        this.loading = true;
        this._notify();

        const token = getAuthToken();
        this._updateDisplayNameFromToken();

        try {
            const data = await usersApi.getEntitlements();
            this.membership = data.membership;
            this.maxParticipants = data.maxParticipants;
            this.signedIn = !!token;
            this.requiresSignIn = false;
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                this.membership = 'free';
                this.maxParticipants = 2;
                this.signedIn = false;
                this.requiresSignIn = true;
            }
        } finally {
            this.loading = false;
            this._notify();
        }
    }

    async signInWithAccessPass(rawPass: string): Promise<void> {
        const pass = rawPass.trim();
        if (!pass) throw new Error('Please paste your access pass first.');

        setAuthToken(pass);
        this._updateDisplayNameFromToken();

        try {
            await this.refreshEntitlements();
            if (this.requiresSignIn) {
                throw new Error('That pass did not work. Please check and try again.');
            }
            this.signedIn = true;
            this.requiresSignIn = false;
            this._notify();
        } catch (err) {
            clearAuthToken();
            this.signedIn = false;
            this.requiresSignIn = true;
            this._notify();
            throw err;
        }
    }

    signOut() {
        clearAuthToken();
        this.signedIn = false;
        this.requiresSignIn = false;
        this.membership = 'free';
        this.maxParticipants = 2;
        this.displayName = 'Friend';
        this._notify();
    }

    private _hydrateTokenFromUrl() {
        const url = new URL(window.location.href);
        const accessPass = url.searchParams.get('access')
            || url.searchParams.get('token')
            || url.searchParams.get('access_token');

        if (!accessPass?.trim()) return;

        setAuthToken(accessPass);

        url.searchParams.delete('access');
        url.searchParams.delete('token');
        url.searchParams.delete('access_token');
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, '', next || '/');
    }
}

export const authStore = new AuthStore();
