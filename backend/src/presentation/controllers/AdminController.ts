import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { walletService } from "../../infrastructure/services/WalletService.js";
import { systemConfigService } from "../../infrastructure/services/SystemConfigService.js";
import { logger } from "../../shared/logger/index.js";

export class AdminController {
  // ── Dashboard ──
  async getDashboard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const [totalUsers, subscriptionsByPlan, totalPointsResult] =
        await Promise.all([
          prisma.user.count(),
          prisma.subscription.groupBy({
            by: ["plan"],
            _count: { plan: true },
            where: { status: "ACTIVE" },
          }),
          prisma.wallet.aggregate({ _sum: { balance: true } }),
        ]);

      res.json({
        success: true,
        data: {
          totalUsers,
          subscriptionsByPlan: subscriptionsByPlan.map((s) => ({
            plan: s.plan,
            count: s._count.plan,
          })),
          totalPointsInCirculation: totalPointsResult._sum.balance || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Plans ──
  async getPlans(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const plans = await prisma.planConfig.findMany({
        orderBy: { sortOrder: "asc" },
      });
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async createPlan(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
      } = req.body;
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
        },
      });
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
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
      } = req.body;
      const plan = await prisma.planConfig.update({
        where: { id: String(req.params.id) },
        data: {
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
        },
      });
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async deletePlan(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await prisma.planConfig.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true, message: "Plan deleted" });
    } catch (error) {
      next(error);
    }
  }

  // ── System Config ──
  async getConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const group = req.query.group as string | undefined;
      const configs = await systemConfigService.getAll(group);
      res.json({ success: true, data: configs });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const updates: Array<{ key: string; value: string }> = req.body.configs;
      for (const { key, value } of updates) {
        await systemConfigService.set(key, value);
      }
      res.json({ success: true, message: "Config updated" });
    } catch (error) {
      next(error);
    }
  }

  // ── Users ──
  async getUsers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = (req.query.search as string) || "";

      const where = search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            fullName: true,
            isAdmin: true,
            isActive: true,
            createdAt: true,
            subscription: { select: { plan: true, status: true } },
            wallet: { select: { balance: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          users,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUser(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: String(req.params.id) },
        select: {
          id: true,
          email: true,
          fullName: true,
          jobTitle: true,
          company: true,
          isAdmin: true,
          isActive: true,
          createdAt: true,
          subscription: true,
          wallet: {
            include: {
              transactions: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async adjustUserWallet(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const targetUserId = req.params.id;
      const { amount, reason } = req.body;

      if (!amount || !reason) {
        res
          .status(400)
          .json({ success: false, error: "Amount and reason are required" });
        return;
      }

      const MAX_ADJUSTMENT = 10000;
      if (Math.abs(amount) > MAX_ADJUSTMENT) {
        res.status(400).json({
          success: false,
          error: `Adjustment cannot exceed ${MAX_ADJUSTMENT} points. For larger adjustments, contact system admin.`,
        });
        return;
      }

      const adminEmail = req.user!.email;
      const description = `Admin adjustment by ${adminEmail}: ${reason}`;

      let result;
      if (amount > 0) {
        result = await walletService.credit(
          String(targetUserId),
          amount,
          description,
          null,
          "ADMIN",
        );
      } else {
        result = await walletService.debit(
          String(targetUserId),
          Math.abs(amount),
          description,
          null,
          "ADMIN",
        );
      }

      logger.info("Admin wallet adjustment", {
        adminUserId: req.user!.userId,
        targetUserId,
        amount,
        reason,
      });

      res.json({ success: true, data: { balance: result.balance } });
    } catch (error) {
      next(error);
    }
  }

  // ── Point Packs ──
  async getPointPacks(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const packs = await prisma.pointPack.findMany({
        orderBy: { sortOrder: "asc" },
      });
      res.json({ success: true, data: packs });
    } catch (error) {
      next(error);
    }
  }

  async createPointPack(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { name, nameAr, points, price, currency, isActive, sortOrder } =
        req.body;
      const pack = await prisma.pointPack.create({
        data: { name, nameAr, points, price, currency, isActive, sortOrder },
      });
      res.status(201).json({ success: true, data: pack });
    } catch (error) {
      next(error);
    }
  }

  async updatePointPack(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { name, nameAr, points, price, currency, isActive, sortOrder } =
        req.body;
      const pack = await prisma.pointPack.update({
        where: { id: String(req.params.id) },
        data: { name, nameAr, points, price, currency, isActive, sortOrder },
      });
      res.json({ success: true, data: pack });
    } catch (error) {
      next(error);
    }
  }

  async deletePointPack(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await prisma.pointPack.delete({ where: { id: String(req.params.id) } });
      res.json({ success: true, message: "Point pack deleted" });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
