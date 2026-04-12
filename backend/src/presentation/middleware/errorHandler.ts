/**
 * Global Error Handler Middleware
 *
 * Catches all errors and returns consistent error responses.
 * Handles both operational errors and unexpected errors.
 *
 * @module presentation/middleware/errorHandler
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { BaseError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger/index.js';
import { generateRequestId } from '../../shared/utils/index.js';

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Global error handler middleware
 *
 * @param error - The error that occurred
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId =
    (req.headers['x-request-id'] as string) || generateRequestId();
  const timestamp = new Date().toISOString();

  // Log the error
  logger.error({
    requestId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  // Handle our custom errors
  if (error instanceof BaseError) {
    const errorJson = error.toJSON() as ErrorResponse['error'];
    const response: ErrorResponse = {
      success: false,
      message: errorJson.message,
      error: errorJson,
      meta: { timestamp, requestId },
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      message: 'Request validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      meta: { timestamp, requestId },
    };

    res.status(400).json(response);
    return;
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let code = 'DATABASE_ERROR';
    let message = 'Database operation failed';

    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with this value already exists';
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY_CONSTRAINT';
        message = 'Related record not found';
        break;
    }

    const response: ErrorResponse = {
      success: false,
      message,
      error: { code, message },
      meta: { timestamp, requestId },
    };

    res.status(statusCode).json(response);
    return;
  }

  // Handle JWT errors
  if (error.name === 'TokenExpiredError') {
    const response: ErrorResponse = {
      success: false,
      message: 'Your session has expired. Please log in again.',
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      },
      meta: { timestamp, requestId },
    };

    res.status(401).json(response);
    return;
  }

  if (error.name === 'JsonWebTokenError') {
    const response: ErrorResponse = {
      success: false,
      message: 'Invalid authentication token',
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
      meta: { timestamp, requestId },
    };

    res.status(401).json(response);
    return;
  }

  // Unknown errors - don't leak details in production
  const errorMessage = process.env.NODE_ENV === 'development'
    ? error.message
    : 'An unexpected error occurred';
  const response: ErrorResponse = {
    success: false,
    message: errorMessage,
    error: {
      code: 'INTERNAL_ERROR',
      message: errorMessage,
    },
    meta: { timestamp, requestId },
  };

  res.status(500).json(response);
};
