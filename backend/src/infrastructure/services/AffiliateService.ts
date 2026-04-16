import { prisma } from "../database/prisma/client.js";
import { systemConfigService } from "./SystemConfigService.js";
import { walletService } from "./WalletService.js";
import { logger } from "../../shared/logger/index.js";

class AffiliateService {
  // ─── Settings ────────────────────────────────────────────────────────
  async getSettings() {
    const [
      enabled,
      commissionPct,
      maxDiscount,
      minDiscount,
      paymentMode,
      autoApprove,
      termsContent,
      policyContent,
    ] = await Promise.all([
      systemConfigService.get("affiliate_enabled"),
      systemConfigService.getNumber("affiliate_commission_percentage", 20),
      systemConfigService.getNumber("affiliate_max_discount_percentage", 15),
      systemConfigService.getNumber("affiliate_min_discount_percentage", 5),
      systemConfigService.get("affiliate_payment_mode"),
      systemConfigService.get("affiliate_auto_approve"),
      systemConfigService.get("affiliate_terms_content"),
      systemConfigService.get("affiliate_policy_content"),
    ]);

    return {
      enabled: enabled !== "false",
      commissionPercentage: commissionPct,
      maxDiscountPercentage: maxDiscount,
      minDiscountPercentage: minDiscount,
      paymentMode: (paymentMode || "points") as "cash" | "points",
      autoApprove: autoApprove === "true",
      termsContent: termsContent || "",
      policyContent: policyContent || "",
    };
  }

  // ─── Apply / Status ──────────────────────────────────────────────────
  async applyAsAffiliate(userId: string) {
    const existing = await prisma.affiliate.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }

    const settings = await this.getSettings();

    const affiliate = await prisma.affiliate.create({
      data: {
        userId,
        status: settings.autoApprove ? "APPROVED" : "PENDING",
        acceptedTermsAt: new Date(),
        termsVersion: "1.0",
        approvedAt: settings.autoApprove ? new Date() : null,
      },
    });

    this.createNotification(
      userId,
      "affiliate_application",
      "Affiliate Application",
      settings.autoApprove
        ? "Your affiliate application has been approved! Start creating referral codes."
        : "Your affiliate application has been submitted and is under review.",
    );

