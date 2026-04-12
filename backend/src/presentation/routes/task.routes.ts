/**
 * Task and Reminder Routes
 *
 * Full CRUD for standalone tasks, categories, reminders, and bulk operations.
 *
 * @module presentation/routes/task
 */

import { Router } from 'express';
import multer from 'multer';
import { contactController } from '../controllers/ContactController.js';
import { taskController } from '../controllers/TaskController.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * Task Routes - Full CRUD
 */
export const taskRoutes = Router();
taskRoutes.use(authenticate);

// Stats (must be before :id routes)
taskRoutes.get('/stats', taskController.getStats.bind(taskController));

// Search
taskRoutes.get('/search', taskController.search.bind(taskController));

// Shared with me (must be before :id routes)
taskRoutes.get('/shared', taskController.getSharedWithMe.bind(taskController));

// NLP parse (must be before :id routes)
taskRoutes.post('/parse', taskController.parseNaturalLanguage.bind(taskController));

// Export all tasks as .ics (must be before :id routes)
taskRoutes.get('/ical', taskController.exportAllTasksIcal.bind(taskController));

// Categories CRUD
taskRoutes.get('/categories', taskController.listCategories.bind(taskController));
taskRoutes.post('/categories', taskController.createCategory.bind(taskController));
taskRoutes.put('/categories/:id', taskController.updateCategory.bind(taskController));
taskRoutes.delete('/categories/:id', taskController.deleteCategory.bind(taskController));

// Bulk operations
taskRoutes.patch('/bulk', taskController.bulkUpdate.bind(taskController));

// Task CRUD
taskRoutes.get('/', taskController.list.bind(taskController));
taskRoutes.post('/', taskController.create.bind(taskController));
taskRoutes.get('/:id', taskController.get.bind(taskController));
taskRoutes.put('/:id', taskController.update.bind(taskController));
taskRoutes.delete('/:id', taskController.delete.bind(taskController));

// Quick status update (Kanban drag)
taskRoutes.patch('/:id/status', taskController.updateStatus.bind(taskController));

// Export single task as .ics
taskRoutes.get('/:id/ical', taskController.exportTaskIcal.bind(taskController));

// Task recurrence
taskRoutes.post('/:id/recurrence', taskController.setRecurrence.bind(taskController));
taskRoutes.get('/:id/recurrence', taskController.getRecurrence.bind(taskController));
taskRoutes.delete('/:id/recurrence', taskController.removeRecurrence.bind(taskController));

// Task reminders
taskRoutes.post('/:id/reminders', taskController.addReminder.bind(taskController));
taskRoutes.delete('/:id/reminders/:reminderId', taskController.deleteReminder.bind(taskController));
taskRoutes.patch('/:id/reminders/:reminderId/snooze', taskController.snoozeReminder.bind(taskController));

// Task sharing
taskRoutes.post('/:id/share', taskController.shareTask.bind(taskController));
taskRoutes.delete('/:id/share/:shareId', taskController.revokeShare.bind(taskController));
taskRoutes.get('/:id/shares', taskController.listShares.bind(taskController));

// Task comments
taskRoutes.get('/:id/comments', taskController.listComments.bind(taskController));
taskRoutes.post('/:id/comments', taskController.addComment.bind(taskController));
taskRoutes.put('/:id/comments/:commentId', taskController.updateComment.bind(taskController));
taskRoutes.delete('/:id/comments/:commentId', taskController.deleteComment.bind(taskController));

// Task activity
taskRoutes.get('/:id/activity', taskController.getActivity.bind(taskController));

// Task assignees
taskRoutes.get('/:id/assignees', taskController.getAssignees.bind(taskController));
taskRoutes.post('/:id/assignees', taskController.addAssignee.bind(taskController));
taskRoutes.delete('/:id/assignees/:contactId', taskController.removeAssignee.bind(taskController));

// Task media attachments
const taskVoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

const taskImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

taskRoutes.post('/:id/attachments/voice', taskVoiceUpload.single('voice'), taskController.uploadVoiceNote.bind(taskController));
taskRoutes.post('/:id/attachments/image', taskImageUpload.single('image'), taskController.uploadImage.bind(taskController));

/**
 * Public Task Routes (no auth required)
 */
export const taskPublicRoutes = Router();
taskPublicRoutes.get('/shared/:token', taskController.getByShareToken.bind(taskController));

/**
 * Reminder Routes - Dashboard level (unchanged)
 */
export const reminderRoutes = Router();
reminderRoutes.use(authenticate);

reminderRoutes.get(
  '/',
  contactController.getAllReminders.bind(contactController)
);

export default { taskRoutes, taskPublicRoutes, reminderRoutes };
