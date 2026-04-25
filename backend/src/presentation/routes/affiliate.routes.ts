import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { affiliateController } from '../controllers/AffiliateController';

export const affiliateRoutes = Router();

// Public endpoints (no auth)
affiliateRoutes.get('/terms', affiliateController.getTerms.bind(affiliateController));
affiliateRoutes.get('/validate/:code', affiliateController.validateCode.bind(affiliateController));

// Authenticated endpoints
affiliateRoutes.use(authenticate);
affiliateRoutes.post('/apply', affiliateController.apply.bind(affiliateController));
affiliateRoutes.get('/me', affiliateController.getMyAffiliate.bind(affiliateController));
affiliateRoutes.post('/codes', affiliateController.createCode.bind(affiliateController));
affiliateRoutes.get('/codes', affiliateController.getCodes.bind(affiliateController));
affiliateRoutes.patch('/codes/:id/status', affiliateController.updateCodeStatus.bind(affiliateController));
affiliateRoutes.get('/referrals', affiliateController.getReferrals.bind(affiliateController));
affiliateRoutes.get('/stats', affiliateController.getStats.bind(affiliateController));
affiliateRoutes.get('/payouts', affiliateController.getPayouts.bind(affiliateController));
affiliateRoutes.post('/payouts', affiliateController.requestPayout.bind(affiliateController));
