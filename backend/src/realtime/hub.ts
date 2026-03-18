import type { ServerWebSocket } from 'bun';
import type { ClientToServerMessage, ServerToClientMessage, SocketContext } from './protocol';
import type { SessionStatus } from '../db';

export type HubDistributedEvent =
  | { kind: 'broadcast'; sessionId: string; payload: ServerToClientMessage }
  | { kind: 'presence'; sessionId: string; participant: { userId: string; name?: string; online: boolean } }
  | { kind: 'presence_heartbeat'; sessionId: string; participant: { userId: string; name?: string } };

export interface RealtimeDistributor {
  subscribe(listener: (event: HubDistributedEvent) => void): Promise<void>;
  publish(event: HubDistributedEvent): Promise<void>;
  close?: () => Promise<void> | void;
}

interface Peer {
  ws: ServerWebSocket<{ ctx: SocketContext }>;
  ctx: SocketContext;
}

interface RoomState {
  peers: Map<string, Peer>;
  participants: Map<string, { userId: string; name?: string; online: boolean }>;
  localPresenceCounts: Map<string, number>;
  remoteHeartbeatAt: Map<string, number>;
}

interface RealtimeHubHooks {
  onJoin?: (ctx: SocketContext) => Promise<void> | void;
  onLeave?: (ctx: SocketContext) => Promise<void> | void;
  onLocationUpdate?: (event: { sessionId: string; userId: string; lat: number; lng: number }) => Promise<void> | void;
  onChatMessage?: (event: { sessionId: string; userId: string; id: string; text: string; ts: number }) => Promise<void> | void;
  onSessionStatus?: (event: { sessionId: string; userId: string; status: SessionStatus }) => Promise<void> | void;
  onSessionVenue?: (event: { sessionId: string; userId: string; venueId: string }) => Promise<void> | void;
}

interface RealtimeHubOptions extends RealtimeHubHooks {
  distributor?: RealtimeDistributor;
}

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const PRESENCE_TTL_MS = Math.max(5_000, Number(process.env.WS_REMOTE_PRESENCE_TTL_MS ?? 30_000));
const PRESENCE_HEARTBEAT_MS = Math.max(1_000, Number(process.env.WS_REMOTE_PRESENCE_HEARTBEAT_MS ?? 10_000));

