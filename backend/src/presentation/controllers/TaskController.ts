/**
 * Task Controller
 *
 * Standalone task management endpoints with filtering, bulk ops, and stats.
 *
 * @module presentation/controllers/TaskController
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/database/prisma/client.js";
import { AuthenticationError } from "../../shared/errors/index.js";
import { logger } from "../../shared/logger/index.js";
import ical, { ICalCalendarMethod } from "ical-generator";

export class TaskController {
  /**
   * GET /api/v1/tasks
   * List tasks with filters, search, pagination
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const {
        status,
        priority,
        category,
        contactId,
        search,
        sort = "dueDate",
        order = "asc",
        page = "1",
        limit = "50",
        dateFrom,
        dateTo,
        filter, // 'today' | 'thisWeek' | 'overdue' | 'noDate'
        assignedTo,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { userId: req.user.userId };

      // Status filter
      if (status) {
        where.status = status;
      }

      // Priority filter
      if (priority) {
        where.priority = priority;
      }

      // Category filter
      if (category) {
        where.category = category;
      }

      // Contact filter
      if (contactId) {
        where.contactId = contactId;
      }

      // Search
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { description: { contains: search } },
        ];
      }

      // Date range filter
      if (dateFrom || dateTo) {
        where.dueDate = {};
        if (dateFrom) where.dueDate.gte = new Date(dateFrom);
        if (dateTo) where.dueDate.lte = new Date(dateTo);
      }

      // Quick filters
      if (filter) {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        switch (filter) {
          case "today":
            where.dueDate = { gte: today, lt: tomorrow };
            where.status = { in: ["PENDING", "IN_PROGRESS"] };
            break;
          case "thisWeek":
            where.dueDate = { gte: today, lt: nextWeek };
            where.status = { in: ["PENDING", "IN_PROGRESS"] };
            break;
          case "overdue":
            where.dueDate = { lt: today, not: null };
            where.status = { in: ["PENDING", "IN_PROGRESS"] };
            break;
          case "noDate":
            where.dueDate = null;
            where.status = { in: ["PENDING", "IN_PROGRESS"] };
            break;
          case "highPriority":
            where.priority = { in: ["HIGH", "URGENT"] };
            where.status = { in: ["PENDING", "IN_PROGRESS"] };
            break;
        }
      }

      // Assigned to filter
      if (assignedTo) {
        if (assignedTo === "me") {
          where.assignedToId = req.user.userId;
        } else {
          where.assignedToId = assignedTo;
        }
      }

      // Sort
      const orderBy: any[] = [];
      const sortField = [
        "dueDate",
        "priority",
        "createdAt",
        "title",
        "status",
      ].includes(sort)
        ? sort
        : "dueDate";
      orderBy.push({ [sortField]: order === "desc" ? "desc" : "asc" });
      if (sortField !== "createdAt") orderBy.push({ createdAt: "desc" });

      const [tasks, total] = await Promise.all([
        prisma.contactTask.findMany({
          where,
          include: {
            contact: {
              select: { id: true, fullName: true, company: true },
            },
            assignedTo: {
              select: { id: true, fullName: true, avatarUrl: true },
            },
            reminders: {
              orderBy: { reminderAt: "asc" },
            },
            assignees: {
              include: {
                contact: {
                  select: {
                    id: true,
                    fullName: true,
                    company: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.contactTask.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          tasks,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
          reminders: {
            orderBy: { reminderAt: "asc" },
          },
          recurrence: true,
          assignees: {
            include: {
              contact: {
                select: {
                  id: true,
                  fullName: true,
                  company: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      res.status(200).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/tasks
   * Create a standalone or contact-linked task
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const {
        title,
        description,
        dueDate,
        reminderAt,
        priority,
        status,
        contactId,
        category,
        categoryColor,
        imageUrls,
        assignedToId,
        assigneeIds,
      } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Title is required" },
        });
        return;
      }

      // Verify contact ownership if contactId provided
      if (contactId) {
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, ownerId: req.user.userId },
        });
        if (!contact) {
          res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Contact not found" },
          });
          return;
        }
      }

      const task = await prisma.contactTask.create({
        data: {
          userId: req.user.userId,
          contactId: contactId || null,
          title: title.trim(),
          description,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          reminderAt: reminderAt ? new Date(reminderAt) : undefined,
          priority: priority || "MEDIUM",
          status: status || "PENDING",
          category,
          categoryColor,
          imageUrls: imageUrls || undefined,
          assignedToId: assignedToId || null,
        },
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      });

      // Sync assignees (contacts assigned to this task)
      if (assigneeIds && Array.isArray(assigneeIds)) {
        for (const cId of assigneeIds) {
          await prisma.taskAssignee.upsert({
            where: { taskId_contactId: { taskId: task.id, contactId: cId } },
            create: { taskId: task.id, contactId: cId },
            update: {},
          });
        }
      }

      // Log activity
      await prisma.taskActivity.create({
        data: { taskId: task.id, userId: req.user.userId, action: "created" },
      });

      // Notify assigned user
      if (assignedToId && assignedToId !== req.user.userId) {
        await prisma.notification
          .create({
            data: {
              userId: assignedToId,
              type: "task_assigned",
              title: "Task assigned to you",
              message: `You've been assigned: "${task.title}"`,
              data: { taskId: task.id },
            },
          })
          .catch((e: any) =>
            logger.error("Failed to create assignment notification", {
              error: e,
            }),
          );
      }

      logger.info("Task created", {
        userId: req.user.userId,
        taskId: task.id,
        contactId,
      });

      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/tasks/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const existing = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const {
        title,
        description,
        dueDate,
        reminderAt,
        priority,
        status,
        contactId,
        category,
        categoryColor,
        imageUrls,
        assignedToId,
        assigneeIds,
      } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (dueDate !== undefined)
        updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (reminderAt !== undefined)
        updateData.reminderAt = reminderAt ? new Date(reminderAt) : null;
      if (priority !== undefined) updateData.priority = priority;
      if (contactId !== undefined) updateData.contactId = contactId || null;
      if (category !== undefined) updateData.category = category;
      if (categoryColor !== undefined) updateData.categoryColor = categoryColor;
      if (imageUrls !== undefined) updateData.imageUrls = imageUrls;
      if (assignedToId !== undefined)
        updateData.assignedToId = assignedToId || null;

      if (status !== undefined) {
        updateData.status = status;
        if (status === "COMPLETED") {
          updateData.completedAt = new Date();
        } else if (existing.status === "COMPLETED") {
          updateData.completedAt = null;
        }
      }

      const task = await prisma.contactTask.update({
        where: { id: String(req.params.id) },
        data: updateData,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          reminders: {
            orderBy: { reminderAt: "asc" },
          },
          assignees: {
            include: {
              contact: {
                select: {
                  id: true,
                  fullName: true,
                  company: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Sync assignees (contacts assigned to this task)
      if (assigneeIds && Array.isArray(assigneeIds)) {
        await prisma.taskAssignee.deleteMany({
          where: { taskId: task.id, contactId: { notIn: assigneeIds } },
        });
        for (const cId of assigneeIds) {
          await prisma.taskAssignee.upsert({
            where: { taskId_contactId: { taskId: task.id, contactId: cId } },
            create: { taskId: task.id, contactId: cId },
            update: {},
          });
        }
      }

      // Log activity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: req.user.userId,
          action: "updated",
          details: { fields: Object.keys(updateData) },
        },
      });

      // Notify assigned user if changed
      if (
        assignedToId &&
        assignedToId !== existing.assignedToId &&
        assignedToId !== req.user.userId
      ) {
        await prisma.notification
          .create({
            data: {
              userId: assignedToId,
              type: "task_assigned",
              title: "Task assigned to you",
              message: `You've been assigned: "${task.title}"`,
              data: { taskId: task.id },
            },
          })
          .catch((e: any) =>
            logger.error("Failed to create assignment notification", {
              error: e,
            }),
          );
      }

      logger.info("Task updated", { userId: req.user.userId, taskId: task.id });

      // Generate next recurring task if completed
      let nextTask = null;
      if (
        status === "COMPLETED" &&
        existing.status !== "COMPLETED" &&
        existing.recurrenceId
      ) {
        nextTask = await this.generateNextRecurringTask(
          existing.id,
          req.user.userId,
        );
      }

      res.status(200).json({ success: true, data: task, nextTask });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tasks/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      await prisma.contactTask.delete({ where: { id: String(req.params.id) } });

      logger.info("Task deleted", {
        userId: req.user.userId,
        taskId: String(req.params.id),
      });

      res.status(200).json({ success: true, message: "Task deleted" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/tasks/bulk
   * Bulk update tasks (status, priority, category, delete)
   */
  async bulkUpdate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { taskIds, action, value } = req.body;

      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "taskIds array is required",
          },
        });
        return;
      }

      if (!action) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "action is required" },
        });
        return;
      }

      const whereBase = { id: { in: taskIds }, userId: req.user.userId };

      let result;
      switch (action) {
        case "updateStatus": {
          const updateData: any = { status: value };
          if (value === "COMPLETED") updateData.completedAt = new Date();
          else updateData.completedAt = null;
          result = await prisma.contactTask.updateMany({
            where: whereBase,
            data: updateData,
          });
          break;
        }
        case "updatePriority":
          result = await prisma.contactTask.updateMany({
            where: whereBase,
            data: { priority: value },
          });
          break;
        case "updateCategory":
          result = await prisma.contactTask.updateMany({
            where: whereBase,
            data: {
              category: value?.name || null,
              categoryColor: value?.color || null,
            },
          });
          break;
        case "delete":
          result = await prisma.contactTask.deleteMany({ where: whereBase });
          break;
        default:
          res.status(400).json({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid action" },
          });
          return;
      }

      logger.info("Bulk task update", {
        userId: req.user.userId,
        action,
        count: result.count,
      });

      res.status(200).json({ success: true, data: { count: result.count } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/tasks/:id/status
   * Quick status update (for Kanban drag)
   */
  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { status } = req.body;

      if (
        !status ||
        !["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Valid status is required",
          },
        });
        return;
      }

      const existing = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const updateData: any = { status };
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (existing.status === "COMPLETED") {
        updateData.completedAt = null;
      }

      const task = await prisma.contactTask.update({
        where: { id: String(req.params.id) },
        data: updateData,
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
      });

      // Log activity
      await prisma.taskActivity.create({
        data: {
          taskId: String(req.params.id),
          userId: req.user.userId,
          action: "status_changed",
          details: { from: existing.status, to: status },
        },
      });

      // Generate next recurring task if completed
      let nextTask = null;
      if (status === "COMPLETED" && existing.recurrenceId) {
        nextTask = await this.generateNextRecurringTask(
          existing.id,
          req.user.userId,
        );
      }

      res.status(200).json({ success: true, data: task, nextTask });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/stats
   * Dashboard widget stats
   */
  async getStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const userId = req.user.userId;
      const pendingStatuses = { in: ["PENDING", "IN_PROGRESS"] as any };

      const [
        total,
        pending,
        overdue,
        todayCount,
        thisWeek,
        completed,
        byStatus,
        byPriority,
      ] = await Promise.all([
        prisma.contactTask.count({ where: { userId } }),
        prisma.contactTask.count({
          where: { userId, status: pendingStatuses },
        }),
        prisma.contactTask.count({
          where: {
            userId,
            status: pendingStatuses,
            dueDate: { lt: today, not: null },
          },
        }),
        prisma.contactTask.count({
          where: {
            userId,
            status: pendingStatuses,
            dueDate: { gte: today, lt: tomorrow },
          },
        }),
        prisma.contactTask.count({
          where: {
            userId,
            status: pendingStatuses,
            dueDate: { gte: today, lt: nextWeek },
          },
        }),
        prisma.contactTask.count({ where: { userId, status: "COMPLETED" } }),
        prisma.contactTask.groupBy({
          by: ["status"],
          where: { userId },
          _count: true,
        }),
        prisma.contactTask.groupBy({
          by: ["priority"],
          where: { userId, status: pendingStatuses },
          _count: true,
        }),
      ]);

      const statusCounts: Record<string, number> = {};
      for (const s of byStatus) {
        statusCounts[s.status] = s._count;
      }

      const priorityCounts: Record<string, number> = {};
      for (const p of byPriority) {
        priorityCounts[p.priority] = p._count;
      }

      res.status(200).json({
        success: true,
        data: {
          total,
          pending,
          overdue,
          today: todayCount,
          thisWeek,
          completed,
          byStatus: statusCounts,
          byPriority: priorityCounts,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/search
   * Full-text search on tasks
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const q = ((req.query.q as string) || "").trim();
      const limit = Math.min(50, parseInt(req.query.limit as string, 10) || 20);

      if (!q) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const tasks = await prisma.contactTask.findMany({
        where: {
          userId: req.user.userId,
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        },
        include: {
          contact: {
            select: { id: true, fullName: true, company: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      res.status(200).json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK REMINDERS
  // ============================================

  /**
   * POST /api/v1/tasks/:id/reminders
   */
  async addReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const { reminderAt, type } = req.body;

      if (!reminderAt) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "reminderAt is required",
          },
        });
        return;
      }

      const reminder = await prisma.taskReminder.create({
        data: {
          taskId: String(req.params.id),
          reminderAt: new Date(reminderAt),
          type: type || "IN_APP",
        },
      });

      res.status(201).json({ success: true, data: reminder });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tasks/:id/reminders/:reminderId
   */
  async deleteReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      await prisma.taskReminder.delete({
        where: { id: String(req.params.reminderId) },
      });

      res.status(200).json({ success: true, message: "Reminder deleted" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/tasks/:id/reminders/:reminderId/snooze
   */
  async snoozeReminder(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const { snoozeUntil } = req.body;

      const reminder = await prisma.taskReminder.update({
        where: { id: String(req.params.reminderId) },
        data: {
          snoozeUntil: new Date(snoozeUntil),
          isSent: false,
        },
      });

      res.status(200).json({ success: true, data: reminder });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK CATEGORIES
  // ============================================

  /**
   * GET /api/v1/tasks/categories
   */
  async listCategories(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const categories = await prisma.taskCategory.findMany({
        where: { userId: req.user.userId },
        orderBy: { name: "asc" },
      });

      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/tasks/categories
   */
  async createCategory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { name, color } = req.body;

      if (!name || !color) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "name and color are required",
          },
        });
        return;
      }

      const category = await prisma.taskCategory.create({
        data: {
          userId: req.user.userId,
          name: name.trim(),
          color,
        },
      });

      res.status(201).json({ success: true, data: category });
    } catch (error: any) {
      if (error.code === "P2002") {
        res.status(409).json({
          success: false,
          error: {
            code: "DUPLICATE",
            message: "Category with this name already exists",
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * PUT /api/v1/tasks/categories/:id
   */
  async updateCategory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const existing = await prisma.taskCategory.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Category not found" },
        });
        return;
      }

      const { name, color } = req.body;

      // If name changed, update tasks that used the old name
      if (name && name !== existing.name) {
        await prisma.contactTask.updateMany({
          where: { userId: req.user.userId, category: existing.name },
          data: {
            category: name.trim(),
            categoryColor: color || existing.color,
          },
        });
      } else if (color && color !== existing.color) {
        await prisma.contactTask.updateMany({
          where: { userId: req.user.userId, category: existing.name },
          data: { categoryColor: color },
        });
      }

      const category = await prisma.taskCategory.update({
        where: { id: String(req.params.id) },
        data: {
          ...(name && { name: name.trim() }),
          ...(color && { color }),
        },
      });

      res.status(200).json({ success: true, data: category });
    } catch (error: any) {
      if (error.code === "P2002") {
        res.status(409).json({
          success: false,
          error: {
            code: "DUPLICATE",
            message: "Category with this name already exists",
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tasks/categories/:id
   */
  async deleteCategory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const existing = await prisma.taskCategory.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Category not found" },
        });
        return;
      }

      // Clear category from tasks
      await prisma.contactTask.updateMany({
        where: { userId: req.user.userId, category: existing.name },
        data: { category: null, categoryColor: null },
      });

      await prisma.taskCategory.delete({
        where: { id: String(req.params.id) },
      });

      res.status(200).json({ success: true, message: "Category deleted" });
    } catch (error) {
      next(error);
    }
  }
  // ============================================
  // RECURRENCE
  // ============================================

  /**
   * Calculate next due date based on recurrence pattern
   */
  private calculateNextDueDate(
    currentDueDate: Date,
    pattern: string,
    interval: number,
    daysOfWeek?: number[],
  ): Date {
    const next = new Date(currentDueDate);

    switch (pattern) {
      case "DAILY":
        next.setDate(next.getDate() + interval);
        break;
      case "WEEKLY":
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Find next matching day of week
          const currentDay = next.getDay();
          const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
          const nextDay = sortedDays.find((d) => d > currentDay);
          if (nextDay !== undefined) {
            next.setDate(next.getDate() + (nextDay - currentDay));
          } else {
            // Wrap to next week
            next.setDate(
              next.getDate() +
                (7 - currentDay + sortedDays[0]) +
                (interval - 1) * 7,
            );
          }
        } else {
          next.setDate(next.getDate() + 7 * interval);
        }
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + interval);
        break;
      case "YEARLY":
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        next.setDate(next.getDate() + interval);
    }

    return next;
  }

  /**
   * Generate next task from recurrence when a task is completed
   */
  private async generateNextRecurringTask(
    taskId: string,
    userId: string,
  ): Promise<any> {
    const task = await prisma.contactTask.findFirst({
      where: { id: taskId, userId },
      include: { recurrence: true },
    });

    if (!task || !task.recurrence || !task.recurrence.isActive) return null;
    if (!task.dueDate) return null;

    const recurrence = task.recurrence;

    // Check limits
    if (recurrence.endDate && new Date() > recurrence.endDate) {
      await prisma.taskRecurrence.update({
        where: { id: recurrence.id },
        data: { isActive: false },
      });
      return null;
    }
    if (
      recurrence.maxOccurrences &&
      recurrence.occurrenceCount >= recurrence.maxOccurrences
    ) {
      await prisma.taskRecurrence.update({
        where: { id: recurrence.id },
        data: { isActive: false },
      });
      return null;
    }

    const daysOfWeek = recurrence.daysOfWeek as number[] | null;
    const nextDueDate = this.calculateNextDueDate(
      task.dueDate,
      recurrence.pattern,
      recurrence.interval,
      daysOfWeek || undefined,
    );

    // Calculate reminder offset from original task
    let nextReminderAt: Date | null = null;
    if (task.reminderAt && task.dueDate) {
      const offset = task.dueDate.getTime() - task.reminderAt.getTime();
      nextReminderAt = new Date(nextDueDate.getTime() - offset);
    }

    // Create next occurrence
    const nextTask = await prisma.contactTask.create({
      data: {
        userId,
        contactId: task.contactId,
        title: task.title,
        description: task.description,
        dueDate: nextDueDate,
        reminderAt: nextReminderAt,
        priority: task.priority,
        status: "PENDING",
        category: task.category,
        categoryColor: task.categoryColor,
        recurrenceId: recurrence.id,
      },
      include: {
        contact: { select: { id: true, fullName: true, company: true } },
      },
    });

    // Update recurrence
    await prisma.taskRecurrence.update({
      where: { id: recurrence.id },
      data: {
        occurrenceCount: { increment: 1 },
        nextRunAt: nextDueDate,
      },
    });

    return nextTask;
  }

  /**
   * POST /api/v1/tasks/:id/recurrence
   * Set recurrence on an existing task
   */
  async setRecurrence(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { pattern, interval, daysOfWeek, endDate, maxOccurrences } =
        req.body;

      if (
        !pattern ||
        !["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"].includes(pattern)
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Valid pattern is required (DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM)",
          },
        });
        return;
      }

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      // Remove existing recurrence if any
      if (task.recurrenceId) {
        await prisma.taskRecurrence.delete({
          where: { id: task.recurrenceId },
        });
      }

      const recurrence = await prisma.taskRecurrence.create({
        data: {
          userId: req.user.userId,
          pattern,
          interval: interval || 1,
          daysOfWeek: daysOfWeek || undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          maxOccurrences: maxOccurrences || undefined,
          parentTaskId: task.id,
          nextRunAt: task.dueDate || undefined,
        },
      });

      const updated = await prisma.contactTask.update({
        where: { id: task.id },
        data: { recurrenceId: recurrence.id },
        include: {
          contact: { select: { id: true, fullName: true, company: true } },
          recurrence: true,
        },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tasks/:id/recurrence
   * Remove recurrence from a task
   */
  async removeRecurrence(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      if (task.recurrenceId) {
        await prisma.contactTask.update({
          where: { id: task.id },
          data: { recurrenceId: null },
        });
        await prisma.taskRecurrence.delete({
          where: { id: task.recurrenceId },
        });
      }

      res.status(200).json({ success: true, message: "Recurrence removed" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/:id/recurrence
   * Get recurrence details for a task
   */
  async getRecurrence(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
        include: { recurrence: true },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      res.status(200).json({ success: true, data: task.recurrence || null });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK SHARING
  // ============================================

  async shareTask(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const { userId, email, permission } = req.body;
      const shareToken =
        !userId && !email
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 32)
          : null;

      const share = await prisma.taskShare.create({
        data: {
          taskId: task.id,
          sharedById: req.user.userId,
          sharedWithId: userId || null,
          sharedEmail: email || null,
          shareToken,
          permission: permission || "VIEW",
        },
        include: { sharedWith: { select: { id: true, fullName: true } } },
      });

      res.status(201).json({ success: true, data: share });
    } catch (error) {
      next(error);
    }
  }

  async revokeShare(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }
      await prisma.taskShare.delete({
        where: { id: String(req.params.shareId) },
      });
      res.status(200).json({ success: true, message: "Share revoked" });
    } catch (error) {
      next(error);
    }
  }

  async listShares(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }
      const shares = await prisma.taskShare.findMany({
        where: { taskId: task.id },
        include: { sharedWith: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json({ success: true, data: shares });
    } catch (error) {
      next(error);
    }
  }

  async getSharedWithMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const shares = await prisma.taskShare.findMany({
        where: { sharedWithId: req.user.userId },
        include: {
          task: {
            include: {
              contact: { select: { id: true, fullName: true, company: true } },
            },
          },
          sharedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json({ success: true, data: shares });
    } catch (error) {
      next(error);
    }
  }

  async getByShareToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const share = await prisma.taskShare.findUnique({
        where: { shareToken: String(req.params.token) },
        include: {
          task: true,
          sharedBy: { select: { fullName: true } },
        },
      });
      if (!share) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Shared task not found" },
        });
        return;
      }
      res.status(200).json({ success: true, data: share });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK COMMENTS
  // ============================================

  async listComments(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }
      const comments = await prisma.taskComment.findMany({
        where: { taskId: task.id },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      res.status(200).json({ success: true, data: comments });
    } catch (error) {
      next(error);
    }
  }

  async addComment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }
      const { content } = req.body;
      if (!content?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Content is required" },
        });
        return;
      }
      const comment = await prisma.taskComment.create({
        data: {
          taskId: task.id,
          userId: req.user.userId,
          content: content.trim(),
        },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
      // Log activity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: req.user.userId,
          action: "commented",
          details: { commentId: comment.id },
        },
      });
      res.status(201).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }

  async updateComment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const existing = await prisma.taskComment.findFirst({
        where: { id: String(req.params.commentId), userId: req.user.userId },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Comment not found" },
        });
        return;
      }
      const comment = await prisma.taskComment.update({
        where: { id: String(req.params.commentId) },
        data: { content: req.body.content.trim() },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
      res.status(200).json({ success: true, data: comment });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const existing = await prisma.taskComment.findFirst({
        where: { id: String(req.params.commentId), userId: req.user.userId },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Comment not found" },
        });
        return;
      }
      await prisma.taskComment.delete({
        where: { id: String(req.params.commentId) },
      });
      res.status(200).json({ success: true, message: "Comment deleted" });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK ACTIVITY
  // ============================================

  async getActivity(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");
      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }
      const activities = await prisma.taskActivity.findMany({
        where: { taskId: task.id },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.status(200).json({ success: true, data: activities });
    } catch (error) {
      next(error);
    }
  }
  // ============================================
  // ICAL EXPORT
  // ============================================

  /**
   * GET /api/v1/tasks/:id/ical
   * Export a single task as .ics file
   */
  async exportTaskIcal(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const task = await prisma.contactTask.findFirst({
        where: { id: String(req.params.id), userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const cal = ical({
        name: "IntellMatch Tasks",
        method: ICalCalendarMethod.PUBLISH,
      });
      const start = task.dueDate || task.createdAt;
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

      cal.createEvent({
        id: task.id,
        start,
        end,
        summary: task.title,
        description: task.description || undefined,
        allDay: !task.dueDate,
      });

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="task-${task.id}.ics"`,
      );
      res.send(cal.toString());
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/ical
   * Export all active tasks as .ics file
   */
  async exportAllTasksIcal(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const tasks = await prisma.contactTask.findMany({
        where: {
          userId: req.user.userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { dueDate: "asc" },
        take: 500,
      });

      const cal = ical({
        name: "IntellMatch Tasks",
        method: ICalCalendarMethod.PUBLISH,
      });

      for (const task of tasks) {
        const start = task.dueDate || task.createdAt;
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        cal.createEvent({
          id: task.id,
          start,
          end,
          summary: task.title,
          description: task.description || undefined,
          allDay: !task.dueDate,
        });
      }

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="intellmatch-tasks.ics"',
      );
      res.send(cal.toString());
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // NLP QUICK CREATE
  // ============================================

  /**
   * POST /api/v1/tasks/parse
   * Parse natural language text into task fields
   */
  async parseNaturalLanguage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { text } = req.body;
      if (!text?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "text is required" },
        });
        return;
      }

      let title = text.trim();
      let dueDate: string | null = null;
      let dueTime: string | null = null;
      let priority: string = "MEDIUM";

      const now = new Date();

      // Extract priority
      if (/\b(urgent|asap|critical)\b/i.test(title)) {
        priority = "URGENT";
        title = title.replace(/\b(urgent|asap|critical)\b/i, "").trim();
      } else if (/\b(important|high\s*priority)\b/i.test(title)) {
        priority = "HIGH";
        title = title.replace(/\b(important|high\s*priority)\b/i, "").trim();
      }

      // Extract "tomorrow"
      if (/\btomorrow\b/i.test(title)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        dueDate = d.toISOString().split("T")[0];
        title = title.replace(/\btomorrow\b/i, "").trim();
      }

      // Extract "today"
      if (/\btoday\b/i.test(title)) {
        dueDate = now.toISOString().split("T")[0];
        title = title.replace(/\btoday\b/i, "").trim();
      }

      // Extract "next monday/tuesday/..."
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const nextDayMatch = title.match(
        /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      );
      if (nextDayMatch) {
        const targetDay = dayNames.indexOf(nextDayMatch[1].toLowerCase());
        const d = new Date(now);
        const currentDay = d.getDay();
        let daysAhead = targetDay - currentDay;
        if (daysAhead <= 0) daysAhead += 7;
        d.setDate(d.getDate() + daysAhead);
        dueDate = d.toISOString().split("T")[0];
        title = title
          .replace(
            /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
            "",
          )
          .trim();
      }

      // Extract "next week"
      if (/\bnext\s+week\b/i.test(title)) {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        dueDate = d.toISOString().split("T")[0];
        title = title.replace(/\bnext\s+week\b/i, "").trim();
      }

      // Extract time: "3pm", "3:30pm", "15:00", "at 3"
      const timeMatch = title.match(
        /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      );
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const ampm = timeMatch[3]?.toLowerCase();
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          dueTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
          title = title.replace(timeMatch[0], "").trim();
        }
      }

      // Clean up extra spaces and trailing prepositions
      title = title
        .replace(/\b(at|on|by)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

      res.status(200).json({
        success: true,
        data: { title, dueDate, dueTime, priority },
      });
    } catch (error) {
      next(error);
    }
  }
  // ============================================
  // TASK ASSIGNEES
  // ============================================

  /**
   * POST /api/v1/tasks/:id/assignees
   * Add a contact as assignee to a task
   */
  async addAssignee(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { id } = req.params as { id: string };
      const { contactId } = req.body;
      const userId = req.user.userId;

      // Verify task belongs to user
      const task = await prisma.contactTask.findFirst({
        where: { id, userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      // Verify contact belongs to user
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ownerId: userId },
      });
      if (!contact) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Contact not found" },
        });
        return;
      }

      const assignee = await prisma.taskAssignee.upsert({
        where: { taskId_contactId: { taskId: id, contactId } },
        create: { taskId: id, contactId },
        update: {},
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
              company: true,
              avatarUrl: true,
            },
          },
        },
      });

      logger.info("Task assignee added", { userId, taskId: id, contactId });

      res.json({ success: true, data: assignee });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/tasks/:id/assignees/:contactId
   * Remove a contact assignee from a task
   */
  async removeAssignee(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { id, contactId } = req.params as { id: string; contactId: string };
      const userId = req.user.userId;

      const task = await prisma.contactTask.findFirst({
        where: { id, userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      await prisma.taskAssignee.deleteMany({
        where: { taskId: id, contactId },
      });

      logger.info("Task assignee removed", { userId, taskId: id, contactId });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/tasks/:id/assignees
   * Get all assignees for a task
   */
  async getAssignees(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { id } = req.params as { id: string };
      const userId = req.user.userId;

      const task = await prisma.contactTask.findFirst({
        where: { id, userId },
      });
      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      const assignees = await prisma.taskAssignee.findMany({
        where: { taskId: id },
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
              company: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({ success: true, data: assignees });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // TASK MEDIA ATTACHMENTS
  // ============================================

  /**
   * POST /api/v1/tasks/:id/attachments/voice
   * Upload voice note for a task
   */
  async uploadVoiceNote(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { id } = req.params as { id: string };

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No audio file provided" },
        });
        return;
      }

      let voiceNoteUrl: string;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "task-attachments";
        const key = `${req.user.userId}/${id}-${Date.now()}.webm`;

        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: req.file.mimetype || "audio/webm",
        });
        voiceNoteUrl = result.url;
      } catch (storageError) {
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        voiceNoteUrl = `data:${req.file.mimetype || "audio/webm"};base64,${base64}`;
      }

      const updatedTask = await prisma.contactTask.update({
        where: { id },
        data: { voiceNoteUrl },
        include: {
          contact: { select: { id: true, fullName: true, company: true } },
          assignees: {
            include: {
              contact: {
                select: {
                  id: true,
                  fullName: true,
                  company: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      logger.info("Task voice note uploaded", {
        userId: req.user.userId,
        taskId: id,
      });

      res.status(200).json({ success: true, data: updatedTask });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/tasks/:id/attachments/image
   * Upload image attachment for a task
   */
  async uploadImage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) throw new AuthenticationError("Authentication required");

      const { id } = req.params as { id: string };

      // Verify task ownership
      const task = await prisma.contactTask.findFirst({
        where: { id, userId: req.user.userId },
      });

      if (!task) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No image file provided" },
        });
        return;
      }

      let imageUrl: string;

      try {
        const { getStorageService } =
          await import("../../infrastructure/external/storage/index.js");
        const storage = getStorageService();

        const bucket = "task-attachments";
        const ext = req.file.originalname.split(".").pop() || "jpg";
        const key = `${req.user.userId}/${id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        await storage.ensureBucket(bucket);

        const result = await storage.upload(bucket, key, req.file.buffer, {
          contentType: req.file.mimetype,
        });
        imageUrl = result.url;
      } catch (storageError) {
        logger.warn("Storage upload failed, using base64", {
          error: storageError,
        });
        const base64 = req.file.buffer.toString("base64");
        imageUrl = `data:${req.file.mimetype};base64,${base64}`;
      }

      // Append to existing imageUrls JSON array
      const existingUrls = (task.imageUrls as string[]) || [];
      const updatedTask = await prisma.contactTask.update({
        where: { id },
        data: { imageUrls: [...existingUrls, imageUrl] },
        include: {
          contact: { select: { id: true, fullName: true, company: true } },
          assignees: {
            include: {
              contact: {
                select: {
                  id: true,
                  fullName: true,
                  company: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      logger.info("Task image uploaded", {
        userId: req.user.userId,
        taskId: id,
      });

      res.status(200).json({ success: true, data: updatedTask });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
export default taskController;
