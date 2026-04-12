/**
 * Collaboration Task Controller
 *
 * Handles HTTP requests for collaboration task endpoints within projects.
 * Provides CRUD operations for tasks that project collaborators can
 * create, assign, and track.
 *
 * @module presentation/controllers/CollaborationTaskController
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma/client';
import { AuthenticationError, NotFoundError, ValidationError } from '../../shared/errors';
import { logger } from '../../shared/logger';

/**
 * Priority sort order mapping for sorting tasks by priority
 */
const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Valid task statuses
 */
const VALID_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

/**
 * Valid task priorities
 */
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

/**
 * Collaboration Task Controller
 *
 * Provides HTTP handlers for task CRUD operations scoped to projects.
 * All operations verify project ownership before proceeding.
 */
export class CollaborationTaskController {
  /**
   * Verify that the authenticated user owns the specified project.
   * Returns the project if found, otherwise throws NotFoundError.
   */
  private async verifyProjectOwnership(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  }

  /**
   * Create a new task for a project
   *
   * POST /api/v1/projects/:projectId/tasks
   *
   * Body:
   * - title: string (required)
   * - description?: string
   * - dueDate?: string (ISO 8601)
   * - status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
   * - priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
   * - assignedToId?: string (user UUID)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId } = req.params;
      await this.verifyProjectOwnership(projectId, req.user.userId);

      const {
        title,
        description,
        dueDate,
        status = 'TODO',
        priority = 'MEDIUM',
        assignedToId,
      } = req.body;

      // Validate status and priority values
      if (status && !VALID_STATUSES.includes(status)) {
        throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      if (priority && !VALID_PRIORITIES.includes(priority)) {
        throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      // If assignedToId is provided, verify the user exists
      if (assignedToId) {
        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee) {
          throw new ValidationError('Assigned user not found');
        }
      }

      const task = await prisma.collaborationTask.create({
        data: {
          projectId,
          createdById: req.user.userId,
          assignedToId: assignedToId || null,
          title,
          description: description || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status,
          priority,
        },
      });

      logger.info('Collaboration task created', {
        userId: req.user.userId,
        projectId,
        taskId: task.id,
        title: task.title,
      });

      res.status(201).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List tasks for a project with optional filters
   *
   * GET /api/v1/projects/:projectId/tasks
   *
   * Query params:
   * - status: filter by task status
   * - priority: filter by priority
   * - assignedToId: filter by assignee
   * - page: page number (default 1)
   * - limit: items per page (default 20, max 100)
   * - sortBy: 'dueDate' | 'createdAt' | 'priority' | 'status' (default 'createdAt')
   * - sortOrder: 'asc' | 'desc' (default 'desc')
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId } = req.params;
      await this.verifyProjectOwnership(projectId, req.user.userId);

      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;
      const assignedToId = req.query.assignedToId as string | undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      // Build where clause
      const where: any = { projectId };

      if (status) {
        where.status = status;
      }

      if (priority) {
        where.priority = priority;
      }

      if (assignedToId) {
        where.assignedToId = assignedToId;
      }

      // Build orderBy
      let orderBy: any;
      if (sortBy === 'priority') {
        // Priority needs custom handling since it's stored as string
        // We'll sort by the field directly and let the client handle priority ordering
        orderBy = { priority: sortOrder };
      } else {
        orderBy = { [sortBy]: sortOrder };
      }

      const [tasks, total] = await Promise.all([
        prisma.collaborationTask.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.collaborationTask.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a task
   *
   * PATCH /api/v1/projects/:projectId/tasks/:taskId
   *
   * Body: (all optional)
   * - title?: string
   * - description?: string | null
   * - dueDate?: string (ISO 8601) | null
   * - status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
   * - priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
   * - assignedToId?: string | null
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId, taskId } = req.params;
      await this.verifyProjectOwnership(projectId, req.user.userId);

      // Verify task exists and belongs to this project
      const existingTask = await prisma.collaborationTask.findFirst({
        where: {
          id: taskId,
          projectId,
        },
      });

      if (!existingTask) {
        throw new NotFoundError('Task not found');
      }

      const {
        title,
        description,
        dueDate,
        status,
        priority,
        assignedToId,
      } = req.body;

      // Validate status if provided
      if (status && !VALID_STATUSES.includes(status)) {
        throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      // Validate priority if provided
      if (priority && !VALID_PRIORITIES.includes(priority)) {
        throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }

      // If assignedToId is provided (not undefined), verify the user exists
      if (assignedToId !== undefined && assignedToId !== null) {
        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee) {
          throw new ValidationError('Assigned user not found');
        }
      }

      // Build update data - only include fields that were actually sent
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (assignedToId !== undefined) updateData.assignedToId = assignedToId;

      const task = await prisma.collaborationTask.update({
        where: { id: taskId },
        data: updateData,
      });

      logger.info('Collaboration task updated', {
        userId: req.user.userId,
        projectId,
        taskId,
        updatedFields: Object.keys(updateData),
      });

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a task
   *
   * DELETE /api/v1/projects/:projectId/tasks/:taskId
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const { projectId, taskId } = req.params;
      await this.verifyProjectOwnership(projectId, req.user.userId);

      // Verify task exists and belongs to this project
      const existingTask = await prisma.collaborationTask.findFirst({
        where: {
          id: taskId,
          projectId,
        },
      });

      if (!existingTask) {
        throw new NotFoundError('Task not found');
      }

      await prisma.collaborationTask.delete({ where: { id: taskId } });

      logger.info('Collaboration task deleted', {
        userId: req.user.userId,
        projectId,
        taskId,
      });

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const collaborationTaskController = new CollaborationTaskController();
