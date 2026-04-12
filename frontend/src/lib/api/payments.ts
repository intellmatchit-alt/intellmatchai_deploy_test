/**
 * Payments API Client
 *
 * Functions for payment and subscription management.
 */

import { api } from './client';

// Request types
export interface CreateCheckoutRequest {
  plan: 'PRO' | 'TEAM';
  billingInterval: 'MONTHLY' | 'YEARLY';
  seats?: number;
}

// Response types
export interface CheckoutResponse {
  redirectUrl: string;
  paymentId: string;
}

export interface Subscription {
  plan: 'FREE' | 'PRO' | 'TEAM';
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE' | 'TRIALING';
  billingInterval: 'MONTHLY' | 'YEARLY' | null;
  seats: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  payments: Payment[];
}

export interface Payment {
  id: string;
  cartId: string;
  tranRef?: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';
  amount: number;
  currency: string;
  plan: 'PRO' | 'TEAM';
  billingInterval: 'MONTHLY' | 'YEARLY';
  seats: number;
  description?: string;
  createdAt: string;
  paidAt: string | null;
  subscription?: {
    plan: string;
    status: string;
  };
}

/**
 * Create a checkout session and get PayTabs redirect URL
 */
export async function createCheckout(
  data: CreateCheckoutRequest
): Promise<CheckoutResponse> {
  return api.post<CheckoutResponse>('/payments/checkout', data);
}

/**
 * Get current user's subscription status
 */
export async function getSubscription(): Promise<Subscription> {
  return api.get<Subscription>('/payments/subscription');
}

/**
 * Get payment details by cart ID
 */
export async function getPayment(cartId: string): Promise<Payment> {
  return api.get<Payment>(`/payments/${cartId}`);
}

/**
 * Get user's payment history
 */
export async function getPaymentHistory(): Promise<Payment[]> {
  return api.get<Payment[]>('/payments/history');
}

// Export all functions as a namespace
export const paymentsApi = {
  createCheckout,
  getSubscription,
  getPayment,
  getPaymentHistory,
};
