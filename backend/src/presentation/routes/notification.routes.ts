/**
 * Notification Routes
 *
 * CRUD for user notifications.
 *
 * @module presentation/routes/notification
 */

import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';
import { authenticate } from '../middleware/auth.middleware';

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);

// Unread count (must be before :id routes)
notificationRoutes.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// Mark all read (must be before :id routes)
notificationRoutes.patch('/read-all', notificationController.markAllRead.bind(notificationController));

// List notifications
notificationRoutes.get('/', notificationController.list.bind(notificationController));

// Mark single as read
notificationRoutes.patch('/:id/read', notificationController.markRead.bind(notificationController));

// Delete notification
notificationRoutes.delete('/:id', notificationController.delete.bind(notificationController));

// Push notification subscription
notificationRoutes.post('/push/subscribe', notificationController.pushSubscribe.bind(notificationController));
notificationRoutes.delete('/push/unsubscribe', notificationController.pushUnsubscribe.bind(notificationController));
notificationRoutes.get('/push/vapid-key', notificationController.getVapidKey.bind(notificationController));

export default notificationRoutes;
