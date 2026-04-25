/**
 * Contact Routes
 *
 * Routes for contact management.
 *
 * @module presentation/routes/contact
 */

import { Router } from 'express';
import multer from 'multer';
import { contactController } from '../controllers/ContactController';
import { authenticate } from '../middleware/auth.middleware';
import { orgContext } from '../middleware/orgContext.middleware';
import { inviteContactService } from '../../application/use-cases/invitation';
import { logger } from '../../shared/logger';
import { getContactLimitForUser } from '../../shared/helpers/planLimits';
import { prisma } from '../../infrastructure/database/prisma/client';
import { validate } from '../middleware/validate.middleware';
import {
  createContactSchema,
  updateContactSchema,
  getContactSchema,
  deleteContactSchema,
  listContactsSchema,
  addInteractionSchema,
} from '../validators/contact.validator';

export const contactRoutes = Router();

// All contact routes require authentication + org context
contactRoutes.use(authenticate);
contactRoutes.use(orgContext);

/**
 * GET /api/v1/contacts/recent
 * Get recently added contacts
 *
 * Query params:
 * - limit: number of contacts (default 10, max 50)
 */
contactRoutes.get(
  '/recent',
  contactController.getRecent.bind(contactController)
);

/**
 * GET /api/v1/contacts/follow-up
 * Get contacts needing follow-up
 *
 * Query params:
 * - days: days threshold (default 30)
 */
contactRoutes.get(
  '/follow-up',
  contactController.getFollowUp.bind(contactController)
);

/**
 * POST /api/v1/contacts/import
 * Import contacts from file (CSV/vCard)
 */
contactRoutes.post(
  '/import',
  contactController.import.bind(contactController)
);

/**
 * GET /api/v1/contacts/export
 * Export contacts to CSV or vCard format
 *
 * Query params:
 * - format: 'csv' | 'vcard' (default 'csv')
 * - ids?: comma-separated contact IDs (optional, exports all if not provided)
 * - search?: search filter
 * - sector?: sector ID filter
 */
contactRoutes.get(
  '/export',
  contactController.export.bind(contactController)
);

/**
 * GET /api/v1/contacts/:id/export
 * Export single contact to vCard format
 */
contactRoutes.get(
  '/:id/export',
  contactController.exportSingle.bind(contactController)
);

/**
 * GET /api/v1/contacts/limit
 * Get contact limit info for current user's plan
 */
