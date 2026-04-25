import { prisma } from '../../infrastructure/database/prisma/client';

export async function getContactLimitForUser(userId: string): Promise<{ limit: number; current: number; remaining: number }> {
  // Get user's subscription
  const subscription = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } });
  const planName = subscription?.plan || 'FREE';

  // Get plan config
  const planConfig = await prisma.planConfig.findUnique({ where: { name: planName }, select: { contactLimit: true } });
  const limit = planConfig?.contactLimit ?? 100; // default 100

  // Count current contacts
  const current = await prisma.contact.count({ where: { ownerId: userId } });

  return { limit, current, remaining: Math.max(0, limit - current) };
}
