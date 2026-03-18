declare module 'web-push' {
  interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
  }

  interface PushSubscription {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface SendOptions {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  }

  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload?: string, options?: SendOptions): Promise<unknown>;
  }

  const webpush: WebPush;
  export default webpush;
}