contactRoutes.get('/limit', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const userId = req.user.userId;
    const { limit, current, remaining } = await getContactLimitForUser(userId);

    // Get plan name
    const subscription = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true } });
    const planName = subscription?.plan || 'FREE';

    res.json({
      success: true,
      data: { limit, current, remaining, planName },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/contacts
 * Get paginated list of contacts
 *
 * Query params:
 * - search: text search across name, email, company, notes
 * - sector: filter by sector ID
 * - favorite: filter favorites (true/false)
 * - minScore: minimum match score (0-100)
 * - page: page number (default 1)
 * - limit: items per page (default 20, max 100)
 * - sort: sort field (name, createdAt, matchScore, lastContactedAt)
 * - order: sort order (asc, desc)
 */
contactRoutes.get(
  '/',
  validate(listContactsSchema),
  contactController.list.bind(contactController)
);

/**
 * POST /api/v1/contacts/analyze
 * Analyze contact data and generate AI suggestions
 *
 * Body:
 * - name: string
 * - company?: string
 * - jobTitle?: string
 * - email?: string
 * - website?: string
 *
 * Returns:
 * - sectors: string[] - suggested sectors
 * - skills: string[] - suggested skills
 * - interests: string[] - suggested interests
 * - bio: string - generated bio
 */
contactRoutes.post(
  '/analyze',
  contactController.analyze.bind(contactController)
);

/**
 * POST /api/v1/contacts/enrich-linkedin
 * Quick add contact via LinkedIn URL using People Data Labs
 *
 * Body:
 * - fullName: string (required)
 * - linkedInUrl: string (required)
 *
 * Returns enriched profile data for user review:
 * - profile: { fullName, jobTitle, company, location, bio, etc. }
 * - skills: matched skills from database
 * - suggestedSkills: raw skills from LinkedIn
 * - sectors: matched sectors from database
 * - industry: raw industry from LinkedIn
 * - education: education history
 * - employmentHistory: recent work history
 * - matchPreview: { estimatedScore, sharedSkills, sharedSectors }
 */
contactRoutes.post(
  '/enrich-linkedin',
  contactController.enrichFromLinkedIn.bind(contactController)
);

/**
 * POST /api/v1/contacts/face-search
 * Search for a person using their photo (face recognition)
 *
 * Body: multipart/form-data
 * - photo: image file (required)
 * - consent: boolean (required - must be true)
 *
 * Privacy Notice:
 * - Requires explicit user consent
 * - Photo is processed in memory and immediately deleted
 * - GDPR/CCPA compliant - no image data is stored
 *
 * Returns:
 * - matches: Array of potential identity matches with social profiles
 * - matchCount: number of matches found
 * - warnings: any warnings about the search
 */
const faceSearchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

contactRoutes.post(
  '/face-search',
  faceSearchUpload.single('photo'),
  contactController.faceSearch.bind(contactController)
);

/**
 * POST /api/v1/contacts
 * Create a new contact manually
 *
 * Body:
 * - name: string (required)
 * - email?: string
 * - phone?: string
 * - company?: string
 * - jobTitle?: string
 * - bio?: string
 * - linkedInUrl?: string
 * - websiteUrl?: string
 * - location?: string
 * - sectors?: Array<{ sectorId: string, isPrimary?: boolean }>
 * - skills?: Array<{ skillId: string, proficiency?: string }>
 * - notes?: string
 * - source?: 'MANUAL' | 'CARD_SCAN' | 'IMPORT' | 'LINKEDIN'
 */
contactRoutes.post(
  '/',
  validate(createContactSchema),
  contactController.create.bind(contactController)
);

/**
 * GET /api/v1/contacts/:id
 * Get contact details
 */
contactRoutes.get(
  '/:id',
  validate(getContactSchema),
  contactController.get.bind(contactController)
);

/**
 * PUT /api/v1/contacts/:id
 * Update contact
 *
 * Body: (all optional)
 * - name?: string
 * - email?: string
 * - phone?: string
 * - company?: string
 * - jobTitle?: string
 * - bio?: string
 * - linkedInUrl?: string
 * - websiteUrl?: string
 * - location?: string
 * - notes?: string
 * - isFavorite?: boolean
 */
contactRoutes.put(
  '/:id',
  validate(updateContactSchema),
  contactController.update.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id
 * Delete contact
 */
contactRoutes.delete(
  '/:id',
  validate(deleteContactSchema),
  contactController.delete.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/avatar
 * Upload avatar image for contact
 */
const contactAvatarUpload = multer({
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

contactRoutes.post(
  '/:id/avatar',
  contactAvatarUpload.single('avatar'),
  contactController.uploadAvatar.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/interaction
 * Log an interaction with contact
 *
 * Body:
 * - type: 'MEETING' | 'CALL' | 'EMAIL' | 'MESSAGE' | 'EVENT' | 'OTHER'
 * - notes?: string
 * - date?: string (ISO datetime)
 */
contactRoutes.post(
  '/:id/interaction',
  validate(addInteractionSchema),
  contactController.addInteraction.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/enrich
 * Trigger enrichment for contact
 *
 * Queues a background job to enrich contact data
 * using external data sources.
 */
contactRoutes.post(
  '/:id/enrich',
  validate(getContactSchema),
  contactController.enrich.bind(contactController)
);

// ============================================
// CONTACT TASKS ROUTES
// ============================================

/**
 * GET /api/v1/contacts/:id/tasks
 * Get all tasks for a contact
 *
 * Query params:
 * - status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
 */
contactRoutes.get(
  '/:id/tasks',
  contactController.listTasks.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/tasks
 * Create a task for a contact
 *
 * Body:
 * - title: string (required)
 * - description?: string
 * - voiceNoteUrl?: string
 * - dueDate?: string (ISO datetime)
 * - reminderAt?: string (ISO datetime)
 * - priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
 */
contactRoutes.post(
  '/:id/tasks',
  contactController.createTask.bind(contactController)
);

/**
 * PUT /api/v1/contacts/:id/tasks/:taskId
 * Update a task
 *
 * Body: (all optional)
 * - title?: string
 * - description?: string
 * - voiceNoteUrl?: string
 * - dueDate?: string (ISO datetime)
 * - reminderAt?: string (ISO datetime)
 * - priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
 * - status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
 */
contactRoutes.put(
  '/:id/tasks/:taskId',
  contactController.updateTask.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id/tasks/:taskId
 * Delete a task
 */
contactRoutes.delete(
  '/:id/tasks/:taskId',
  contactController.deleteTask.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/tasks/:taskId/voice
 * Upload voice note for a task
 *
 * Body: multipart/form-data
 * - voice: audio file (webm, mp3, wav, etc.)
 */
const voiceUpload = multer({
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

contactRoutes.post(
  '/:id/tasks/:taskId/voice',
  voiceUpload.single('voice'),
  contactController.uploadTaskVoice.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/tasks/:taskId/images
 * Upload images for a task
 *
 * Body: multipart/form-data
 * - images: image files (jpg, png, gif, webp)
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

contactRoutes.post(
  '/:id/tasks/:taskId/images',
  imageUpload.array('images', 10), // Max 10 images
  contactController.uploadTaskImages.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id/tasks/:taskId/images/:imageIndex
 * Delete an image from a task
 */
contactRoutes.delete(
  '/:id/tasks/:taskId/images/:imageIndex',
  contactController.deleteTaskImage.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/tasks/:taskId/send-email
 * Send task details to contact via email
 */
contactRoutes.post(
  '/:id/tasks/:taskId/send-email',
  contactController.sendTaskEmail.bind(contactController)
);

// ============================================
// CONTACT REMINDERS ROUTES
// ============================================

/**
 * GET /api/v1/contacts/:id/reminders
 * Get all reminders for a contact
 *
 * Query params:
 * - includeCompleted?: boolean (default false)
 */
contactRoutes.get(
  '/:id/reminders',
  contactController.listReminders.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/reminders
 * Create a reminder for a contact
 *
 * Body:
 * - title: string (required)
 * - description?: string
 * - reminderAt: string (ISO datetime, required)
 */
contactRoutes.post(
  '/:id/reminders',
  contactController.createReminder.bind(contactController)
);

/**
 * PUT /api/v1/contacts/:id/reminders/:reminderId
 * Update a reminder
 *
 * Body: (all optional)
 * - title?: string
 * - description?: string
 * - reminderAt?: string (ISO datetime)
 * - isCompleted?: boolean
 */
contactRoutes.put(
  '/:id/reminders/:reminderId',
  contactController.updateReminder.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id/reminders/:reminderId
 * Delete a reminder
 */
contactRoutes.delete(
  '/:id/reminders/:reminderId',
  contactController.deleteReminder.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/reminders/:reminderId/images
 * Upload images for a reminder
 *
 * Body: multipart/form-data
 * - images: image files (jpg, png, gif, webp)
 */
contactRoutes.post(
  '/:id/reminders/:reminderId/images',
  imageUpload.array('images', 10), // Max 10 images
  contactController.uploadReminderImages.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id/reminders/:reminderId/images/:imageIndex
 * Delete an image from a reminder
 */
contactRoutes.delete(
  '/:id/reminders/:reminderId/images/:imageIndex',
  contactController.deleteReminderImage.bind(contactController)
);

// ============================================
// CONTACT NOTES ROUTES (Rich Media Notes)
// ============================================

/**
 * GET /api/v1/contacts/:id/notes
 * Get all notes for a contact
 *
 * Query params:
 * - type?: 'TEXT' | 'IMAGE' | 'VOICE' (filter by type)
 * - limit?: number (default 50)
 */
contactRoutes.get(
  '/:id/notes',
  contactController.listNotes.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/notes
 * Create a text note for a contact
 *
 * Body:
 * - content: string (required for text notes)
 * - type?: 'TEXT' (default)
 */
contactRoutes.post(
  '/:id/notes',
  contactController.createNote.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/notes/image
 * Upload an image note for a contact
 *
 * Body: multipart/form-data
 * - image: image file (jpg, png, gif, webp)
 * - content?: string (optional caption)
 */
const noteImageUpload = multer({
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

contactRoutes.post(
  '/:id/notes/image',
  noteImageUpload.single('image'),
  contactController.createImageNote.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/notes/voice
 * Upload a voice note for a contact
 *
 * Body: multipart/form-data
 * - voice: audio file (webm, mp3, wav, etc.)
 * - duration?: number (duration in seconds)
 */
const noteVoiceUpload = multer({
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

contactRoutes.post(
  '/:id/notes/voice',
  noteVoiceUpload.single('voice'),
  contactController.createVoiceNote.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/notes/file
 * Upload a file note for a contact (PDF, Word, PPT, Excel, etc.)
 *
 * Body: multipart/form-data
 * - file: document file (pdf, doc, docx, ppt, pptx, xls, xlsx)
 * - content?: string (optional description)
 */
const noteFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files are allowed (PDF, Word, PowerPoint, Excel, CSV, TXT)'));
    }
  },
});

contactRoutes.post(
  '/:id/notes/file',
  noteFileUpload.single('file'),
  contactController.createFileNote.bind(contactController)
);

/**
 * DELETE /api/v1/contacts/:id/notes/:noteId
 * Delete a note
 */
contactRoutes.delete(
  '/:id/notes/:noteId',
  contactController.deleteNote.bind(contactController)
);

/**
 * POST /api/v1/contacts/:id/invite
 * Invite a contact to join the platform
 *
 * Body:
 * - method: 'email' | 'sms' (required)
 * - message?: string (optional personalized message)
 */
contactRoutes.post('/:id/invite', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const { id } = req.params;
    const { method, message } = req.body;

    if (!method || !['email', 'sms'].includes(method)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_METHOD', message: 'method must be "email" or "sms"' },
      });
      return;
    }

    const result = await inviteContactService.inviteContact(
      { contactId: id, method, message },
      req.user.userId
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: 'INVITATION_FAILED', message: result.error },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        preAccountId: result.preAccountId,
        invitationSent: result.invitationSent,
        method: result.method,
      },
    });
  } catch (error) {
    logger.error('Invite contact failed', { error });
    next(error);
  }
});

export default contactRoutes;
