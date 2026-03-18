import { Peer, type DataConnection, type PeerJSOption } from 'peerjs';
import { sessionStore, locationStore, uiStore } from '../store/index.js';
import type { Coordinates, PartnerStatus, SessionStatus, Venue } from '../types/index.js';

type P2PMessage =
    | { type: 'location:update'; coords: Coordinates }
    | { type: 'partner:status'; status: PartnerStatus }
    | { type: 'session:status'; status: SessionStatus }
    | { type: 'session:venue'; venue: Venue }
    | { type: 'session:agree' }
    | { type: 'session:reset' }
    | { type: 'user:info'; name: string }
    | { type: 'chat:message'; text: string; timestamp: number };

class P2PService {
    private _peer: Peer | null = null;
    private _conn: DataConnection | null = null;
    private _isHost = false;
    private _sendQueue: P2PMessage[] = [];
    private _reconnectTimer: any = null;
    private _reconciliationTimer: any = null;
    private _signalingReconnectAttempts = 0;
    private _signalingReconnectTimer: any = null;
    private _maxQueueSize = 300;

    private _buildPeerOptions(): PeerJSOption {
        const defaultStun: RTCIceServer[] = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
        ];

        let iceServers: RTCIceServer[] = [...defaultStun];

        const iceServersJson = import.meta.env.VITE_ICE_SERVERS_JSON as string | undefined;
        if (iceServersJson) {
            try {
                const parsed = JSON.parse(iceServersJson) as RTCIceServer[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    iceServers = parsed;
                }
            } catch {
                console.warn('[P2P] Invalid VITE_ICE_SERVERS_JSON; falling back to default STUN/TURN config');
            }
        } else {
            const stunUrls = (import.meta.env.VITE_STUN_URLS as string | undefined)
                ?.split(',')
                .map((u) => u.trim())
                .filter(Boolean);
            if (stunUrls && stunUrls.length > 0) {
                iceServers = [{ urls: stunUrls }];
            }

            const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
            const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
            const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();
            if (turnUrl && turnUsername && turnCredential) {
                iceServers.push({
                    urls: turnUrl,
                    username: turnUsername,
                    credential: turnCredential,
                });
            }
        }

        const peerHost = (import.meta.env.VITE_PEER_HOST as string | undefined)?.trim();
        const peerPath = (import.meta.env.VITE_PEER_PATH as string | undefined)?.trim();
        const peerPortRaw = (import.meta.env.VITE_PEER_PORT as string | undefined)?.trim();
        const peerSecureRaw = (import.meta.env.VITE_PEER_SECURE as string | undefined)?.trim();
        const peerPort = peerPortRaw ? Number(peerPortRaw) : undefined;

        const options: PeerJSOption = {
            config: {
                iceServers,
                iceTransportPolicy: 'all',
            },
        };

        if (peerHost) {
            options.host = peerHost;
            if (peerPath) options.path = peerPath;
            if (Number.isFinite(peerPort)) options.port = peerPort;
            if (peerSecureRaw) options.secure = peerSecureRaw === 'true' || peerSecureRaw === '1';
        }

