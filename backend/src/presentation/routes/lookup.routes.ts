/**
 * Lookup Routes
 *
 * Routes for lookup data (sectors, skills, interests, hobbies).
 * Includes Redis caching for improved performance.
 *
 * @module presentation/routes/lookup
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client.js';
import { cacheService, CACHE_TTL, CACHE_KEYS } from '../../infrastructure/cache/index.js';
import { logger } from '../../shared/logger/index.js';

export const lookupRoutes = Router();

/**
 * Generate cache key for lookup list
 */
function getLookupListCacheKey(type: string, search?: string, parentId?: string, limit?: number): string {
  return `${type}:list:${search || 'all'}:${parentId || 'none'}:${limit || 100}`;
}

/**
 * GET /api/v1/sectors
 * Get all sectors (with caching)
 */
lookupRoutes.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.baseUrl.split('/').pop();
    const search = req.query.search as string | undefined;
    const parentId = req.query.parentId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    // Generate cache key
    const cacheKey = getLookupListCacheKey(path || '', search, parentId, limit);

    // Try to get from cache (only if no search query - search results shouldn't be cached)
    if (!search && cacheService.isAvailable()) {
      const cached = await cacheService.get<any[]>(cacheKey);
      if (cached) {
        logger.debug(`Lookup ${path} served from cache`, { count: cached.length });
        res.status(200).json({
          success: true,
          data: cached,
          cached: true,
        });
        return;
      }
    }

    let data: any[] = [];

    if (path === 'sectors') {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search } },
        ];
      }
      if (parentId) {
        where.parentId = parentId;
      }

      data = await prisma.sector.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { children: true, userSectors: true, contactSectors: true },
          },
        },
      });

      // Transform to include counts
      data = data.map((sector: any) => ({
        id: sector.id,
        name: sector.name,
        nameAr: sector.nameAr,
        parentId: sector.parentId,
        childrenCount: sector._count.children,
        usersCount: sector._count.userSectors,
        contactsCount: sector._count.contactSectors,
      }));
    } else if (path === 'skills') {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search } },
        ];
      }

      data = await prisma.skill.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { userSkills: true, contactSkills: true },
          },
        },
      });

      // Transform to include counts
      data = data.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        nameAr: skill.nameAr,
        category: skill.category,
        usersCount: skill._count.userSkills,
        contactsCount: skill._count.contactSkills,
      }));
    } else if (path === 'interests') {
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search } },
        ];
      }

      data = await prisma.interest.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { userInterests: true },
          },
        },
      });

      // Transform to include counts
      data = data.map((interest: any) => ({
        id: interest.id,
        name: interest.name,
        nameAr: interest.nameAr,
        usersCount: interest._count.userInterests,
      }));
    } else if (path === 'hobbies') {
      const where: any = { isActive: true };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameAr: { contains: search } },
        ];
      }

      data = await prisma.hobby.findMany({
        where,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { userHobbies: true },
          },
        },
      });

      // Transform to include counts
      data = data.map((hobby: any) => ({
        id: hobby.id,
        name: hobby.name,
        nameAr: hobby.nameAr,
        category: hobby.category,
        icon: hobby.icon,
        usersCount: hobby._count.userHobbies,
      }));
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PATH', message: `Unknown lookup type: ${path}` },
      });
      return;
    }

    // Cache the result (only if no search query)
    if (!search) {
      cacheService.set(cacheKey, data, CACHE_TTL.LOOKUP_LIST).catch(() => {
        // Ignore cache errors
      });
    }

    logger.debug(`Lookup ${path} fetched from database`, { count: data.length, search });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/sectors/:id
 * Get sector/skill/interest by ID (with caching)
 */
