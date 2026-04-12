/**
 * PayTabs Payment Gateway Service
 *
 * Integrates with PayTabs API for payment processing.
 * API Documentation: https://site.paytabs.com/en/pt2-documentation/
 */

import crypto from 'crypto';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/logger/index.js';
import {
  IPaymentService,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentCallbackData,
} from './IPaymentService.js';

// PayTabs API response type
interface PayTabsApiResponse {
  tran_ref?: string;
  redirect_url?: string;
  message?: string;
  code?: number;
}

// Pricing configuration (in USD)
const PRICING = {
  PRO: {
    MONTHLY: 28,
    YEARLY: 280,
  },
  TEAM: {
    MONTHLY: 45,
    YEARLY: 450,
  },
};

export class PayTabsService implements IPaymentService {
  private endpoint: string;
  private serverKey: string;
  private profileId: string;
  private currency: string;

  constructor() {
    this.endpoint = config.paytabs.endpoint;
    this.serverKey = config.paytabs.serverKey || '';
    this.profileId = config.paytabs.profileId || '';
    this.currency = config.paytabs.currency;

    if (this.serverKey && this.profileId) {
      logger.info('PayTabs service configured', {
        endpoint: this.endpoint,
        profileId: this.profileId,
        currency: this.currency,
      });
    } else {
      logger.warn('PayTabs service not configured - missing credentials');
    }
  }

  /**
   * Check if PayTabs service is available
   */
  async isAvailable(): Promise<boolean> {
    return !!(this.serverKey && this.profileId && config.features.paytabs);
  }

  /**
   * Create a payment and get PayTabs redirect URL
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const {
      userId,
      plan,
      billingInterval,
      seats = 1,
      customerEmail,
      customerName,
      customerPhone,
    } = request;

    // Calculate amount based on plan and billing interval
    let amount: number;
    if (plan === 'TEAM') {
      amount = PRICING.TEAM[billingInterval] * seats;
    } else {
      amount = PRICING.PRO[billingInterval];
    }

    // Generate unique cart ID (payment ID)
    const cartId = `PAY-${userId.slice(0, 8)}-${Date.now()}`;

    // Build description
    const intervalLabel = billingInterval === 'MONTHLY' ? 'Monthly' : 'Yearly';
    const description =
      plan === 'TEAM'
        ? `IntellMatch ${plan} Plan - ${intervalLabel} (${seats} seats)`
        : `IntellMatch ${plan} Plan - ${intervalLabel}`;

    // Prepare PayTabs request payload
    const payload = {
      profile_id: this.profileId,
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: cartId,
      cart_currency: this.currency,
      cart_amount: amount.toFixed(2),
      cart_description: description,
      return: `${config.app.clientUrl}/checkout/success?cart_id=${cartId}`,
      callback: `${config.app.url}/api/v1/payments/callback`,
      customer_details: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone || '',
        street1: 'N/A',
        city: 'N/A',
        state: 'N/A',
        country: 'JO',
        zip: '00000',
      },
      hide_shipping: true,
    };

    logger.info('Creating PayTabs payment', {
      cartId,
      plan,
      amount,
      billingInterval,
      seats,
      customerEmail,
    });

    try {
      const response = await fetch(`${this.endpoint}/payment/request`, {
        method: 'POST',
        headers: {
          Authorization: this.serverKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: PayTabsApiResponse = await response.json();

      if (!response.ok || !data.redirect_url) {
        logger.error('PayTabs payment creation failed', {
          cartId,
          status: response.status,
          response: data,
        });
        throw new Error(data.message || 'Failed to create payment with PayTabs');
      }

      logger.info('PayTabs payment created successfully', {
        cartId,
        tranRef: data.tran_ref,
        redirectUrl: data.redirect_url,
      });

      return {
        paymentId: cartId,
        redirectUrl: data.redirect_url,
        tranRef: data.tran_ref,
      };
    } catch (error) {
      logger.error('PayTabs API error', { cartId, error });
      throw error;
    }
  }

  /**
   * Verify that callback data is authentic using PayTabs HMAC-SHA256 signature
   * PayTabs signs callbacks with the server key as the HMAC secret
   */
  verifyCallback(data: PaymentCallbackData, signature?: string): boolean {
    // Basic validation - ensure required fields exist
    if (!data.cart_id) {
      logger.warn('Invalid callback data - missing cart_id');
      return false;
    }

    // Check for payment result
    const status = data.payment_result?.response_status || data.respone_status;
    if (!status) {
      logger.warn('Invalid callback data - missing response status');
      return false;
    }

    // Verify HMAC-SHA256 signature (mandatory)
    if (!signature || !this.serverKey) {
      logger.warn('Callback rejected - missing signature or server key', { cartId: data.cart_id });
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.serverKey)
      .update(JSON.stringify(data))
      .digest('hex');

    if (signature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        )) {
      logger.warn('Invalid callback signature - HMAC mismatch', { cartId: data.cart_id });
      return false;
    }

    logger.info('Callback signature verified', { cartId: data.cart_id });

    return true;
  }
}

// Export singleton instance
let payTabsServiceInstance: PayTabsService | null = null;

export function getPayTabsService(): PayTabsService {
  if (!payTabsServiceInstance) {
    payTabsServiceInstance = new PayTabsService();
  }
  return payTabsServiceInstance;
}
