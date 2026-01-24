/**
 * Scheduling Engine
 * 
 * Main orchestrator for generating tournament schedules.
 * 
 * Flow:
 * 1. Generate matches for all stages
 * 2. Allocate time slots based on pitches and dependencies
 * 3. Validate constraints (rest times, conflicts, etc.)
 * 4. Return schedule with stats and warnings
 */

import {
  ScheduleGenerationInput,
  ScheduleGenerationResult,
  ConstraintViolation,
  StageConfig,
} from './types'
import { generateAllMatches } from './matchGeneration'
import { 
  allocateTimeSlots, 
  calculateTotalDuration, 
  calculatePitchUtilization 
} from './timeAllocation'
import { 
  validateSchedule, 
  calculateAverageRestTime 
} from './constraints'

// ==========================================
// Main Schedule Generation
// ==========================================

/**
 * Generate a complete tournament schedule
 * 
 * @param input - Schedule generation input (stages, timing, constraints)
 * @returns Schedule generation result with matches, stats, and any issues
 */
export function generateSchedule(input: ScheduleGenerationInput): ScheduleGenerationResult {
  const { stages, timing, constraints } = input
  
  // Step 1: Generate all matches
  const generatedMatches = generateAllMatches(stages)
  
  if (generatedMatches.length === 0) {
    return {
      success: false,
      matches: [],
      warnings: [],
      errors: [{
        type: 'MISSING_TEAM',
        severity: 'error',
        message: 'No matches could be generated. Check stage configuration.',
      }],
      stats: {
        totalMatches: 0,
        totalDuration: 0,
        pitchUtilization: {},
        averageRestTime: 0,
      },
    }
  }

  // Step 2: Allocate time slots
  const allocationResult = allocateTimeSlots(generatedMatches, stages, timing)
  
  if (!allocationResult.success) {
    const errors: ConstraintViolation[] = allocationResult.errors.map(e => ({
      type: 'TIME_OVERLAP' as const,
      severity: 'error' as const,
      message: e,
    }))
    
    return {
      success: false,
      matches: allocationResult.matches,
      warnings: [],
      errors,
      stats: {
        totalMatches: generatedMatches.length,
        totalDuration: calculateTotalDuration(allocationResult.matches),
        pitchUtilization: calculatePitchUtilization(allocationResult.matches, timing),
        averageRestTime: calculateAverageRestTime(allocationResult.matches),
      },
    }
  }

  // Build team names map for friendly error messages
  const teamNames = new Map<string, string>()
  for (const stage of stages) {
    if (stage.groups) {
      for (const group of stage.groups) {
        for (const team of group.teams) {
          if (team.registrationId && team.teamName) {
            teamNames.set(team.registrationId, team.teamName)
          }
        }
      }
    }
  }

  // Step 3: Validate constraints
  const validationResult = validateSchedule(allocationResult.matches, {
    restTime: constraints?.restTime,
    // Don't validate missing teams for knockout matches
    validateMissingTeams: false,
    teamNames,
  })

  // Separate warnings and errors
  const warnings = validationResult.violations.filter(v => v.severity === 'warning')
  const errors = validationResult.violations.filter(v => v.severity === 'error')

  // Step 4: Calculate stats
  const stats = {
    totalMatches: allocationResult.matches.length,
    totalDuration: calculateTotalDuration(allocationResult.matches),
    pitchUtilization: calculatePitchUtilization(allocationResult.matches, timing),
    averageRestTime: calculateAverageRestTime(allocationResult.matches),
  }

  return {
    success: errors.length === 0,
    matches: allocationResult.matches,
    warnings,
    errors,
    stats,
  }
}

// ==========================================
// Re-exports for convenience
// ==========================================

export * from './types'
export * from './matchGeneration'
export * from './timeAllocation'
export * from './constraints'

// ==========================================
// Utility: Convert DB data to StageConfig
// ==========================================

import { StageType, RoundRobinType } from '@/types'
import { IncomingTeamSlot, GroupSchedulingMode } from './types'

interface DBStage {
  id: string
  name: string
  type: StageType
  order: number
  bufferTimeMinutes: number
  configuration: unknown
  groups: {
    id: string
    name: string
    order: number
    roundRobinType: RoundRobinType
    teamAssignments: {
      id: string
      registrationId: string
      seedPosition: number | null
      registration: {
        id: string
        registeredTeamName: string | null
        team: {
          name: string
        }
      }
    }[]
  }[]
}

/**
 * Build incoming team slots for knockout/finals stages based on previous stages
 */
