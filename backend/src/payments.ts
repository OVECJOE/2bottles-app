import Stripe from 'stripe';
import { normalizeUserId } from './auth';
import { recordDbPaymentWebhookEvent, upsertDbMembershipTier } from './db';

interface CheckoutInput {
  userId: string;
  userEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

interface CheckoutResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

export class PaymentsService {
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;
  private paidPriceId: string | null = null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? null;
    this.paidPriceId = process.env.STRIPE_PRICE_ID_PAID?.trim() ?? null;

    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil',
      });
    }
  }

  get isConfigured(): boolean {
    return !!this.stripe && !!this.paidPriceId;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.stripe) return { ok: false, reason: 'stripe_not_configured' };
    if (!this.paidPriceId) return { ok: false, reason: 'missing_price_id' };

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.userEmail,
      line_items: [{
        price: this.paidPriceId,
        quantity: 1,
      }],
      metadata: {
        userId: input.userId,
        tier: 'paid',
      },
      allow_promotion_codes: true,
    });

    if (!session.url) return { ok: false, reason: 'missing_checkout_url' };
    return { ok: true, url: session.url };
  }

  verifyWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
    if (!this.stripe || !this.webhookSecret || !signature) return null;

    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      return null;
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const eventObject = event.data.object as { metadata?: Record<string, unknown> };

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const rawUserId = session.metadata?.userId ?? null;
      const userId = normalizeUserId(rawUserId);

      const inserted = await recordDbPaymentWebhookEvent(
        'stripe',
        event.id,
        event.type,
        userId,
        session.subscription ? String(session.subscription) : null,
        {
          checkoutSessionId: session.id,
          subscriptionId: session.subscription ? String(session.subscription) : null,
          customerId: session.customer ? String(session.customer) : null,
        },
      );
      if (!inserted) return;

      await upsertDbMembershipTier(
        userId,
        'paid',
        'stripe',
        session.subscription ? String(session.subscription) : session.id,
      );
      return;
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const rawUserId = sub.metadata?.userId ?? null;
      const userId = normalizeUserId(rawUserId || String(sub.customer ?? 'guest'));

      const inserted = await recordDbPaymentWebhookEvent(
        'stripe',
        event.id,
        event.type,
        userId,
        sub.id,
        {
          subscriptionId: sub.id,
          customerId: sub.customer ? String(sub.customer) : null,
          status: sub.status,
        },
      );
      if (!inserted) return;

      await upsertDbMembershipTier(userId, 'free', 'stripe', sub.id);
      return;
    }

    // Record unhandled Stripe events for observability, idempotently.
    const rawUserId = typeof eventObject?.metadata === 'object' && eventObject.metadata && !Array.isArray(eventObject.metadata)
      ? String((eventObject.metadata as Record<string, unknown>).userId ?? '')
      : '';

    await recordDbPaymentWebhookEvent(
      'stripe',
      event.id,
      event.type,
      rawUserId ? normalizeUserId(rawUserId) : null,
      null,
      { noted: true },
    );
  }
}
