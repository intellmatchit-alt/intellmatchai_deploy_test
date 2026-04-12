/**
 * PNME Dependency Injection Container
 *
 * Registers all PNME services with tsyringe for dependency injection.
 * This file should be imported early in the application bootstrap.
 *
 * @module infrastructure/container/pitchContainer
 */

import { container } from 'tsyringe';

// Import interfaces (for type tokens)
import { IFileStorageService } from '../../application/interfaces/IFileStorageService';
import { IPitchQueueService } from '../../application/interfaces/IPitchQueueService';
import {
  IDocumentParserService,
  ISectionClassifierService,
  INeedsExtractorService,
  IEmbeddingService,
  IProfileBuilderService,
  IMatchExplainerService,
  IOutreachGeneratorService,
} from '../../application/interfaces/IPitchAIService';

// Import repository interfaces
import {
  IPitchRepository,
  IPitchSectionRepository,
  IPitchNeedRepository,
  IPitchMatchRepository,
  IPitchJobRepository,
  IContactProfileCacheRepository,
  IUserPNMEPreferencesRepository,
} from '../../domain/repositories/IPitchRepository';
import { IContactRepository } from '../../domain/repositories/IContactRepository';

// Import implementations
import {
  PrismaPitchRepository,
  PrismaPitchSectionRepository,
  PrismaPitchNeedRepository,
  PrismaPitchMatchRepository,
  PrismaPitchJobRepository,
  PrismaContactProfileCacheRepository,
  PrismaUserPNMEPreferencesRepository,
} from '../repositories/PrismaPitchRepository';
import { PrismaContactRepository } from '../repositories/PrismaContactRepository';

import {
  documentParserService,
  sectionClassifierService,
  needsExtractorService,
  profileBuilderService,
  matchExplainerService,
  outreachGeneratorService,
  pitchQueueService,
  pitchFileStorageService,
} from '../services/pitch';

import { embeddingService } from '../external/embedding/EmbeddingService';
import { logger } from '../../shared/logger';

/**
 * Register PNME repositories
 * Note: Repository classes import prisma directly, no constructor argument needed
 */
function registerRepositories(): void {
  // Pitch Repository
  container.register<IPitchRepository>('PitchRepository', {
    useClass: PrismaPitchRepository,
  });

  // Pitch Section Repository
  container.register<IPitchSectionRepository>('PitchSectionRepository', {
    useClass: PrismaPitchSectionRepository,
  });

  // Pitch Need Repository
  container.register<IPitchNeedRepository>('PitchNeedRepository', {
    useClass: PrismaPitchNeedRepository,
  });

  // Pitch Match Repository
  container.register<IPitchMatchRepository>('PitchMatchRepository', {
    useClass: PrismaPitchMatchRepository,
  });

  // Pitch Job Repository
  container.register<IPitchJobRepository>('PitchJobRepository', {
    useClass: PrismaPitchJobRepository,
  });

  // Contact Profile Cache Repository
  container.register<IContactProfileCacheRepository>('ContactProfileCacheRepository', {
    useClass: PrismaContactProfileCacheRepository,
  });

  // User PNME Preferences Repository
  container.register<IUserPNMEPreferencesRepository>('UserPNMEPreferencesRepository', {
    useClass: PrismaUserPNMEPreferencesRepository,
  });

  // Contact Repository (needed by PNME workers)
  container.register<IContactRepository>('ContactRepository', {
    useClass: PrismaContactRepository,
  });
}

/**
 * Register PNME services
 */
function registerServices(): void {
  // File Storage Service
  container.register<IFileStorageService>('FileStorageService', {
    useValue: pitchFileStorageService,
  });

  // Queue Service
  container.register<IPitchQueueService>('PitchQueueService', {
    useValue: pitchQueueService,
  });

  // Document Parser Service
  container.register<IDocumentParserService>('DocumentParserService', {
    useValue: documentParserService,
  });

  // Section Classifier Service
  container.register<ISectionClassifierService>('SectionClassifierService', {
    useValue: sectionClassifierService,
  });

  // Needs Extractor Service
  container.register<INeedsExtractorService>('NeedsExtractorService', {
    useValue: needsExtractorService,
  });

  // Profile Builder Service
  container.register<IProfileBuilderService>('ProfileBuilderService', {
    useValue: profileBuilderService,
  });

  // Match Explainer Service
  container.register<IMatchExplainerService>('MatchExplainerService', {
    useValue: matchExplainerService,
  });

  // Outreach Generator Service
  container.register<IOutreachGeneratorService>('OutreachGeneratorService', {
    useValue: outreachGeneratorService,
  });

  // Embedding Service (reuse existing)
  container.register<IEmbeddingService>('EmbeddingService', {
    useValue: {
      generateEmbedding: async (text: string) => {
        const profile = {
          id: `text-${Date.now()}`,
          type: 'contact' as const,
          bio: text,
        };
        const result = await embeddingService.generateProfileEmbedding(profile);
        return {
          embedding: result?.embedding || [],
          model: 'text-embedding-3-small',
          tokensUsed: 0,
        };
      },
      generateEmbeddings: async (texts: string[]) => {
        const profiles = texts.map((text, i) => ({
          id: `text-${Date.now()}-${i}`,
          type: 'contact' as const,
          bio: text,
        }));
        const results = await embeddingService.generateBatchEmbeddings(profiles);
        return {
          embeddings: Array.from(results.values()).map((r) => r.embedding),
          model: 'text-embedding-3-small',
          tokensUsed: 0,
        };
      },
      cosineSimilarity: (a: number[], b: number[]) => {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
          dotProduct += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
      },
    },
  });
}

/**
 * Register PNME use cases
 */
function registerUseCases(): void {
  // Use cases are automatically resolved via @injectable() decorator
  // No explicit registration needed as long as the decorator is present
}

/**
 * Initialize PNME container
 * Call this function during application bootstrap
 */
export function initializePNMEContainer(): void {
  logger.info('Initializing PNME dependency injection container...');

  registerRepositories();
  registerServices();
  registerUseCases();

  logger.info('PNME container initialized successfully');
}

/**
 * Get the tsyringe container
 */
export { container };
