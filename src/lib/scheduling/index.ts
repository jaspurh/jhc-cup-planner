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

  // Step 3: Validate constraints
  const validationResult = validateSchedule(allocationResult.matches, {
    restTime: constraints?.restTime,
    // Don't validate missing teams for knockout matches
    validateMissingTeams: false,
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

interface DBStage {
  id: string
  name: string
  type: StageType
  order: number
  gapMinutesBefore: number
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
 * Convert database stage data to StageConfig for scheduling
 */
export function dbStageToConfig(stage: DBStage): StageConfig {
  return {
    stageId: stage.id,
    stageName: stage.name,
    type: stage.type,
    order: stage.order,
    gapMinutesBefore: stage.gapMinutesBefore,
    customConfig: stage.configuration as Record<string, unknown> | undefined,
    groups: stage.groups.map(group => ({
      groupId: group.id,
      groupName: group.name,
      roundRobinType: group.roundRobinType,
      teams: group.teamAssignments.map(ta => ({
        registrationId: ta.registrationId,
        seedPosition: ta.seedPosition ?? undefined,
        teamName: ta.registration.registeredTeamName || ta.registration.team.name,
      })),
    })),
    // For knockout stages, count advancing teams from previous stages
    advancingTeamCount: stage.groups.reduce(
      (sum, g) => sum + g.teamAssignments.length, 
      0
    ),
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