function buildIncomingTeams(
  previousStages: DBStage[],
  advancingTeamCount: number
): IncomingTeamSlot[] {
  const incomingTeams: IncomingTeamSlot[] = []
  
  // Get the most recent stage with groups (GROUP_STAGE or GSL_GROUPS)
  const groupStages = previousStages.filter(
    s => s.type === 'GROUP_STAGE' || s.type === 'GSL_GROUPS'
  )
  
  if (groupStages.length === 0) {
    // No group stages - just create generic seed labels
    for (let i = 1; i <= advancingTeamCount; i++) {
      incomingTeams.push({
        seedPosition: i,
        sourceLabel: `Seed ${i}`,
        registrationId: null,
      })
    }
    return incomingTeams
  }

  // Get the last group stage
  const lastGroupStage = groupStages[groupStages.length - 1]
  const groups = [...lastGroupStage.groups].sort((a, b) => a.order - b.order)
  const teamsPerGroup = Math.ceil(advancingTeamCount / groups.length)
  
  // Determine position labels based on stage type
  const isGSL = lastGroupStage.type === 'GSL_GROUPS'
  const positionLabels = isGSL 
    ? ['Winner', 'Runner-up'] 
    : ['1st', '2nd', '3rd', '4th', '5th', '6th']

  let seedPosition = 1
  
  // Standard seeding: 1st from each group first, then 2nd from each, etc.
  for (let pos = 0; pos < teamsPerGroup && seedPosition <= advancingTeamCount; pos++) {
    for (const group of groups) {
      if (seedPosition > advancingTeamCount) break
      
      const posLabel = positionLabels[pos] || `${pos + 1}th`
      const sourceLabel = `${group.name} ${posLabel}`
      
      incomingTeams.push({
        seedPosition,
        sourceLabel,
        registrationId: null, // TBD - winners not known yet
      })
      seedPosition++
    }
  }

  return incomingTeams
}

/**
 * Convert database stage data to StageConfig for scheduling
 */
export function dbStageToConfig(
  stage: DBStage, 
  previousStages: DBStage[] = []
): StageConfig {
  const config = stage.configuration as Record<string, unknown> | undefined
  
  // For knockout/finals stages, get advancingTeamCount from config or count team assignments
  const teamsFromGroups = stage.groups.reduce(
    (sum, g) => sum + g.teamAssignments.length, 
    0
  )
  const advancingTeamCount = (config?.advancingTeamCount as number) || teamsFromGroups || 0

  // Build incoming teams for knockout/finals stages
  let incomingTeams: IncomingTeamSlot[] | undefined
  if (stage.type === 'KNOCKOUT' || stage.type === 'FINAL') {
    incomingTeams = buildIncomingTeams(previousStages, advancingTeamCount)
  }

  // Get group scheduling mode from config
  const groupSchedulingMode = (config?.groupSchedulingMode as GroupSchedulingMode) || 'interleaved'

  return {
    stageId: stage.id,
    stageName: stage.name,
    type: stage.type,
    order: stage.order,
    bufferTimeMinutes: stage.bufferTimeMinutes,
    customConfig: config,
    groups: stage.groups.map(group => ({
      groupId: group.id,
      groupName: group.name,
      groupOrder: group.order,
      roundRobinType: group.roundRobinType,
      teams: group.teamAssignments.map(ta => ({
        registrationId: ta.registrationId,
        seedPosition: ta.seedPosition ?? undefined,
        teamName: ta.registration.registeredTeamName || ta.registration.team.name,
      })),
    })),
    advancingTeamCount,
    incomingTeams,
    groupSchedulingMode,
  }
}

interface DBPitch {
  id: string
  name: string
}

interface DBTournament {
  startTime: Date | null
  matchDurationMinutes: number
  transitionTimeMinutes: number
}

/**
 * Create TimingConfig from database data
 */
export function createTimingConfig(
  tournament: DBTournament,
  pitches: DBPitch[],
  availableFrom?: Date,
  availableTo?: Date
) {
  const startTime = tournament.startTime || new Date()
  const endOfDay = new Date(startTime)
  endOfDay.setHours(23, 59, 59, 999)

  return {
    startTime,
    matchDurationMinutes: tournament.matchDurationMinutes,
    transitionTimeMinutes: tournament.transitionTimeMinutes,
    pitches: pitches.map(p => ({
      pitchId: p.id,
      pitchName: p.name,
      availableFrom: availableFrom || startTime,
      availableTo: availableTo || endOfDay,
      scheduledMatches: [],
    })),
  }
}
