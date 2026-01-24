/**
 * Constraint Validation Module
 * 
 * Validates scheduled matches against various constraints:
 * - Rest time between matches for same team
 * - Dependency ordering
 * - Pitch conflicts
 * - Time overlaps
 */

import {
  AllocatedMatch,
  ConstraintViolation,
  ConstraintResult,
  RestTimeConfig,
} from './types'

// ==========================================
// Default Constraints
// ==========================================

const DEFAULT_REST_TIME: RestTimeConfig = {
  minimumRestMinutes: 15,
  preferredRestMinutes: 30,
}

// ==========================================
// Rest Time Validation
// ==========================================

/**
 * Calculate rest time between two matches in minutes
 */
function calculateRestTime(match1: AllocatedMatch, match2: AllocatedMatch): number {
  // Ensure match1 is the earlier match
  const [earlier, later] = match1.scheduledEndTime < match2.scheduledStartTime
    ? [match1, match2]
    : [match2, match1]

  return Math.round(
    (later.scheduledStartTime.getTime() - earlier.scheduledEndTime.getTime()) / 60000
  )
}

/**
 * Check if a team plays in a match
 */
function teamPlaysInMatch(teamId: string, match: AllocatedMatch): boolean {
  return match.homeRegistrationId === teamId || match.awayRegistrationId === teamId
}

/**
 * Validate rest times for all teams
 */
export function validateRestTimes(
  matches: AllocatedMatch[],
  config: RestTimeConfig = DEFAULT_REST_TIME
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // Get all unique team IDs
  const teamIds = new Set<string>()
  for (const match of matches) {
    if (match.homeRegistrationId) teamIds.add(match.homeRegistrationId)
    if (match.awayRegistrationId) teamIds.add(match.awayRegistrationId)
  }

  // Check rest times for each team
  for (const teamId of teamIds) {
    // Get all matches for this team, sorted by time
    const teamMatches = matches
      .filter(m => teamPlaysInMatch(teamId, m))
      .sort((a, b) => a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime())

    // Check consecutive matches
    for (let i = 0; i < teamMatches.length - 1; i++) {
      const current = teamMatches[i]
      const next = teamMatches[i + 1]
      const restTime = calculateRestTime(current, next)

      if (restTime < config.minimumRestMinutes) {
        violations.push({
          type: 'REST_TIME',
          severity: 'error',
          message: `Team ${teamId} has only ${restTime} minutes rest between matches (minimum: ${config.minimumRestMinutes})`,
          matchId: next.tempId,
          details: {
            teamId,
            previousMatch: current.tempId,
            nextMatch: next.tempId,
            restMinutes: restTime,
            minimumRequired: config.minimumRestMinutes,
          },
        })
      } else if (config.preferredRestMinutes && restTime < config.preferredRestMinutes) {
        violations.push({
          type: 'REST_TIME',
          severity: 'warning',
          message: `Team ${teamId} has only ${restTime} minutes rest between matches (preferred: ${config.preferredRestMinutes})`,
          matchId: next.tempId,
          details: {
            teamId,
            previousMatch: current.tempId,
            nextMatch: next.tempId,
            restMinutes: restTime,
            preferredRest: config.preferredRestMinutes,
          },
        })
      }
    }
  }

  return violations
}

// ==========================================
// Dependency Validation
// ==========================================

/**
 * Validate that all dependencies are respected
 */