    return affiliate;
  }

  async getAffiliateByUserId(userId: string) {
    return prisma.affiliate.findUnique({
      where: { userId },
      include: {
        _count: { select: { codes: true, referrals: true, payouts: true } },
      },
    });
  }

  async isAffiliate(userId: string): Promise<boolean> {
    const aff = await prisma.affiliate.findUnique({
      where: { userId },
      select: { status: true },
    });
    return aff?.status === "APPROVED";
  }

  // ─── Codes ───────────────────────────────────────────────────────────
  async createCode(
    affiliateId: string,
    code: string,
    discountPercent: number,
    name?: string,
  ) {
    const settings = await this.getSettings();

    if (
      discountPercent < settings.minDiscountPercentage ||
      discountPercent > settings.maxDiscountPercentage
    ) {
      throw new Error(
        `Discount must be between ${settings.minDiscountPercentage}% and ${settings.maxDiscountPercentage}%`,
      );
    }

    // Check affiliate is approved
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
    });
    if (!affiliate || affiliate.status !== "APPROVED") {
      throw new Error("Affiliate account is not active");
    }

    // Check code uniqueness
    const existing = await prisma.affiliateCode.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (existing) {
      throw new Error("This code is already taken");
    }

    return prisma.affiliateCode.create({
      data: {
        affiliateId,
        name: name || null,
        code: code.toUpperCase(),
        discountPercent,
      },
    });
  }

  async getCodes(affiliateId: string) {
    const settings = await this.getSettings();
    const codes = await prisma.affiliateCode.findMany({
      where: { affiliateId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { referrals: true } } },
    });

    return codes.map((c) => ({
      ...c,
      commissionPercent:
        Number(settings.commissionPercentage) - Number(c.discountPercent),
    }));
  }

  async updateCodeStatus(
    affiliateId: string,
    codeId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    const code = await prisma.affiliateCode.findFirst({
      where: { id: codeId, affiliateId },
    });
    if (!code) throw new Error("Code not found");

    return prisma.affiliateCode.update({
      where: { id: codeId },
      data: { status },
    });
  }

  // ─── Validate (public) ──────────────────────────────────────────────
  async validateCode(code: string) {
    const settings = await this.getSettings();
    if (!settings.enabled) return null;

    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        affiliate: { select: { status: true, userId: true } },
      },
    });

    if (!affiliateCode) return null;
    if (affiliateCode.status !== "ACTIVE") return null;
    if (affiliateCode.affiliate.status !== "APPROVED") return null;

    return {
      code: affiliateCode.code,
      discountPercent: Number(affiliateCode.discountPercent),
      valid: true,
    };
  }

  // ─── Referral Tracking ───────────────────────────────────────────────
  async trackRegistration(code: string, userId: string, email: string) {
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { affiliate: true },
    });

    if (!affiliateCode || affiliateCode.status !== "ACTIVE") return null;
    if (affiliateCode.affiliate.status !== "APPROVED") return null;

    // Don't let affiliate refer themselves
    if (affiliateCode.affiliate.userId === userId) return null;

    const referral = await prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliateCode.affiliateId,
        codeId: affiliateCode.id,
        referredUserId: userId,
        referredEmail: email.toLowerCase(),
        registeredAt: new Date(),
      },
    });

    // Increment usage count
    await prisma.affiliateCode.update({
      where: { id: affiliateCode.id },
      data: { usageCount: { increment: 1 } },
    });

    // Save referral code on user record
    await prisma.user.update({
      where: { id: userId },
      data: { referralCodeUsed: code.toUpperCase() },
    });

    return referral;
  }

  async trackPurchase(userId: string, purchaseAmount: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCodeUsed: true },
    });

    if (!user?.referralCodeUsed) return null;

    // Find the pending referral for this user
    const referral = await prisma.affiliateReferral.findFirst({
      where: {
        referredUserId: userId,
        commissionStatus: "PENDING",
      },
      include: {
        code: true,
        affiliate: { select: { id: true, userId: true } },
      },
    });

    if (!referral) return null;

    const settings = await this.getSettings();
    const discountPct = Number(referral.code.discountPercent);
    const commissionPct = settings.commissionPercentage - discountPct;
    const discountAmount = (purchaseAmount * discountPct) / 100;
    const commissionAmount = (purchaseAmount * commissionPct) / 100;

    // Convert commission to points if needed (1 point = $1 by default)
    const commissionPoints =
      settings.paymentMode === "points" ? Math.round(commissionAmount) : 0;

    // Update referral record
    await prisma.affiliateReferral.update({
      where: { id: referral.id },
      data: {
        purchasedAt: new Date(),
        purchaseAmount,
        discountAmount,
        commissionPercent: commissionPct,
        commissionAmount,
        commissionPoints,
        commissionStatus: "EARNED",
      },
    });

    // Update code aggregates
    await prisma.affiliateCode.update({
      where: { id: referral.codeId },
      data: {
        totalRevenue: { increment: purchaseAmount },
        totalCommission: { increment: commissionAmount },
      },
    });

    // Credit the affiliate
    if (settings.paymentMode === "points" && commissionPoints > 0) {
      await walletService.credit(
        referral.affiliate.userId,
        commissionPoints,
        `Affiliate commission: code ${referral.code.code}`,
        referral.id,
        "AFFILIATE_COMMISSION",
      );

      await prisma.affiliate.update({
        where: { id: referral.affiliateId },
        data: {
          totalEarningsPoints: { increment: commissionPoints },
        },
      });
    } else {
      // Cash mode: update affiliate balance
      await prisma.affiliate.update({
        where: { id: referral.affiliateId },
        data: {
          totalEarnings: { increment: commissionAmount },
          payoutBalance: { increment: commissionAmount },
        },
      });
    }

    this.createNotification(
      referral.affiliate.userId,
      "affiliate_commission",
      "Commission Earned",
      settings.paymentMode === "points"
        ? `You earned ${commissionPoints} points from referral code ${referral.code.code}!`
        : `You earned $${commissionAmount.toFixed(2)} from referral code ${referral.code.code}!`,
    );

    return { commissionAmount, commissionPoints, discountAmount };
  }

  // ─── Referrals ───────────────────────────────────────────────────────
  async getReferrals(
    affiliateId: string,
    codeId?: string,
    page = 1,
    limit = 20,
  ) {
    const where: any = { affiliateId };
    if (codeId) where.codeId = codeId;

    const [referrals, total] = await Promise.all([
      prisma.affiliateReferral.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          code: { select: { code: true, discountPercent: true } },
        },
      }),
      prisma.affiliateReferral.count({ where }),
    ]);

    return { referrals, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Stats ───────────────────────────────────────────────────────────
  async getStats(affiliateId: string) {
    const [affiliate, totalReferrals, conversions, totalCodes] =
      await Promise.all([
        prisma.affiliate.findUnique({ where: { id: affiliateId } }),
        prisma.affiliateReferral.count({ where: { affiliateId } }),
        prisma.affiliateReferral.count({
          where: { affiliateId, commissionStatus: { in: ["EARNED", "PAID"] } },
        }),
        prisma.affiliateCode.count({ where: { affiliateId } }),
      ]);

    return {
      totalReferrals,
      conversions,
      conversionRate:
        totalReferrals > 0
          ? ((conversions / totalReferrals) * 100).toFixed(1)
          : "0",
      totalCodes,
      totalEarnings: Number(affiliate?.totalEarnings || 0),
      totalEarningsPoints: affiliate?.totalEarningsPoints || 0,
      payoutBalance: Number(affiliate?.payoutBalance || 0),
      payoutBalancePoints: affiliate?.payoutBalancePoints || 0,
    };
  }

  // ─── Payouts ─────────────────────────────────────────────────────────
  async getPayouts(affiliateId: string, page = 1, limit = 20) {
    const [payouts, total] = await Promise.all([
      prisma.affiliatePayout.findMany({
        where: { affiliateId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliatePayout.count({ where: { affiliateId } }),
    ]);

    return { payouts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async requestPayout(affiliateId: string) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
    });
    if (!affiliate) throw new Error("Affiliate not found");

    const settings = await this.getSettings();

    if (settings.paymentMode === "points") {
      if (affiliate.payoutBalancePoints <= 0)
        throw new Error("No points balance to withdraw");
      const payout = await prisma.affiliatePayout.create({
        data: {
          affiliateId,
          amount: 0,
          points: affiliate.payoutBalancePoints,
          paymentMode: "points",
        },
      });
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: { payoutBalancePoints: 0 },
      });
      return payout;
    } else {
      if (Number(affiliate.payoutBalance) <= 0)
        throw new Error("No balance to withdraw");
      const payout = await prisma.affiliatePayout.create({
        data: {
          affiliateId,
          amount: affiliate.payoutBalance,
          points: 0,
          paymentMode: "cash",
        },
      });
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: { payoutBalance: 0 },
      });
      return payout;
    }
  }

  // ─── SuperAdmin ──────────────────────────────────────────────────────
  async updateAffiliateStatus(
    affiliateId: string,
    status: "APPROVED" | "SUSPENDED" | "REJECTED",
    reason?: string,
  ) {
    const data: any = { status };
    if (status === "APPROVED") data.approvedAt = new Date();
    if (status === "SUSPENDED") {
      data.suspendedAt = new Date();
      data.suspendedReason = reason || null;
    }

    const affiliate = await prisma.affiliate.update({
      where: { id: affiliateId },
      data,
      include: { user: { select: { id: true } } },
    });

    const messages: Record<string, string> = {
      APPROVED:
        "Your affiliate application has been approved! You can now create referral codes.",
      SUSPENDED: `Your affiliate account has been suspended.${reason ? ` Reason: ${reason}` : ""}`,
      REJECTED: "Your affiliate application has been rejected.",
    };

    this.createNotification(
      affiliate.userId,
      "affiliate_status",
      "Affiliate Status Update",
      messages[status],
    );

    return affiliate;
  }

  async processPayout(
    payoutId: string,
    action: "approve" | "reject",
    notes?: string,
  ) {
    const payout = await prisma.affiliatePayout.findUnique({
      where: { id: payoutId },
      include: { affiliate: true },
    });

    if (!payout || payout.status !== "PENDING") {
      throw new Error("Payout not found or already processed");
    }

    if (action === "reject") {
      // Refund balance back to affiliate
      if (payout.paymentMode === "points") {
        await prisma.affiliate.update({
          where: { id: payout.affiliateId },
          data: { payoutBalancePoints: { increment: payout.points } },
        });
      } else {
        await prisma.affiliate.update({
          where: { id: payout.affiliateId },
          data: { payoutBalance: { increment: payout.amount } },
        });
      }
    }

    return prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: {
        status: action === "approve" ? "COMPLETED" : "FAILED",
        processedAt: new Date(),
        notes: notes || null,
      },
    });
  }

  async getAllAffiliates(
    page = 1,
    limit = 20,
    status?: string,
    search?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    const [affiliates, total] = await Promise.all([
      prisma.affiliate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
          _count: { select: { codes: true, referrals: true } },
        },
      }),
      prisma.affiliate.count({ where }),
    ]);

    return { affiliates, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSystemStats() {
    const [
      totalAffiliates,
      activeAffiliates,
      totalCodes,
      totalReferrals,
      totalConversions,
    ] = await Promise.all([
      prisma.affiliate.count(),
      prisma.affiliate.count({ where: { status: "APPROVED" } }),
      prisma.affiliateCode.count(),
      prisma.affiliateReferral.count(),
      prisma.affiliateReferral.count({
        where: { commissionStatus: { in: ["EARNED", "PAID"] } },
      }),
    ]);

    const earningsAgg = await prisma.affiliate.aggregate({
      _sum: { totalEarnings: true, totalEarningsPoints: true },
    });

    return {
      totalAffiliates,
      activeAffiliates,
      totalCodes,
      totalReferrals,
      totalConversions,
      totalEarningsCash: Number(earningsAgg._sum.totalEarnings || 0),
      totalEarningsPoints: earningsAgg._sum.totalEarningsPoints || 0,
    };
  }

  async getAllCodes(page = 1, limit = 20) {
    const [codes, total] = await Promise.all([
      prisma.affiliateCode.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          affiliate: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      }),
      prisma.affiliateCode.count(),
    ]);

    const settings = await this.getSettings();
    return {
      codes: codes.map((c) => ({
        ...c,
        commissionPercent:
          settings.commissionPercentage - Number(c.discountPercent),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllReferrals(page = 1, limit = 20) {
    const [referrals, total] = await Promise.all([
      prisma.affiliateReferral.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          code: { select: { code: true } },
          affiliate: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      }),
      prisma.affiliateReferral.count(),
    ]);

    return { referrals, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAllPayouts(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      prisma.affiliatePayout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          affiliate: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      }),
      prisma.affiliatePayout.count({ where }),
    ]);

    return { payouts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAffiliateDetail(affiliateId: string) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            company: true,
          },
        },
        codes: { orderBy: { createdAt: "desc" } },
        _count: { select: { referrals: true, payouts: true } },
      },
    });

    if (!affiliate) throw new Error("Affiliate not found");

    const stats = await this.getStats(affiliateId);
    return { ...affiliate, stats };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  private createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    retries = 2,
  ) {
    prisma.notification
      .create({
        data: { userId, type, title, message },
      })
      .catch((err) => {
        if (retries > 0) {
          setTimeout(
            () =>
              this.createNotification(
                userId,
                type,
                title,
                message,
                retries - 1,
              ),
            1000,
          );
        } else {
          logger.error("Failed to create affiliate notification", {
            userId,
            type,
            error: err,
          });
        }
      });
  }
}

export const affiliateService = new AffiliateService();
