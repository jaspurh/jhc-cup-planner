import { z } from 'zod'

// Stage type enum - must match Prisma StageType enum
export const stageTypeSchema = z.enum([
  'GROUP_STAGE',
  'GSL_GROUPS',
  'KNOCKOUT',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'FINAL',
])
export const roundRobinTypeSchema = z.enum(['SINGLE', 'DOUBLE'])

// Group stage configuration
export const groupStageConfigSchema = z.object({
  numGroups: z.number().int().min(1).max(16),
  teamsPerGroup: z.number().int().min(2).max(8).optional(),
  roundRobinType: roundRobinTypeSchema.default('SINGLE'),
  advancingTeamsPerGroup: z.number().int().min(1).max(4).default(2),
})

// GSL groups configuration (4 teams per group, 5 matches each)
export const gslGroupsConfigSchema = z.object({
  numGroups: z.number().int().min(1).max(8),
  advancingTeamsPerGroup: z.literal(2), // GSL always advances 2 teams
})

// Knockout stage configuration
export const knockoutStageConfigSchema = z.object({
  numMatches: z.number().int().min(1).max(32),
  seedingRule: z.enum(['1v2', 'custom']).default('1v2'),
  hasThirdPlace: z.boolean().default(false),
})

// Double elimination configuration
export const doubleEliminationConfigSchema = z.object({
  numTeams: z.number().int().min(4).max(64),
  hasGrandFinalReset: z.boolean().default(true),
})

// Stage configuration union
export const stageConfigurationSchema = z.union([
  groupStageConfigSchema,
  gslGroupsConfigSchema,
  knockoutStageConfigSchema,
  doubleEliminationConfigSchema,
])

// Create stage schema
export const createStageSchema = z.object({
  name: z.string().min(1, 'Stage name is required').max(50),
  tournamentId: z.cuid(),
  type: stageTypeSchema,
  order: z.number().int().min(1),
  gapMinutesBefore: z.number().int().min(0).max(120).default(0),
  configuration: stageConfigurationSchema.optional(),
})

export type CreateStageInput = z.infer<typeof createStageSchema>

// Update stage schema
export const updateStageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  order: z.number().int().min(1).optional(),
  gapMinutesBefore: z.number().int().min(0).max(120).optional(),
  configuration: stageConfigurationSchema.optional(),
})

export type UpdateStageInput = z.infer<typeof updateStageSchema>

// Create group schema
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50),
  stageId: z.cuid(),
  order: z.number().int().min(1),
  roundRobinType: roundRobinTypeSchema.default('SINGLE'),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>

// Assign team to group
export const assignTeamToGroupSchema = z.object({
  groupId: z.cuid(),
  registrationId: z.cuid(),
  seedPosition: z.number().int().min(1).optional(),
})

export type AssignTeamToGroupInput = z.infer<typeof assignTeamToGroupSchema>

