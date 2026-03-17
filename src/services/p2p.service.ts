import { Peer, type DataConnection } from 'peerjs';
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

    async init(id?: string): Promise<string> {
        if (this._peer && !this._peer.destroyed) {
            if (id && this._peer.id === id) return this._peer.id;
            this._peer.destroy();
        }
        
        return new Promise((resolve, reject) => {
            this._peer = id ? new Peer(id) : new Peer();

            const timeout = setTimeout(() => {
                reject(new Error('Peer initialization timeout'));
            }, 10000);

            this._peer.on('open', (peerId) => {
                clearTimeout(timeout);
                console.log('[P2P] Peer open with ID:', peerId);
                this._signalingReconnectAttempts = 0; // Reset on success
                this._setupPeerListeners();
                resolve(peerId);
            });

            this._peer.on('error', (err: any) => {
                clearTimeout(timeout);
                console.error('[P2P] Peer error:', err);
                
                // Critical error mapping for better UX
                const errorMap: Record<string, string> = {
                    'server-error': 'Signaling server error. Reconnecting...',
                    'socket-error': 'Network socket closed. Retrying...',
                    'socket-closed': 'Network connection lost.',
                    'network': 'Check your internet connection.'
                };

                if (err.type === 'id-taken' && id) {
                    console.log('[P2P] ID taken, attempting with random suffix...');
                    const newId = `${id}-${Math.floor(Math.random() * 1000)}`;
                    this.init(newId).then(resolve).catch(reject);
                } else if (err.type === 'id-taken') {
                    this._peer?.reconnect();
                    resolve(this._peer?.id ?? '');
                } else {
                    const msg = errorMap[err.type] || `P2P error: ${err.type || 'Unknown'}`;
                    // Only show toast for non-reconnecting errors or if it persists
                    if (this._signalingReconnectAttempts > 2) uiStore.showToast(msg);
                    reject(err);
                }
            });

            this._peer.on('disconnected', () => {
                console.warn('[P2P] Peer disconnected from signaling server.');
                this._handleSignalingDisconnect();
            });
        });
    }

    private _handleSignalingDisconnect() {
        if (!this._peer || this._peer.destroyed || this._signalingReconnectTimer) return;

        const delay = Math.min(1000 * Math.pow(2, this._signalingReconnectAttempts), 30000);
        console.log(`[P2P] Reconnecting to signaling in ${delay}ms (Attempt ${this._signalingReconnectAttempts + 1})`);
        
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
                console.log('[P2P] Routine state reconciliation...');
                this.syncPartner();
            }
        }, 15000); // Reconciliation every 15s for better responsiveness
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
            console.log('[P2P] Incoming connection from:', conn.peer);
            this._isHost = true;
            this._setupConnection(conn);
        });
    }

    async connect(targetId: string): Promise<void> {
        if (!this._peer) {
            console.log('[P2P] No peer instance, initializing...');
            await this.init();
        }
        
        if (this._peer?.id === targetId) {
            console.warn('[P2P] Cannot connect to self.');
            return;
        }

        if (this._peer?.disconnected) {
            console.log('[P2P] Peer disconnected from signaling server. Reconnecting before connect...');
            this._peer.reconnect();
        }

        console.log('[P2P] Attempting to connect to target:', targetId);
        const conn = this._peer!.connect(targetId, {
            reliable: true
        });
        this._isHost = false;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error('[P2P] Connection timeout after 10s');
                uiStore.showToast('Connection to partner timed out.');
                reject(new Error('Connection timeout'));
            }, 10000);

            conn.on('open', () => {
                clearTimeout(timeout);
                console.log('[P2P] Connection established to:', targetId);
                this._setupConnection(conn);
                resolve();
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                console.error('[P2P] Connection error event:', err);
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
            console.log('[P2P] Connection fully open, flushing queue...');
            this._flushQueue();
            // If host, push current state to partner
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
            console.log('[P2P] Connection closed');
            this._stopReconciliation();
            if (this._conn === conn) {
                this._conn = null;
                uiStore.setPartnerOnline(false);
                uiStore.showToast('Partner disconnected');
                
                // Auto-reconnect if we are the partner and host might have refreshed
                if (!this._isHost && sessionStore.session?.id) {
                    this._attemptReconnect();
                }
            }
        });

        conn.on('error', (err) => {
            console.error('[P2P] Connection error on specific conn:', err);
            this._stopReconciliation();
            conn.close();
        });
    }

    private _attemptReconnect() {
        if (this._reconnectTimer) return;
        // Bug 13: Don't reconnect if session ended
        if (!sessionStore.session || sessionStore.session.status === 'ended') return;

        console.log('[P2P] Attempting auto-reconnect to host...');
        this._reconnectTimer = setTimeout(async () => {
            this._reconnectTimer = null;
            try {
                if (sessionStore.session?.id) {
                    await this.connect(sessionStore.session.id);
                }
            } catch (e) {
                this._attemptReconnect(); // retry
            }
        }, 3000);
    }

    private _flushQueue() {
        while (this._sendQueue.length > 0 && this._conn?.open) {
            const msg = this._sendQueue.shift();
            if (msg) this._conn.send(msg);
        }
    }

    /**
     * Pushes current critical state from Host to a (re)connecting Partner
     */
    syncPartner() {
        if (!this._isHost || !this._conn?.open) return; // Bug 14: Avoid queuing syncs during transitions
        const s = sessionStore;
        this.send({ type: 'user:info', name: s.ownName });
        if (s.selectedVenue) {
            this.send({ type: 'session:venue', venue: s.selectedVenue });
        }
        this.send({ type: 'session:status', status: s.session?.status || 'pending_partner' });
        if (s.ownAgreed) this.broadcastAgreement();
    }

    send(msg: P2PMessage) {
        if (this._conn && this._conn.open) {
            this._conn.send(msg);
        } else {
            console.log('[P2P] Connection not open, queuing message:', msg.type);
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
        console.log('[P2P] Received message:', msg);
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
                    sessionStore.endSession();
                    uiStore.goHome();
                }
                break;

            case 'session:status':
                sessionStore.setSessionStatus(msg.status);
                if (msg.status === 'live') uiStore.goToLiveTracking();
                if (msg.status === 'ended') uiStore.goToEndSession();
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
                    id: crypto.randomUUID(),
                    senderId: 'partner',
                    text: msg.text,
                    timestamp: msg.timestamp,
                });
                break;
        }
    }

    disconnect() {
        this._stopReconciliation();
        this._conn?.close();
        this._peer?.destroy();
        this._peer = null;
        this._conn = null;
    }
}

export const p2pService = new P2PService();
