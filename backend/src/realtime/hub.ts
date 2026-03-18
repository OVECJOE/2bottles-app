import type { ServerWebSocket } from 'bun';
import type { ClientToServerMessage, ServerToClientMessage, SocketContext } from './protocol';
import type { SessionStatus } from '../db';

interface Peer {
  ws: ServerWebSocket<{ ctx: SocketContext }>;
  ctx: SocketContext;
}

interface RoomState {
  peers: Map<string, Peer>;
  participants: Map<string, { userId: string; name?: string; online: boolean }>;
}

interface RealtimeHubHooks {
  onJoin?: (ctx: SocketContext) => Promise<void> | void;
  onLeave?: (ctx: SocketContext) => Promise<void> | void;
  onLocationUpdate?: (event: { sessionId: string; userId: string; lat: number; lng: number }) => Promise<void> | void;
  onChatMessage?: (event: { sessionId: string; userId: string; id: string; text: string; ts: number }) => Promise<void> | void;
  onSessionStatus?: (event: { sessionId: string; status: SessionStatus }) => Promise<void> | void;
  onSessionVenue?: (event: { sessionId: string; venueId: string }) => Promise<void> | void;
}

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export class RealtimeHub {
  private rooms = new Map<string, RoomState>();
  constructor(private hooks: RealtimeHubHooks = {}) {}

  join(sessionId: string, peer: Peer) {
    const room = this.rooms.get(sessionId) ?? { peers: new Map(), participants: new Map() };
    room.peers.set(peer.ctx.socketId, peer);
    room.participants.set(peer.ctx.userId, { userId: peer.ctx.userId, name: peer.ctx.name, online: true });
    this.rooms.set(sessionId, room);
    void this.hooks.onJoin?.(peer.ctx);
    this.broadcastPresence(sessionId);
  }

  leave(sessionId: string, socketId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(socketId);
    room.peers.delete(socketId);
    if (peer) {
      const p = room.participants.get(peer.ctx.userId);
      if (p) room.participants.set(peer.ctx.userId, { ...p, online: false });
      void this.hooks.onLeave?.(peer.ctx);
    }

    if (room.peers.size === 0) {
      this.rooms.delete(sessionId);
      return;
    }

    this.broadcastPresence(sessionId);
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
        await this.hooks.onSessionStatus?.({ sessionId, status: msg.status });
        this.broadcast(sessionId, { type: 'session:status', status: msg.status });
        return;

      case 'session:venue':
        await this.hooks.onSessionVenue?.({ sessionId, venueId: msg.venueId });
        this.broadcast(sessionId, { type: 'session:venue', venueId: msg.venueId });
        return;

      case 'presence:join':
      case 'presence:leave':
        // Presence is derived from socket lifecycle for now.
        return;
    }
  }

  private broadcastPresence(sessionId: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const payload: ServerToClientMessage = {
      type: 'presence:update',
      sessionId,
      participants: [...room.participants.values()],
    };
    this.broadcast(sessionId, payload);
  }

  private broadcast(sessionId: string, payload: ServerToClientMessage, exceptSocketId?: string) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const text = JSON.stringify(payload);
    for (const [socketId, peer] of room.peers.entries()) {
      if (exceptSocketId && socketId === exceptSocketId) continue;
      peer.ws.send(text);
    }
  }

  private send(ws: ServerWebSocket<{ ctx: SocketContext }>, payload: ServerToClientMessage) {
    ws.send(JSON.stringify(payload));
  }
}
