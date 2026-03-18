import { api } from './client.js';

// Billing is opt-in. Keep disabled by default for self-hosted/free setups.
export const billingEnabled = import.meta.env.VITE_ENABLE_BILLING === 'true';

export type MembershipTier = 'free' | 'paid';

export interface EntitlementsResponse {
	membership: MembershipTier;
	maxParticipants: number;
}

export interface CheckoutPayload {
	successUrl?: string;
	cancelUrl?: string;
}

export interface CheckoutResponse {
	ok: boolean;
	url: string;
}

export const usersApi = {
	getEntitlements: () => api.get<EntitlementsResponse>('/me/entitlements'),

	createCheckout: (payload: CheckoutPayload) =>
		api.post<CheckoutResponse>('/payments/checkout', payload),
};