export function validateDependencies(matches: AllocatedMatch[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  const matchMap = new Map(matches.map(m => [m.tempId, m]))

  for (const match of matches) {
    for (const depId of match.dependsOn) {
      const depMatch = matchMap.get(depId)
      
      if (!depMatch) {
        // Dependency not found - might be a bye or error
        if (!depId.startsWith('BYE-')) {
          violations.push({
            type: 'DEPENDENCY',
            severity: 'warning',
            message: `Match ${match.tempId} depends on ${depId} which was not found`,
            matchId: match.tempId,
            details: {
              dependencyId: depId,
            },
          })
        }
        continue
      }

      // Check that dependency ends before this match starts
      if (depMatch.scheduledEndTime > match.scheduledStartTime) {
        violations.push({
          type: 'DEPENDENCY',
          severity: 'error',
          message: `Match ${match.tempId} starts before its dependency ${depId} ends`,
          matchId: match.tempId,
          details: {
            dependencyId: depId,
            matchStart: match.scheduledStartTime.toISOString(),
            dependencyEnd: depMatch.scheduledEndTime.toISOString(),
          },
        })
      }
    }
  }

  return violations
}

// ==========================================
// Pitch Conflict Validation
// ==========================================

/**
 * Validate that no two matches overlap on the same pitch
 */
export function validatePitchConflicts(matches: AllocatedMatch[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  // Group matches by pitch
  const matchesByPitch = new Map<string, AllocatedMatch[]>()
  for (const match of matches) {
    const existing = matchesByPitch.get(match.pitchId) || []
    existing.push(match)
    matchesByPitch.set(match.pitchId, existing)
  }

  // Check for overlaps on each pitch
  for (const [pitchId, pitchMatches] of matchesByPitch) {
    // Sort by start time
    const sorted = pitchMatches.sort((a, b) => 
      a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime()
    )

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (current.scheduledEndTime > next.scheduledStartTime) {
        violations.push({
          type: 'PITCH_CONFLICT',
          severity: 'error',
          message: `Matches ${current.tempId} and ${next.tempId} overlap on pitch ${pitchId}`,
          matchId: next.tempId,
          details: {
            pitchId,
            match1: current.tempId,
            match1End: current.scheduledEndTime.toISOString(),
            match2: next.tempId,
            match2Start: next.scheduledStartTime.toISOString(),
          },
        })
      }
    }
  }

  return violations
}

// ==========================================
// Missing Team Validation
// ==========================================

/**
 * Validate that all non-placeholder matches have both teams assigned
 */
export function validateMissingTeams(matches: AllocatedMatch[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  for (const match of matches) {
    // Skip matches that are expected to have placeholder teams (knockout later rounds)
    if (match.dependsOn.length > 0) {
      // These are expected to have null teams until dependencies are resolved
      continue
    }

    if (!match.homeRegistrationId) {
      violations.push({
        type: 'MISSING_TEAM',
        severity: 'error',
        message: `Match ${match.tempId} is missing home team`,
        matchId: match.tempId,
        details: {
          missingPosition: 'home',
        },
      })
    }

    if (!match.awayRegistrationId) {
      violations.push({
        type: 'MISSING_TEAM',
        severity: 'error',
        message: `Match ${match.tempId} is missing away team`,
        matchId: match.tempId,
        details: {
          missingPosition: 'away',
        },
      })
    }
  }

  return violations
}

// ==========================================
// Main Validation Function
// ==========================================

export interface ValidationOptions {
  restTime?: RestTimeConfig
  validateMissingTeams?: boolean
}

/**
 * Run all constraint validations on the schedule
 */
export function validateSchedule(
  matches: AllocatedMatch[],
  options: ValidationOptions = {}
): ConstraintResult {
  const allViolations: ConstraintViolation[] = []

  // Rest time validation
  const restViolations = validateRestTimes(matches, options.restTime || DEFAULT_REST_TIME)
  allViolations.push(...restViolations)

  // Dependency validation
  const depViolations = validateDependencies(matches)
  allViolations.push(...depViolations)

  // Pitch conflict validation
  const pitchViolations = validatePitchConflicts(matches)
  allViolations.push(...pitchViolations)

  // Missing team validation (optional, disabled for knockout stages)
  if (options.validateMissingTeams !== false) {
    const missingViolations = validateMissingTeams(matches)
    allViolations.push(...missingViolations)
  }

  // Check if any errors exist
  const hasErrors = allViolations.some(v => v.severity === 'error')

  return {
    valid: !hasErrors,
    violations: allViolations,
  }
}

// ==========================================
// Rest Time Calculation Helpers
// ==========================================

/**
 * Calculate average rest time across all teams
 */
export function calculateAverageRestTime(matches: AllocatedMatch[]): number {
  const teamIds = new Set<string>()
  for (const match of matches) {
    if (match.homeRegistrationId) teamIds.add(match.homeRegistrationId)
    if (match.awayRegistrationId) teamIds.add(match.awayRegistrationId)
  }

  let totalRestTime = 0
  let restTimeCount = 0

  for (const teamId of teamIds) {
    const teamMatches = matches
      .filter(m => teamPlaysInMatch(teamId, m))
      .sort((a, b) => a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime())

    for (let i = 0; i < teamMatches.length - 1; i++) {
      totalRestTime += calculateRestTime(teamMatches[i], teamMatches[i + 1])
      restTimeCount++
    }
  }

  return restTimeCount > 0 ? Math.round(totalRestTime / restTimeCount) : 0
}

/**
 * Get minimum rest time for each team
 */
export function getMinRestTimeByTeam(matches: AllocatedMatch[]): Map<string, number> {
  const result = new Map<string, number>()

  const teamIds = new Set<string>()
  for (const match of matches) {
    if (match.homeRegistrationId) teamIds.add(match.homeRegistrationId)
    if (match.awayRegistrationId) teamIds.add(match.awayRegistrationId)
  }

  for (const teamId of teamIds) {
    const teamMatches = matches
      .filter(m => teamPlaysInMatch(teamId, m))
      .sort((a, b) => a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime())

    let minRest = Infinity
    for (let i = 0; i < teamMatches.length - 1; i++) {
      const rest = calculateRestTime(teamMatches[i], teamMatches[i + 1])
      if (rest < minRest) minRest = rest
    }

    if (minRest !== Infinity) {
      result.set(teamId, minRest)
    }
  }

  return result
}
