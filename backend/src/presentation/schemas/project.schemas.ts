/**
 * Project Validation Schemas
 *
 * Zod schemas for validating project-related requests.
 *
 * @module presentation/schemas/project.schemas
 */

import { z } from 'zod';

// ===== Enums =====

export const ProjectStageEnum = z.enum([
  'IDEA',
  'MVP',
  'EARLY',
  'GROWTH',
  'SCALE',
]);

export const ProjectVisibilityEnum = z.enum([
  'PUBLIC',
  'PRIVATE',
  'CONNECTIONS_ONLY',
]);

export const SkillImportanceEnum = z.enum([
  'REQUIRED',
  'PREFERRED',
  'NICE_TO_HAVE',
]);

export const ProjectMatchStatusEnum = z.enum([
  'PENDING',
  'CONTACTED',
  'SAVED',
  'DISMISSED',
  'CONNECTED',
]);

export const LookingForEnum = z.enum([
  'investor',
  'advisor',
  'service_provider',
  'strategic_partner',
  'channel_distribution',
  'technical_partner',
  'cofounder_talent',
]);

export const ProjectCategoryEnum = z.enum([
  'healthtech',
  'fintech',
  'edtech',
  'saas',
  'ecommerce',
  'aiml',
  'cleantech',
  'proptech',
  'agritech',
  'foodtech',
  'legaltech',
  'hrtech',
  'martech',
  'insurtech',
  'logistics',
  'gaming',
  'social',
  'media',
  'cybersecurity',
  'iot',
  'blockchain',
  'other',
]);

// ===== Shared Types =====

const SkillWithImportance = z.object({
  skillId: z.string().uuid('Invalid skill ID format'),
  importance: SkillImportanceEnum.optional().default('REQUIRED'),
});

const PaginationQuery = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = val ? parseInt(val, 10) || 20 : 20;
      return Math.min(100, Math.max(1, parsed));
    }),
});

// ===== Request Schemas =====

/**
 * POST /api/v1/projects - Create project
 */
export const createProjectSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(1, 'Title is required')
      .max(255, 'Title must be 255 characters or less'),
    summary: z
      .string({ required_error: 'Summary is required' })
      .min(1, 'Summary is required')
      .max(2000, 'Summary must be 2000 characters or less'),
    detailedDesc: z.string().max(10000, 'Detailed description must be 10000 characters or less').optional(),
    category: z.string().max(100, 'Category must be 100 characters or less').optional(),
    stage: ProjectStageEnum.optional().default('IDEA'),
    investmentRange: z.string().max(100, 'Investment range must be 100 characters or less').optional(),
    timeline: z.string().max(2000, 'Timeline must be 2000 characters or less').optional(),
    lookingFor: z.array(z.string().max(100)).optional().default([]),
    sectorIds: z.array(z.string().uuid('Invalid sector ID format')).optional().default([]),
    skills: z.array(SkillWithImportance).optional().default([]),
    visibility: ProjectVisibilityEnum.optional().default('PRIVATE'),
    metadata: z.record(z.any()).optional(),
    needs: z.array(z.string().max(200)).optional().default([]),
    markets: z.array(z.string().max(100)).optional().default([]),
    fundingAskMin: z.number().int().min(0).optional().nullable(),
    fundingAskMax: z.number().int().min(0).optional().nullable(),
    tractionSignals: z.array(z.string().max(200)).optional().default([]),
    advisoryTopics: z.array(z.string().max(200)).optional().default([]),
    partnerTypeNeeded: z.array(z.string().max(100)).optional().default([]),
    commitmentLevelNeeded: z.string().max(50).optional().nullable(),
    idealCounterpartProfile: z.string().max(5000).optional().nullable(),
    targetCustomerTypes: z.array(z.string().max(100)).optional().default([]),
    engagementModel: z.array(z.string().max(100)).optional().default([]),
    strictLookingFor: z.boolean().optional().default(false),
  }),
});

