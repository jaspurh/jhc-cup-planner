/**
 * Time Allocation Module
 * 
 * Allocates time slots to generated matches based on:
 * - Available pitches
 * - Match dependencies
 * - Stage gaps
 * - Match duration + transition time
 */

import {
  GeneratedMatch,
  AllocatedMatch,
  PitchSlot,
  TimingConfig,
  StageConfig,
} from './types'

// ==========================================
// Time Slot Allocation
// ==========================================

/**
 * Find the next available time slot on any pitch
 */
function findNextAvailableSlot(
  pitches: PitchSlot[],
  afterTime: Date,
  durationMinutes: number,
  transitionMinutes: number
): { pitchId: string; startTime: Date; endTime: Date } | null {
  let earliestSlot: { pitchId: string; startTime: Date; endTime: Date } | null = null

  for (const pitch of pitches) {
    // Find earliest available start time on this pitch
    let potentialStart = new Date(Math.max(afterTime.getTime(), pitch.availableFrom.getTime()))

    // Check if we conflict with any scheduled match
    for (const match of pitch.scheduledMatches.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
      const potentialEnd = new Date(potentialStart.getTime() + durationMinutes * 60000)
      
      // Check for overlap (including transition time after previous match)
      const matchEndWithTransition = new Date(match.endTime.getTime() + transitionMinutes * 60000)
      if (potentialStart < matchEndWithTransition && potentialEnd > match.startTime) {
        // Conflict - move start time to after this match plus transition
        potentialStart = matchEndWithTransition
      }
    }

    const potentialEnd = new Date(potentialStart.getTime() + durationMinutes * 60000)

    // Check if slot fits within pitch availability
    if (potentialEnd <= pitch.availableTo) {
      if (!earliestSlot || potentialStart < earliestSlot.startTime) {
        earliestSlot = {
          pitchId: pitch.pitchId,
          startTime: potentialStart,
          endTime: potentialEnd,
        }
      }
    }
  }

  return earliestSlot
}

/**
 * Get the earliest time a match can start based on its dependencies
 */
function getEarliestStartTime(
  match: GeneratedMatch,
  allocatedMatches: Map<string, AllocatedMatch>,
  baseTime: Date
): Date {
  if (match.dependsOn.length === 0) {
    return baseTime
  }

  let latestDependencyEnd = baseTime

  for (const depId of match.dependsOn) {
    const depMatch = allocatedMatches.get(depId)
    if (depMatch && depMatch.scheduledEndTime > latestDependencyEnd) {
      latestDependencyEnd = depMatch.scheduledEndTime
    }
  }

  return latestDependencyEnd
}

/**
 * Sort matches by allocation priority
 * 
 * @param matches - Matches to sort
 * @param groupSchedulingMode - 'sequential' = all Group A, then Group B, etc; 'interleaved' = round-robin across groups
 */
function sortByPriority(
  matches: GeneratedMatch[], 
  groupSchedulingMode: 'sequential' | 'interleaved' = 'interleaved'
): GeneratedMatch[] {
  return [...matches].sort((a, b) => {
    if (groupSchedulingMode === 'sequential') {
      // Sequential mode: group all matches by groupId first
      const aGroup = a.groupId || ''
      const bGroup = b.groupId || ''
      if (aGroup !== bGroup) {
        return aGroup.localeCompare(bGroup)
      }
    }
    
    // Then by round number
    if (a.roundNumber !== b.roundNumber) {
      return a.roundNumber - b.roundNumber
    }
    
    // For interleaved mode within same round, sort by group to spread them out
    if (groupSchedulingMode === 'interleaved') {
      const aGroup = a.groupId || ''
      const bGroup = b.groupId || ''
      if (aGroup !== bGroup) {
        // Interleave by alternating groups
        return aGroup.localeCompare(bGroup)
      }
    }
    
    // Then by number of dependencies (fewer first)
    if (a.dependsOn.length !== b.dependsOn.length) {
      return a.dependsOn.length - b.dependsOn.length
    }
    
    // 3rd place match should be scheduled before final
    const aIsThirdPlace = a.metadata?.isThirdPlace === true
    const bIsThirdPlace = b.metadata?.isThirdPlace === true
    const aIsFinal = a.bracketPosition === 'F'
    const bIsFinal = b.bracketPosition === 'F'
    
    if (aIsThirdPlace && bIsFinal) return -1
    if (bIsThirdPlace && aIsFinal) return 1
    
    // Then by match number
    return a.matchNumber - b.matchNumber
  })
}

/**
 * Group matches by stage
 */
function groupByStage(matches: GeneratedMatch[]): Map<string, GeneratedMatch[]> {
  const grouped = new Map<string, GeneratedMatch[]>()
  
  for (const match of matches) {
    const existing = grouped.get(match.stageId) || []
    existing.push(match)
    grouped.set(match.stageId, existing)
  }

  return grouped
}

