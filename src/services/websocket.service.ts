/**
 * WebSocket service — single persistent connection per session.
 *
 * Message types (server → client):
 *   partner:location   { lat, lng }
 *   partner:status     { status: PartnerStatus }
 *   session:status     { status: SessionStatus }
 *   session:venue      { venueId: string }
 *
 * Message types (client → server):
 *   location:update    { lat, lng, sessionId }
 *   session:end        { sessionId }
 */
import { locationStore, sessionStore, uiStore } from '../store/index.js';
import type { PartnerStatus, SessionStatus } from '../types/index.js';

type WSMessage =
    | { type: 'partner:location'; lat: number; lng: number }
    | { type: 'partner:location'; userId: string; lat: number; lng: number; ts?: number }
    | { type: 'partner:status'; status: PartnerStatus }
    | { type: 'session:status'; status: SessionStatus }
    | { type: 'session:venue'; venueId: string }
    | { type: 'presence:update'; sessionId: string; participants: Array<{ userId: string; name?: string; online: boolean }> }
    | { type: 'chat:message'; userId: string; text: string; ts: number; id: string }
    | { type: 'pong'; ts: number };

class WebSocketService {
    private _ws: WebSocket | null = null;
    private _sessionId: string | null = null;
    private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _reconnectAttempts = 0;
    private _locationInterval: ReturnType<typeof setInterval> | null = null;
    private _pingInterval: ReturnType<typeof setInterval> | null = null;

    private _wsBaseUrl() {
        const explicit = import.meta.env.VITE_WS_URL as string | undefined;
        if (explicit) return explicit;
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${location.host}`;
    }

    connect(sessionId: string) {
        if (this._ws?.readyState === WebSocket.OPEN) return;

        this._sessionId = sessionId;
        this._reconnectAttempts = 0;
        this._open();
    }

    disconnect() {
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        if (this._locationInterval) clearInterval(this._locationInterval);
        if (this._pingInterval) clearInterval(this._pingInterval);
        this._ws?.close(1000, 'session ended');
        this._ws = null;
        this._sessionId = null;
    }

    sendLocation(lat: number, lng: number) {
        this._send({
            type: 'location:update',
            lat,
            lng,
            sessionId: this._sessionId,
            userId: sessionStore.session?.id || 'anonymous',
            ts: Date.now(),
        });
    }

    private _open() {
        const base = this._wsBaseUrl().replace(/\/$/, '');
        const userId = sessionStore.session?.id || 'anonymous';
        const name = encodeURIComponent(sessionStore.ownName || 'Guest');

        // New backend endpoint format.
        const nextUrl = `${base}/ws?sessionId=${encodeURIComponent(String(this._sessionId || ''))}&userId=${encodeURIComponent(userId)}&name=${name}`;
        // Legacy endpoint fallback for older servers.
        const legacyUrl = `${base}/ws/${this._sessionId}`;
        const url = import.meta.env.VITE_WS_LEGACY === 'true' ? legacyUrl : nextUrl;

        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            this._reconnectAttempts = 0;
            this._startLocationBroadcast();
            this._startPing();
        };

        this._ws.onmessage = (e) => {
            try {
                this._handle(JSON.parse(e.data) as WSMessage);
            } catch {
                console.warn('[WS] Invalid message', e.data);
            }
        };

        this._ws.onclose = (e) => {
            if (this._locationInterval) clearInterval(this._locationInterval);
            if (this._pingInterval) clearInterval(this._pingInterval);
            if (e.code !== 1000) this._scheduleReconnect();
        };

        this._ws.onerror = () => {
            this._ws?.close();
        };
    }

    /** Broadcast own location every 4 seconds while connected */
    private _startLocationBroadcast() {
        if (this._locationInterval) clearInterval(this._locationInterval);
        this._locationInterval = setInterval(() => {
            const own = locationStore.own;
            if (own) this.sendLocation(own.lat, own.lng);
        }, 4_000);
    }

    private _startPing() {
        if (this._pingInterval) clearInterval(this._pingInterval);
        this._pingInterval = setInterval(() => {
            this._send({ type: 'ping', ts: Date.now() });
        }, 20_000);
    }

    private _handle(msg: WSMessage) {
        switch (msg.type) {
            case 'partner:location':
                locationStore.setPartnerLocation({ lat: msg.lat, lng: msg.lng });
                if (sessionStore.partner) {
                    void sessionStore.setPartner({
                        ...sessionStore.partner,
                        location: { lat: msg.lat, lng: msg.lng },
                    });
                }
                break;

            case 'presence:update':
                // Presence surface can be wired to UI store later.
                break;

            case 'chat:message':
                sessionStore.addMessage({
                    id: msg.id,
                    senderId: 'partner',
                    text: msg.text,
                    timestamp: msg.ts,
                });
                break;

            case 'pong':
                break;

            case 'partner:status':
                sessionStore.setPartnerStatus(msg.status);
                if (msg.status === 'rejected') uiStore.goToRejected();
                if (msg.status === 'agreed') uiStore.goToSessionLink();
                if (msg.status === 'arrived' && locationStore.own) {
                    const dest = locationStore.destination;
                    if (dest) uiStore.goToEndSession();
                }
                break;

            case 'session:status':
                void sessionStore.setSessionStatus(msg.status);
                break;

            case 'session:venue':
                {
                    const selected = sessionStore.venueSuggestions.find((v) => v.id === msg.venueId);
                    if (selected) {
                        void sessionStore.selectVenue(selected);
                    } else {
                        void sessionStore.setSessionVenue(msg.venueId);
                    }
                }
                // Partner selected a venue — navigate to agree/refuse
                if (uiStore.screen !== 'partner-agree-refuse') {
                    uiStore.goToAgreeRefuse();
                }
                break;
        }
    }

    private _scheduleReconnect() {
        if (this._reconnectAttempts >= 5) return;
        const delay = Math.min(1000 * 2 ** this._reconnectAttempts, 30_000);
        this._reconnectAttempts++;
        this._reconnectTimer = setTimeout(() => this._open(), delay);
    }

    private _send(data: unknown) {
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(data));
        }
    }
}

export const wsService = new WebSocketService();