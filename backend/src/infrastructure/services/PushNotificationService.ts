/**
 * Push Notification Service
 *
 * Sends web push notifications via the Web Push protocol.
 *
 * @module infrastructure/services/PushNotificationService
 */

import webpush from 'web-push';
import { prisma } from '../database/prisma/client.js';
import { logger } from '../../shared/logger/index.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails('mailto:support@intellmatch.com', vapidPublicKey, vapidPrivateKey);
}

export class PushNotificationService {
  static getVapidPublicKey(): string {
    return vapidPublicKey;
  }

  static async sendPush(userId: string, title: string, body: string, data?: any): Promise<void> {
    if (!vapidPublicKey || !vapidPrivateKey) return;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, data })
        );
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        logger.error('Push notification failed', { error: error.message, subscriptionId: sub.id });
      }
    }
  }

  static async subscribe(userId: string, endpoint: string, p256dh: string, auth: string): Promise<any> {
    // Upsert by endpoint
    const existing = await prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    if (existing) {
      return prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth },
      });
    }
    return prisma.pushSubscription.create({
      data: { userId, endpoint, p256dh, auth },
    });
  }

  static async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
}
