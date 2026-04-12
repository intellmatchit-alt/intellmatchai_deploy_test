/**
 * Payment Controller
 *
 * Handles HTTP requests for payment and subscription management.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import {
  CreateCheckoutUseCase,
  ProcessPaymentCallbackUseCase,
  GetSubscriptionUseCase,
} from '../../application/use-cases/payment/index.js';
import { logger } from '../../shared/logger/index.js';
import { AuthenticationError, NotFoundError, ForbiddenError } from '../../shared/errors/index.js';

export class PaymentController {
  private createCheckoutUseCase: CreateCheckoutUseCase;
  private processCallbackUseCase: ProcessPaymentCallbackUseCase;
  private getSubscriptionUseCase: GetSubscriptionUseCase;

  constructor() {
    this.createCheckoutUseCase = new CreateCheckoutUseCase();
    this.processCallbackUseCase = new ProcessPaymentCallbackUseCase();
    this.getSubscriptionUseCase = new GetSubscriptionUseCase();
  }

  /**
   * Create checkout session and get PayTabs redirect URL
   * POST /api/v1/payments/checkout
   */
  async createCheckout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { plan, billingInterval, seats } = req.body;

      const result = await this.createCheckoutUseCase.execute({
        userId: req.user.userId,
        plan,
        billingInterval,
        seats,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle PayTabs server-to-server callback
   * POST /api/v1/payments/callback
   *
   * Note: This endpoint does NOT require authentication
   * It is called directly by PayTabs servers
   */
  async handleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      logger.info('Received PayTabs callback', {
        cartId: req.body.cart_id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const signature = req.headers['signature'] as string | undefined;
      const result = await this.processCallbackUseCase.execute(req.body, signature);

      // PayTabs expects a 200 response to confirm receipt
      res.status(200).json({
        success: true,
        message: 'Callback processed',
        ...result,
      });
    } catch (error) {
      logger.error('Payment callback processing failed', {
        cartId: req.body?.cart_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Still return 200 to prevent PayTabs retries for validation errors
      // Only internal errors should cause retries
      if (
        error instanceof NotFoundError ||
        error instanceof Error
      ) {
        res.status(200).json({
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed',
        });
        return;
      }

      next(error);
    }
  }

  /**
   * Get current user's subscription status
   * GET /api/v1/payments/subscription
   */
  async getSubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const subscription = await this.getSubscriptionUseCase.execute(
        req.user.userId
      );

      res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment details by cart ID
   * GET /api/v1/payments/:cartId
   */
  async getPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { cartId } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { cartId },
        include: {
          subscription: {
            select: {
              userId: true,
              plan: true,
              status: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      // Ensure user owns this payment
      if (payment.subscription.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }

      res.status(200).json({
        success: true,
        data: {
          id: payment.id,
          cartId: payment.cartId,
          tranRef: payment.tranRef,
          status: payment.status,
          amount: Number(payment.amount),
          currency: payment.currency,
          plan: payment.plan,
          billingInterval: payment.billingInterval,
          seats: payment.seats,
          description: payment.description,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
          subscription: {
            plan: payment.subscription.plan,
            status: payment.subscription.status,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's payment history
   * GET /api/v1/payments/history
   */
  async getPaymentHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const payments = await prisma.payment.findMany({
        where: {
          subscription: {
            userId: req.user.userId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          cartId: true,
          tranRef: true,
          status: true,
          amount: true,
          currency: true,
          plan: true,
          billingInterval: true,
          seats: true,
          createdAt: true,
          paidAt: true,
        },
      });

      res.status(200).json({
        success: true,
        data: payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const paymentController = new PaymentController();
