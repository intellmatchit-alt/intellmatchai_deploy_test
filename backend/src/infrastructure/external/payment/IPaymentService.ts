/**
 * Payment Service Interface
 *
 * Defines the contract for payment gateway integrations.
 */

export interface CreatePaymentRequest {
  userId: string;
  plan: 'PRO' | 'TEAM';
  billingInterval: 'MONTHLY' | 'YEARLY';
  seats?: number;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
}

export interface CreatePaymentResponse {
  paymentId: string;
  redirectUrl: string;
  tranRef: string;
}

export interface PaymentCallbackData {
  tran_ref: string;
  cart_id: string;
  tran_type: string;
  tran_class: string;
  cart_currency: string;
  cart_amount: string;
  cart_description: string;
  respone_status: string; // Note: PayTabs uses 'respone' (typo in their API)
  response_code: string;
  response_message: string;
  acquirer_message?: string;
  payment_result?: {
    response_status: string;
    response_code: string;
    response_message: string;
    acquirer_message?: string;
    cvv_result?: string;
    avs_result?: string;
    transaction_time?: string;
  };
  customer_details?: {
    name: string;
    email: string;
    phone?: string;
    street1?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
}

export interface IPaymentService {
  /**
   * Create a new payment and get redirect URL
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  /**
   * Verify callback data is authentic
   */
  verifyCallback(data: PaymentCallbackData, signature?: string): boolean;

  /**
   * Check if the payment service is available
   */
  isAvailable(): Promise<boolean>;
}
