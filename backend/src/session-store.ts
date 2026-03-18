type SessionStatus = 'pending_partner' | 'selecting_venue' | 'pending_agreement' | 'agreed' | 'live' | 'ended';
export type SessionRole = 'owner' | 'member';

export interface SessionRecord {
  id: string;
  ownerUserId: string;
  status: SessionStatus;
  venueId?: string;
  maxParticipants: number;
  participants: Array<{ userId: string; name?: string }>;
  createdAt: number;
  endedAt?: number;
}

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  create(ownerUserId: string, ownerName: string | undefined, maxParticipants: number) {
    const id = newId();
    const record: SessionRecord = {
      id,
      ownerUserId,
      status: 'pending_partner',
      maxParticipants,
      participants: [{ userId: ownerUserId, name: ownerName }],
      createdAt: Date.now(),
    };
    this.sessions.set(id, record);
    return record;
  }

  get(id: string) {
    return this.sessions.get(id) ?? null;
  }

  join(id: string, userId: string, name?: string) {
    const session = this.sessions.get(id);
    if (!session) return { ok: false as const, code: 'not_found' };
    if (session.status === 'ended') return { ok: false as const, code: 'ended' };

    const existing = session.participants.find((p) => p.userId === userId);
    if (existing) return { ok: true as const, session };

    if (session.participants.length >= session.maxParticipants) {
      return { ok: false as const, code: 'full' };
    }

    session.participants.push({ userId, name });
    this.sessions.set(id, session);
    return { ok: true as const, session };
  }

  end(id: string) {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.status = 'ended';
    session.endedAt = Date.now();
    this.sessions.set(id, session);
    return true;
  }

  setVenue(id: string, venueId: string | null) {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.venueId = venueId ?? undefined;
    this.sessions.set(id, session);
    return true;
  }

  setStatus(id: string, status: SessionStatus) {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.status = status;
    if (status === 'ended') {
      session.endedAt = Date.now();
    }
    this.sessions.set(id, session);
    return true;
  }

  getRole(id: string, userId: string): SessionRole | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    const joined = session.participants.some((p) => p.userId === userId);
    if (!joined) return null;
    return session.ownerUserId === userId ? 'owner' : 'member';
  }
}
