/**
 * Application Configuration
 *
 * Centralized configuration management using environment variables.
 * All configuration values are typed and validated at startup.
 *
 * @module config
 */

import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

/**
 * Environment variable schema validation
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3001"),
  APP_NAME: z.string().default("P2P Network"),
  APP_URL: z.string().default("http://localhost:3001"),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6380"),

  // Neo4j
  NEO4J_URI: z.string().default("bolt://localhost:7687"),
  NEO4J_USER: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string().default("neo4jpassword"),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // S3/MinIO
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("p2p-uploads"),
  S3_REGION: z.string().default("us-east-1"),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default("60000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100"),

  // Logging
  LOG_LEVEL: z.string().default("debug"),

  // AI Services (Optional)
  AZURE_DOCUMENT_ENDPOINT: z.string().optional(),
  AZURE_DOCUMENT_KEY: z.string().optional(),
  AZURE_DOCUMENT_KEY_2: z.string().optional(),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  PDL_API_KEY: z.string().optional(),
  RECOMBEE_DATABASE_ID: z.string().optional(),
  RECOMBEE_SECRET_TOKEN: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),

  // Contact Enrichment Services
  NUMVERIFY_API_KEY: z.string().optional(),
  ABSTRACTAPI_API_KEY: z.string().optional(),

  // Face Search Service
  PIMEYES_API_KEY: z.string().optional(),

  // LLM Providers
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  PERPLEXITY_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "groq", "gemini", "auto"]).default("auto"),

  // Google Custom Search
  GOOGLE_CSE_KEY: z.string().optional(),
  GOOGLE_CSE_CX: z.string().optional(),

  // Feature Flags
  FEATURE_AZURE_OCR: z.string().default("false"),
  FEATURE_GOOGLE_VISION: z.string().default("false"),
  FEATURE_PDL_ENRICHMENT: z.string().default("false"),
  FEATURE_FACE_SEARCH: z.string().default("false"),
  FEATURE_RECOMBEE: z.string().default("false"),
  FEATURE_COHERE_RERANK: z.string().default("false"),
  FEATURE_OPENAI_EXPLANATIONS: z.string().default("false"),

  // LLM Provider Feature Flags
  FEATURE_OPENAI: z.string().default("false"),
  FEATURE_GROQ: z.string().default("true"),
  FEATURE_GEMINI: z.string().default("false"),

  // Image Preprocessing
  FEATURE_IMAGE_PREPROCESSING: z.string().default("true"),
  IMAGE_PREPROCESSING_LEVEL: z
    .enum(["none", "light", "aggressive"])
    .default("light"),

  // PayTabs Payment Gateway
  PAYTABS_SERVER_KEY: z.string().optional(),
  PAYTABS_PROFILE_ID: z.string().optional(),
  PAYTABS_CURRENCY: z.string().default("USD"),
  PAYTABS_ENDPOINT: z.string().default("https://secure-jordan.paytabs.com"),
  FEATURE_PAYTABS: z.string().default("false"),

  // CallerKit Phone Enrichment
  CALLERKIT_API_KEY: z.string().optional(),
  CALLERKIT_BASE_URL: z.string().default("https://callerapi.com/api"),
  FEATURE_CALLERKIT: z.string().default("false"),

  // SerpAPI LinkedIn Discovery
  SERPAPI_API_KEY: z.string().optional(),
  FEATURE_SERPAPI: z.string().default("false"),

  // Superadmin
  SUPERADMIN_JWT_SECRET: z.string().optional(),

  // SDAIA PDPL Compliance
  SDAIA_RETENTION_DAYS: z.string().default("365"),
  SDAIA_AUDIT_LOGGING: z.string().default("true"),
  SDAIA_CONTROLLER_NAME: z.string().default("IntellMatch"),
  SDAIA_CONTROLLER_CONTACT: z.string().default("dpo@intellmatch.com"),
  SDAIA_DPO_EMAIL: z.string().default("dpo@intellmatch.com"),
});

/**
 * Parse and validate environment variables
 */
function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:");
    console.error(parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
}

const env = parseEnv();

/**
 * Application configuration object
 */
