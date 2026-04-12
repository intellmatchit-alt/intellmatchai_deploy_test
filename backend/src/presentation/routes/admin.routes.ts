import { Router } from 'express';
import { adminController } from '../controllers/AdminController.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireAdmin);

// Dashboard
adminRoutes.get('/dashboard', adminController.getDashboard.bind(adminController));

// Plans
adminRoutes.get('/plans', adminController.getPlans.bind(adminController));
adminRoutes.post('/plans', adminController.createPlan.bind(adminController));
adminRoutes.patch('/plans/:id', adminController.updatePlan.bind(adminController));
adminRoutes.delete('/plans/:id', adminController.deletePlan.bind(adminController));

// System Config
adminRoutes.get('/config', adminController.getConfig.bind(adminController));
adminRoutes.patch('/config', adminController.updateConfig.bind(adminController));

// Users
adminRoutes.get('/users', adminController.getUsers.bind(adminController));
adminRoutes.get('/users/:id', adminController.getUser.bind(adminController));
adminRoutes.post('/users/:id/wallet', adminController.adjustUserWallet.bind(adminController));

// Point Packs
adminRoutes.get('/point-packs', adminController.getPointPacks.bind(adminController));
adminRoutes.post('/point-packs', adminController.createPointPack.bind(adminController));
adminRoutes.patch('/point-packs/:id', adminController.updatePointPack.bind(adminController));
adminRoutes.delete('/point-packs/:id', adminController.deletePointPack.bind(adminController));
