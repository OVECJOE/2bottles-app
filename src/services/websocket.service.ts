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
    | { type: 'partner:status'; status: PartnerStatus }
    | { type: 'session:status'; status: SessionStatus }
    | { type: 'session:venue'; venueId: string };

class WebSocketService {
    private _ws: WebSocket | null = null;
    private _sessionId: string | null = null;
    private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _reconnectAttempts = 0;
    private _locationInterval: ReturnType<typeof setInterval> | null = null;

    connect(sessionId: string) {
        if (this._ws?.readyState === WebSocket.OPEN) return;

        this._sessionId = sessionId;
        this._reconnectAttempts = 0;
        this._open();
    }

    disconnect() {
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        if (this._locationInterval) clearInterval(this._locationInterval);
        this._ws?.close(1000, 'session ended');
        this._ws = null;
        this._sessionId = null;
    }

    sendLocation(lat: number, lng: number) {
        this._send({ type: 'location:update', lat, lng, sessionId: this._sessionId });
    }

    private _open() {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${location.host}/ws/${this._sessionId}`;

        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
            this._reconnectAttempts = 0;
            this._startLocationBroadcast();
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

    private _handle(msg: WSMessage) {
        switch (msg.type) {
            case 'partner:location':
                locationStore.setPartnerLocation({ lat: msg.lat, lng: msg.lng });
                if (sessionStore.partner) {
                    sessionStore.setPartner({
                        ...sessionStore.partner,
                        location: { lat: msg.lat, lng: msg.lng },
                    });
                }
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
                sessionStore.setSessionStatus(msg.status);
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