export const config = {
  /**
   * Application settings
   */
  app: {
    env: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    name: env.APP_NAME,
    url: env.APP_URL,
    clientUrl: env.CORS_ORIGINS.split(",")[0] || "http://localhost:3000",
  },

  /**
   * Database configuration
   */
  database: {
    url: env.DATABASE_URL,
  },

  /**
   * Redis configuration
   */
  redis: {
    url: env.REDIS_URL,
  },

  /**
   * Neo4j configuration
   */
  neo4j: {
    uri: env.NEO4J_URI,
    user: env.NEO4J_USER,
    password: env.NEO4J_PASSWORD,
  },

  /**
   * JWT configuration
   */
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  },

  /**
   * Superadmin configuration
   */
  superadmin: {
    jwtSecret: env.SUPERADMIN_JWT_SECRET || env.JWT_SECRET + "_superadmin",
    jwtExpiry: "2h",
  },

  /**
   * S3/MinIO configuration
   */
  s3: {
    endpoint: env.S3_ENDPOINT,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
  },

  /**
   * CORS configuration
   */
  cors: {
    origins: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
  },

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },

  /**
   * Logging configuration
   */
  logging: {
    level: env.LOG_LEVEL,
  },

  /**
   * AI Services configuration
   */
  ai: {
    azure: {
      endpoint: env.AZURE_DOCUMENT_ENDPOINT,
      key: env.AZURE_DOCUMENT_KEY,
      key2: env.AZURE_DOCUMENT_KEY_2,
    },
    googleVision: {
      apiKey: env.GOOGLE_VISION_API_KEY,
    },
    pdl: {
      apiKey: env.PDL_API_KEY,
    },
    recombee: {
      databaseId: env.RECOMBEE_DATABASE_ID,
      secretToken: env.RECOMBEE_SECRET_TOKEN,
    },
    cohere: {
      apiKey: env.COHERE_API_KEY,
    },
    numverify: {
      apiKey: env.NUMVERIFY_API_KEY,
    },
    abstractapi: {
      apiKey: env.ABSTRACTAPI_API_KEY,
    },
    pimeyes: {
      apiKey: env.PIMEYES_API_KEY,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      enabled: env.FEATURE_OPENAI === "true",
    },
    groq: {
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      enabled: env.FEATURE_GROQ === "true",
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      enabled: env.FEATURE_GEMINI === "true",
    },
    perplexity: {
      apiKey: env.PERPLEXITY_API_KEY,
    },
    googleCse: {
      apiKey: env.GOOGLE_CSE_KEY,
      cx: env.GOOGLE_CSE_CX,
    },
    callerKit: {
      apiKey: env.CALLERKIT_API_KEY,
      baseUrl: env.CALLERKIT_BASE_URL,
    },
    serpapi: {
      apiKey: env.SERPAPI_API_KEY,
    },
    provider: env.AI_PROVIDER,
  },

  /**
   * Feature flags
   */
  features: {
    azureOcr: env.FEATURE_AZURE_OCR === "true",
    googleVision: env.FEATURE_GOOGLE_VISION === "true",
    pdlEnrichment: env.FEATURE_PDL_ENRICHMENT === "true",
    faceSearch: env.FEATURE_FACE_SEARCH === "true",
    recombee: env.FEATURE_RECOMBEE === "true",
    cohereRerank: env.FEATURE_COHERE_RERANK === "true",
    openaiExplanations: env.FEATURE_OPENAI_EXPLANATIONS === "true",
    // LLM Providers
    openai: env.FEATURE_OPENAI === "true",
    groq: env.FEATURE_GROQ === "true",
    gemini: env.FEATURE_GEMINI === "true",
    // Image Preprocessing
    imagePreprocessing: env.FEATURE_IMAGE_PREPROCESSING === "true",
    // Payment Gateway
    paytabs: env.FEATURE_PAYTABS === "true",
    // Phone Enrichment
    callerKit: env.FEATURE_CALLERKIT === "true",
    serpapi: env.FEATURE_SERPAPI === "true",
  },

  /**
   * Image preprocessing configuration
   */
  imagePreprocessing: {
    enabled: env.FEATURE_IMAGE_PREPROCESSING === "true",
    level: env.IMAGE_PREPROCESSING_LEVEL,
  },

  /**
   * PayTabs payment gateway configuration
   */
  paytabs: {
    serverKey: env.PAYTABS_SERVER_KEY,
    profileId: env.PAYTABS_PROFILE_ID,
    currency: env.PAYTABS_CURRENCY,
    endpoint: env.PAYTABS_ENDPOINT,
    enabled: env.FEATURE_PAYTABS === "true",
  },
  /**
   * SDAIA PDPL compliance configuration
   */
  sdaia: {
    retentionDays: parseInt(env.SDAIA_RETENTION_DAYS, 10),
    auditLogging: env.SDAIA_AUDIT_LOGGING === "true",
    controllerName: env.SDAIA_CONTROLLER_NAME,
    controllerContact: env.SDAIA_CONTROLLER_CONTACT,
    dpoEmail: env.SDAIA_DPO_EMAIL,
  },
} as const;

export type Config = typeof config;
