/**
 * Process Payment Callback Use Case
 *
 * Handles PayTabs server-to-server callback after payment completion.
 * Updates payment status and activates subscription if approved.
 */

import { prisma } from '../../../infrastructure/database/prisma/client';
import {
  getPayTabsService,
  PaymentCallbackData,
} from '../../../infrastructure/external/payment/index';
import { logger } from '../../../shared/logger/index';
import { ValidationError, NotFoundError } from '../../../shared/errors/index';
import { emailService } from '../../../infrastructure/services/EmailService';
import { walletService } from '../../../infrastructure/services/WalletService';
import { affiliateService } from '../../../infrastructure/services/AffiliateService';

export interface ProcessCallbackResult {
  success: boolean;
  status: string;
  alreadyProcessed?: boolean;
  subscriptionActivated?: boolean;
}

export class ProcessPaymentCallbackUseCase {
  async execute(data: PaymentCallbackData, signature?: string): Promise<ProcessCallbackResult> {
    const cartId = data.cart_id;
    const responseStatus =
      data.payment_result?.response_status || data.respone_status;

    logger.info('Processing payment callback', {
      cartId,
      status: responseStatus,
      tranRef: data.tran_ref,
    });

    // Verify callback authenticity (pass signature for HMAC verification)
    const payTabsService = getPayTabsService();
    if (!payTabsService.verifyCallback(data, signature)) {
      logger.warn('Invalid callback signature', { cartId });
      throw new ValidationError('Invalid callback data');
    }

    // Find the payment record
    const payment = await prisma.payment.findUnique({
      where: { cartId },
      include: {
        subscription: {
          select: {
            id: true,
            userId: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      logger.error('Payment not found for callback', { cartId });
      throw new NotFoundError('Payment not found');
    }

    // Validate callback amount matches expected payment amount
    if (data.cart_amount) {
      const callbackAmount = parseFloat(data.cart_amount);
      const expectedAmount = Number(payment.amount);
      if (Math.abs(callbackAmount - expectedAmount) > 0.01) {
        logger.error('Payment amount mismatch in callback', {
          cartId,
          callbackAmount,
          expectedAmount,
        });
        throw new ValidationError('Payment amount mismatch');
      }
    }

    // Idempotency check - if already processed, skip
    if (payment.status !== 'PENDING') {
      logger.info('Payment already processed', {
        cartId,
        currentStatus: payment.status,
      });
      return {
        success: true,
        status: payment.status,
        alreadyProcessed: true,
      };
    }

    // Map PayTabs status to our status
    // A = Approved, D = Declined, E = Error, H = Hold, P = Pending, V = Voided
    const statusMap: Record<string, 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'PENDING'> = {
      A: 'APPROVED',
      D: 'DECLINED',
      E: 'DECLINED', // Error
      H: 'PENDING', // Hold
      P: 'PENDING', // Pending
      V: 'CANCELLED', // Voided
    };
    const newStatus = statusMap[responseStatus] || 'DECLINED';

    // Update payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        tranRef: data.tran_ref || payment.tranRef,
        responseCode: data.payment_result?.response_code || data.response_code,
        responseMessage:
          data.payment_result?.response_message || data.response_message,
        callbackPayload: data as any,
        paidAt: newStatus === 'APPROVED' ? new Date() : null,
      },
    });

    logger.info('Payment status updated', {
      cartId,
      previousStatus: 'PENDING',
      newStatus,
    });

    // If approved, activate subscription
    if (newStatus === 'APPROVED') {
      const periodStart = new Date();
      const periodEnd = new Date();

      if (payment.billingInterval === 'MONTHLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          plan: payment.plan,
          status: 'ACTIVE',
          billingInterval: payment.billingInterval,
          seats: payment.seats,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null, // Clear trial
        },
      });

      logger.info('Subscription activated', {
        userId: payment.subscription.userId,
        subscriptionId: payment.subscriptionId,
        plan: payment.plan,
        billingInterval: payment.billingInterval,
        periodStart,
        periodEnd,
      });

      // Credit wallet with plan points
      try {
        const planConfig = await prisma.planConfig.findUnique({
          where: { name: payment.plan },
        });
        if (planConfig && planConfig.pointsAllocation > 0) {
          await walletService.credit(
            payment.subscription.userId,
            planConfig.pointsAllocation,
            `Plan subscription: ${planConfig.displayName}`,
            payment.subscriptionId,
            'SUBSCRIPTION',
          );
          logger.info('Wallet credited for subscription', {
            userId: payment.subscription.userId,
            points: planConfig.pointsAllocation,
            plan: payment.plan,
          });
        }
      } catch (walletError) {
        logger.error('Failed to credit wallet for subscription', {
          userId: payment.subscription.userId,
          error: walletError,
        });
      }

      // Auto-create organization for TEAM plan
      if (payment.plan === 'TEAM') {
        await this.autoCreateOrganization(
          payment.subscription.userId,
          payment.subscriptionId
        );
      }

      // Track affiliate commission if user was referred
      try {
        const purchaseAmount = Number(payment.amount);
        await affiliateService.trackPurchase(payment.subscription.userId, purchaseAmount);
      } catch (affErr) {
        logger.error('Failed to track affiliate commission', {
          userId: payment.subscription.userId,
          error: affErr instanceof Error ? affErr.message : 'Unknown error',
        });
      }

      // Send confirmation and invoice emails
      await this.sendPaymentEmails(payment, periodStart, periodEnd);

      return {
        success: true,
        status: newStatus,
        subscriptionActivated: true,
      };
    }

