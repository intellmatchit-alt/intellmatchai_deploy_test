/**
 * Get Subscription Use Case
 *
 * Retrieves the current user's subscription status and payment history.
 * Also handles subscription expiration checks.
 */

import { prisma } from '../../../infrastructure/database/prisma/client';
import { logger } from '../../../shared/logger/index';

export interface SubscriptionResult {
  plan: string;
  status: string;
  billingInterval: string | null;
  seats: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  planConfig?: {
    isFree: boolean;
    hasFreeTrial: boolean;
    freeTrialDays: number;
    paymentRequired: boolean;
    isUpgradable: boolean;
    contactLimit: number;
  } | null;
  payments: Array<{
    id: string;
    cartId: string;
    status: string;
    amount: number;
    currency: string;
    plan: string;
    billingInterval: string;
    createdAt: Date;
    paidAt: Date | null;
  }>;
}

export class GetSubscriptionUseCase {
  private async getPlanConfig(planName: string) {
    const config = await prisma.planConfig.findUnique({
      where: { name: planName },
      select: { isFree: true, hasFreeTrial: true, freeTrialDays: true, paymentRequired: true, isUpgradable: true, contactLimit: true },
    });
    return config || null;
  }

  async execute(userId: string): Promise<SubscriptionResult> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        payments: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            cartId: true,
            status: true,
            amount: true,
            currency: true,
            plan: true,
            billingInterval: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });

    // If no subscription exists, return default free plan
    if (!subscription) {
      return {
        plan: 'FREE',
        status: 'ACTIVE',
        billingInterval: null,
        seats: 1,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndsAt: null,
        cancelAtPeriodEnd: false,
        payments: [],
      };
    }

    // Check if subscription has expired
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < new Date() &&
      subscription.status === 'ACTIVE'
    ) {
      logger.info('Subscription expired, downgrading to FREE', {
        userId,
        subscriptionId: subscription.id,
        expiredAt: subscription.currentPeriodEnd,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'EXPIRED',
          plan: 'FREE',
        },
      });

      return {
        plan: 'FREE',
        status: 'EXPIRED',
        billingInterval: subscription.billingInterval,
        seats: subscription.seats,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        payments: subscription.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      };
    }

    // Check if trial has expired
    if (
      subscription.trialEndsAt &&
      subscription.trialEndsAt < new Date() &&
      subscription.status === 'TRIALING'
    ) {
      logger.info('Trial expired, setting status to ACTIVE FREE', {
        userId,
        subscriptionId: subscription.id,
        trialEndedAt: subscription.trialEndsAt,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          plan: 'FREE',
        },
      });

      return {
        plan: 'FREE',
        status: 'ACTIVE',
        billingInterval: null,
        seats: 1,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trialEndsAt: subscription.trialEndsAt,
        cancelAtPeriodEnd: false,
        payments: subscription.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      };
    }

    const planConfig = await this.getPlanConfig(subscription.plan);

    return {
      plan: subscription.plan,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      seats: subscription.seats,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      planConfig,
      payments: subscription.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }
}
