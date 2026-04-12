/**
 * PNME Validators: Request validation schemas for pitch operations
 */

import { z } from 'zod';
import { PitchSectionType, PitchStatus } from '../../domain/entities/Pitch';

// Upload pitch
const uploadSchema = z.object({
  body: z.object({
    title: z.string().max(255).optional(),
    language: z.enum(['en', 'ar']).optional().default('en'),
  }),
});

// List pitches
const listSchema = z.object({
  query: z.object({
    status: z.nativeEnum(PitchStatus).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

// Get pitch by ID
const getByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

// Get pitch results
const getResultsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    sectionType: z.nativeEnum(PitchSectionType).optional(),
    minScore: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }),
});

// Rematch pitch
const rematchSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    fromStep: z.enum(['COMPUTE_MATCHES', 'GENERATE_OUTREACH']).optional(),
  }),
});

// Export pitch results
const exportSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    format: z.enum(['json', 'csv', 'pdf']).optional().default('json'),
  }),
});

// Regenerate outreach
const regenerateOutreachSchema = z.object({
  params: z.object({
    pitchId: z.string().uuid(),
    sectionId: z.string().uuid(),
    contactId: z.string().uuid(),
  }),
  body: z.object({
    tone: z.enum(['professional', 'casual', 'warm']).optional().default('professional'),
    focus: z.string().max(500).optional(),
  }),
});

// Update PNME preferences
const updatePreferencesSchema = z.object({
  body: z
    .object({
      relevanceWeight: z.number().min(0).max(1).optional(),
      expertiseWeight: z.number().min(0).max(1).optional(),
      strategicWeight: z.number().min(0).max(1).optional(),
      relationshipWeight: z.number().min(0).max(1).optional(),
      autoDeletePitchDays: z.number().int().min(0).max(365).optional(),
      enableWhatsAppMetadata: z.boolean().optional(),
      defaultLanguage: z.enum(['en', 'ar']).optional(),
      minMatchScore: z.number().int().min(0).max(100).optional(),
      maxMatchesPerSection: z.number().int().min(1).max(50).optional(),
    })
    .refine(
      (data) => {
        // If any weight is provided, validate sum equals 1.0
        const weights = [
          data.relevanceWeight,
          data.expertiseWeight,
          data.strategicWeight,
          data.relationshipWeight,
        ].filter((w) => w !== undefined);

        if (weights.length === 4) {
          const sum = weights.reduce((a, b) => a! + b!, 0);
          return Math.abs(sum! - 1.0) < 0.001;
        }
        return true;
      },
      {
        message: 'Weights must sum to 1.0',
      },
    ),
});

export const pitchValidators = {
  upload: uploadSchema,
  list: listSchema,
  getById: getByIdSchema,
  getResults: getResultsSchema,
  rematch: rematchSchema,
  export: exportSchema,
  regenerateOutreach: regenerateOutreachSchema,
  updatePreferences: updatePreferencesSchema,
};