    return {
      success: true,
      status: newStatus,
      subscriptionActivated: false,
    };
  }

  /**
   * Auto-create organization when TEAM plan is activated
   */
  private async autoCreateOrganization(
    userId: string,
    subscriptionId: string
  ): Promise<void> {
    try {
      // Check if org already exists for this subscription
      const existingOrg = await prisma.organization.findUnique({
        where: { subscriptionId },
      });

      if (existingOrg) {
        logger.info('Organization already exists for subscription', { subscriptionId });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, company: true },
      });

      const orgName = user?.company || `${user?.fullName || 'My'}'s Team`;
      const baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      await prisma.organization.create({
        data: {
          name: orgName,
          slug,
          subscriptionId,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });

      logger.info('Organization auto-created for TEAM plan', {
        userId,
        subscriptionId,
        orgName,
      });
    } catch (error) {
      logger.error('Failed to auto-create organization', {
        userId,
        subscriptionId,
        error,
      });
    }
  }

  /**
   * Send payment confirmation, invoice, and admin notification emails
   */
  private async sendPaymentEmails(
    payment: {
      id: string;
      customerName: string;
      customerEmail: string;
      plan: string;
      billingInterval: string;
      amount: any;
      currency: string;
      seats: number;
      tranRef: string | null;
      paidAt: Date | null;
      subscription: {
        id: string;
        userId: string;
      };
    },
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const paymentDate = payment.paidAt ? formatDate(payment.paidAt) : formatDate(new Date());
    const invoiceNumber = `INV-${payment.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    try {
      // 1. Send payment confirmation email to customer
      await emailService.sendPaymentConfirmationEmail(payment.customerEmail, {
        customerName: payment.customerName,
        plan: payment.plan,
        billingInterval: payment.billingInterval,
        amount: Number(payment.amount),
        currency: payment.currency,
        seats: payment.seats > 1 ? payment.seats : undefined,
        transactionRef: payment.tranRef || payment.id,
        paymentDate,
        periodStart: formatDate(periodStart),
        periodEnd: formatDate(periodEnd),
        dashboardUrl: `${process.env.FRONTEND_URL || 'https://intellmatch.com'}/dashboard`,
      });

      logger.info('Payment confirmation email sent', {
        email: payment.customerEmail,
        paymentId: payment.id,
      });

      // 2. Send invoice email to customer
      await emailService.sendInvoiceEmail(payment.customerEmail, {
        customerName: payment.customerName,
        customerEmail: payment.customerEmail,
        invoiceNumber,
        invoiceDate: paymentDate,
        plan: payment.plan,
        billingInterval: payment.billingInterval,
        amount: Number(payment.amount),
        currency: payment.currency,
        seats: payment.seats > 1 ? payment.seats : undefined,
        transactionRef: payment.tranRef || payment.id,
        periodStart: formatDate(periodStart),
        periodEnd: formatDate(periodEnd),
      });

      logger.info('Invoice email sent', {
        email: payment.customerEmail,
        invoiceNumber,
      });

      // 3. Send notification to admins
      await emailService.sendPaymentNotificationToAdmin({
        customerName: payment.customerName,
        customerEmail: payment.customerEmail,
        plan: payment.plan,
        billingInterval: payment.billingInterval,
        amount: Number(payment.amount),
        currency: payment.currency,
        seats: payment.seats > 1 ? payment.seats : undefined,
        transactionRef: payment.tranRef || payment.id,
        paymentDate,
      });

      logger.info('Admin payment notification sent', {
        paymentId: payment.id,
      });
    } catch (error) {
      // Don't fail the payment callback if email fails
      logger.error('Failed to send payment emails', {
        paymentId: payment.id,
        error,
      });
    }
  }
}
