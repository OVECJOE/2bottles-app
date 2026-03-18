export type ClientToServerMessage =
  | { type: 'presence:join'; sessionId: string; userId: string; name?: string }
  | { type: 'presence:leave'; sessionId: string; userId: string }
  | { type: 'location:update'; sessionId: string; userId: string; lat: number; lng: number; ts: number }
  | { type: 'chat:message'; sessionId: string; userId: string; text: string; ts: number }
  | { type: 'session:status'; sessionId: string; status: 'pending_partner' | 'selecting_venue' | 'pending_agreement' | 'agreed' | 'live' | 'ended' }
  | { type: 'session:venue'; sessionId: string; venueId: string }
  | { type: 'ping'; ts: number };

export type ServerToClientMessage =
  | { type: 'presence:update'; sessionId: string; participants: Array<{ userId: string; name?: string; online: boolean }> }
  | { type: 'partner:location'; userId: string; lat: number; lng: number; ts: number }
  | { type: 'chat:message'; userId: string; text: string; ts: number; id: string }
  | { type: 'session:status'; status: 'pending_partner' | 'selecting_venue' | 'pending_agreement' | 'agreed' | 'live' | 'ended' }
  | { type: 'session:venue'; venueId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong'; ts: number };

export interface SocketContext {
  socketId: string;
  requestId?: string;
  userId: string;
  sessionId: string;
  name?: string;
}
