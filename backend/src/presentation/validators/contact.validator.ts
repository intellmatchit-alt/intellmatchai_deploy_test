/**
 * Contact Validators
 *
 * Request validation schemas for contact endpoints.
 *
 * @module presentation/validators/contact.validator
 */

import { z } from 'zod';

/**
 * Helper to transform empty strings to undefined
 */
const emptyStringToUndefined = (val: string | undefined | null) => {
  if (val === '' || val === null) return undefined;
  return val;
};

/**
 * Optional email that handles empty strings
 */
const optionalEmail = z
  .string()
  .transform(emptyStringToUndefined)
  .pipe(
    z.string().email('Invalid email address').max(255).optional()
  )
  .or(z.literal('').transform(() => undefined))
  .optional()
  .nullable();

/**
 * Optional URL that handles empty strings and adds protocol if missing
 */
const optionalUrl = z
  .string()
  .transform((val) => {
    if (!val || val.trim() === '') return undefined;
    const trimmed = val.trim();
    // Add https:// if no protocol specified
    if (trimmed && !trimmed.match(/^https?:\/\//i)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  })
  .pipe(
    z.string().url('Invalid URL').max(500).optional()
  )
  .or(z.literal('').transform(() => undefined))
  .optional()
  .nullable();

/**
 * Optional string that handles empty strings
 */
const optionalString = (maxLength: number) => z
  .string()
  .max(maxLength)
  .transform(emptyStringToUndefined)
  .optional()
  .nullable();

/**
 * Title options for names (same as auth.validator.ts)
 */
const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Sir', 'Madam', 'Sheikh', 'Eng.', 'Capt.', 'Rev.'] as const;

/**
 * Create contact schema
 */
export const createContactSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .trim(),
    title: optionalString(20),
    firstName: optionalString(100),
    middleName: optionalString(100),
    lastName: optionalString(100),
    email: optionalEmail,
    phone: optionalString(50),
    company: optionalString(100),
    jobTitle: optionalString(100),
    bio: optionalString(3000),
    bioSummary: optionalString(500),
    bioFull: optionalString(5000),
    linkedInUrl: optionalUrl,
    websiteUrl: optionalUrl,
    location: optionalString(255),
    sectors: z
      .array(z.object({
        sectorId: z.string().min(1),
        isPrimary: z.boolean().optional().default(false),
      }))
      .optional(),
    skills: z
      .array(z.object({
        skillId: z.string().min(1),
        proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
      }))
      .optional(),
    interests: z
      .array(z.object({
        interestId: z.string().min(1),
      }))
      .optional(),
    hobbies: z
      .array(z.object({
        hobbyId: z.string().min(1),
      }))
      .optional(),
    // Custom values for sectors/skills/interests/hobbies that don't exist in database yet
    customSectors: z.array(z.string().max(100)).optional(),
    customSkills: z.array(z.string().max(100)).optional(),
    customInterests: z.array(z.string().max(100)).optional(),
    customHobbies: z.array(z.string().max(100)).optional(),
    notes: optionalString(5000),
    source: z
      .enum(['MANUAL', 'CARD_SCAN', 'IMPORT', 'LINKEDIN'])
      .optional()
      .default('MANUAL'),
    // Allow cardImageUrl for scanned contacts
    cardImageUrl: optionalUrl,
  }),
});

/**
 * Update contact schema
 */
export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z
      .string()
      .min(1)
      .max(100)
      .trim()
      .optional(),
    title: optionalString(20),
    firstName: optionalString(100),
    middleName: optionalString(100),
    lastName: optionalString(100),
    email: optionalEmail,
    phone: optionalString(50),
    company: optionalString(100),
    jobTitle: optionalString(100),
    bio: optionalString(3000),
    bioSummary: optionalString(500),
    bioFull: optionalString(5000),
    linkedInUrl: optionalUrl,
    websiteUrl: optionalUrl,
    location: optionalString(255),
    notes: optionalString(5000),
    isFavorite: z
      .boolean()
      .optional(),
    // Sectors, skills, interests for update
    sectors: z
      .array(z.object({
        sectorId: z.string().min(1),
        isPrimary: z.boolean().optional().default(false),
      }))
      .optional(),
    skills: z
      .array(z.object({
        skillId: z.string().min(1),
        proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
      }))
      .optional(),
    interests: z
      .array(z.object({
        interestId: z.string().min(1),
      }))
      .optional(),
    hobbies: z
      .array(z.object({
        hobbyId: z.string().min(1),
      }))
      .optional(),
    // Custom values for sectors/skills/interests/hobbies that don't exist in database yet
    customSectors: z.array(z.string().max(100)).optional(),
    customSkills: z.array(z.string().max(100)).optional(),
    customInterests: z.array(z.string().max(100)).optional(),
    customHobbies: z.array(z.string().max(100)).optional(),
  }),
});

/**
 * Get contact schema
 */
export const getContactSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

/**
 * Delete contact schema
 */
export const deleteContactSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

/**
 * List contacts schema
 */
export const listContactsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    sector: z.string().min(1).optional(),
    favorite: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
    minScore: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().min(0).max(100))
      .optional(),
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().min(1))
      .optional()
      .default('1'),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().min(1).max(100))
      .optional()
      .default('20'),
    sort: z
      .enum(['name', 'createdAt', 'matchScore', 'lastContactedAt'])
      .optional()
      .default('createdAt'),
    order: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc'),
  }),
});

/**
 * Add interaction schema
 */
export const addInteractionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    type: z.enum(['MEETING', 'CALL', 'EMAIL', 'MESSAGE', 'EVENT', 'OTHER']),
    notes: z.string().max(1000).optional(),
    date: z.string().datetime().optional(),
  }),
});

/**
 * Scan card schema - uses same lenient validators as create contact
 */
export const scanCardSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).trim(),
    title: optionalString(20),
    firstName: optionalString(100),
    middleName: optionalString(100),
    lastName: optionalString(100),
    email: optionalEmail,
    phone: optionalString(50),
    company: optionalString(100),
    jobTitle: optionalString(100),
    website: optionalUrl,
    cardImageUrl: z
      .string()
      .min(1, 'Card image URL is required')
      .transform((val) => {
        if (!val || val.trim() === '') return val;
        const trimmed = val.trim();
        if (!trimmed.match(/^https?:\/\//i)) {
          return `https://${trimmed}`;
        }
        return trimmed;
      }),
    sectors: z.array(z.string()).optional(),
  }),
});

/**
 * Export types
 */
export type CreateContactInput = z.infer<typeof createContactSchema>['body'];
export type UpdateContactInput = z.infer<typeof updateContactSchema>['body'];
export type ListContactsQuery = z.infer<typeof listContactsSchema>['query'];
export type AddInteractionInput = z.infer<typeof addInteractionSchema>['body'];
export type ScanCardInput = z.infer<typeof scanCardSchema>['body'];