// ==========================================
// Main Allocation Function
// ==========================================

export interface AllocationResult {
  success: boolean
  matches: AllocatedMatch[]
  unallocated: GeneratedMatch[]
  errors: string[]
}

/**
 * Allocate time slots to all matches
 * 
 * Algorithm:
 * 1. Group matches by stage
 * 2. For each stage (in order):
 *    a. Apply stage gap if not first stage
 *    b. Sort matches by priority (round, dependencies)
 *    c. For each match:
 *       - Find earliest start time based on dependencies
 *       - Find next available pitch slot after that time
 *       - Allocate the match
 * 3. Return allocated matches and any that couldn't be scheduled
 */
export function allocateTimeSlots(
  matches: GeneratedMatch[],
  stages: StageConfig[],
  timing: TimingConfig
): AllocationResult {
  const allocatedMatches: Map<string, AllocatedMatch> = new Map()
  const unallocated: GeneratedMatch[] = []
  const errors: string[] = []

  // Initialize pitch slots with mutable scheduled matches
  const pitches: PitchSlot[] = timing.pitches.map(p => ({
    ...p,
    scheduledMatches: [...p.scheduledMatches],
  }))

  if (pitches.length === 0) {
    return {
      success: false,
      matches: [],
      unallocated: matches,
      errors: ['No pitches available for scheduling'],
    }
  }

  // Group matches by stage
  const matchesByStage = groupByStage(matches)

  // Sort stages by order
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  // Track the latest end time across all stages
  let stageStartTime = new Date(timing.startTime)

  for (const stage of sortedStages) {
    const stageMatches = matchesByStage.get(stage.stageId) || []
    if (stageMatches.length === 0) continue

    // Apply stage gap
    if (stage.bufferTimeMinutes > 0 && allocatedMatches.size > 0) {
      // Find the latest end time from previous matches
      let latestEnd = stageStartTime
      for (const [, match] of allocatedMatches) {
        if (match.scheduledEndTime > latestEnd) {
          latestEnd = match.scheduledEndTime
        }
      }
      stageStartTime = new Date(latestEnd.getTime() + stage.bufferTimeMinutes * 60000)
    }

    // Sort matches by priority, respecting group scheduling mode
    const groupSchedulingMode = stage.groupSchedulingMode || 'interleaved'
    const sortedMatches = sortByPriority(stageMatches, groupSchedulingMode)

    // Track current group for gap insertion in sequential mode
    let currentGroupId: string | undefined = undefined
    let groupStartTime = stageStartTime

    // Allocate each match
    for (const match of sortedMatches) {
      // Check if all dependencies are allocated
      const unmetDeps = match.dependsOn.filter(depId => !allocatedMatches.has(depId))
      if (unmetDeps.length > 0) {
        // Skip for now - will try again after other matches
        continue
      }

      // In sequential mode, add gap when switching to a new group
      if (groupSchedulingMode === 'sequential' && match.groupId && match.groupId !== currentGroupId) {
        if (currentGroupId !== undefined && stage.bufferTimeMinutes > 0) {
          // Find latest end time from previous group's matches
          let latestGroupEnd = groupStartTime
          for (const [, allocated] of allocatedMatches) {
            if (allocated.groupId === currentGroupId && allocated.scheduledEndTime > latestGroupEnd) {
              latestGroupEnd = allocated.scheduledEndTime
            }
          }
          groupStartTime = new Date(latestGroupEnd.getTime() + stage.bufferTimeMinutes * 60000)
        }
        currentGroupId = match.groupId
      }

      // Find earliest start based on dependencies
      const baseTime = groupSchedulingMode === 'sequential' ? groupStartTime : stageStartTime
      const earliestStart = getEarliestStartTime(match, allocatedMatches, baseTime)

      // For the first match, don't add transition time
      // Transition time is only needed between matches
      const isFirstMatch = allocatedMatches.size === 0
      const searchFrom = isFirstMatch 
        ? earliestStart 
        : new Date(earliestStart.getTime() + timing.transitionTimeMinutes * 60000)

      // Find next available slot
      const slot = findNextAvailableSlot(pitches, searchFrom, timing.matchDurationMinutes, isFirstMatch ? 0 : timing.transitionTimeMinutes)

      if (!slot) {
        errors.push(`Could not allocate time slot for match ${match.tempId}`)
        unallocated.push(match)
        continue
      }

      // Create allocated match
      const allocatedMatch: AllocatedMatch = {
        ...match,
        pitchId: slot.pitchId,
        scheduledStartTime: slot.startTime,
        scheduledEndTime: slot.endTime,
      }

      allocatedMatches.set(match.tempId, allocatedMatch)

      // Update pitch scheduled matches
      const pitch = pitches.find(p => p.pitchId === slot.pitchId)
      if (pitch) {
        pitch.scheduledMatches.push({
          matchTempId: match.tempId,
          pitchId: slot.pitchId,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })
      }
    }

    // Second pass for matches with dependencies that are now met
    const remainingMatches = sortedMatches.filter(m => !allocatedMatches.has(m.tempId) && !unallocated.includes(m))
    
    for (const match of remainingMatches) {
      const unmetDeps = match.dependsOn.filter(depId => !allocatedMatches.has(depId))
      if (unmetDeps.length > 0) {
        errors.push(`Match ${match.tempId} has unmet dependencies: ${unmetDeps.join(', ')}`)
        unallocated.push(match)
        continue
      }

      const earliestStart = getEarliestStartTime(match, allocatedMatches, stageStartTime)
      const searchFrom = new Date(earliestStart.getTime() + timing.transitionTimeMinutes * 60000)
      const slot = findNextAvailableSlot(pitches, searchFrom, timing.matchDurationMinutes, timing.transitionTimeMinutes)

      if (!slot) {
        errors.push(`Could not allocate time slot for match ${match.tempId}`)
        unallocated.push(match)
        continue
      }

      const allocatedMatch: AllocatedMatch = {
        ...match,
        pitchId: slot.pitchId,
        scheduledStartTime: slot.startTime,
        scheduledEndTime: slot.endTime,
      }

      allocatedMatches.set(match.tempId, allocatedMatch)

      const pitch = pitches.find(p => p.pitchId === slot.pitchId)
      if (pitch) {
        pitch.scheduledMatches.push({
          matchTempId: match.tempId,
          pitchId: slot.pitchId,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })
      }
    }

    // Update stage start time for next stage
    for (const [, match] of allocatedMatches) {
      if (match.stageId === stage.stageId && match.scheduledEndTime > stageStartTime) {
        stageStartTime = match.scheduledEndTime
      }
    }
  }

  return {
    success: unallocated.length === 0 && errors.length === 0,
    matches: Array.from(allocatedMatches.values()),
    unallocated,
    errors,
  }
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calculate total duration of scheduled matches
 */
export function calculateTotalDuration(matches: AllocatedMatch[]): number {
  if (matches.length === 0) return 0

  let earliest = matches[0].scheduledStartTime
  let latest = matches[0].scheduledEndTime

  for (const match of matches) {
    if (match.scheduledStartTime < earliest) earliest = match.scheduledStartTime
    if (match.scheduledEndTime > latest) latest = match.scheduledEndTime
  }

  return Math.round((latest.getTime() - earliest.getTime()) / 60000)
}

/**
 * Calculate pitch utilization percentages
 */
export function calculatePitchUtilization(
  matches: AllocatedMatch[],
  timing: TimingConfig
): Record<string, number> {
  const utilization: Record<string, number> = {}

  if (matches.length === 0) return utilization

  // Find overall time span
  let earliest = matches[0].scheduledStartTime
  let latest = matches[0].scheduledEndTime

  for (const match of matches) {
    if (match.scheduledStartTime < earliest) earliest = match.scheduledStartTime
    if (match.scheduledEndTime > latest) latest = match.scheduledEndTime
  }

  const totalSpan = latest.getTime() - earliest.getTime()
  if (totalSpan === 0) return utilization

  // Calculate time used per pitch
  for (const pitch of timing.pitches) {
    const pitchMatches = matches.filter(m => m.pitchId === pitch.pitchId)
    const timeUsed = pitchMatches.reduce((sum, m) => 
      sum + (m.scheduledEndTime.getTime() - m.scheduledStartTime.getTime()), 0
    )
    utilization[pitch.pitchId] = Math.round((timeUsed / totalSpan) * 100)
  }

  return utilization
}

/**
 * Get matches sorted by start time for display
 */
export function sortMatchesByTime(matches: AllocatedMatch[]): AllocatedMatch[] {
  return [...matches].sort((a, b) => 
    a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime()
  )
}

/**
 * Group matches by pitch for schedule view
 */
export function groupMatchesByPitch(matches: AllocatedMatch[]): Map<string, AllocatedMatch[]> {
  const grouped = new Map<string, AllocatedMatch[]>()

  for (const match of matches) {
    const existing = grouped.get(match.pitchId) || []
    existing.push(match)
    grouped.set(match.pitchId, existing)
  }

  // Sort each pitch's matches by time
  for (const [pitchId, pitchMatches] of grouped) {
    grouped.set(pitchId, sortMatchesByTime(pitchMatches))
  }

  return grouped
}
