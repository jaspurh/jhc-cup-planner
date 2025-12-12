import { z } from 'zod'

// Match status enum
export const matchStatusSchema = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'])

// Create match schema (for manual match creation)
export const createMatchSchema = z.object({
  stageId: z.cuid(),
  groupId: z.cuid().optional(),
  pitchId: z.cuid().optional(),
  homeRegistrationId: z.cuid().optional(),
  awayRegistrationId: z.cuid().optional(),
  matchNumber: z.number().int().min(1).optional(),
  roundNumber: z.number().int().min(1).optional(),
  bracketPosition: z.string().max(10).optional(),
  scheduledStartTime: z.coerce.date().optional(),
})

export type CreateMatchInput = z.infer<typeof createMatchSchema>

// Update match schema
export const updateMatchSchema = z.object({
  pitchId: z.cuid().nullable().optional(),
  homeRegistrationId: z.cuid().nullable().optional(),
  awayRegistrationId: z.cuid().nullable().optional(),
  scheduledStartTime: z.coerce.date().nullable().optional(),
  status: matchStatusSchema.optional(),
})

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>

// Enter match result schema
export const enterMatchResultSchema = z.object({
  matchId: z.cuid(),
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  homePenalties: z.number().int().min(0).max(99).optional(),
  awayPenalties: z.number().int().min(0).max(99).optional(),
  notes: z.string().max(500).optional(),
})

export type EnterMatchResultInput = z.infer<typeof enterMatchResultSchema>

// Update match result schema
export const updateMatchResultSchema = z.object({
  matchId: z.cuid(),
  homeScore: z.number().int().min(0).max(99).optional(),
  awayScore: z.number().int().min(0).max(99).optional(),
  homePenalties: z.number().int().min(0).max(99).nullable().optional(),
  awayPenalties: z.number().int().min(0).max(99).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export type UpdateMatchResultInput = z.infer<typeof updateMatchResultSchema>

// Bulk update match times (for schedule adjustments)
export const bulkUpdateMatchTimesSchema = z.object({
  updates: z.array(z.object({
    matchId: z.cuid(),
    scheduledStartTime: z.coerce.date(),
  })),
})

export type BulkUpdateMatchTimesInput = z.infer<typeof bulkUpdateMatchTimesSchema>

