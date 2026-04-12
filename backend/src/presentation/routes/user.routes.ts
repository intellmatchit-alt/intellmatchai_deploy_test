/**
 * User Routes
 *
 * Routes for user-related operations like searching users.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Stricter rate limit for search/enumeration endpoints
const searchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 searches per 15 minutes
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many search requests' } },
});

/**
 * Search users by name or email
 * GET /api/v1/users/search?q=query&limit=10
 */
router.get('/search', searchRateLimiter, authenticate, async (req, res, next) => {
  try {
    const { q, limit = '10' } = req.query;
    const userId = req.user!.userId;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    const searchTerm = q.trim();
    const maxResults = Math.min(parseInt(limit as string, 10) || 10, 50);

    // Search users by name or company only (not email — prevents enumeration)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Exclude current user
          { isActive: true },
          { status: 'ACTIVE' },
          {
            OR: [
              { fullName: { contains: searchTerm } },
              { company: { contains: searchTerm } },
            ],
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        company: true,
        jobTitle: true,
      },
      take: maxResults,
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check which emails have accounts
 * POST /api/v1/users/check-emails
 * Body: { emails: string[] }
 * Returns: { existingEmails: string[] }
 */
router.post('/check-emails', authenticate, async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.json({
        success: true,
        data: { existingEmails: [] },
      });
      return;
    }

    // Limit to prevent abuse
    const emailsToCheck = emails.slice(0, 500).map((e: string) => e.toLowerCase().trim());

    // Find users with these emails
    const users = await prisma.user.findMany({
      where: {
        email: { in: emailsToCheck },
        isActive: true,
      },
      select: {
        email: true,
      },
    });

    const existingEmails = users.map(u => u.email.toLowerCase());

    res.json({
      success: true,
      data: { existingEmails },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check which phone numbers have accounts
 * POST /api/v1/users/check-phones
 * Body: { phones: string[] }
 * Returns: { "+962791234567": "userId_abc123", ... } — only matching phones included
 */
router.post('/check-phones', authenticate, async (req, res, next) => {
  try {
    const { phones } = req.body;

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      res.json({ success: true, data: {} });
      return;
    }

    // Limit to prevent abuse
    const phonesToCheck = phones.slice(0, 500);

    // Normalize: strip everything except digits and leading +
    const normalize = (p: string) => p.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+');

    const normalized = phonesToCheck.map((p: string) => ({
      original: p,
      clean: normalize(p),
      digitsOnly: normalize(p).replace(/[^0-9]/g, ''),
    }));

    // Fetch all users that have a phone number
    const usersWithPhone = await prisma.user.findMany({
      where: {
        phone: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        phone: true,
        phoneCountryCode: true,
      },
    });

    // Build result map: original phone → userId
    const result: Record<string, string> = {};

    for (const input of normalized) {
      for (const user of usersWithPhone) {
        if (!user.phone) continue;
        const userClean = normalize(user.phone);
        const userDigits = userClean.replace(/[^0-9]/g, '');

        // Match by full normalized, digits-only, or suffix (last 9+ digits)
        if (
          userClean === input.clean ||
          userDigits === input.digitsOnly ||
          (input.digitsOnly.length >= 9 && userDigits.endsWith(input.digitsOnly.slice(-9))) ||
          (userDigits.length >= 9 && input.digitsOnly.endsWith(userDigits.slice(-9)))
        ) {
          result[input.original] = user.id;
          break;
        }
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user by ID (public profile)
 * GET /api/v1/users/:id
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        company: true,
        jobTitle: true,
        bio: true,
        location: true,
        linkedinUrl: true,
        websiteUrl: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

export const userRoutes = router;
export default router;
