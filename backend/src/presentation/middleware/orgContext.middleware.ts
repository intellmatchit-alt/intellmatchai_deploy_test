/**
 * Organization Context Middleware
 *
 * Reads X-Organization-Id header and validates membership.
 * Attaches orgContext to request for scoping queries.
 *
 * @module presentation/middleware/orgContext
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client';
import { logger } from '../../shared/logger';

/**
 * Extend Express Request with orgContext
 */
declare global {
  namespace Express {
    interface Request {
      orgContext?: {
        organizationId: string;
        role: string;
        name: string;
      } | null;
    }
  }
}

/**
 * Organization context middleware
 *
 * If X-Organization-Id header is present, validates user membership
 * and attaches org context. If absent, sets orgContext to null (personal mode).
 */
export async function orgContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgId = req.headers['x-organization-id'] as string | undefined;

    if (!orgId) {
      req.orgContext = null;
      return next();
    }

    // Validate org ID format (must be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ORG_ID',
          message: 'Invalid organization ID format',
        },
      });
      return;
    }

    if (!req.user) {
      req.orgContext = null;
      return next();
    }

    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.userId,
        },
      },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!member) {
      res.status(403).json({
        success: false,
        error: {
          code: 'NOT_ORG_MEMBER',
          message: 'You are not a member of this organization',
        },
      });
      return;
    }

    req.orgContext = {
      organizationId: orgId,
      role: member.role,
      name: member.organization.name,
    };

    next();
  } catch (error) {
    logger.error('Org context middleware error', { error });
    next(error);
  }
}
