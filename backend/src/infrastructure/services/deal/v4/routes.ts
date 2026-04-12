/**
 * Deal Matching Routes
 * v4.0.0 — strict final production
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DealMatchingController, dealMatchingController } from './controller';

export function createDealMatchingRouter(controller: DealMatchingController = dealMatchingController): Router {
  const router = Router();

  router.post('/find-matches', wrap((r, s, n) => controller.findMatches(r, s, n)));
  router.post('/find-buyers', wrap((r, s, n) => controller.findBuyers(r, s, n)));
  router.post('/calculate-match', wrap((r, s, n) => controller.calculateMatch(r, s, n)));
  router.post('/extract-buy-request', wrap((r, s, n) => controller.extractBuyRequest(r, s, n)));
  router.post('/extract-sell-offering', wrap((r, s, n) => controller.extractSellOffering(r, s, n)));
  router.post('/detect-type', wrap((r, s, n) => controller.detectDocumentType(r, s, n)));
  router.post('/buy-request', wrap((r, s, n) => controller.createBuyRequest(r, s, n)));
  router.patch('/buy-request/:id', wrap((r, s, n) => controller.updateBuyRequest(r, s, n)));
  router.post('/sell-offering', wrap((r, s, n) => controller.createSellOffering(r, s, n)));
  router.patch('/sell-offering/:id', wrap((r, s, n) => controller.updateSellOffering(r, s, n)));
  router.get('/enums', wrap((r, s, n) => controller.getEnums(r, s, n)));
  router.get('/health', (r, s) => controller.healthCheck(r, s));

  return router;
}

function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };
}

export const dealMatchingRouter = createDealMatchingRouter();
