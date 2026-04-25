import { Request, Response, NextFunction } from 'express';
import { walletService } from '../../infrastructure/services/WalletService';
import { systemConfigService } from '../../infrastructure/services/SystemConfigService';
import { prisma } from '../../infrastructure/database/prisma/client';
import { logger } from '../../shared/logger/index';
import { getPayTabsService } from '../../infrastructure/external/payment/PayTabsService';
import { config } from '../../config/index';
import { emailService } from '../../infrastructure/services/EmailService';
import { affiliateService } from '../../infrastructure/services/AffiliateService';

export class WalletController {
  async getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const wallet = await walletService.getOrCreateWallet(userId);
      const { transactions } = await walletService.getTransactions(userId, 1, 5);

      // Get costs for display
      const scanCost = await systemConfigService.getNumber('scan_cost', 5);
      const importCost = await systemConfigService.getNumber('contact_upload_cost', 2);
      const collaborationCost = await systemConfigService.getNumber('collaboration_request_cost', 0);

      res.json({
        success: true,
        data: {
          balance: Number(wallet.balance),
          recentTransactions: transactions.map(tx => ({
            ...tx,
            amount: Number(tx.amount),
            balance: Number(tx.balance),
          })),
          costs: { scan: scanCost, import: importCost, collaboration: collaborationCost },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const result = await walletService.getTransactions(userId, page, limit);

      res.json({
        success: true,
        data: {
          ...result,
          transactions: result.transactions.map(tx => ({
            ...tx,
            amount: Number(tx.amount),
            balance: Number(tx.balance),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Purchase a point pack - creates PayTabs checkout and returns redirect URL
   */
  async purchasePointPack(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { packId } = req.body;

      const pack = await prisma.pointPack.findUnique({ where: { id: packId } });
      if (!pack || !pack.isActive) {
        res.status(404).json({ success: false, error: 'Point pack not found' });
        return;
      }

      // Get user details for PayTabs
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true, phone: true },
      });

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const payTabsService = getPayTabsService();
      const isAvailable = await payTabsService.isAvailable();

      if (!isAvailable) {
        // Fallback: direct credit if PayTabs not configured
        const { balance } = await walletService.credit(
          userId,
          pack.points,
          `Purchased: ${pack.name}`,
          packId,
          'PURCHASE',
        );
        logger.info('Point pack purchased (direct - no payment gateway)', { userId, packId, points: pack.points });
        res.json({ success: true, data: { balance, pointsAdded: pack.points } });
        return;
      }

      // Create unique cart ID
      const cartId = `PTS-${userId.slice(0, 8)}-${Date.now()}`;
      const amount = Number(pack.price);

      // Create PayTabs payment
      const payload = {
        profile_id: (payTabsService as any).profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: cartId,
        cart_currency: pack.currency || 'USD',
        cart_amount: amount.toFixed(2),
        cart_description: `IntellMatch Points - ${pack.name} (${pack.points} points)`,
        return: `${config.app.clientUrl}/wallet?payment=success&cart_id=${cartId}`,
        callback: `${config.app.url}/api/v1/wallet/purchase/callback`,
        customer_details: {
          name: user.fullName,
          email: user.email,
          phone: user.phone || '',
          street1: 'N/A',
          city: 'N/A',
          state: 'N/A',
          country: 'SA',
          zip: '00000',
        },
        hide_shipping: true,
      };

      const response = await fetch(`${(payTabsService as any).endpoint}/payment/request`, {
        method: 'POST',
        headers: {
          Authorization: (payTabsService as any).serverKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as { redirect_url?: string; tran_ref?: string; message?: string };

      if (!response.ok || !data.redirect_url) {
        logger.error('PayTabs point pack payment creation failed', { cartId, response: data });
        res.status(500).json({ success: false, error: 'Failed to create payment' });
        return;
      }

      // Store pending purchase
      await prisma.pointPackPurchase.create({
        data: {
          userId,
          packId: pack.id,
          cartId,
          tranRef: data.tran_ref || null,
          amount,
          currency: pack.currency || 'USD',
          points: pack.points,
          status: 'PENDING',
        },
      });

      logger.info('Point pack checkout created', { userId, cartId, packId, points: pack.points, amount });

      res.json({
        success: true,
        data: { redirectUrl: data.redirect_url, cartId },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PayTabs callback for point pack purchases
   */
  async purchaseCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cartId = req.body.cart_id;
      const responseStatus = req.body.payment_result?.response_status || req.body.respone_status;

      logger.info('Point pack payment callback received', { cartId, status: responseStatus });

      // Verify signature
      const payTabsService = getPayTabsService();
      const signature = req.headers['signature'] as string | undefined;
      if (!payTabsService.verifyCallback(req.body, signature)) {
        logger.warn('Invalid point pack callback signature', { cartId });
        res.status(200).json({ success: false, error: 'Invalid signature' });
        return;
      }

      // Find purchase record
      const purchase = await prisma.pointPackPurchase.findUnique({ where: { cartId } });
      if (!purchase) {
        logger.error('Point pack purchase not found', { cartId });
        res.status(200).json({ success: false, error: 'Purchase not found' });
        return;
      }

      // Already processed
      if (purchase.status !== 'PENDING') {
        res.status(200).json({ success: true, alreadyProcessed: true });
        return;
      }

      // Map status
      const statusMap: Record<string, 'APPROVED' | 'DECLINED' | 'CANCELLED' | 'PENDING'> = {
        A: 'APPROVED',
        D: 'DECLINED',
        E: 'DECLINED',
        H: 'PENDING',
        P: 'PENDING',
        V: 'CANCELLED',
      };
      const newStatus = statusMap[responseStatus] || 'DECLINED';

      // Update purchase record
      await prisma.pointPackPurchase.update({
        where: { id: purchase.id },
        data: {
          status: newStatus,
          tranRef: req.body.tran_ref || purchase.tranRef,
          responseCode: req.body.payment_result?.response_code,
          responseMessage: req.body.payment_result?.response_message,
          callbackPayload: req.body,
          paidAt: newStatus === 'APPROVED' ? new Date() : null,
        },
      });

      // If approved, credit wallet
      if (newStatus === 'APPROVED') {
        const pack = await prisma.pointPack.findUnique({ where: { id: purchase.packId } });
        const packName = pack?.name || 'Point Pack';

        await walletService.credit(
          purchase.userId,
          purchase.points,
          `Purchased: ${packName}`,
          purchase.id,
          'PURCHASE',
        );

        logger.info('Point pack purchase approved - wallet credited', {
          userId: purchase.userId,
          points: purchase.points,
          cartId,
        });

        // Track affiliate commission
        try {
          await affiliateService.trackPurchase(purchase.userId, Number(purchase.amount));
        } catch (affErr) {
          logger.error('Failed to track affiliate commission for point pack', {
            userId: purchase.userId,
            error: affErr instanceof Error ? affErr.message : 'Unknown error',
          });
        }

        // Send invoice email
        try {
          const user = await prisma.user.findUnique({
            where: { id: purchase.userId },
            select: { email: true, fullName: true },
          });

          if (user?.email) {
            const invoiceNumber = `INV-PTS-${Date.now()}`;
            const invoiceDate = new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            await emailService.sendInvoiceEmail(user.email, {
              customerName: user.fullName || 'Customer',
              customerEmail: user.email,
              invoiceNumber,
              invoiceDate,
              plan: packName,
              billingInterval: 'one-time',
              amount: Number(purchase.amount),
              currency: purchase.currency,
              transactionRef: req.body.tran_ref || purchase.tranRef || purchase.cartId,
              periodStart: invoiceDate,
              periodEnd: invoiceDate,
            });

            logger.info('Point pack invoice email sent', {
              email: user.email,
              invoiceNumber,
              cartId,
            });
          }
        } catch (emailError) {
          logger.error('Failed to send point pack invoice email', { cartId, error: emailError });
        }
      } else {
        logger.info('Point pack purchase not approved', { cartId, status: newStatus });
      }

      res.status(200).json({ success: true, status: newStatus });
    } catch (error) {
      logger.error('Point pack callback error', { error });
      res.status(200).json({ success: false, error: 'Processing failed' });
    }
  }

  async getPointPacks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const packs = await prisma.pointPack.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      res.json({ success: true, data: packs });
    } catch (error) {
      next(error);
    }
  }
}

export const walletController = new WalletController();
