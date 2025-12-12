import { z } from 'zod'

// Tournament enums
export const tournamentStatusSchema = z.enum(['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED'])
export const tournamentStyleSchema = z.enum(['COMPETITIVE', 'RECREATIONAL'])
export const tournamentFormatSchema = z.enum(['GROUP_STAGE', 'KNOCKOUT', 'DOUBLE_ELIMINATION', 'GROUP_KNOCKOUT', 'ROUND_ROBIN'])

// Create tournament schema
export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name is required').max(100, 'Tournament name is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  eventId: z.string().cuid('Invalid event ID'),
  style: tournamentStyleSchema.default('COMPETITIVE'),
  format: tournamentFormatSchema.default('GROUP_KNOCKOUT'),
  matchDurationMinutes: z.number().int().min(1).max(120).default(5),
  transitionTimeMinutes: z.number().int().min(0).max(30).default(1),
  startTime: z.coerce.date().optional(),
})

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>

// Update tournament schema
export const updateTournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name is required').max(100, 'Tournament name is too long').optional(),
  description: z.string().max(2000, 'Description is too long').nullable().optional(),
  status: tournamentStatusSchema.optional(),
  style: tournamentStyleSchema.optional(),
  format: tournamentFormatSchema.optional(),
  matchDurationMinutes: z.number().int().min(1).max(120).optional(),
  transitionTimeMinutes: z.number().int().min(0).max(30).optional(),
  startTime: z.coerce.date().nullable().optional(),
})

export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>

// Tournament timing configuration
export const tournamentTimingSchema = z.object({
  matchDurationMinutes: z.number().int().min(1).max(120),
  transitionTimeMinutes: z.number().int().min(0).max(30),
  startTime: z.coerce.date(),
})

export type TournamentTimingInput = z.infer<typeof tournamentTimingSchema>

// Tournament ID param
export const tournamentIdSchema = z.object({
  tournamentId: z.string().cuid(),
})

