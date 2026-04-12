/**
 * Collaboration Task Validation Schemas
 *
 * Zod schemas for validating collaboration task-related requests.
 *
 * @module presentation/schemas/collaborationTask.schemas
 */

import { z } from 'zod';

// ===== Enums =====

export const TaskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]);

export const TaskPriorityEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

// ===== Request Schemas =====

/**
 * POST /api/v1/projects/:projectId/tasks - Create task
 */
export const createCollaborationTaskSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
  }),
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(1, 'Title is required')
      .max(255, 'Title must be 255 characters or less'),
    description: z
      .string()
      .max(5000, 'Description must be 5000 characters or less')
      .optional()
      .nullable(),
    dueDate: z
      .string()
      .datetime({ message: 'Invalid date format. Use ISO 8601 format.' })
      .optional()
      .nullable(),
    status: TaskStatusEnum.optional().default('TODO'),
    priority: TaskPriorityEnum.optional().default('MEDIUM'),
    assignedToId: z
      .string()
      .uuid('Invalid user ID format')
      .optional()
      .nullable(),
  }),
});

/**
 * GET /api/v1/projects/:projectId/tasks - List tasks
 */
export const listCollaborationTasksSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
  }),
  query: z.object({
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    assignedToId: z.string().uuid('Invalid user ID format').optional(),
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
    sortBy: z.enum(['dueDate', 'createdAt', 'priority', 'status']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

/**
 * PATCH /api/v1/projects/:projectId/tasks/:taskId - Update task
 */
export const updateCollaborationTaskSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
    taskId: z.string().uuid('Invalid task ID format'),
  }),
  body: z.object({
    title: z
      .string()
      .min(1, 'Title cannot be empty')
      .max(255, 'Title must be 255 characters or less')
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must be 5000 characters or less')
      .optional()
      .nullable(),
    dueDate: z
      .string()
      .datetime({ message: 'Invalid date format. Use ISO 8601 format.' })
      .optional()
      .nullable(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    assignedToId: z
      .string()
      .uuid('Invalid user ID format')
      .optional()
      .nullable(),
  }),
});

/**
 * DELETE /api/v1/projects/:projectId/tasks/:taskId - Delete task
 */
export const deleteCollaborationTaskSchema = z.object({
  params: z.object({
    projectId: z.string().uuid('Invalid project ID format'),
    taskId: z.string().uuid('Invalid task ID format'),
  }),
});

// ===== Type Exports =====

export type CreateCollaborationTaskInput = z.infer<typeof createCollaborationTaskSchema>['body'];
export type UpdateCollaborationTaskInput = z.infer<typeof updateCollaborationTaskSchema>['body'];
export type ListCollaborationTasksQuery = z.infer<typeof listCollaborationTasksSchema>['query'];
