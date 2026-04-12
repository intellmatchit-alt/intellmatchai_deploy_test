/**
 * Payment Request Validators
 *
 * Zod schemas for validating payment-related API requests.
 */

import { z } from 'zod';

/**
 * Create checkout session schema
 */
export const createCheckoutSchema = z.object({
  body: z.object({
    plan: z.enum(['PRO', 'TEAM'], {
      errorMap: () => ({ message: 'Plan must be PRO or TEAM' }),
    }),
    billingInterval: z.enum(['MONTHLY', 'YEARLY'], {
      errorMap: () => ({ message: 'Billing interval must be MONTHLY or YEARLY' }),
    }),
    seats: z.number().int().min(1).optional(),
  }),
});

/**
 * PayTabs callback schema
 * Note: PayTabs uses 'respone_status' (typo in their API)
 */
export const paymentCallbackSchema = z.object({
  body: z.object({
    tran_ref: z.string().optional(),
    cart_id: z.string(),
    tran_type: z.string().optional(),
    tran_class: z.string().optional(),
    cart_currency: z.string().optional(),
    cart_amount: z.string().optional(),
    cart_description: z.string().optional(),
    respone_status: z.string().optional(), // PayTabs typo
    response_code: z.string().optional(),
    response_message: z.string().optional(),
    acquirer_message: z.string().optional(),
    payment_result: z
      .object({
        response_status: z.string(),
        response_code: z.string().optional(),
        response_message: z.string().optional(),
        acquirer_message: z.string().optional(),
        cvv_result: z.string().optional(),
        avs_result: z.string().optional(),
        transaction_time: z.string().optional(),
      })
      .optional(),
    customer_details: z
      .object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        street1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zip: z.string().optional(),
      })
      .optional(),
  }),
});

/**
 * Get payment by cart ID schema
 */
export const getPaymentSchema = z.object({
  params: z.object({
    cartId: z.string().min(1, 'Cart ID is required'),
  }),
});

// Export types
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>['body'];
export type PaymentCallbackInput = z.infer<typeof paymentCallbackSchema>['body'];
export type GetPaymentParams = z.infer<typeof getPaymentSchema>['params'];