        return options;
    }

    private _newId() {
        return typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
    }

    get isConnected(): boolean {
        return !!this._conn?.open;
    }

    async init(id?: string): Promise<string> {
        if (this._peer && !this._peer.destroyed) {
            if (id && this._peer.id === id) return this._peer.id;
            this._peer.destroy();
        }
        
        return new Promise((resolve, reject) => {
            const peerOptions = this._buildPeerOptions();
            this._peer = id ? new Peer(id, peerOptions) : new Peer(peerOptions);

            const timeout = setTimeout(() => {
                reject(new Error('Peer initialization timeout'));
            }, 10000);

            this._peer.on('open', (peerId) => {
                clearTimeout(timeout);
                this._signalingReconnectAttempts = 0;
                this._setupPeerListeners();
                resolve(peerId);
            });

            this._peer.on('error', (err: any) => {
                clearTimeout(timeout);
                
                const errorMap: Record<string, string> = {
                    'server-error': 'Signaling server error. Reconnecting...',
                    'socket-error': 'Network socket closed. Retrying...',
                    'socket-closed': 'Network connection lost.',
                    'network': 'Check your internet connection.'
                };

                if (err.type === 'id-taken' && id) {
                    const newId = `${id}-${Math.floor(Math.random() * 1000)}`;
                    if (sessionStore.session) {
                        void sessionStore.setSessionIdentity(newId);
                    }
                    this.init(newId).then(resolve).catch(reject);
                } else if (err.type === 'id-taken') {
                    this._peer?.reconnect();
                    resolve(this._peer?.id ?? '');
                } else {
                    const msg = errorMap[err.type] || `P2P error: ${err.type || 'Unknown'}`;
                    if (this._signalingReconnectAttempts > 2) uiStore.showToast(msg);
                    reject(err);
                }
            });

            this._peer.on('disconnected', () => {
                this._handleSignalingDisconnect();
            });
        });
    }

    private _handleSignalingDisconnect() {
        if (!this._peer || this._peer.destroyed || this._signalingReconnectTimer) return;

        const delay = Math.min(1000 * Math.pow(2, this._signalingReconnectAttempts), 30000);
        
        this._signalingReconnectTimer = setTimeout(() => {
            this._signalingReconnectTimer = null;
            this._signalingReconnectAttempts++;
            if (this._peer && !this._peer.destroyed && this._peer.disconnected) {
                this._peer.reconnect();
            }
        }, delay);
    }

    private _startReconciliation() {
        if (this._reconciliationTimer) clearInterval(this._reconciliationTimer);
        this._reconciliationTimer = setInterval(() => {
            if (this._conn?.open && this._isHost) {
                this.syncPartner();
            }
        }, 15000);
    }

    private _stopReconciliation() {
        if (this._reconciliationTimer) {
            clearInterval(this._reconciliationTimer);
            this._reconciliationTimer = null;
        }
    }

    private _setupPeerListeners() {
        if (!this._peer) return;

        this._peer.on('connection', (conn) => {
            this._isHost = true;
            this._setupConnection(conn);
        });
    }

    async connect(targetId: string): Promise<void> {
        if (!this._peer) {
            await this.init();
        }
        
        if (this._peer?.id === targetId) {
            return;
        }

        if (this._peer?.disconnected) {
            this._peer.reconnect();
        }

        const conn = this._peer!.connect(targetId, {
            reliable: true
        });
        this._isHost = false;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                uiStore.showToast('Connection to partner timed out.');
                reject(new Error('Connection timeout'));
            }, 10000);

            conn.on('open', () => {
                clearTimeout(timeout);
                this._setupConnection(conn);
                resolve();
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                uiStore.showToast(`Connection error: ${err.type || 'Blocked by firewall'}`);
                conn.close();
                reject(err);
            });
        });
    }

    private _setupConnection(conn: DataConnection) {
        this._conn = conn;
        uiStore.setPartnerOnline(true);
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        const onOpen = () => {
            this._flushQueue();
            this._syncOwnState();
            if (this._isHost) {
                this.syncPartner();
                this._startReconciliation();
            }
        };

        if (conn.open) {
            onOpen();
        } else {
            conn.on('open', onOpen);
        }

        conn.on('data', (data) => {
            this._handleMessage(data as P2PMessage);
        });

        conn.on('close', () => {
            this._stopReconciliation();
            if (this._conn === conn) {
                this._conn = null;
                uiStore.setPartnerOnline(false);
                uiStore.showToast('Partner disconnected');
                
                if (!this._isHost && sessionStore.session?.id) {
                    this._attemptReconnect();
                }
            }
        });

        conn.on('error', () => {
            this._stopReconciliation();
            conn.close();
        });
    }

    private _attemptReconnect() {
        if (this._reconnectTimer) return;
        if (!sessionStore.session || sessionStore.session.status === 'ended') return;

        this._reconnectTimer = setTimeout(async () => {
            this._reconnectTimer = null;
            try {
                if (sessionStore.session?.id) {
                    await this.connect(sessionStore.session.id);
                }
            } catch (e) {
                this._attemptReconnect();
            }
        }, 3000);
    }

    private _flushQueue() {
        while (this._sendQueue.length > 0 && this._conn?.open) {
            const msg = this._sendQueue.shift();
            if (msg) this._conn.send(msg);
        }
    }

    syncPartner() {
        if (!this._isHost || !this._conn?.open) return;
        const s = sessionStore;
        this._syncOwnState();
        if (s.selectedVenue) this.send({ type: 'session:venue', venue: s.selectedVenue });
        this.send({ type: 'session:status', status: s.session?.status || 'pending_partner' });
        if (s.ownAgreed) this.broadcastAgreement();
    }

    private _syncOwnState() {
        const s = sessionStore;
        if (s.ownName) this.send({ type: 'user:info', name: s.ownName });
        if (locationStore.own) this.broadcastLocation(locationStore.own);
    }

    send(msg: P2PMessage) {
        if (this._conn && this._conn.open) {
            this._conn.send(msg);
        } else {
            if (this._sendQueue.length >= this._maxQueueSize) {
                this._sendQueue.shift();
            }
            this._sendQueue.push(msg);
        }
    }

    broadcastLocation(coords: Coordinates) {
        this.send({ type: 'location:update', coords });
    }

    broadcastVenue(venue: Venue) {
        this.send({ type: 'session:venue', venue });
    }

    broadcastSessionStatus(status: SessionStatus) {
        this.send({ type: 'session:status', status });
    }

    broadcastUserInfo(name: string) {
        this.send({ type: 'user:info', name });
    }

    broadcastAgreement() {
        this.send({ type: 'session:agree' });
    }

    broadcastReset() {
        this.send({ type: 'session:reset' });
    }

    private _handleMessage(msg: P2PMessage) {
        switch (msg.type) {
            case 'location:update':
                locationStore.setPartnerLocation(msg.coords);
                break;

            case 'partner:status':
                sessionStore.setPartnerStatus(msg.status);
                if (msg.status === 'accepted' && this._isHost) {
                    uiStore.goToSelectVenue();
                }
                if (msg.status === 'rejected') {
                    uiStore.showToast('Partner declined the invite.');
                    this.disconnect();
                    sessionStore.endSession();
                    uiStore.goHome();
                }
                break;

            case 'session:status':
                sessionStore.setSessionStatus(msg.status);
                if (msg.status === 'live') uiStore.goToLiveTracking();
                if (msg.status === 'ended') {
                    this.disconnect();
                    uiStore.goToEndSession();
                }
                break;

            case 'session:venue':
                sessionStore.selectVenue(msg.venue);
                uiStore.goToAgreeRefuse();
                break;

            case 'session:agree':
                sessionStore.setPartnerAgreed(true);
                if (sessionStore.isVenueConfirmed) {
                    uiStore.goToLiveTracking();
                    this.broadcastSessionStatus('live');
                }
                break;

            case 'session:reset':
                sessionStore.setPartnerAgreed(false);
                sessionStore.setOwnAgreed(false);
                uiStore.goToSelectVenue();
                break;

            case 'user:info':
                sessionStore.setPartnerName(msg.name);
                break;

            case 'chat:message':
                sessionStore.addMessage({
                    id: this._newId(),
                    senderId: 'partner',
                    text: msg.text,
                    timestamp: msg.timestamp,
                });
                break;
        }
    }

    disconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this._signalingReconnectTimer) {
            clearTimeout(this._signalingReconnectTimer);
            this._signalingReconnectTimer = null;
        }
        this._stopReconciliation();
        this._sendQueue = [];
        this._conn?.close();
        this._peer?.destroy();
        this._peer = null;
        this._conn = null;
        uiStore.setPartnerOnline(false);
    }

    endSessionForAll() {
        this.broadcastSessionStatus('ended');
        this.disconnect();
    }
}

export const p2pService = new P2PService();
