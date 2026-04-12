/**
 * Custom Error Classes
 *
 * Provides a hierarchy of custom error classes for different error scenarios.
 * All errors extend BaseError which provides consistent error handling.
 *
 * @module shared/errors
 */

/**
 * Base error class for all application errors
 *
 * @abstract
 */
export abstract class BaseError extends Error {
  /**
   * HTTP status code for the error
   */
  abstract readonly statusCode: number;

  /**
   * Error code for client identification
   */
  abstract readonly code: string;

  /**
   * Whether the error is operational (expected) vs programming error
   */
  readonly isOperational: boolean = true;

  /**
   * Additional error details
   */
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }

  /**
   * Convert error to JSON for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation error (400 Bad Request)
 *
 * Use when request data fails validation
 */
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string = 'Validation failed',
    details?: Record<string, unknown>
  ) {
    super(message, details);
  }
}

/**
 * Authentication error (401 Unauthorized)
 *
 * Use when user is not authenticated
 */
export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required') {
    super(message);
  }
}

/**
 * Authorization error (403 Forbidden)
 *
 * Use when user doesn't have permission
 */
export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied') {
    super(message);
  }
}

/**
 * Forbidden error (403 Forbidden)
 *
 * Alias for AuthorizationError - use when user doesn't have permission
 */
export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(message: string = 'Access denied') {
    super(message);
  }
}

/**
 * Not found error (404 Not Found)
 *
 * Use when a resource is not found
 */
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
  }
}

/**
 * Conflict error (409 Conflict)
 *
 * Use when there's a conflict (e.g., duplicate entry)
 */
export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';

  constructor(message: string = 'Resource already exists') {
    super(message);
  }
}

/**
 * Rate limit error (429 Too Many Requests)
 *
 * Use when rate limit is exceeded
 */
export class RateLimitError extends BaseError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Too many requests, please try again later') {
    super(message);
  }
}

/**
 * External service error (502 Bad Gateway)
 *
 * Use when an external service fails
 */
export class ExternalServiceError extends BaseError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_SERVICE_ERROR';

  constructor(
    serviceName: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(`${serviceName}: ${message}`, details);
  }
}

/**
 * Internal server error (500 Internal Server Error)
 *
 * Use for unexpected errors
 */
export class InternalError extends BaseError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  readonly isOperational = false;

  constructor(message: string = 'An unexpected error occurred') {
    super(message);
  }
}

/**
 * Domain exception for business rule violations
 *
 * Use when business rules are violated
 */
export class DomainException extends BaseError {
  readonly statusCode = 422;
  readonly code = 'DOMAIN_EXCEPTION';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}
