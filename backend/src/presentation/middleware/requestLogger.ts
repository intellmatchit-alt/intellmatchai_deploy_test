/**
 * Request Logger Middleware
 *
 * Adds request ID and logs request/response information.
 *
 * @module presentation/middleware/requestLogger
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/logger/index.js';
import { generateRequestId } from '../../shared/utils/index.js';

/**
 * Request logger middleware
 *
 * Adds a unique request ID to each request and logs request details.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate or use existing request ID
  const requestId =
    (req.headers['x-request-id'] as string) || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Record start time
  const startTime = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info({
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as any).user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    });
  });

  next();
};
