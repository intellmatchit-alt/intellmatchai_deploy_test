/**
 * Video Gallery Routes
 *
 * Public endpoints for browsing the video gallery.
 * No authentication required.
 *
 * @module presentation/routes/video
 */

import { Router, Request, Response } from "express";
import { prisma } from "../../infrastructure/database/prisma/client.js";

export const videoRoutes = Router();

// ===========================================================================
// GET / — List active videos (paginated)
// ===========================================================================

videoRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 12),
    );
    const categoryId = req.query.categoryId as string | undefined;
    const tagId = req.query.tagId as string | undefined;
    const search = req.query.search as string | undefined;
    const featured = req.query.featured as string | undefined;

    const where: any = { isActive: true };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tagId) {
      where.tags = { some: { tagId } };
    }

    if (search) {
      where.title = { contains: search };
    }

    if (featured === "true") {
      where.isFeatured = true;
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        include: {
          category: true,
          tags: { include: { tag: true } },
        },
        orderBy: [
          { isFeatured: "desc" },
          { sortOrder: "asc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.video.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        videos,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch videos" });
  }
});

// ===========================================================================
// GET /categories — List active categories
// ===========================================================================

videoRoutes.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.videoCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { videos: { where: { isActive: true } } },
        },
      },
    });

    return res.json({ success: true, data: categories });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch categories" });
  }
});

// ===========================================================================
// GET /tags — List active tags
// ===========================================================================

videoRoutes.get("/tags", async (_req: Request, res: Response) => {
  try {
    const tags = await prisma.videoTag.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return res.json({ success: true, data: tags });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch tags" });
  }
});

// ===========================================================================
// POST /:id/view — Increment view count
// ===========================================================================

videoRoutes.post("/:id/view", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    prisma.video
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});
    return res.json({ success: true });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to record view" });
  }
});

// ===========================================================================
// POST /:id/like — Increment like count
// ===========================================================================

videoRoutes.post("/:id/like", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const video = await prisma.video.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return res.json({ success: true, data: { likeCount: video.likeCount } });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to like video" });
  }
});

// ===========================================================================
// POST /:id/share — Increment share count
// ===========================================================================

videoRoutes.post("/:id/share", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const video = await prisma.video.update({
      where: { id },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return res.json({ success: true, data: { shareCount: video.shareCount } });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: "Failed to record share" });
  }
});
