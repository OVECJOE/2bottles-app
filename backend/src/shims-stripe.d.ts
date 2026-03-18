declare module 'stripe' {
  namespace Stripe {
    interface Event {
      id: string;
      type: string;
      data: {
        object: any;
      };
    }

    namespace Checkout {
      interface Session {
        id: string;
        url?: string | null;
        subscription?: string | null;
        customer?: string | null;
        metadata?: Record<string, string>;
      }
    }

    interface Subscription {
      id: string;
      customer?: string | null;
      status?: string;
      metadata?: Record<string, string>;
    }
  }

  class Stripe {
    constructor(secretKey: string, options?: { apiVersion?: string });

    checkout: {
      sessions: {
        create(input: {
          mode: 'subscription' | 'payment';
          success_url: string;
          cancel_url: string;
          customer_email?: string;
          line_items: Array<{ price: string; quantity: number }>;
          metadata?: Record<string, string>;
          allow_promotion_codes?: boolean;
        }): Promise<Stripe.Checkout.Session>;
      };
    };

    webhooks: {
      constructEvent(payload: string, signature: string, secret: string): Stripe.Event;
    };
  }

  export default Stripe;
}
