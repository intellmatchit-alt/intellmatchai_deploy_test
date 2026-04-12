/**
 * PNME Match Validators: Request validation schemas for match operations
 */

import { z } from 'zod';
import { PitchMatchStatus } from '../../domain/entities/Pitch';

// Update match status
const updateStatusSchema = z.object({
  params: z.object({
    matchId: z.string().uuid(),
  }),
  body: z.object({
    status: z.nativeEnum(PitchMatchStatus),
    outreachEdited: z.string().max(5000).optional(),
  }),
});

export const pitchMatchValidators = {
  updateStatus: updateStatusSchema,
};
