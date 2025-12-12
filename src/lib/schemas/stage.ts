import { z } from 'zod'

// Stage type enum
export const stageTypeSchema = z.enum(['GROUP_STAGE', 'KNOCKOUT', 'FINAL'])
export const roundRobinTypeSchema = z.enum(['SINGLE', 'DOUBLE'])

// Group stage configuration
export const groupStageConfigSchema = z.object({
  numGroups: z.number().int().min(1).max(16),
  teamsPerGroup: z.number().int().min(2).max(8).optional(),
  roundRobinType: roundRobinTypeSchema.default('SINGLE'),
  advancingTeamsPerGroup: z.number().int().min(1).max(4).default(2),
})

// Knockout stage configuration
export const knockoutStageConfigSchema = z.object({
  numMatches: z.number().int().min(1).max(32),
  seedingRule: z.enum(['1v2', 'custom']).default('1v2'),
  hasThirdPlace: z.boolean().default(false),
})

// Create stage schema
export const createStageSchema = z.object({
  name: z.string().min(1, 'Stage name is required').max(50),
  tournamentId: z.string().cuid(),
  type: stageTypeSchema,
  order: z.number().int().min(1),
  gapMinutesBefore: z.number().int().min(0).max(120).default(0),
  configuration: z.union([groupStageConfigSchema, knockoutStageConfigSchema]).optional(),
})

export type CreateStageInput = z.infer<typeof createStageSchema>

// Update stage schema
export const updateStageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  order: z.number().int().min(1).optional(),
  gapMinutesBefore: z.number().int().min(0).max(120).optional(),
  configuration: z.union([groupStageConfigSchema, knockoutStageConfigSchema]).optional(),
})

export type UpdateStageInput = z.infer<typeof updateStageSchema>

// Create group schema
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50),
  stageId: z.string().cuid(),
  order: z.number().int().min(1),
  roundRobinType: roundRobinTypeSchema.default('SINGLE'),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>

// Assign team to group
export const assignTeamToGroupSchema = z.object({
  groupId: z.string().cuid(),
  registrationId: z.string().cuid(),
  seedPosition: z.number().int().min(1).optional(),
})

export type AssignTeamToGroupInput = z.infer<typeof assignTeamToGroupSchema>