lookupRoutes.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.baseUrl.split('/').pop();
    const { id } = req.params;

    // Generate cache key
    let cacheKey = '';
    if (path === 'sectors') {
      cacheKey = CACHE_KEYS.SECTOR_BY_ID + id;
    } else if (path === 'skills') {
      cacheKey = CACHE_KEYS.SKILL_BY_ID + id;
    } else if (path === 'interests') {
      cacheKey = CACHE_KEYS.INTEREST_BY_ID + id;
    } else if (path === 'hobbies') {
      cacheKey = CACHE_KEYS.HOBBY_BY_ID + id;
    }

    // Try to get from cache
    if (cacheKey && cacheService.isAvailable()) {
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        logger.debug(`Lookup ${path}/${id} served from cache`);
        res.status(200).json({
          success: true,
          data: cached,
          cached: true,
        });
        return;
      }
    }

    let data: any = null;

    if (path === 'sectors') {
      data = await prisma.sector.findUnique({
        where: { id },
        include: {
          parent: true,
          children: true,
          _count: {
            select: { userSectors: true, contactSectors: true },
          },
        },
      });

      if (data) {
        data = {
          id: data.id,
          name: data.name,
          nameAr: data.nameAr,
          parentId: data.parentId,
          parent: data.parent ? { id: data.parent.id, name: data.parent.name } : null,
          children: data.children.map((c: any) => ({ id: c.id, name: c.name })),
          usersCount: data._count.userSectors,
          contactsCount: data._count.contactSectors,
        };
      }
    } else if (path === 'skills') {
      data = await prisma.skill.findUnique({
        where: { id },
        include: {
          _count: {
            select: { userSkills: true, contactSkills: true },
          },
        },
      });

      if (data) {
        data = {
          id: data.id,
          name: data.name,
          nameAr: data.nameAr,
          category: data.category,
          usersCount: data._count.userSkills,
          contactsCount: data._count.contactSkills,
        };
      }
    } else if (path === 'interests') {
      data = await prisma.interest.findUnique({
        where: { id },
        include: {
          _count: {
            select: { userInterests: true },
          },
        },
      });

      if (data) {
        data = {
          id: data.id,
          name: data.name,
          nameAr: data.nameAr,
          usersCount: data._count.userInterests,
        };
      }
    } else if (path === 'hobbies') {
      data = await prisma.hobby.findUnique({
        where: { id },
        include: {
          _count: {
            select: { userHobbies: true },
          },
        },
      });

      if (data) {
        data = {
          id: data.id,
          name: data.name,
          nameAr: data.nameAr,
          category: data.category,
          icon: data.icon,
          usersCount: data._count.userHobbies,
        };
      }
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PATH', message: `Unknown lookup type: ${path}` },
      });
      return;
    }

    if (!data) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `${path?.slice(0, -1)} not found` },
      });
      return;
    }

    // Cache the result
    if (cacheKey) {
      cacheService.set(cacheKey, data, CACHE_TTL.SECTORS).catch(() => {
        // Ignore cache errors
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sectors
 * Create a new sector/skill/interest (for custom user additions)
 * Invalidates cache on creation
 */
lookupRoutes.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.baseUrl.split('/').pop();
    const { name, nameAr, parentId, category } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_NAME', message: 'Name is required' },
      });
      return;
    }

    let data: any = null;

    if (path === 'sectors') {
      // Check if sector already exists
      const existing = await prisma.sector.findFirst({
        where: { name: { equals: name } },
      });

      if (existing) {
        res.status(200).json({
          success: true,
          data: { id: existing.id, name: existing.name, nameAr: existing.nameAr },
          message: 'Sector already exists',
        });
        return;
      }

      data = await prisma.sector.create({
        data: { name, nameAr, parentId },
      });

      // Invalidate cache
      await cacheService.invalidateLookupCache('sectors');
    } else if (path === 'skills') {
      const existing = await prisma.skill.findFirst({
        where: { name: { equals: name } },
      });

      if (existing) {
        res.status(200).json({
          success: true,
          data: { id: existing.id, name: existing.name, nameAr: existing.nameAr },
          message: 'Skill already exists',
        });
        return;
      }

      data = await prisma.skill.create({
        data: { name, nameAr, category },
      });

      // Invalidate cache
      await cacheService.invalidateLookupCache('skills');
    } else if (path === 'interests') {
      const existing = await prisma.interest.findFirst({
        where: { name: { equals: name } },
      });

      if (existing) {
        res.status(200).json({
          success: true,
          data: { id: existing.id, name: existing.name, nameAr: existing.nameAr },
          message: 'Interest already exists',
        });
        return;
      }

      data = await prisma.interest.create({
        data: { name, nameAr },
      });

      // Invalidate cache
      await cacheService.invalidateLookupCache('interests');
    } else if (path === 'hobbies') {
      const existing = await prisma.hobby.findFirst({
        where: { name: { equals: name } },
      });

      if (existing) {
        res.status(200).json({
          success: true,
          data: { id: existing.id, name: existing.name, nameAr: existing.nameAr },
          message: 'Hobby already exists',
        });
        return;
      }

      data = await prisma.hobby.create({
        data: { name, nameAr, category },
      });

      // Invalidate cache
      await cacheService.invalidateLookupCache('hobbies');
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PATH', message: `Unknown lookup type: ${path}` },
      });
      return;
    }

    logger.info(`Created new ${path?.slice(0, -1)}`, { id: data.id, name: data.name });

    res.status(201).json({
      success: true,
      data: { id: data.id, name: data.name, nameAr: data.nameAr },
    });
  } catch (error) {
    next(error);
  }
});

export default lookupRoutes;
