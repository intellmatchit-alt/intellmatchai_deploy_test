/**
 * Event Routes
 *
 * Routes for event QR & matching feature.
 *
 * @module presentation/routes/event
 */

import { Router } from 'express';
import multer from 'multer';
import { eventController } from '../controllers/EventController';
import { itemizedMatchController } from '../controllers/ItemizedMatchController';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { publicEventRateLimiter, eventRegistrationRateLimiter } from '../middleware/rateLimiter';
import {
  createEventSchema,
  updateEventSchema,
  listEventsSchema,
  getEventSchema,
  deleteEventSchema,
  getAttendeesSchema,
  exportAttendeesSchema,
  addToContactsSchema,
  inviteAttendeesSchema,
  getPublicEventSchema,
  guestRegistrationSchema,
  joinEventSchema,
  getPublicAttendeesSchema,
  getAttendedEventsSchema,
  getMyMatchesSchema,
  getQRCodeSchema,
  convertGuestSchema,
  linkGuestSchema,
} from '../schemas/event.schemas';

export const eventRoutes = Router();

// Configure multer for CV and photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cv') {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('CV must be a PDF file'));
      }
    } else if (file.fieldname === 'photo' || file.fieldname === 'thumbnail') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('File must be an image'));
      }
    } else {
      cb(null, true);
    }
  },
});

// ===== PUBLIC ROUTES (No authentication required) =====

/**
 * GET /api/v1/events/public/:code
 * Get public event info for QR landing page
 */
eventRoutes.get(
  '/public/:code',
  publicEventRateLimiter,
  validate(getPublicEventSchema),
  eventController.getPublicEvent.bind(eventController)
);

/**
 * POST /api/v1/events/public/:code/register
 * Register as guest for an event
 *
 * Body:
 * - name: string (required)
 * - email: string (required)
 * - mobile?: string
 * - company?: string
 * - role?: string
 * - bio?: string
 * - lookingFor?: string
 *
 * Files (multipart/form-data):
 * - cv?: PDF file
 * - photo?: image file
 */
eventRoutes.post(
  '/public/:code/register',
  eventRegistrationRateLimiter,
  upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  validate(guestRegistrationSchema),
  eventController.registerGuest.bind(eventController)
);

/**
 * POST /api/v1/events/public/:code/join
 * Join event as authenticated user (uses profile data for matching)
 */
eventRoutes.post(
  '/public/:code/join',
  authenticate,
  validate(joinEventSchema),
  eventController.joinEvent.bind(eventController)
);

/**
 * GET /api/v1/events/public/:code/attendees
 * Get attendees list with match info (requires token or auth)
 *
 * Query params:
 * - token: guest access token
 */
eventRoutes.get(
  '/public/:code/attendees',
  publicEventRateLimiter,
  optionalAuth,
  validate(getPublicAttendeesSchema),
  eventController.getPublicAttendees.bind(eventController)
);

/**
 * POST /api/v1/events/guests/convert
 * Convert guest to full user account
 *
 * Body:
 * - accessToken: string (64-char guest access token)
 * - password: string (min 8 chars, uppercase, lowercase, number)
 * - confirmPassword: string (must match password)
 */
eventRoutes.post(
  '/guests/convert',
  eventRegistrationRateLimiter,
  validate(convertGuestSchema),
  eventController.convertGuestToUser.bind(eventController)
);

// ===== AUTHENTICATED ROUTES =====

// Apply authentication to all routes below
eventRoutes.use(authenticate);

/**
 * POST /api/v1/events/guests/link
 * Link guest token to authenticated user
 *
 * Body:
 * - accessToken: string (64-char guest access token)
 */
eventRoutes.post(
  '/guests/link',
  validate(linkGuestSchema),
  eventController.linkGuestToUser.bind(eventController)
);

/**
 * GET /api/v1/events/attended
 * Get events the user has attended
 */
eventRoutes.get(
  '/attended',
  validate(getAttendedEventsSchema),
  eventController.getAttendedEvents.bind(eventController)
);

/**
 * GET /api/v1/events
 * Get user's hosted events
 *
 * Query params:
 * - page: page number (default 1)
 * - limit: items per page (default 20)
 * - status: 'active', 'inactive', or 'all'
 */
eventRoutes.get(
  '/',
  validate(listEventsSchema),
  eventController.list.bind(eventController)
);

