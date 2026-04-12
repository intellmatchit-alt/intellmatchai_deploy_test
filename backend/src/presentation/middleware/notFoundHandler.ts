/**
 * Not Found Handler Middleware
 *
 * Handles requests to routes that don't exist.
 *
 * @module presentation/middleware/notFoundHandler
 */

import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../shared/errors/index.js';

/**
 * Not found handler middleware
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};
