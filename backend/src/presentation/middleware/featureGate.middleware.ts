/**
 * Feature Gate Middleware
 *
 * Controls access to features based on subscription plan and organization role.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { AuthenticationError, ForbiddenError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';

// Extend Express Request with subscription and org context
declare global {
  namespace Express {
    interface Request {
      subscription?: {
        plan: string;
        status: string;
        seats: number;
      };
      organization?: {
        id: string;
        role: string;
        name: string;
      };
    }
  }
}

// Plan hierarchy
const PLAN_HIERARCHY: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  TEAM: 2,
};

// Role hierarchy
const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Attach subscription and organization context to request.
 * Must be used after authenticate middleware.
 */
export function attachSubscriptionContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next();
  }

  const userId = req.user.userId;

  // Load subscription + org context
  prisma.subscription
    .findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        seats: true,
        organization: {
          select: {
            id: true,
            name: true,
            members: {
              where: { userId },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    })
    .then((sub) => {
      if (sub) {
        req.subscription = {
          plan: sub.status === 'ACTIVE' || sub.status === 'TRIALING' ? sub.plan : 'FREE',
          status: sub.status,
          seats: sub.seats,
        };

        if (sub.organization) {
          const memberRole = sub.organization.members[0]?.role || 'VIEWER';
          req.organization = {
            id: sub.organization.id,
            role: memberRole,
            name: sub.organization.name,
          };
        }
      } else {
        req.subscription = { plan: 'FREE', status: 'ACTIVE', seats: 1 };
      }
      next();
    })
    .catch((err) => {
      logger.error('Failed to load subscription context', { userId, error: err });
      // Don't block the request, default to FREE
      req.subscription = { plan: 'FREE', status: 'ACTIVE', seats: 1 };
      next();
    });
}

/**
 * Require minimum subscription plan.
 */
export function requirePlan(minPlan: 'FREE' | 'PRO' | 'TEAM') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userPlan = req.subscription?.plan || 'FREE';
    const userLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[minPlan] ?? 0;

    if (userLevel < requiredLevel) {
      return next(
        new ForbiddenError(
          `This feature requires the ${minPlan} plan. Your current plan is ${userPlan}.`
        )
      );
    }

    next();
  };
}

/**
 * Require minimum organization role.
 * Assumes attachSubscriptionContext has been called.
 */
export function requireOrgRole(minRole: 'VIEWER' | 'MEMBER' | 'ADMIN' | 'OWNER') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!req.organization) {
      return next(new ForbiddenError('You are not a member of any organization'));
    }

    const userRole = req.organization.role;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return next(
        new ForbiddenError(
          `This action requires ${minRole} role or higher. Your role is ${userRole}.`
        )
      );
    }

    next();
  };
}

/**
 * Require that the organization ID in the route matches the user's org.
 */
export function requireOrgMatch(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }

  const orgId = req.params.id || req.params.orgId;

  if (!req.organization) {
    return next(new ForbiddenError('You are not a member of any organization'));
  }

  if (req.organization.id !== orgId) {
    return next(new ForbiddenError('You do not have access to this organization'));
  }

  next();
}
