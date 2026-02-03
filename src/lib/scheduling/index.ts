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
 * Build incoming team distribution for a group stage that follows another group stage.
 * This handles proper seeding where:
 * - Each new group gets a mix of 1st and 2nd place teams from the previous stage
 * - 1st seeds play 2nd seeds in opening matches (for GSL: M1 and M2)
 * 
 * Example for 4 prev groups → 2 GSL groups:
 * - GSL Group 1: A1 (seed 1), D1 (seed 2), B2 (seed 3), C2 (seed 4)
 * - GSL Group 2: B1 (seed 1), C1 (seed 2), A2 (seed 3), D2 (seed 4)
 */
function buildIncomingTeamsForGroups(
  previousStages: DBStage[],
  targetGroupCount: number,
  teamsPerTargetGroup: number
): Map<number, IncomingTeamSlot[]> {
  const result = new Map<number, IncomingTeamSlot[]>()
  
  // Initialize empty arrays for each target group
  for (let g = 0; g < targetGroupCount; g++) {
    result.set(g, [])
  }
  
  // Get the most recent stage with groups
  const groupStages = previousStages.filter(
    s => s.type === 'GROUP_STAGE' || s.type === 'GSL_GROUPS'
  )
  
  if (groupStages.length === 0) {
    // No previous group stage - create generic seeds
    for (let g = 0; g < targetGroupCount; g++) {
      const groupTeams: IncomingTeamSlot[] = []
      for (let t = 0; t < teamsPerTargetGroup; t++) {
        const seedPosition = t + 1
        groupTeams.push({
          seedPosition,
          sourceLabel: `Seed ${g * teamsPerTargetGroup + t + 1}`,
          registrationId: null,
        })
      }
      result.set(g, groupTeams)
    }
    return result
  }
  
  const lastGroupStage = groupStages[groupStages.length - 1]
  const prevGroups = [...lastGroupStage.groups].sort((a, b) => a.order - b.order)
  const isGSL = lastGroupStage.type === 'GSL_GROUPS'
  const positionLabels = isGSL 
    ? ['Winner', 'Runner-up'] 
    : ['1st', '2nd', '3rd', '4th', '5th', '6th']
  
  // Calculate how many teams advance from each position
  const totalTeamsAdvancing = targetGroupCount * teamsPerTargetGroup
  const teamsPerPosition = Math.ceil(totalTeamsAdvancing / 2) // Assume top 2 from each group
  
  // Build list of all advancing teams with their source info
  const allAdvancingTeams: { sourceLabel: string; position: number; groupIndex: number }[] = []
  
  // Get 1st place from each previous group
  for (let i = 0; i < prevGroups.length && allAdvancingTeams.length < teamsPerPosition; i++) {
    allAdvancingTeams.push({
      sourceLabel: `${prevGroups[i].name} ${positionLabels[0]}`,
      position: 1,
      groupIndex: i,
    })
  }
  
  // Get 2nd place from each previous group
  for (let i = 0; i < prevGroups.length && allAdvancingTeams.length < totalTeamsAdvancing; i++) {
    allAdvancingTeams.push({
      sourceLabel: `${prevGroups[i].name} ${positionLabels[1] || '2nd'}`,
      position: 2,
      groupIndex: i,
    })
  }
  
  // Now distribute teams to target groups using cross-seeding
  const firstPlaceTeams = allAdvancingTeams.filter(t => t.position === 1)
  const secondPlaceTeams = allAdvancingTeams.filter(t => t.position === 2)
  
  for (let g = 0; g < targetGroupCount; g++) {
    const groupTeams: IncomingTeamSlot[] = []
    
    // For GSL with 4 teams per group: 2 first-place + 2 second-place teams
    // Seed 1 & 3 are 1st place, Seed 2 & 4 are 2nd place (so 1st meets 2nd in M1 and M2)
    const teamsNeeded = teamsPerTargetGroup
    const firstNeeded = Math.ceil(teamsNeeded / 2)
    const secondNeeded = teamsNeeded - firstNeeded
    
    // Pick 1st place teams using snake pattern for fairness
    for (let i = 0; i < firstNeeded && firstPlaceTeams.length > 0; i++) {
      const pickIndex = i % 2 === 0 
        ? g % firstPlaceTeams.length
        : (firstPlaceTeams.length - 1 - (g % firstPlaceTeams.length)) % firstPlaceTeams.length
      
      const team = firstPlaceTeams.splice(pickIndex >= firstPlaceTeams.length ? 0 : pickIndex, 1)[0]
      if (team) {
        const seedPos = i * 2 + 1 // 1, 3, 5...
        groupTeams.push({
          seedPosition: seedPos,
          sourceLabel: team.sourceLabel,
          registrationId: null,
        })
      }
    }
    
    // Pick 2nd place teams
    for (let i = 0; i < secondNeeded && secondPlaceTeams.length > 0; i++) {
      const pickIndex = (firstNeeded - 1 - i + g) % secondPlaceTeams.length
      const actualIndex = pickIndex >= 0 ? pickIndex % secondPlaceTeams.length : 0
      
      const team = secondPlaceTeams.splice(actualIndex >= secondPlaceTeams.length ? 0 : actualIndex, 1)[0]
      if (team) {
        const seedPos = (i + 1) * 2 // 2, 4, 6...
        groupTeams.push({
          seedPosition: seedPos,
          sourceLabel: team.sourceLabel,
          registrationId: null,
        })
      }
    }
    
    groupTeams.sort((a, b) => a.seedPosition - b.seedPosition)
    result.set(g, groupTeams)
  }
  
  return result
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

  // Build incoming teams for group stages that follow other group stages
  let groupIncomingTeams: Map<number, IncomingTeamSlot[]> | undefined
  const hasPreviousGroupStage = previousStages.some(
    s => s.type === 'GROUP_STAGE' || s.type === 'GSL_GROUPS'
  )
  
  if ((stage.type === 'GSL_GROUPS' || stage.type === 'GROUP_STAGE') && hasPreviousGroupStage) {
    const teamsPerGroup = stage.type === 'GSL_GROUPS' ? 4 : 4
    groupIncomingTeams = buildIncomingTeamsForGroups(
      previousStages,
      stage.groups.length,
      teamsPerGroup
    )
  }

  // Get group scheduling mode from config
  const groupSchedulingMode = (config?.groupSchedulingMode as GroupSchedulingMode) || 'interleaved'

  // Sort groups by order
  const sortedGroups = [...stage.groups].sort((a, b) => a.order - b.order)

  return {
    stageId: stage.id,
    stageName: stage.name,
    type: stage.type,
    order: stage.order,
    bufferTimeMinutes: stage.bufferTimeMinutes,
    customConfig: config,
    groups: sortedGroups.map((group, index) => ({
      groupId: group.id,
      groupName: group.name,
      groupOrder: group.order,
      roundRobinType: group.roundRobinType,
      teams: group.teamAssignments.map(ta => ({
        registrationId: ta.registrationId,
        seedPosition: ta.seedPosition ?? undefined,
        teamName: ta.registration.registeredTeamName || ta.registration.team.name,
      })),
      // Add incoming teams for groups following other group stages
      incomingTeams: groupIncomingTeams?.get(index),
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
