/**
 * Event Validation Schemas
 *
 * Zod schemas for validating event-related requests.
 *
 * @module presentation/schemas/event.schemas
 */

import { z } from 'zod';

// ===== Create Event Schema =====

export const createEventSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, 'Event name must be at least 3 characters')
      .max(255, 'Event name must be less than 255 characters'),
    description: z
      .string()
      .max(5000, 'Description must be less than 5000 characters')
      .optional(),
    dateTime: z.string().datetime({ message: 'Invalid date/time format' }),
    location: z
      .string()
      .max(500, 'Location must be less than 500 characters')
      .optional(),
    locationLat: z.union([z.number(), z.string().transform(v => v ? parseFloat(v) : undefined)]).pipe(z.number().min(-90).max(90)).optional().nullable(),
    locationLng: z.union([z.number(), z.string().transform(v => v ? parseFloat(v) : undefined)]).pipe(z.number().min(-180).max(180)).optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    welcomeMessage: z
      .string()
      .max(500, 'Welcome message must be less than 500 characters')
      .optional(),
  }),
});

// ===== Update Event Schema =====

export const updateEventSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    name: z
      .string()
      .min(3, 'Event name must be at least 3 characters')
      .max(255, 'Event name must be less than 255 characters')
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must be less than 5000 characters')
      .optional(),
    dateTime: z.string().datetime({ message: 'Invalid date/time format' }).optional(),
    location: z
      .string()
      .max(500, 'Location must be less than 500 characters')
      .optional(),
    locationLat: z.union([z.number(), z.string().transform(v => v ? parseFloat(v) : undefined)]).pipe(z.number().min(-90).max(90)).optional().nullable(),
    locationLng: z.union([z.number(), z.string().transform(v => v ? parseFloat(v) : undefined)]).pipe(z.number().min(-180).max(180)).optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    welcomeMessage: z
      .string()
      .max(500, 'Welcome message must be less than 500 characters')
      .optional()
      .nullable(),
    isActive: z.boolean().optional(),
  }),
});

// ===== List Events Schema =====

export const listEventsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    status: z.enum(['active', 'inactive', 'all']).optional(),
  }),
});

// ===== Get Event Schema =====

export const getEventSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
});

// ===== Delete Event Schema =====

export const deleteEventSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
});

// ===== Get Attendees Schema =====

export const getAttendeesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
  }),
});

// ===== Export Attendees Schema =====

export const exportAttendeesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  query: z.object({
    format: z.enum(['csv', 'json']).optional(),
  }),
});

// ===== Add Attendees to Contacts Schema =====

export const addToContactsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    attendeeIds: z.array(z.string().uuid()).optional(), // If not provided, add all
  }),
});

// ===== Invite Attendees Schema =====

export const inviteAttendeesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  body: z.object({
    attendeeIds: z.array(z.string().uuid()).optional(), // If not provided, invite all
    message: z.string().max(1000).optional(),
  }),
});

// ===== Public Event Schema (by code) =====

export const getPublicEventSchema = z.object({
  params: z.object({
    code: z
      .string()
      .min(4, 'Invalid event code')
      .max(20, 'Invalid event code'),
  }),
});

// ===== Guest Registration Schema =====

export const guestRegistrationSchema = z.object({
  params: z.object({
    code: z
      .string()
      .min(4, 'Invalid event code')
      .max(20, 'Invalid event code'),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(255, 'Name must be less than 255 characters'),
    email: z.string().email('Invalid email address'),
    mobile: z
      .string()
      .max(50, 'Mobile number must be less than 50 characters')
      .optional(),
    company: z
      .string()
      .max(255, 'Company name must be less than 255 characters')
      .optional(),
    role: z
      .string()
      .max(255, 'Role must be less than 255 characters')
      .optional(),
    bio: z
      .string()
      .max(1000, 'Bio must be less than 1000 characters')
      .optional(),
    lookingFor: z
      .string()
      .max(2000, 'Looking for must be less than 2000 characters')
      .optional(),
    // Optional: Create account during registration
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be less than 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .optional(),
    confirmPassword: z.string().optional(),
  }).refine(
    (data) => {
      // If password provided, confirmPassword must match
      if (data.password && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    { message: 'Passwords do not match', path: ['confirmPassword'] }
  ),
});

// ===== Get Public Attendees Schema =====

export const getPublicAttendeesSchema = z.object({
  params: z.object({
    code: z
      .string()
      .min(4, 'Invalid event code')
      .max(20, 'Invalid event code'),
  }),
  query: z.object({
    token: z.string().optional(), // Guest access token
  }),
});

// ===== Get Attended Events Schema =====

export const getAttendedEventsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// ===== Get My Matches Schema =====

export const getMyMatchesSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
});

// ===== QR Code Schema =====

export const getQRCodeSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid event ID'),
  }),
  query: z.object({
    format: z.enum(['png', 'svg', 'base64']).optional(),
    size: z.string().regex(/^\d+$/).optional(),
  }),
});

// ===== Convert Guest to User Schema =====

export const convertGuestSchema = z.object({
  body: z.object({
    accessToken: z
      .string()
      .min(64, 'Invalid access token')
      .max(64, 'Invalid access token'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be less than 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

// ===== Join Event (Authenticated) Schema =====

export const joinEventSchema = z.object({
  params: z.object({
    code: z
      .string()
      .min(4, 'Invalid event code')
      .max(20, 'Invalid event code'),
  }),
});

// ===== Link Guest to User Schema =====

export const linkGuestSchema = z.object({
  body: z.object({
    accessToken: z
      .string()
      .min(64, 'Invalid access token')
      .max(64, 'Invalid access token'),
  }),
});

// Export types
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type GuestRegistrationInput = z.infer<typeof guestRegistrationSchema>;
export type ConvertGuestInput = z.infer<typeof convertGuestSchema>;
export type LinkGuestInput = z.infer<typeof linkGuestSchema>;