/**
 * PUT /api/v1/projects/:id - Update project
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(255, 'Title must be 255 characters or less').optional(),
    summary: z.string().min(1, 'Summary cannot be empty').max(2000, 'Summary must be 2000 characters or less').optional(),
    detailedDesc: z.string().max(10000, 'Detailed description must be 10000 characters or less').optional().nullable(),
    category: z.string().max(100, 'Category must be 100 characters or less').optional().nullable(),
    stage: ProjectStageEnum.optional(),
    investmentRange: z.string().max(100, 'Investment range must be 100 characters or less').optional().nullable(),
    timeline: z.string().max(2000, 'Timeline must be 2000 characters or less').optional().nullable(),
    lookingFor: z.array(z.string().max(100)).optional(),
    sectorIds: z.array(z.string().uuid('Invalid sector ID format')).optional(),
    skills: z.array(SkillWithImportance).optional(),
    visibility: ProjectVisibilityEnum.optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
    needs: z.array(z.string().max(200)).optional(),
    markets: z.array(z.string().max(100)).optional(),
    fundingAskMin: z.number().int().min(0).optional().nullable(),
    fundingAskMax: z.number().int().min(0).optional().nullable(),
    tractionSignals: z.array(z.string().max(200)).optional(),
    advisoryTopics: z.array(z.string().max(200)).optional(),
    partnerTypeNeeded: z.array(z.string().max(100)).optional(),
    commitmentLevelNeeded: z.string().max(50).optional().nullable(),
    idealCounterpartProfile: z.string().max(5000).optional().nullable(),
    targetCustomerTypes: z.array(z.string().max(100)).optional(),
    engagementModel: z.array(z.string().max(100)).optional(),
    strictLookingFor: z.boolean().optional(),
  }),
});

/**
 * GET /api/v1/projects - List projects
 */
export const listProjectsSchema = z.object({
  query: PaginationQuery.extend({
    status: z.enum(['active', 'inactive', 'all']).optional(),
  }),
});

/**
 * GET /api/v1/projects/:id - Get project
 */
export const getProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),
});

/**
 * DELETE /api/v1/projects/:id - Delete project
 */
export const deleteProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),
});

/**
 * POST /api/v1/projects/:id/find-matches - Find matches
 */
export const findMatchesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),
});

/**
 * GET /api/v1/projects/:id/matches - Get matches
 */
export const getMatchesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),
  query: z.object({
    type: z.enum(['user', 'contact', 'all']).optional(),
    status: z
      .string()
      .optional()
      .transform((val) => val?.toUpperCase())
      .pipe(ProjectMatchStatusEnum.optional()),
    minScore: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : Math.min(100, Math.max(0, num));
      }),
  }),
});

/**
 * PUT /api/v1/projects/:id/matches/:matchId/status - Update match status
 */
export const updateMatchStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project ID format'),
    matchId: z.string().uuid('Invalid match ID format'),
  }),
  body: z.object({
    status: z
      .string()
      .transform((val) => val.toUpperCase())
      .pipe(ProjectMatchStatusEnum)
      .optional(),
    suggestedMessageEdited: z.string().optional(),
  }).refine((data) => data.status !== undefined || data.suggestedMessageEdited !== undefined, {
    message: 'Status or suggestedMessageEdited is required',
  }),
});

/**
 * GET /api/v1/projects/discover/all - Discover projects
 */
export const discoverProjectsSchema = z.object({
  query: PaginationQuery.extend({
    category: z.string().max(100).optional(),
    stage: ProjectStageEnum.optional(),
    sector: z.string().uuid('Invalid sector ID format').optional(),
  }),
});

// ===== Type Exports =====

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>['query'];
export type GetMatchesQuery = z.infer<typeof getMatchesSchema>['query'];
export type DiscoverProjectsQuery = z.infer<typeof discoverProjectsSchema>['query'];
