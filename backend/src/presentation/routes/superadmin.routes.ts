/**
 * Superadmin Routes
 *
 * Complete admin panel API — separate auth system from regular users.
 * Includes: auth, dashboard, user management, plan management,
 * admin account management, audit log, and system config.
 *
 * @module presentation/routes/superadmin
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { generateSuperAdminToken } from "../../infrastructure/auth/superadmin-jwt.js";
import {
  authenticateSuperAdmin,
  requireRole,
} from "../middleware/superadmin.middleware.js";
import { affiliateService } from "../../infrastructure/services/AffiliateService.js";

export const superAdminRoutes = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logAudit(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: any,
  ipAddress?: string,
) {
  await prisma.adminAuditLog.create({
    data: { adminId, action, targetType, targetId, details, ipAddress },
  });
}

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    ""
  );
}

// ===========================================================================
// AUTH (public — no middleware)
// ===========================================================================

/**
 * POST /auth/login — superadmin login
 */
superAdminRoutes.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required" });
    }

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    if (!admin.isActive) {
      return res
        .status(403)
        .json({ success: false, error: "Account is deactivated" });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    // Update last login
    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateSuperAdminToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    await logAudit(admin.id, "LOGIN", "SuperAdmin", admin.id, null, getIp(req));

    return res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
        },
      },
    });
  } catch (error: any) {
    console.error("Superadmin login error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// All routes below require superadmin authentication
// ===========================================================================
superAdminRoutes.use(authenticateSuperAdmin);

/**
 * GET /auth/me — current admin info
 */
superAdminRoutes.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: req.superAdmin!.adminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!admin) {
      return res.status(404).json({ success: false, error: "Admin not found" });
    }
    return res.json({ success: true, data: admin });
  } catch (error: any) {
    console.error("Superadmin me error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// DASHBOARD & ANALYTICS
// ===========================================================================

/**
 * GET /dashboard — system statistics
 */
// superAdminRoutes.get('/dashboard', async (_req: Request, res: Response) => {
//   try {
//     const now = new Date();
//     const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
//     const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

//     const [
//       totalUsers,
//       activeUsers,
//       newUsersLast30,
//       newUsersLast7,
//       totalContacts,
//       subscriptionsByPlan,
//       totalEvents,
//       collabRequestsTotal,
//       collabRequestsAccepted,
//       collabPointsCharged,
//       collabPointsPaidOut,
//     ] = await Promise.all([
//       prisma.user.count(),
//       prisma.user.count({ where: { isActive: true, status: 'ACTIVE' } }),
//       prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
//       prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
//       prisma.contact.count(),
//       prisma.subscription.groupBy({ by: ['plan'], _count: { plan: true } }),
//       prisma.event.count(),
//       prisma.collaborationRequest.count(),
//       prisma.collaborationRequest.count({ where: { status: 'ACCEPTED' } }),
//       prisma.walletTransaction.aggregate({ where: { referenceType: 'COLLABORATION_REQUEST' }, _sum: { amount: true } }),
//       prisma.walletTransaction.aggregate({ where: { referenceType: 'COLLABORATION_ACCEPT' }, _sum: { amount: true } }),
//     ]);

//     const totalCharged = Math.abs(collabPointsCharged._sum?.amount || 0);
//     const totalPaidOut = collabPointsPaidOut._sum?.amount || 0;
//     const platformRevenue = totalCharged - totalPaidOut;

//     return res.json({
//       success: true,
//       data: {
//         users: {
//           total: totalUsers,
//           active: activeUsers,
//           newLast30Days: newUsersLast30,
//           newLast7Days: newUsersLast7,
//         },
//         contacts: { total: totalContacts },
//         subscriptions: subscriptionsByPlan.reduce(
//           (acc, s) => ({ ...acc, [s.plan]: s._count.plan }),
//           {} as Record<string, number>,
//         ),
//         events: { total: totalEvents },
//         collaboration: {
//           totalRequests: collabRequestsTotal,
//           acceptedRequests: collabRequestsAccepted,
//           totalPointsCharged: totalCharged,
//           totalPointsPaidOut: totalPaidOut,
//           platformRevenue,
//         },
//       },
//     });
//   } catch (error: any) {
//     console.error('Dashboard error:', error);
//     return res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// });

/**
 * GET /analytics — time-series user growth (daily for last 30 days)
 */
superAdminRoutes.get("/analytics", async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const dailySignups = await prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return res.json({
      success: true,
      data: {
        userGrowth: dailySignups.map((row) => ({
          date: row.date,
          count: Number(row.count),
        })),
      },
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// USER MANAGEMENT
// ===========================================================================

/**
 * GET /users — paginated user list with search and filters
 */
superAdminRoutes.get("/users", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;
    const plan = req.query.plan as string;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder =
      (req.query.sortOrder as string) === "asc" ? "asc" : "desc";

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { fullName: { contains: search } },
        { company: { contains: search } },
      ];
    }

    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;

    if (plan) {
      where.subscription = { plan };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          company: true,
          jobTitle: true,
          isActive: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          subscription: { select: { plan: true, status: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Flatten subscription.plan to top-level plan field
    const flatUsers = users.map(({ subscription, ...rest }) => ({
      ...rest,
      plan: subscription?.plan || "FREE",
    }));

    return res.json({
      success: true,
      data: {
        users: flatUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("List users error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /users/:id — user detail
 */
superAdminRoutes.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        company: true,
        bio: true,
        phone: true,
        location: true,
        linkedinUrl: true,
        websiteUrl: true,
        avatarUrl: true,
        isActive: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        subscription: { select: { plan: true, status: true } },
        wallet: { select: { id: true, balance: true } },
        _count: { select: { contacts: true, projects: true, events: true } },
        userSectors: {
          select: { sector: { select: { name: true } } },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Flatten nested relations to match frontend expected shape
    const { subscription, wallet, _count, userSectors, ...rest } = user;
    return res.json({
      success: true,
      data: {
        ...rest,
        plan: subscription?.plan || "FREE",
        walletBalance: wallet?.balance ?? 0,
        contactsCount: _count?.contacts ?? 0,
        projectsCount: _count?.projects ?? 0,
        eventsCount: _count?.events ?? 0,
        sector: userSectors?.[0]?.sector?.name || null,
      },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * PATCH /users/:id — update user fields
 */
superAdminRoutes.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      "fullName",
      "email",
      "company",
      "jobTitle",
      "isActive",
      "status",
      "emailVerified",
    ];
    const data: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No valid fields to update" });
    }

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        status: true,
      },
    });

    await logAudit(
      req.superAdmin!.adminId,
      "UPDATE_USER",
      "User",
      String(req.params.id),
      data,
      getIp(req),
    );

    return res.json({ success: true, data: user });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    console.error("Update user error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /users/:id/ban — ban a user
 */
superAdminRoutes.post("/users/:id/ban", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { isActive: false, status: "INACTIVE" },
      select: { id: true, email: true, fullName: true },
    });

    await logAudit(
      req.superAdmin!.adminId,
      "BAN_USER",
      "User",
      String(req.params.id),
      { reason },
      getIp(req),
    );

    return res.json({
      success: true,
      data: user,
      message: "User banned successfully",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    console.error("Ban user error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /users/:id/unban — unban a user
 */
superAdminRoutes.post(
  "/users/:id/unban",
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.update({
        where: { id: String(req.params.id) },
        data: { isActive: true, status: "ACTIVE" },
        select: { id: true, email: true, fullName: true },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "UNBAN_USER",
        "User",
        String(req.params.id),
        null,
        getIp(req),
      );

      return res.json({
        success: true,
        data: user,
        message: "User unbanned successfully",
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      console.error("Unban user error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * DELETE /users/:id — delete user (SUPER_ADMIN only)
 */
superAdminRoutes.delete(
  "/users/:id",
  requireRole("SUPER_ADMIN"),
  async (req: Request, res: Response) => {
    try {
      await logAudit(
        req.superAdmin!.adminId,
        "DELETE_USER",
        "User",
        String(req.params.id),
        null,
        getIp(req),
      );

      await prisma.user.delete({ where: { id: String(req.params.id) } });

      return res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      console.error("Delete user error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * POST /users/:id/wallet — adjust wallet balance
 */
superAdminRoutes.post(
  "/users/:id/wallet",
  async (req: Request, res: Response) => {
    try {
      const { amount, description } = req.body;

      if (typeof amount !== "number" || amount === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Amount must be a non-zero number" });
      }

      if (!description) {
        return res
          .status(400)
          .json({ success: false, error: "Description is required" });
      }

      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      // Upsert wallet
      const wallet = await prisma.wallet.upsert({
        where: { userId: String(req.params.id) },
        create: { userId: String(req.params.id), balance: Math.max(0, amount) },
        update: { balance: { increment: amount } },
      });

      // Create transaction record
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: amount > 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(amount),
          balance: wallet.balance,
          description,
          referenceType: "ADMIN_ADJUSTMENT",
        },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "ADJUST_WALLET",
        "Wallet",
        wallet.id,
        { userId: String(req.params.id), amount, description },
        getIp(req),
      );

      return res.json({
        success: true,
        data: { walletId: wallet.id, balance: wallet.balance },
      });
    } catch (error: any) {
      console.error("Adjust wallet error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /users/:id/plan — change user subscription plan
 */
superAdminRoutes.patch(
  "/users/:id/plan",
  async (req: Request, res: Response) => {
    try {
      const { plan } = req.body;
      const validPlans = ["FREE", "PRO", "TEAM"];

      if (!validPlans.includes(plan)) {
        return res.status(400).json({
          success: false,
          error: `Plan must be one of: ${validPlans.join(", ")}`,
        });
      }

      // Ensure user exists
      const user = await prisma.user.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const subscription = await prisma.subscription.upsert({
        where: { userId: String(req.params.id) },
        create: { userId: String(req.params.id), plan, status: "ACTIVE" },
        update: { plan, status: "ACTIVE" },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "CHANGE_PLAN",
        "Subscription",
        subscription.id,
        { userId: String(req.params.id), plan },
        getIp(req),
      );

      return res.json({ success: true, data: subscription });
    } catch (error: any) {
      console.error("Change plan error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// PLAN MANAGEMENT
// ===========================================================================

/**
 * GET /plans — list PlanConfig entries
 */
superAdminRoutes.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.planConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return res.json({ success: true, data: plans });
  } catch (error: any) {
    console.error("List plans error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /plans — create plan (SUPER_ADMIN or ADMIN)
 */
superAdminRoutes.post(
  "/plans",
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        displayName,
        displayNameAr,
        description,
        descriptionAr,
        monthlyPrice,
        yearlyPrice,
        pointsAllocation,
        contactLimit,
        features,
        featuresAr,
        minSeats,
        maxSeats,
        isActive,
        sortOrder,
        ctaText,
        ctaTextAr,
        badgeText,
        badgeTextAr,
        badgeColor,
        borderColor,
        isHighlighted,
        animation,
      } = req.body;

      if (!name || !displayName) {
        return res
          .status(400)
          .json({ success: false, error: "name and displayName are required" });
      }

      const plan = await prisma.planConfig.create({
        data: {
          name,
          displayName,
          displayNameAr,
          description,
          descriptionAr,
          monthlyPrice,
          yearlyPrice,
          pointsAllocation,
          contactLimit,
          features,
          featuresAr,
          minSeats,
          maxSeats,
          isActive,
          sortOrder,
          ctaText,
          ctaTextAr,
          badgeText,
          badgeTextAr,
          badgeColor,
          borderColor,
          isHighlighted,
          animation,
        },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "CREATE_PLAN",
        "PlanConfig",
        plan.id,
        { name },
        getIp(req),
      );

      return res.status(201).json({ success: true, data: plan });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json({ success: false, error: "Plan name already exists" });
      }
      console.error("Create plan error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /plans/:id — update plan
 */
superAdminRoutes.patch(
  "/plans/:id",
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const allowedFields = [
        "displayName",
        "displayNameAr",
        "description",
        "descriptionAr",
        "monthlyPrice",
        "yearlyPrice",
        "pointsAllocation",
        "contactLimit",
        "features",
        "featuresAr",
        "minSeats",
        "maxSeats",
        "isActive",
        "sortOrder",
        "ctaText",
        "ctaTextAr",
        "badgeText",
        "badgeTextAr",
        "badgeColor",
        "borderColor",
        "isHighlighted",
        "animation",
      ];
      const data: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }

      if (Object.keys(data).length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "No valid fields to update" });
      }

      const plan = await prisma.planConfig.update({
        where: { id: String(req.params.id) },
        data,
      });

      await logAudit(
        req.superAdmin!.adminId,
        "UPDATE_PLAN",
        "PlanConfig",
        String(req.params.id),
        data,
        getIp(req),
      );

      return res.json({ success: true, data: plan });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "Plan not found" });
      }
      console.error("Update plan error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * DELETE /plans/:id — delete plan (SUPER_ADMIN only)
 */
superAdminRoutes.delete(
  "/plans/:id",
  requireRole("SUPER_ADMIN"),
  async (req: Request, res: Response) => {
    try {
      await logAudit(
        req.superAdmin!.adminId,
        "DELETE_PLAN",
        "PlanConfig",
        String(req.params.id),
        null,
        getIp(req),
      );

      await prisma.planConfig.delete({ where: { id: String(req.params.id) } });

      return res.json({ success: true, message: "Plan deleted successfully" });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "Plan not found" });
      }
      console.error("Delete plan error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// ADMIN ACCOUNT MANAGEMENT (SUPER_ADMIN only)
// ===========================================================================

/**
 * GET /admins — list SuperAdmin accounts
 */
superAdminRoutes.get(
  "/admins",
  requireRole("SUPER_ADMIN"),
  async (_req: Request, res: Response) => {
    try {
      const admins = await prisma.superAdmin.findMany({
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return res.json({ success: true, data: admins });
    } catch (error: any) {
      console.error("List admins error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * POST /admins — create new admin
 */
superAdminRoutes.post(
  "/admins",
  requireRole("SUPER_ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { email, password, fullName, role } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({
          success: false,
          error: "email, password, and fullName are required",
        });
      }

      const validRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Role must be one of: ${validRoles.join(", ")}`,
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const admin = await prisma.superAdmin.create({
        data: { email, passwordHash, fullName, role: role || "ADMIN" },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
        },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "CREATE_ADMIN",
        "SuperAdmin",
        admin.id,
        { email, role: role || "ADMIN" },
        getIp(req),
      );

      return res.status(201).json({ success: true, data: admin });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json({ success: false, error: "Email already exists" });
      }
      console.error("Create admin error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /admins/:id — update admin role/name
 */
superAdminRoutes.patch(
  "/admins/:id",
  requireRole("SUPER_ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const allowedFields = ["fullName", "role", "isActive"];
      const data: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }

      if (data.role) {
        const validRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"];
        if (!validRoles.includes(data.role)) {
          return res.status(400).json({
            success: false,
            error: `Role must be one of: ${validRoles.join(", ")}`,
          });
        }
      }

      if (Object.keys(data).length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "No valid fields to update" });
      }

      const admin = await prisma.superAdmin.update({
        where: { id: String(req.params.id) },
        data,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "UPDATE_ADMIN",
        "SuperAdmin",
        String(req.params.id),
        data,
        getIp(req),
      );

      return res.json({ success: true, data: admin });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "Admin not found" });
      }
      console.error("Update admin error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * DELETE /admins/:id — delete admin
 */
superAdminRoutes.delete(
  "/admins/:id",
  requireRole("SUPER_ADMIN"),
  async (req: Request, res: Response) => {
    try {
      // Prevent self-delete
      if (req.params.id === req.superAdmin!.adminId) {
        return res
          .status(400)
          .json({ success: false, error: "Cannot delete your own account" });
      }

      await logAudit(
        req.superAdmin!.adminId,
        "DELETE_ADMIN",
        "SuperAdmin",
        String(req.params.id),
        null,
        getIp(req),
      );

      await prisma.superAdmin.delete({ where: { id: String(req.params.id) } });

      return res.json({ success: true, message: "Admin deleted successfully" });
    } catch (error: any) {
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, error: "Admin not found" });
      }
      console.error("Delete admin error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// AUDIT LOG
// ===========================================================================

/**
 * GET /audit-log — paginated audit log
 */
superAdminRoutes.get("/audit-log", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50),
    );
    const adminId = req.query.adminId as string;
    const action = req.query.action as string;

    const where: any = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: { admin: { select: { email: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("Audit log error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// SYSTEM CONFIG
// ===========================================================================

/**
 * GET /config — list system configs
 */
superAdminRoutes.get("/config", async (req: Request, res: Response) => {
  try {
    const group = req.query.group as string;
    const where: any = {};
    if (group) where.groupName = group;

    const configs = await prisma.systemConfig.findMany({
      where,
      orderBy: [{ groupName: "asc" }, { key: "asc" }],
    });

    return res.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("List config error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * PATCH /config — update configs (accepts array of { key, value })
 */
superAdminRoutes.patch("/config", async (req: Request, res: Response) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs) || configs.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "configs array is required" });
    }

    const results = [];
    for (const { key, value } of configs) {
      if (!key || value === undefined) continue;

      const updated = await prisma.systemConfig.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
      results.push(updated);
    }

    await logAudit(
      req.superAdmin!.adminId,
      "UPDATE_CONFIG",
      "SystemConfig",
      undefined,
      { keys: configs.map((c: any) => c.key) },
      getIp(req),
    );

    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Update config error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// POINT PACKS
// ===========================================================================

/**
 * GET /point-packs — list all point packs (sorted by sortOrder)
 */
superAdminRoutes.get("/point-packs", async (req: Request, res: Response) => {
  try {
    const packs = await prisma.pointPack.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return res.json({ success: true, data: packs });
  } catch (error: any) {
    console.error("List point packs error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /point-packs — create a point pack
 */
superAdminRoutes.post("/point-packs", async (req: Request, res: Response) => {
  try {
    const { name, nameAr, points, price, currency, isActive, sortOrder } =
      req.body;

    if (!name || points === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        error: "name, points, and price are required",
      });
    }

    const pack = await prisma.pointPack.create({
      data: {
        name,
        nameAr: nameAr || null,
        points: Number(points),
        price: Number(price),
        currency: currency || "USD",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    await logAudit(
      req.superAdmin!.adminId,
      "CREATE_POINT_PACK",
      "PointPack",
      pack.id,
      { name, points, price },
      getIp(req),
    );

    return res.json({ success: true, data: pack });
  } catch (error: any) {
    console.error("Create point pack error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * PATCH /point-packs/:id — update a point pack
 */
superAdminRoutes.patch(
  "/point-packs/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { name, nameAr, points, price, currency, isActive, sortOrder } =
        req.body;

      const existing = await prisma.pointPack.findUnique({ where: { id } });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Point pack not found" });
      }

      const data: any = {};
      if (name !== undefined) data.name = name;
      if (nameAr !== undefined) data.nameAr = nameAr;
      if (points !== undefined) data.points = Number(points);
      if (price !== undefined) data.price = Number(price);
      if (currency !== undefined) data.currency = currency;
      if (isActive !== undefined) data.isActive = Boolean(isActive);
      if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

      const pack = await prisma.pointPack.update({
        where: { id },
        data,
      });

      await logAudit(
        req.superAdmin!.adminId,
        "UPDATE_POINT_PACK",
        "PointPack",
        id,
        data,
        getIp(req),
      );

      return res.json({ success: true, data: pack });
    } catch (error: any) {
      console.error("Update point pack error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * DELETE /point-packs/:id — delete a point pack
 */
superAdminRoutes.delete(
  "/point-packs/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.pointPack.findUnique({ where: { id } });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Point pack not found" });
      }

      await prisma.pointPack.delete({ where: { id } });

      await logAudit(
        req.superAdmin!.adminId,
        "DELETE_POINT_PACK",
        "PointPack",
        id,
        { name: existing.name },
        getIp(req),
      );

      return res.json({
        success: true,
        data: { message: "Point pack deleted" },
      });
    } catch (error: any) {
      console.error("Delete point pack error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// PAYMENTS (Point Pack Purchases)
// ===========================================================================

/**
 * GET /payments — paginated list of point pack purchases with user and pack info
 */
superAdminRoutes.get("/payments", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [purchases, total] = await Promise.all([
      prisma.pointPackPurchase.findMany({
        where,
        include: {
          user: { select: { fullName: true, email: true } },
          pointPack: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.pointPackPurchase.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        purchases,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("List payments error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ===========================================================================
// BUG REPORTS (QA Reporting)
// ===========================================================================

/**
 * GET /bug-reports — paginated list of all bug reports with filters
 */
superAdminRoutes.get("/bug-reports", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const status = req.query.status as string;
    const category = req.query.category as string;
    const urgency = req.query.urgency as string;
    const userId = req.query.userId as string;
    const pagePath = req.query.pagePath as string;
    const search = req.query.search as string;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (urgency) where.urgency = urgency;
    if (userId) where.userId = userId;
    if (pagePath) where.pagePath = { contains: pagePath };
    if (search) where.description = { contains: search };

    const [reports, total] = await Promise.all([
      prisma.bugReport.findMany({
        where,
        include: {
          user: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bugReport.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("List bug reports error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/**
 * GET /bug-reports/stats — aggregate counts
 */
superAdminRoutes.get(
  "/bug-reports/stats",
  async (_req: Request, res: Response) => {
    try {
      const [total, open, inProgress, highUrgency] = await Promise.all([
        prisma.bugReport.count(),
        prisma.bugReport.count({ where: { status: "OPEN" } }),
        prisma.bugReport.count({ where: { status: "IN_PROGRESS" } }),
        prisma.bugReport.count({ where: { urgency: "HIGH" } }),
      ]);

      return res.json({
        success: true,
        data: { total, open, inProgress, highUrgency },
      });
    } catch (error: any) {
      console.error("Bug report stats error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /bug-reports/:id — single bug report detail
 */
superAdminRoutes.get(
  "/bug-reports/:id",
  async (req: Request, res: Response) => {
    try {
      const report = await prisma.bugReport.findUnique({
        where: { id: String(req.params.id) },
        include: {
          user: { select: { fullName: true, email: true } },
        },
      });

      if (!report) {
        return res
          .status(404)
          .json({ success: false, error: "Bug report not found" });
      }

      return res.json({ success: true, data: report });
    } catch (error: any) {
      console.error("Get bug report error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /bug-reports/:id/status — change status of a bug report
 */
superAdminRoutes.patch(
  "/bug-reports/:id/status",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { status, adminNotes } = req.body;

      const validStatuses = ["OPEN", "IN_PROGRESS", "DONE", "WONT_FIX"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `status must be one of: ${validStatuses.join(", ")}`,
        });
      }

      // Check report exists
      const existing = await prisma.bugReport.findUnique({ where: { id } });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Bug report not found" });
      }

      const data: any = { status };
      if (adminNotes !== undefined) data.adminNotes = adminNotes;

      // If resolved, set resolvedAt and resolvedById
      if (status === "DONE" || status === "WONT_FIX") {
        data.resolvedAt = new Date();
        data.resolvedById = req.superAdmin!.adminId;
      } else {
        // If re-opened or moved to in-progress, clear resolution fields
        data.resolvedAt = null;
        data.resolvedById = null;
      }

      const report = await prisma.bugReport.update({ where: { id }, data });

      // Notify the user
      await prisma.notification.create({
        data: {
          userId: existing.userId,
          type: "BUG_REPORT_STATUS",
          title: "Report Updated",
          message: `Your report has been marked as ${status}`,
          data: { bugReportId: id, status, adminNotes },
        },
      });

      await logAudit(
        req.superAdmin!.adminId,
        "UPDATE_BUG_REPORT_STATUS",
        "BugReport",
        String(id),
        { status, adminNotes },
        getIp(req),
      );

      return res.json({ success: true, data: report });
    } catch (error: any) {
      console.error("Update bug report status error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ===========================================================================
// AFFILIATE MANAGEMENT
// ===========================================================================

/**
 * GET /affiliates/stats — Aggregate affiliate system stats
 */
superAdminRoutes.get(
  "/affiliates/stats",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const stats = await affiliateService.getSystemStats();
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error("Get affiliate stats error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /affiliates/codes — List all codes across all affiliates
 */
superAdminRoutes.get(
  "/affiliates/codes",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await affiliateService.getAllCodes(page, limit);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Get all affiliate codes error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /affiliates/referrals — List all referrals
 */
superAdminRoutes.get(
  "/affiliates/referrals",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await affiliateService.getAllReferrals(page, limit);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Get all affiliate referrals error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /affiliates/payouts — List all payout requests
 */
superAdminRoutes.get(
  "/affiliates/payouts",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const result = await affiliateService.getAllPayouts(page, limit, status);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Get all affiliate payouts error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /affiliates/:id — Get affiliate detail
 */
superAdminRoutes.get(
  "/affiliates/:id",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const detail = await affiliateService.getAffiliateDetail(String(id));
      return res.json({ success: true, data: detail });
    } catch (error: any) {
      if (error.message === "Affiliate not found") {
        return res.status(404).json({ success: false, error: error.message });
      }
      console.error("Get affiliate detail error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * GET /affiliates — List all affiliates
 */
superAdminRoutes.get(
  "/affiliates",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const result = await affiliateService.getAllAffiliates(
        page,
        limit,
        status,
        search,
      );
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Get affiliates error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /affiliates/:id/status — Approve/reject/suspend affiliate
 */
superAdminRoutes.patch(
  "/affiliates/:id/status",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { status, reason } = req.body;

      if (!["APPROVED", "SUSPENDED", "REJECTED"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid status" });
      }

      const affiliate = await affiliateService.updateAffiliateStatus(
        id,
        status,
        reason,
      );

      await logAudit(
        req.superAdmin!.adminId,
        `AFFILIATE_${status}`,
        "Affiliate",
        id,
        { status, reason },
        getIp(req),
      );

      return res.json({ success: true, data: affiliate });
    } catch (error: any) {
      console.error("Update affiliate status error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

/**
 * PATCH /affiliates/payouts/:id — Process payout (approve/reject)
 */
superAdminRoutes.patch(
  "/affiliates/payouts/:id",
  authenticateSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { action, notes } = req.body;

      if (!["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ success: false, error: "Action must be approve or reject" });
      }

      const payout = await affiliateService.processPayout(
        String(id),
        action,
        notes,
      );

      await logAudit(
        req.superAdmin!.adminId,
        `AFFILIATE_PAYOUT_${action.toUpperCase()}`,
        "AffiliatePayout",
        id,
        { action, notes },
        getIp(req),
      );

      return res.json({ success: true, data: payout });
    } catch (error: any) {
      if (
        error.message?.includes("not found") ||
        error.message?.includes("already processed")
      ) {
        return res.status(400).json({ success: false, error: error.message });
      }
      console.error("Process affiliate payout error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  },
);

// ============================================================
// Video Gallery Management
// ============================================================

/** Parse YouTube/Vimeo URL to extract type, ID, and thumbnail */
function parseVideoUrl(url: string): {
  videoType: "YOUTUBE" | "VIMEO";
  videoId: string;
  thumbnailUrl: string | null;
} | null {
  if (!url) return null;

  // YouTube patterns
  const ytPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of ytPatterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        videoType: "YOUTUBE",
        videoId: match[1],
        thumbnailUrl: `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`,
      };
    }
  }

  // Vimeo patterns
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/,
  );
  if (vimeoMatch) {
    return {
      videoType: "VIMEO",
      videoId: vimeoMatch[1],
      thumbnailUrl: null, // Vimeo thumbnails require oEmbed API call
    };
  }

  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Video Categories ---
superAdminRoutes.get("/video-categories", async (req, res) => {
  const categories = await prisma.videoCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { videos: true } } },
  });
  res.json({ success: true, data: categories });
});

superAdminRoutes.post("/video-categories", async (req, res) => {
  const { name, nameAr, slug, sortOrder = 0, isActive = true } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: "Name is required" });
    return;
  }
  const finalSlug = slug || slugify(name);
  const category = await prisma.videoCategory.create({
    data: { name, nameAr, slug: finalSlug, sortOrder, isActive },
  });
  res.json({ success: true, data: category });
});

superAdminRoutes.patch("/video-categories/:id", async (req, res) => {
  const { name, nameAr, slug, sortOrder, isActive } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (nameAr !== undefined) data.nameAr = nameAr;
  if (slug !== undefined) data.slug = slug;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (isActive !== undefined) data.isActive = isActive;
  const category = await prisma.videoCategory.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ success: true, data: category });
});

superAdminRoutes.delete("/video-categories/:id", async (req, res) => {
  const videoCount = await prisma.video.count({
    where: { categoryId: req.params.id },
  });
  if (videoCount > 0) {
    res.status(400).json({
      success: false,
      error: `Cannot delete: ${videoCount} videos use this category. Reassign or delete them first.`,
    });
    return;
  }
  await prisma.videoCategory.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: "Category deleted" });
});

// --- Video Tags ---
superAdminRoutes.get("/video-tags", async (req, res) => {
  const tags = await prisma.videoTag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { videos: true } } },
  });
  res.json({ success: true, data: tags });
});

superAdminRoutes.post("/video-tags", async (req, res) => {
  const { name, nameAr, isActive = true } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: "Name is required" });
    return;
  }
  const tag = await prisma.videoTag.create({
    data: { name, nameAr, isActive },
  });
  res.json({ success: true, data: tag });
});

superAdminRoutes.patch("/video-tags/:id", async (req, res) => {
  const { name, nameAr, isActive } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (nameAr !== undefined) data.nameAr = nameAr;
  if (isActive !== undefined) data.isActive = isActive;
  const tag = await prisma.videoTag.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ success: true, data: tag });
});

superAdminRoutes.delete("/video-tags/:id", async (req, res) => {
  const usageCount = await prisma.videoTagRelation.count({
    where: { tagId: req.params.id },
  });
  if (usageCount > 0) {
    res.status(400).json({
      success: false,
      error: `Cannot delete: ${usageCount} videos use this tag. Remove tag from videos first.`,
    });
    return;
  }
  await prisma.videoTag.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: "Tag deleted" });
});

// --- Videos ---
superAdminRoutes.get("/videos", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string) || 20),
  );
  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      include: { category: true, tags: { include: { tag: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.video.count(),
  ]);
  res.json({
    success: true,
    data: {
      videos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

superAdminRoutes.post("/videos", async (req, res) => {
  const {
    title,
    titleAr,
    description,
    descriptionAr,
    videoUrl,
    categoryId,
    tagIds = [],
    duration,
    sortOrder = 0,
    isActive = true,
    isFeatured = false,
  } = req.body;
  if (!title || !videoUrl || !categoryId) {
    res.status(400).json({
      success: false,
      error: "Title, videoUrl, and categoryId are required",
    });
    return;
  }

  const parsed = parseVideoUrl(videoUrl);
  if (!parsed) {
    res.status(400).json({
      success: false,
      error: "Invalid video URL. Must be a YouTube or Vimeo link.",
    });
    return;
  }

  const video = await prisma.video.create({
    data: {
      title,
      titleAr,
      description,
      descriptionAr,
      videoUrl,
      videoType: parsed.videoType,
      videoId: parsed.videoId,
      thumbnailUrl: parsed.thumbnailUrl,
      duration,
      categoryId,
      sortOrder,
      isActive,
      isFeatured,
      ...(tagIds.length > 0 && {
        tags: { create: tagIds.map((tagId: string) => ({ tagId })) },
      }),
    },
    include: { category: true, tags: { include: { tag: true } } },
  });
  res.json({ success: true, data: video });
});

superAdminRoutes.get("/videos/:id", async (req, res) => {
  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
    include: { category: true, tags: { include: { tag: true } } },
  });
  if (!video) {
    res.status(404).json({ success: false, error: "Video not found" });
    return;
  }
  res.json({ success: true, data: video });
});

superAdminRoutes.patch("/videos/:id", async (req, res) => {
  const {
    title,
    titleAr,
    description,
    descriptionAr,
    videoUrl,
    categoryId,
    tagIds,
    duration,
    sortOrder,
    isActive,
    isFeatured,
  } = req.body;
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (titleAr !== undefined) data.titleAr = titleAr;
  if (description !== undefined) data.description = description;
  if (descriptionAr !== undefined) data.descriptionAr = descriptionAr;
  if (categoryId !== undefined) data.categoryId = categoryId;
  if (duration !== undefined) data.duration = duration;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (isActive !== undefined) data.isActive = isActive;
  if (isFeatured !== undefined) data.isFeatured = isFeatured;

  if (videoUrl !== undefined) {
    const parsed = parseVideoUrl(videoUrl);
    if (!parsed) {
      res.status(400).json({ success: false, error: "Invalid video URL" });
      return;
    }
    data.videoUrl = videoUrl;
    data.videoType = parsed.videoType;
    data.videoId = parsed.videoId;
    data.thumbnailUrl = parsed.thumbnailUrl;
  }

  // Sync tags if provided
  if (tagIds !== undefined) {
    await prisma.videoTagRelation.deleteMany({
      where: { videoId: req.params.id },
    });
    if (tagIds.length > 0) {
      data.tags = { create: tagIds.map((tagId: string) => ({ tagId })) };
    }
  }

  const video = await prisma.video.update({
    where: { id: req.params.id },
    data,
    include: { category: true, tags: { include: { tag: true } } },
  });
  res.json({ success: true, data: video });
});

superAdminRoutes.delete("/videos/:id", async (req, res) => {
  await prisma.video.delete({ where: { id: req.params.id } }); // cascades to VideoTagRelation
  res.json({ success: true, message: "Video deleted" });
});
