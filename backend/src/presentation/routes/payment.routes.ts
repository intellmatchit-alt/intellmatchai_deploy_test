/**
 * Payment Routes
 *
 * API endpoints for payment and subscription management.
 */

import { Router } from 'express';
import { paymentController } from '../controllers/PaymentController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createCheckoutSchema,
  paymentCallbackSchema,
  getPaymentSchema,
} from '../validators/payment.validator.js';

export const paymentRoutes = Router();

/**
 * POST /api/v1/payments/checkout
 * Create checkout session and get PayTabs redirect URL
 * Requires authentication
 */
paymentRoutes.post(
  '/checkout',
  authenticate,
  validate(createCheckoutSchema),
  paymentController.createCheckout.bind(paymentController)
);

/**
 * POST /api/v1/payments/callback
 * PayTabs server-to-server callback
 * NO authentication - called directly by PayTabs servers
 */
paymentRoutes.post(
  '/callback',
  validate(paymentCallbackSchema),
  paymentController.handleCallback.bind(paymentController)
);

/**
 * GET /api/v1/payments/subscription
 * Get current user's subscription status
 * Requires authentication
 */
paymentRoutes.get(
  '/subscription',
  authenticate,
  paymentController.getSubscription.bind(paymentController)
);

/**
 * GET /api/v1/payments/history
 * Get user's payment history
 * Requires authentication
 */
paymentRoutes.get(
  '/history',
  authenticate,
  paymentController.getPaymentHistory.bind(paymentController)
);

/**
 * GET /api/v1/payments/:cartId
 * Get payment details by cart ID
 * Requires authentication
 */
paymentRoutes.get(
  '/:cartId',
  authenticate,
  validate(getPaymentSchema),
  paymentController.getPayment.bind(paymentController)
);

export default paymentRoutes;
