/**
 * Notification Controller
 *
 * Manages user notifications: list, read status, delete.
 *
 * @module presentation/controllers/NotificationController
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { AuthenticationError } from "../../shared/errors/index.js";
import { logger } from "../../shared/logger/index.js";

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * List notifications for the authenticated user
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const {
        page = "1",
        limit = "20",
        unreadOnly,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { userId: req.user.userId };
      if (unreadOnly === "true") {
        where.isRead = false;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Get count of unread notifications
   */
  async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const count = await prisma.notification.count({
        where: { userId: req.user.userId, isRead: false },
      });

      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read
   */
  async markRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const notification = await prisma.notification.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Notification not found" },
        });
        return;
      }

      const updated = await prisma.notification.update({
        where: { id: String(req.params.id) },
        data: { isRead: true },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all notifications as read
   */
  async markAllRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const result = await prisma.notification.updateMany({
        where: { userId: req.user.userId, isRead: false },
        data: { isRead: true },
      });

      logger.info("All notifications marked read", {
        userId: req.user.userId,
        count: result.count,
      });

      res.status(200).json({ success: true, data: { count: result.count } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   * Delete a notification
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const notification = await prisma.notification.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Notification not found" },
        });
        return;
      }

      await prisma.notification.delete({
        where: { id: String(req.params.id) },
      });

      res.status(200).json({ success: true, message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  }
  /**
   * POST /api/v1/notifications/push/subscribe
   * Save a push subscription
   */
  async pushSubscribe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "endpoint and keys (p256dh, auth) are required",
          },
        });
        return;
      }

      const { PushNotificationService } =
        await import("../../infrastructure/services/PushNotificationService.js");
      const subscription = await PushNotificationService.subscribe(
        req.user.userId,
        endpoint,
        keys.p256dh,
        keys.auth,
      );

      res.status(201).json({ success: true, data: subscription });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/notifications/push/unsubscribe
   * Remove a push subscription
   */
  async pushUnsubscribe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { endpoint } = req.body;
      if (!endpoint) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "endpoint is required" },
        });
        return;
      }

      const { PushNotificationService } =
        await import("../../infrastructure/services/PushNotificationService.js");
      await PushNotificationService.unsubscribe(req.user.userId, endpoint);

      res.status(200).json({ success: true, message: "Unsubscribed" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/push/vapid-key
   * Get the VAPID public key
   */
  async getVapidKey(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { PushNotificationService } =
        await import("../../infrastructure/services/PushNotificationService.js");
      const key = PushNotificationService.getVapidPublicKey();
      res.status(200).json({ success: true, data: { key } });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
export default notificationController;