/**
 * POST /api/v1/events
 * Create a new event
 *
 * Body:
 * - name: string (required)
 * - description?: string
 * - dateTime: ISO date string (required)
 * - location?: string
 */
eventRoutes.post(
  '/',
  validate(createEventSchema),
  eventController.create.bind(eventController)
);

/**
 * GET /api/v1/events/:id
 * Get event details (host only)
 */
eventRoutes.get(
  '/:id',
  validate(getEventSchema),
  eventController.get.bind(eventController)
);

/**
 * PUT /api/v1/events/:id
 * Update event (host only)
 */
eventRoutes.put(
  '/:id',
  validate(updateEventSchema),
  eventController.update.bind(eventController)
);

/**
 * DELETE /api/v1/events/:id
 * Delete event (host only)
 */
eventRoutes.delete(
  '/:id',
  validate(deleteEventSchema),
  eventController.delete.bind(eventController)
);

/**
 * GET /api/v1/events/:id/attendees
 * Get event attendees (host only)
 */
eventRoutes.get(
  '/:id/attendees',
  validate(getAttendeesSchema),
  eventController.getAttendees.bind(eventController)
);

/**
 * POST /api/v1/events/:id/attendees/export
 * Export attendees to CSV or JSON
 *
 * Query params:
 * - format: 'csv' or 'json' (default csv)
 */
eventRoutes.post(
  '/:id/attendees/export',
  validate(exportAttendeesSchema),
  eventController.exportAttendees.bind(eventController)
);

/**
 * POST /api/v1/events/:id/attendees/add-to-contacts
 * Add attendees to host's contacts
 *
 * Body:
 * - attendeeIds?: string[] (if not provided, add all)
 */
eventRoutes.post(
  '/:id/attendees/add-to-contacts',
  validate(addToContactsSchema),
  eventController.addToContacts.bind(eventController)
);

/**
 * POST /api/v1/events/:id/invite-all
 * Send IntellMatch invitations to attendees
 *
 * Body:
 * - attendeeIds?: string[] (if not provided, invite all)
 * - message?: string (custom invitation message)
 */
eventRoutes.post(
  '/:id/invite-all',
  validate(inviteAttendeesSchema),
  eventController.inviteAttendees.bind(eventController)
);

/**
 * GET /api/v1/events/:id/my-matches
 * Get my matches for a specific event
 */
eventRoutes.get(
  '/:id/my-matches',
  validate(getMyMatchesSchema),
  eventController.getMyMatches.bind(eventController)
);

/**
 * GET /api/v1/events/:id/qr
 * Generate QR code for event
 *
 * Query params:
 * - format: 'png' | 'svg' | 'base64' (default png)
 * - size: number (default 300, max 1000)
 */
eventRoutes.get(
  '/:id/qr',
  validate(getQRCodeSchema),
  eventController.getQRCode.bind(eventController)
);

// ===== ITEMIZED MATCHING ROUTES =====

/**
 * GET /api/v1/events/:id/matches/itemized
 * Get all itemized matches for the requesting attendee
 *
 * Works with both authenticated users and guest tokens.
 * Returns list of all matches sorted by complementary goals.
 *
 * Query params:
 * - token: guest access token (required if not authenticated)
 */
eventRoutes.get(
  '/:id/matches/itemized',
  optionalAuth,
  itemizedMatchController.getEventMatches.bind(itemizedMatchController)
);

/**
 * GET /api/v1/events/:id/matches/itemized/:attendeeId
 * Get itemized match between requesting user and specific attendee
 *
 * Works with both authenticated users and guest tokens.
 * Returns per-criterion scores with detailed explanations.
 *
 * Query params:
 * - token: guest access token (required if not authenticated)
 */
eventRoutes.get(
  '/:id/matches/itemized/:attendeeId',
  optionalAuth,
  itemizedMatchController.getEventMatch.bind(itemizedMatchController)
);

/**
 * POST /api/v1/events/:id/thumbnail
 * Upload event thumbnail image
 *
 * Accepts multipart/form-data with 'thumbnail' field.
 * Recommended size: 1200x630 pixels (OG image standard)
 * Supported formats: JPEG, PNG, WebP
 * Max size: 5MB
 */
eventRoutes.post(
  '/:id/thumbnail',
  authenticate,
  upload.single('thumbnail'),
  eventController.uploadThumbnail.bind(eventController)
);

export default eventRoutes;
