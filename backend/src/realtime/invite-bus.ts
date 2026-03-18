import { createClient } from 'redis';

export interface InviteUpdatePayload {
  action: 'created' | 'accepted' | 'rejected';
  sessionId: string;
  partnerUserId: string;
  inviterUserId: string;
}

export interface InviteUpdateEvent {
  targetUserIds: string[];
  payload: InviteUpdatePayload;
  ts: number;
}

interface InviteEnvelope {
  sourceNodeId: string;
  event: InviteUpdateEvent;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isInviteUpdateEvent(value: unknown): value is InviteUpdateEvent {
  if (!isObjectRecord(value)) return false;
  if (!Array.isArray(value.targetUserIds)) return false;
  if (!isObjectRecord(value.payload)) return false;
  if (typeof value.ts !== 'number' || !Number.isFinite(value.ts)) return false;

  const payload = value.payload;
  const validAction = payload.action === 'created' || payload.action === 'accepted' || payload.action === 'rejected';

  return validAction
    && typeof payload.sessionId === 'string'
    && typeof payload.partnerUserId === 'string'
    && typeof payload.inviterUserId === 'string';
}

export interface InviteRealtimeBus {
  subscribe(listener: (event: InviteUpdateEvent) => void): Promise<void>;
  publish(event: InviteUpdateEvent): Promise<void>;
  close(): Promise<void>;
}

class RedisInviteRealtimeBus implements InviteRealtimeBus {
  private pub: ReturnType<typeof createClient>;
  private sub: ReturnType<typeof createClient>;

  constructor(
    private redisUrl: string,
    private channel: string,
    private nodeId: string,
  ) {
    this.pub = createClient({ url: this.redisUrl });
    this.sub = createClient({ url: this.redisUrl });

    this.pub.on('error', (err) => {
      console.error('[backend] redis invite publish error:', err);
    });
    this.sub.on('error', (err) => {
      console.error('[backend] redis invite subscribe error:', err);
    });
  }

  async subscribe(listener: (event: InviteUpdateEvent) => void): Promise<void> {
    await this.pub.connect();
    await this.sub.connect();
    await this.sub.subscribe(this.channel, (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isObjectRecord(parsed)) return;

        const sourceNodeId = parsed.sourceNodeId;
        const event = parsed.event;
        if (typeof sourceNodeId !== 'string' || !isInviteUpdateEvent(event)) return;
        if (sourceNodeId === this.nodeId) return;

        listener(event);
      } catch {
        // Ignore malformed payloads from pub/sub.
      }
    });
  }

  async publish(event: InviteUpdateEvent): Promise<void> {
    const envelope: InviteEnvelope = {
      sourceNodeId: this.nodeId,
      event,
    };
    await this.pub.publish(this.channel, JSON.stringify(envelope));
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.sub.quit(),
      this.pub.quit(),
    ]);
  }
}

export async function createInviteRealtimeBus(): Promise<InviteRealtimeBus | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  const channel = process.env.REDIS_INVITE_CHANNEL?.trim() || '2bottles:invites';
  const nodeId = process.env.INSTANCE_ID?.trim()
    || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  return new RedisInviteRealtimeBus(redisUrl, channel, nodeId);
}
