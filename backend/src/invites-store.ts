export type InviteDecision = 'accepted' | 'rejected';
export type InviteStatus = 'pending' | InviteDecision;

export interface InviteRecord {
  sessionId: string;
  inviterUserId: string;
  partnerUserId: string;
  status: InviteStatus;
  createdAt: number;
  updatedAt: number;
  respondedAt?: number;
}

function inviteKey(sessionId: string, partnerUserId: string): string {
  return `${sessionId}:${partnerUserId}`;
}

export class InvitesStore {
  private byKey = new Map<string, InviteRecord>();
  private keysByPartner = new Map<string, Set<string>>();

  upsertPending(sessionId: string, inviterUserId: string, partnerUserId: string): InviteRecord {
    const now = Date.now();
    const key = inviteKey(sessionId, partnerUserId);
    const existing = this.byKey.get(key);

    const record: InviteRecord = {
      sessionId,
      inviterUserId,
      partnerUserId,
      status: 'pending',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.byKey.set(key, record);
    const partnerSet = this.keysByPartner.get(partnerUserId) ?? new Set<string>();
    partnerSet.add(key);
    this.keysByPartner.set(partnerUserId, partnerSet);
    return record;
  }

  get(sessionId: string, partnerUserId: string): InviteRecord | null {
    return this.byKey.get(inviteKey(sessionId, partnerUserId)) ?? null;
  }

  listForPartner(partnerUserId: string, status?: InviteStatus): InviteRecord[] {
    const keys = this.keysByPartner.get(partnerUserId);
    if (!keys || keys.size === 0) return [];

    const out: InviteRecord[] = [];
    for (const key of keys.values()) {
      const record = this.byKey.get(key);
      if (!record) continue;
      if (status && record.status !== status) continue;
      out.push(record);
    }

    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }

  respond(sessionId: string, partnerUserId: string, decision: InviteDecision): InviteRecord | null {
    const key = inviteKey(sessionId, partnerUserId);
    const existing = this.byKey.get(key);
    if (!existing) return null;

    const now = Date.now();
    const next: InviteRecord = {
      ...existing,
      status: decision,
      updatedAt: now,
      respondedAt: now,
    };

    this.byKey.set(key, next);
    return next;
  }
}
