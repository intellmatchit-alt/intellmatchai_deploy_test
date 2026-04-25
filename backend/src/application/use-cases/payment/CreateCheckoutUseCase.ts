/**
 * Create Checkout Use Case
 *
 * Creates a payment checkout session with PayTabs and returns the redirect URL.
 */

import { prisma } from '../../../infrastructure/database/prisma/client';
import { getPayTabsService } from '../../../infrastructure/external/payment/PayTabsService';
import { logger } from '../../../shared/logger/index';
import { ValidationError, NotFoundError } from '../../../shared/errors/index';


export interface CreateCheckoutDTO {
  userId: string;
  plan: 'PRO' | 'TEAM';
  billingInterval: 'MONTHLY' | 'YEARLY';
  seats?: number;
}

export interface CreateCheckoutResult {
  redirectUrl: string;
  paymentId: string;
}

export class CreateCheckoutUseCase {
  async execute(dto: CreateCheckoutDTO): Promise<CreateCheckoutResult> {
    const { userId, plan, billingInterval, seats: requestedSeats } = dto;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check for existing active subscription (not FREE)
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (
      existingSubscription?.status === 'ACTIVE' &&
      existingSubscription.plan !== 'FREE'
    ) {
      throw new ValidationError(
        'User already has an active paid subscription. Please cancel it first or contact support for upgrade.'
      );
    }

    // Create or get subscription record
    let subscription = existingSubscription;
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          plan: 'FREE',
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });
    }

    // Look up dynamic plan config from DB — must exist
    const planConfig = await prisma.planConfig.findUnique({ where: { name: plan } });
    if (!planConfig) {
      throw new ValidationError(`Plan "${plan}" is not configured. Please contact support.`);
    }

    // Validate TEAM plan seats
    let seats = 1;
    const minSeats = planConfig.minSeats || 3;
    if (plan === 'TEAM') {
      seats = requestedSeats || minSeats;
      if (seats < minSeats) {
        throw new ValidationError(`TEAM plan requires at least ${minSeats} seats`);
      }
    }

    // Get PayTabs service and create payment
    const payTabsService = getPayTabsService();

    const paymentResponse = await payTabsService.createPayment({
      userId,
      plan,
      billingInterval,
      seats,
      customerEmail: user.email,
      customerName: user.fullName,
      customerPhone: user.phone || undefined,
    });

    // Calculate amount from DB config
    const unitPrice = Number(billingInterval === 'MONTHLY' ? planConfig.monthlyPrice : planConfig.yearlyPrice);
    if (unitPrice <= 0) {
      throw new ValidationError(`Plan "${plan}" has no pricing configured for ${billingInterval}`);
    }
    const amount = plan === 'TEAM' ? unitPrice * seats : unitPrice;

    // Create pending payment record
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        cartId: paymentResponse.paymentId,
        tranRef: paymentResponse.tranRef,
        amount,
        currency: 'USD',
        status: 'PENDING',
        customerEmail: user.email,
        customerName: user.fullName,
        description: plan === 'TEAM'
          ? `IntellMatch ${plan} Plan - ${seats} seats - ${billingInterval}`
          : `IntellMatch ${plan} Plan - ${billingInterval}`,
        billingInterval,
        plan,
        seats,
      },
    });

    logger.info('Checkout created successfully', {
      userId,
      plan,
      billingInterval,
      paymentId: paymentResponse.paymentId,
    });

    return {
      redirectUrl: paymentResponse.redirectUrl,
      paymentId: paymentResponse.paymentId,
    };
  }
}
