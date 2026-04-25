import { prisma } from '../database/prisma/client';

interface CacheEntry {
  value: string;
  expiry: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class SystemConfigService {
  private cache: Map<string, CacheEntry> = new Map();

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (!config) return null;

    this.cache.set(key, { value: config.value, expiry: Date.now() + CACHE_TTL });
    return config.value;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const value = await this.get(key);
    if (value === null) return defaultValue;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async set(key: string, value: string): Promise<void> {
    await prisma.systemConfig.update({
      where: { key },
      data: { value },
    });
    this.cache.delete(key);
  }

  async getAll(group?: string) {
    const where = group ? { groupName: group } : {};
    return prisma.systemConfig.findMany({ where, orderBy: { key: 'asc' } });
  }

  invalidateCache() {
    this.cache.clear();
  }
}

export const systemConfigService = new SystemConfigService();
