import webpush from 'web-push';

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

interface InvitePushInput {
  sessionId: string;
  inviterName?: string;
  inviteUrl: string;
}

export interface InvitePushResult {
  attempted: number;
  delivered: number;
  failed: number;
  staleEndpoints: string[];
  skipped: boolean;
  skipReason?: string;
}

function isValidSubscription(subscription: PushSubscriptionPayload): boolean {
  return !!subscription.endpoint
    && typeof subscription.endpoint === 'string'
    && !!subscription.keys?.p256dh
    && !!subscription.keys?.auth;
}

class PushNotificationService {
  private enabled: boolean;
  private skipReason: string | undefined;

  constructor() {
    const vapidPublicKeyRaw = process.env.VAPID_PUBLIC_KEY?.trim();
    const vapidPrivateKeyRaw = process.env.VAPID_PRIVATE_KEY?.trim();
    const vapidSubject = process.env.VAPID_SUBJECT?.trim() || 'mailto:ops@2bottles.local';

    this.enabled = !!vapidPublicKeyRaw && !!vapidPrivateKeyRaw;
    if (!this.enabled) {
      this.skipReason = 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY';
      return;
    }

    const vapidPublicKey = vapidPublicKeyRaw as string;
    const vapidPrivateKey = vapidPrivateKeyRaw as string;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  async sendInvite(
    subscriptions: PushSubscriptionPayload[],
    input: InvitePushInput,
  ): Promise<InvitePushResult> {
    const attempted = subscriptions.length;

    if (!this.enabled) {
      return {
        attempted,
        delivered: 0,
        failed: 0,
        staleEndpoints: [],
        skipped: true,
        skipReason: this.skipReason,
      };
    }

    if (attempted === 0) {
      return {
        attempted: 0,
        delivered: 0,
        failed: 0,
        staleEndpoints: [],
        skipped: false,
      };
    }

    const payload = JSON.stringify({
      type: 'invite',
      title: `${input.inviterName || 'Someone'} invited you to 2bottles`,
      body: 'Tap to accept or decline this rendezvous invite.',
      url: input.inviteUrl,
      sessionId: input.sessionId,
      ts: Date.now(),
    });

    let delivered = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(subscriptions.map(async (subscription) => {
      if (!isValidSubscription(subscription)) {
        failed += 1;
        return;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime ?? null,
            keys: {
              p256dh: subscription.keys?.p256dh || '',
              auth: subscription.keys?.auth || '',
            },
          },
          payload,
          {
            TTL: 60,
            urgency: 'high',
          },
        );
        delivered += 1;
      } catch (err: any) {
        const statusCode = Number(err?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscription.endpoint);
        } else {
          failed += 1;
        }
      }
    }));

    return {
      attempted,
      delivered,
      failed,
      staleEndpoints,
      skipped: false,
    };
  }
}

export function createPushNotificationService(): PushNotificationService {
  return new PushNotificationService();
}
