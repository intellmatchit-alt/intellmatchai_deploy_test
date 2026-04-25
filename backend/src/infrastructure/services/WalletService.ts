import { prisma } from '../database/prisma/client';
import { InsufficientPointsError } from '../../shared/errors/InsufficientPointsError';
import { logger } from '../../shared/logger/index';
import { Decimal } from '@prisma/client/runtime/library';

const LOW_BALANCE_THRESHOLD = 10;

/** Convert Prisma Decimal to number */
function toNum(val: Decimal | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

class WalletService {
  async getOrCreateWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      // Find user's current plan to determine welcome points
      let welcomePoints = 0;
      const subscription = await prisma.subscription.findUnique({ where: { userId } });
      if (subscription) {
        const planConfig = await prisma.planConfig.findUnique({
          where: { name: subscription.plan },
        });
        if (planConfig) {
          welcomePoints = planConfig.pointsAllocation;
        }
      }

      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: welcomePoints,
        },
      });

      // Log welcome bonus transaction if points > 0
      if (welcomePoints > 0) {
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: welcomePoints,
            balance: welcomePoints,
            description: 'Welcome bonus - plan activation',
            referenceType: 'SUBSCRIPTION',
          },
        });

        this.createNotification(
          userId,
          'wallet_credit',
          'Welcome Points',
          `You received ${welcomePoints} points as a welcome bonus!`,
          { amount: welcomePoints, balance: welcomePoints, type: 'SUBSCRIPTION' },
        );
      }
    }

    return wallet;
  }

  async credit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string | null,
    referenceType?: string | null,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId, balance: 0 } });
      }

      const currentBalance = toNum(wallet.balance);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount,
          balance: newBalance,
          description,
          referenceId: referenceId || undefined,
          referenceType: referenceType || undefined,
        },
      });

      return { transaction, balance: newBalance };
    });

    // Create notification for credit (async, don't block)
    this.createNotification(
      userId,
      'wallet_credit',
      'Points Received',
      `+${amount} points: ${description}. Balance: ${result.balance}`,
      { amount, balance: result.balance, referenceType, referenceId },
    );

    return result;
  }

  async debit(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string | null,
    referenceType?: string | null,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      // Use SELECT ... FOR UPDATE to prevent race conditions on concurrent debits
      const rows = await tx.$queryRaw<Array<{ id: string; balance: any }>>`
        SELECT id, balance FROM wallets WHERE user_id = ${userId} FOR UPDATE
      `;
      let wallet = rows[0];
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId, balance: 0 } });
      }

      const currentBalance = toNum(wallet.balance);

      if (currentBalance < amount) {
        throw new InsufficientPointsError(amount, currentBalance);
      }

      const newBalance = Math.round((currentBalance - amount) * 100) / 100;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: -amount,
          balance: newBalance,
          description,
          referenceId: referenceId || undefined,
          referenceType: referenceType || undefined,
        },
      });

      return { transaction, balance: newBalance };
    });

    // Create notification for debit (async, don't block)
    this.createNotification(
      userId,
      'wallet_debit',
      'Points Used',
      `-${amount} points: ${description}. Balance: ${result.balance}`,
      { amount, balance: result.balance, referenceType, referenceId },
    );

    // Low balance warning
    if (result.balance <= LOW_BALANCE_THRESHOLD && result.balance >= 0) {
      this.createNotification(
        userId,
        'wallet_low_balance',
        'Low Points Balance',
        `Your points balance is low (${result.balance}). Consider purchasing more points.`,
        { balance: result.balance },
      );
    }

    return result;
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return toNum(wallet.balance);
  }

  async getTransactions(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await this.getOrCreateWallet(userId);

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a notification for wallet events (fire-and-forget with retry)
   */
  private createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
    retries: number = 2,
  ) {
    prisma.notification.create({
      data: { userId, type, title, message, data: data || undefined },
    }).catch((err) => {
      if (retries > 0) {
        setTimeout(() => this.createNotification(userId, type, title, message, data, retries - 1), 1000);
      } else {
        logger.error('Failed to create wallet notification after retries', { userId, type, error: err });
      }
    });
  }
}

export const walletService = new WalletService();
