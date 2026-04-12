/**
 * P2P Relationship Intelligence App - Backend Entry Point
 *
 * This is the main entry point for the Express.js backend server.
 * It initializes all components and starts the HTTP server.
 *
 * @module main
 */

import "reflect-metadata";
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import { config } from "./config/index.js";
import { setupSwagger } from "./config/swagger.js";
import { logger } from "./shared/logger/index.js";
import { errorHandler } from "./presentation/middleware/errorHandler.js";
import { notFoundHandler } from "./presentation/middleware/notFoundHandler.js";
import { requestLogger } from "./presentation/middleware/requestLogger.js";
import { rateLimiter } from "./presentation/middleware/rateLimiter.js";
import { routes } from "./presentation/routes/index.js";
import { initializeDatabase } from "./infrastructure/database/prisma/client.js";
import { initializeRedis } from "./infrastructure/database/redis/client.js";
import { initializeWebSocket } from "./infrastructure/websocket/index.js";
import { getServiceContainer } from "./infrastructure/external/ServiceContainer.js";
import { initializePNMEContainer } from "./infrastructure/container/pitchContainer.js";
import { initializeQueues } from "./infrastructure/queue/index.js";
import {
  startOpportunityMatchingWorker,
  stopOpportunityMatchingWorker,
} from "./infrastructure/external/opportunities/workers/opportunity-matching.worker";
import {
  initializeRateLimiter,
  closeRateLimiter,
} from "./infrastructure/external/opportunities/middleware/opportunity-rate-limiter";

/**
 * Creates and configures the Express application
 *
 * @returns Configured Express application
 */
function createApp(): Express {
  const app = express();

  // ===========================================
  // Trust Proxy (required when behind nginx/reverse proxy)
  // ===========================================
  app.set("trust proxy", 1);

  // ===========================================
  // Security Middleware
  // ===========================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", config.app.clientUrl],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ===========================================
  // CORS Configuration
  // ===========================================
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "Accept-Language",
      ],
    }),
  );

  // ===========================================
  // Request Processing
  // ===========================================
  app.use(compression());
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // ===========================================
  // Logging
  // ===========================================
  if (config.app.env !== "test") {
    app.use(
      morgan(config.app.env === "development" ? "dev" : "combined", {
        stream: { write: (message: string) => logger.http(message.trim()) },
        skip: (req) => req.url === "/health" || req.url === "/api/v1/health",
      }),
    );
  }
  app.use(requestLogger);

  // ===========================================
  // Rate Limiting
  // ===========================================
  app.use(rateLimiter);

  // ===========================================
  // Health Check
  // ===========================================
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
    });
  });

  // ===========================================
  // AI Services Status
  // ===========================================
  app.get("/health/services", async (req, res) => {
    try {
      const container = getServiceContainer();
      const [status, health] = await Promise.all([
        container.getStatus(),
        container.healthCheck(),
      ]);

      res.status(health.healthy ? 200 : 503).json({
        healthy: health.healthy,
        services: health.services,
        activeProviders: {
          ocr: status.ocr.active,
          matching: status.matching.active,
          explanation: status.explanation.active,
        },
        availability: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        healthy: false,
        error: "Failed to check service status",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===========================================
  // API Documentation (Swagger UI) — protected by basic auth
  // Set SWAGGER_ENABLED=false in .env to disable
  // ===========================================
  if (process.env.SWAGGER_ENABLED !== "false") {
    const swaggerUser = process.env.SWAGGER_USER || "intellmatch";
    const swaggerPass = process.env.SWAGGER_PASSWORD || "intellmatch@docs2024";
    app.use("/api-docs", (req, res, next) => {
      // Relax CSP for Swagger UI — swagger-ui-bundle.js requires 'unsafe-eval'
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
      );
      const auth = req.headers.authorization;
      if (auth) {
        const [scheme, encoded] = auth.split(" ");
        if (scheme === "Basic" && encoded) {
          const decoded = Buffer.from(encoded, "base64").toString("utf-8");
          const [user, pass] = decoded.split(":");
          if (user === swaggerUser && pass === swaggerPass) {
            return next();
          }
        }
      }
      res.setHeader("WWW-Authenticate", 'Basic realm="API Documentation"');
      res.status(401).send("Authentication required");
    });
    setupSwagger(app);
  }

  // ===========================================
  // API Routes
  // ===========================================
  app.use("/api/v1", routes);

  // ===========================================
  // Error Handling
  // ===========================================
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Initializes all services and starts the server
 */
async function bootstrap(): Promise<void> {
  try {
    logger.info("Starting P2P Backend Server...");
    logger.info(`Environment: ${config.app.env}`);

    // Initialize database connections
    logger.info("Connecting to databases...");
    await initializeDatabase();
    await initializeRedis();
    logger.info("Database connections established");

    // Initialize PNME dependency injection container
    logger.info("Initializing PNME container...");
    initializePNMEContainer();
    logger.info("PNME container initialized");

    // Initialize AI services container
    logger.info("Initializing AI services...");
    const serviceContainer = getServiceContainer();
    await serviceContainer.initialize();
    logger.info("AI services initialized");

    // Initialize queue service and start BullMQ workers
    logger.info("Initializing queue service and workers...");
    await initializeQueues();
    logger.info("Queue service and workers initialized");

    // Initialize opportunity matching v2 worker and rate limiter
    logger.info("Initializing opportunity matching v2...");
    initializeRateLimiter();
    startOpportunityMatchingWorker();
    logger.info("Opportunity matching v2 worker started");

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize WebSocket
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origins,
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });
    initializeWebSocket(io);
    logger.info("WebSocket server initialized");

    // Start listening
    httpServer.listen(config.app.port, () => {
      logger.info(`Server running on port ${config.app.port}`);
      logger.info(
        `API available at http://localhost:${config.app.port}/api/v1`,
      );
      logger.info(`Health check at http://localhost:${config.app.port}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      httpServer.close(() => {
        logger.info("HTTP server closed");
      });

      // Close database connections
      // await prisma.$disconnect();
      // await redis.quit();

      // Stop opportunity matching worker and rate limiter
      await stopOpportunityMatchingWorker().catch(() => {});
      await closeRateLimiter().catch(() => {});

      logger.info("Graceful shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
