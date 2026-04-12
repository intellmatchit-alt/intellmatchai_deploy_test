/**
 * Validation Middleware
 *
 * Express middleware for validating requests using Zod schemas.
 *
 * @module presentation/middleware/validate.middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Validation middleware factory
 *
 * Creates middleware that validates request against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * router.post('/register', validate(registerSchema), authController.register);
 * ```
 */
export function validate(schema: AnyZodObject) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Parse and validate request
      const result = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace request properties with validated/transformed values
      req.body = result.body ?? req.body;
      req.query = result.query ?? req.query;
      req.params = result.params ?? req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Transform Zod errors to our validation error format
        const messages = error.errors.map((e) => {
          const path = e.path.join('.');
          return `${path}: ${e.message}`;
        });

        // Log detailed validation errors
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: messages,
          body: req.body,
        });

        next(new ValidationError('Validation failed', { errors: messages }));
      } else {
        next(error);
      }
    }
  };
}
