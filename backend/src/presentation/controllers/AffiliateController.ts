import { Request, Response, NextFunction } from 'express';
import { affiliateService } from '../../infrastructure/services/AffiliateService.js';

class AffiliateController {
  /**
   * GET /affiliate/terms — Public: get terms & policy content
   */
  async getTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await affiliateService.getSettings();
      res.json({
        success: true,
        data: {
          termsContent: settings.termsContent,
          policyContent: settings.policyContent,
          enabled: settings.enabled,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /affiliate/validate/:code — Public: validate a referral code
   */
  async validateCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params;
      const result = await affiliateService.validateCode(code);
      if (!result) {
        res.json({ success: true, data: { valid: false } });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /affiliate/apply — Apply to become affiliate
   */
  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.applyAsAffiliate(userId);
      res.status(201).json({ success: true, data: affiliate });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /affiliate/me — Get my affiliate profile
   */
  async getMyAffiliate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.json({ success: true, data: null });
        return;
      }
      const settings = await affiliateService.getSettings();
      res.json({
        success: true,
        data: {
          ...affiliate,
          settings: {
            commissionPercentage: settings.commissionPercentage,
            maxDiscountPercentage: settings.maxDiscountPercentage,
            minDiscountPercentage: settings.minDiscountPercentage,
            paymentMode: settings.paymentMode,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /affiliate/codes — Create a referral code
   */
  async createCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { code, discountPercent, name } = req.body;

      if (!code || typeof discountPercent !== 'number') {
        res.status(400).json({ success: false, error: 'Code and discountPercent are required' });
        return;
      }

      // Validate code format
      if (!/^[A-Za-z0-9_-]{3,30}$/.test(code)) {
        res.status(400).json({ success: false, error: 'Code must be 3-30 alphanumeric characters' });
        return;
      }

      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate || affiliate.status !== 'APPROVED') {
        res.status(403).json({ success: false, error: 'Affiliate account is not active' });
        return;
      }

      const created = await affiliateService.createCode(affiliate.id, code, discountPercent, name);
      res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      if (error.message?.includes('already taken') || error.message?.includes('must be between')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /affiliate/codes — List my codes
   */
  async getCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.json({ success: true, data: [] });
        return;
      }
      const codes = await affiliateService.getCodes(affiliate.id);
      res.json({ success: true, data: codes });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /affiliate/codes/:id/status — Pause/resume a code
   */
  async updateCodeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { status } = req.body;

      if (!['ACTIVE', 'PAUSED'].includes(status)) {
        res.status(400).json({ success: false, error: 'Status must be ACTIVE or PAUSED' });
        return;
      }

      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.status(404).json({ success: false, error: 'Affiliate not found' });
        return;
      }

      const updated = await affiliateService.updateCodeStatus(affiliate.id, id, status);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error.message === 'Code not found') {
        res.status(404).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /affiliate/referrals — List my referrals
   */
  async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.json({ success: true, data: { referrals: [], total: 0, page: 1, totalPages: 0 } });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const codeId = req.query.codeId as string | undefined;

      const result = await affiliateService.getReferrals(affiliate.id, codeId, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /affiliate/stats — Dashboard stats
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.status(404).json({ success: false, error: 'Affiliate not found' });
        return;
      }
      const stats = await affiliateService.getStats(affiliate.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /affiliate/payouts — Payout history
   */
  async getPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.json({ success: true, data: { payouts: [], total: 0, page: 1, totalPages: 0 } });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await affiliateService.getPayouts(affiliate.id, page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /affiliate/payouts — Request a payout
   */
  async requestPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const affiliate = await affiliateService.getAffiliateByUserId(userId);
      if (!affiliate) {
        res.status(404).json({ success: false, error: 'Affiliate not found' });
        return;
      }

      const payout = await affiliateService.requestPayout(affiliate.id);
      res.status(201).json({ success: true, data: payout });
    } catch (error: any) {
      if (error.message?.includes('No') && error.message?.includes('balance')) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }
}

export const affiliateController = new AffiliateController();
