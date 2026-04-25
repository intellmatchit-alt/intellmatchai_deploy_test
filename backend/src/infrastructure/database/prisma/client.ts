/**
 * Prisma Database Client
 *
 * Singleton Prisma client instance with connection management and retry logic.
 *
 * @module infrastructure/database/prisma/client
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../../shared/logger/index';

/**
 * Prisma client instance - initialized on first access
 */
let _prisma: PrismaClient | undefined;

/**
 * Connection health check interval
 */
let _healthCheckInterval: NodeJS.Timeout | undefined;

/**
 * Track if we're currently reconnecting to avoid multiple reconnect attempts
 */
let _isReconnecting = false;

/**
 * Reconnect to database with retry logic
 */
async function reconnectWithRetry(maxRetries = 3): Promise<boolean> {
  if (_isReconnecting) return false;
  _isReconnecting = true;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Database reconnection attempt ${attempt}/${maxRetries}...`);
      if (_prisma) {
        await _prisma.$disconnect().catch(() => {}); // Ignore disconnect errors
        await _prisma.$connect();
        logger.info('Database reconnected successfully');
        _isReconnecting = false;
        return true;
      }
    } catch (error) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)
      logger.warn(`Reconnection attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error('All database reconnection attempts failed');
  _isReconnecting = false;
  return false;
}

/**
 * Get or create Prisma client instance
 *
 * @returns Prisma client singleton
 */
export const getPrismaClient = (): PrismaClient => {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      _prisma.$on('query' as never, (e: any) => {
        logger.debug({
          type: 'prisma_query',
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        });
      });
    }

    // Start health check interval to keep connections alive (every 30 seconds)
    // This prevents connections from going stale
    if (!_healthCheckInterval) {
      _healthCheckInterval = setInterval(async () => {
        if (!_prisma || _isReconnecting) return;
        try {
          await _prisma.$queryRaw`SELECT 1`;
        } catch (error) {
          logger.warn('Database health check failed, attempting reconnection...', error);
          await reconnectWithRetry(3);
        }
      }, 30 * 1000); // 30 seconds - keeps connections active

      // Also run an immediate health check after 5 seconds of startup
      setTimeout(async () => {
        if (!_prisma || _isReconnecting) return;
        try {
          await _prisma.$queryRaw`SELECT 1`;
          logger.info('Initial database health check passed');
        } catch (error) {
          logger.warn('Initial database health check failed, reconnecting...', error);
          await reconnectWithRetry(3);
        }
      }, 5000);
    }
  }

  return _prisma;
};

/**
 * Force reconnect - call this when a database operation fails
 */
export const forceReconnect = async (): Promise<boolean> => {
  return reconnectWithRetry(3);
};

/**
 * Execute a database operation with automatic retry on connection failure
 *
 * @param operation - The database operation to execute
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns The result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if this is a connection error that should trigger a retry
      const isConnectionError =
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1002' || // Connection timed out
        error?.code === 'P1008' || // Operations timed out
        error?.code === 'P1017' || // Server closed connection
        error?.message?.includes("Can't reach database server") ||
        error?.message?.includes('Connection refused') ||
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('ETIMEDOUT');

      if (isConnectionError && attempt < maxRetries) {
        logger.warn(`Database operation failed (attempt ${attempt + 1}/${maxRetries + 1}), reconnecting...`, {
          error: error?.message,
          code: error?.code,
        });

        // Try to reconnect
        await reconnectWithRetry(2);

        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Non-connection error or max retries reached
      throw error;
    }
  }

  throw lastError;
}

/**
 * Initialize database connection
 *
 * Tests the database connection and logs the result.
 */
export const initializeDatabase = async (): Promise<void> => {
  const client = getPrismaClient();

  try {
    // Test connection
    await client.$connect();
    logger.info('MySQL database connected successfully');

    // Log database info
    const result = await client.$queryRaw<
      [{ version: string }]
    >`SELECT VERSION() as version`;
    logger.info(`MySQL version: ${result[0]?.version}`);
  } catch (error) {
    logger.error('Failed to connect to MySQL database:', error);
    throw error;
  }
};

/**
 * Disconnect from database
 *
 * Should be called during graceful shutdown.
 */
export const disconnectDatabase = async (): Promise<void> => {
  if (_prisma) {
    await _prisma.$disconnect();
    logger.info('MySQL database disconnected');
  }
};

/**
 * Prisma client singleton - auto-initializes on first access
 * Use this for direct imports: import { prisma } from './client'
 */
export const prisma = getPrismaClient();

export default getPrismaClient;
