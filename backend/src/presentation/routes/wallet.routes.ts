import { Router } from 'express';
import { walletController } from '../controllers/WalletController.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const walletRoutes = Router();

// PayTabs callback - NO authentication (called by PayTabs servers)
walletRoutes.post('/purchase/callback', walletController.purchaseCallback.bind(walletController));

// All other wallet routes require authentication
walletRoutes.use(authenticate);

walletRoutes.get('/', walletController.getWallet.bind(walletController));
walletRoutes.get('/transactions', walletController.getTransactions.bind(walletController));
walletRoutes.post('/purchase', walletController.purchasePointPack.bind(walletController));
walletRoutes.get('/point-packs', walletController.getPointPacks.bind(walletController));
