/**
 * Logging Module
 *
 * Provides structured logging using Winston with support for
 * different log levels, formats, and transports.
 *
 * @module shared/logger
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Custom log format for development (readable)
 */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (stack) {
    log += `\n${stack}`;
  }

  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }

  return log;
});

/**
 * Create Winston logger instance
 */
const createLogger = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  return winston.createLogger({
    level: logLevel,
    defaultMeta: {
      service: 'p2p-api',
      environment: process.env.NODE_ENV || 'development',
    },
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true })
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: isDevelopment
          ? combine(colorize(), devFormat)
          : combine(json()),
      }),

      // File transports for production
      ...(process.env.NODE_ENV === 'production'
        ? [
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              format: json(),
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              format: json(),
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
            }),
          ]
        : []),
    ],
  });
};

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * HTTP request logging helper
 */
(logger as any).http = (message: string) => {
  logger.log('http', message);
};

/**
 * Create a child logger with additional context
 *
 * @param context - Additional context to include in logs
 * @returns Child logger instance
 *
 * @example
 * ```typescript
 * const contactLogger = createChildLogger({ module: 'contacts' });
 * contactLogger.info('Contact created', { contactId: '123' });
 * ```
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export default logger;