export class RealtimeHub {
  private rooms = new Map<string, RoomState>();
  private hooks: RealtimeHubHooks;
  private distributor: RealtimeDistributor | null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: RealtimeHubOptions = {}) {
    const { distributor, ...hooks } = options;
    this.hooks = hooks;
    this.distributor = distributor ?? null;

    this.heartbeatInterval = setInterval(() => {
      this.publishLocalHeartbeats();
    }, PRESENCE_HEARTBEAT_MS);

    this.sweepInterval = setInterval(() => {
      this.sweepStaleRemotePresence();
    }, Math.max(1_000, Math.floor(PRESENCE_TTL_MS / 2)));
  }

  close() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.sweepInterval) clearInterval(this.sweepInterval);
    this.heartbeatInterval = null;
    this.sweepInterval = null;
  }

  async attachDistributor(distributor: RealtimeDistributor) {
    this.distributor = distributor;
    await distributor.subscribe((event) => {
      this.handleDistributedEvent(event);
    });
  }

  join(sessionId: string, peer: Peer) {
    const room = this.rooms.get(sessionId) ?? {
      peers: new Map(),
      participants: new Map(),
      localPresenceCounts: new Map(),
      remoteHeartbeatAt: new Map(),
    };
    room.peers.set(peer.ctx.socketId, peer);
    room.localPresenceCounts.set(peer.ctx.userId, (room.localPresenceCounts.get(peer.ctx.userId) ?? 0) + 1);
    room.participants.set(peer.ctx.userId, { userId: peer.ctx.userId, name: peer.ctx.name, online: true });
    this.rooms.set(sessionId, room);
    void this.hooks.onJoin?.(peer.ctx);
    this.broadcastPresenceLocal(sessionId);
    void this.publishPresence(sessionId, { userId: peer.ctx.userId, name: peer.ctx.name, online: true });
  }

  leave(sessionId: string, socketId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(socketId);
    room.peers.delete(socketId);
    if (peer) {
      const current = room.localPresenceCounts.get(peer.ctx.userId) ?? 0;
      const nextCount = Math.max(0, current - 1);
      if (nextCount > 0) {
        room.localPresenceCounts.set(peer.ctx.userId, nextCount);
      } else {
        room.localPresenceCounts.delete(peer.ctx.userId);
        const p = room.participants.get(peer.ctx.userId);
        if (p) room.participants.set(peer.ctx.userId, { ...p, online: false });
      }
      void this.hooks.onLeave?.(peer.ctx);
      if (nextCount === 0) {
        void this.publishPresence(sessionId, { userId: peer.ctx.userId, name: peer.ctx.name, online: false });
      }
    }

    if (room.peers.size === 0) {
      this.rooms.delete(sessionId);
      return;
    }

    this.broadcastPresenceLocal(sessionId);
  }

  async handleMessage(ws: ServerWebSocket<{ ctx: SocketContext }>, msg: ClientToServerMessage) {
    const sessionId = ws.data.ctx.sessionId;
    const userId = ws.data.ctx.userId;

    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong', ts: msg.ts });
        return;

      case 'location:update':
        await this.hooks.onLocationUpdate?.({ sessionId, userId, lat: msg.lat, lng: msg.lng });
        this.broadcast(sessionId, {
          type: 'partner:location',
          userId,
          lat: msg.lat,
          lng: msg.lng,
          ts: msg.ts,
        }, ws.data.ctx.socketId);
        return;

      case 'chat:message':
        {
          const id = newId();
          await this.hooks.onChatMessage?.({ sessionId, userId, id, text: msg.text, ts: msg.ts });
          this.broadcast(sessionId, {
            type: 'chat:message',
            userId,
            text: msg.text,
            ts: msg.ts,
            id,
          });
          return;
        }

      case 'session:status':
        await this.hooks.onSessionStatus?.({ sessionId, userId, status: msg.status });
        this.broadcast(sessionId, { type: 'session:status', status: msg.status });
        return;

      case 'session:venue':
        await this.hooks.onSessionVenue?.({ sessionId, userId, venueId: msg.venueId });
        this.broadcast(sessionId, { type: 'session:venue', venueId: msg.venueId });
        return;

      case 'presence:join':
      case 'presence:leave':
        // Presence is derived from socket lifecycle for now.
        return;
    }
  }

  private handleDistributedEvent(event: HubDistributedEvent) {
    if (event.kind === 'broadcast') {
      this.broadcastLocal(event.sessionId, event.payload);
      return;
    }

    const room = this.rooms.get(event.sessionId);
    if (!room) return;

    if (event.kind === 'presence') {
      if (this.hasLocalPresence(room, event.participant.userId) && !event.participant.online) {
        return;
      }
      room.participants.set(event.participant.userId, event.participant);
      if (event.participant.online) {
        room.remoteHeartbeatAt.set(event.participant.userId, Date.now());
      } else {
        room.remoteHeartbeatAt.delete(event.participant.userId);
      }
      this.rooms.set(event.sessionId, room);
      this.broadcastPresenceLocal(event.sessionId);
      return;
    }

    if (!this.hasLocalPresence(room, event.participant.userId)) {
      const existing = room.participants.get(event.participant.userId);
      room.participants.set(event.participant.userId, {
        userId: event.participant.userId,
        name: event.participant.name ?? existing?.name,
        online: true,
      });
    }
    room.remoteHeartbeatAt.set(event.participant.userId, Date.now());
    this.rooms.set(event.sessionId, room);
    this.broadcastPresenceLocal(event.sessionId);
  }

  private hasLocalPresence(room: RoomState, userId: string) {
    return (room.localPresenceCounts.get(userId) ?? 0) > 0;
  }

  private publishLocalHeartbeats() {
    if (!this.distributor) return;

    for (const [sessionId, room] of this.rooms.entries()) {
      for (const [userId, count] of room.localPresenceCounts.entries()) {
        if (count < 1) continue;
        const participant = room.participants.get(userId);
        void this.publishPresenceHeartbeat(sessionId, {
          userId,
          name: participant?.name,
        });
      }
    }
  }

  private sweepStaleRemotePresence() {
    const now = Date.now();

    for (const [sessionId, room] of this.rooms.entries()) {
      let changed = false;
      for (const [userId, lastAt] of room.remoteHeartbeatAt.entries()) {
        if (this.hasLocalPresence(room, userId)) {
          room.remoteHeartbeatAt.delete(userId);
          continue;
        }
        if (now - lastAt <= PRESENCE_TTL_MS) continue;

        const participant = room.participants.get(userId);
        if (participant?.online) {
          room.participants.set(userId, { ...participant, online: false });
          changed = true;
        }
        room.remoteHeartbeatAt.delete(userId);
      }

      if (changed) {
        this.broadcastPresenceLocal(sessionId);
      }
    }
  }

  private broadcastPresenceLocal(sessionId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const payload: ServerToClientMessage = {
      type: 'presence:update',
      sessionId,
      participants: [...room.participants.values()],
    };
    this.broadcastLocal(sessionId, payload);
  }

  private broadcast(sessionId: string, payload: ServerToClientMessage, exceptSocketId?: string) {
    this.broadcastLocal(sessionId, payload, exceptSocketId);
    void this.publishBroadcast(sessionId, payload);
  }

  private broadcastLocal(sessionId: string, payload: ServerToClientMessage, exceptSocketId?: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const text = JSON.stringify(payload);
    for (const [socketId, peer] of room.peers.entries()) {
      if (exceptSocketId && socketId === exceptSocketId) continue;
      peer.ws.send(text);
    }
  }

  private async publishBroadcast(sessionId: string, payload: ServerToClientMessage) {
    if (!this.distributor) return;
    await this.distributor.publish({ kind: 'broadcast', sessionId, payload }).catch(() => undefined);
  }

  private async publishPresence(sessionId: string, participant: { userId: string; name?: string; online: boolean }) {
    if (!this.distributor) return;
    await this.distributor.publish({ kind: 'presence', sessionId, participant }).catch(() => undefined);
  }

  private async publishPresenceHeartbeat(sessionId: string, participant: { userId: string; name?: string }) {
    if (!this.distributor) return;
    await this.distributor.publish({ kind: 'presence_heartbeat', sessionId, participant }).catch(() => undefined);
  }

  private send(ws: ServerWebSocket<{ ctx: SocketContext }>, payload: ServerToClientMessage) {
    ws.send(JSON.stringify(payload));
  }
}
