/**
 * Scheduling Engine Types
 * 
 * Types used for match generation, time allocation, and schedule validation.
 */

import { StageType, RoundRobinType } from '@/types'

// ==========================================
// Match Generation Types
// ==========================================

/**
 * Generated match before time allocation
 */
export interface GeneratedMatch {
  /** Unique match identifier within the generation context */
  tempId: string
  /** Stage this match belongs to */
  stageId: string
  /** Group this match belongs to (for group stages) */
  groupId?: string
  /** Home team registration ID (null for placeholder matches) */
  homeRegistrationId: string | null
  /** Away team registration ID (null for placeholder matches) */
  awayRegistrationId: string | null
  /** Sequential match number within the stage/group */
  matchNumber: number
  /** Round number (for round-robin or knockout rounds) */
  roundNumber: number
  /** Bracket position identifier (e.g., "QF1", "SF2", "F", "LB-R1-1") */
  bracketPosition?: string
  /** Dependencies - matches that must complete before this one */
  dependsOn: string[]
  /** Metadata for display/sorting */
  metadata?: {
    /** Source of advancing team (e.g., "Winner of QF1") */
    homeSource?: string
    awaySource?: string
    /** Is this a decider/tiebreaker match? */
    isDecider?: boolean
    /** Bracket type for double elimination */
    bracketType?: 'winners' | 'losers' | 'grand_final'
  }
}

/**
 * Team identifier for match generation
 */
export interface TeamSlot {
  registrationId: string
  seedPosition?: number
  teamName?: string // For display purposes
}

/**
 * Group configuration for match generation
 */
export interface GroupConfig {
  groupId: string
  groupName: string
  teams: TeamSlot[]
  roundRobinType: RoundRobinType
}

/**
 * Stage configuration for match generation
 */
export interface StageConfig {
  stageId: string
  stageName: string
  type: StageType
  order: number
  gapMinutesBefore: number
  groups?: GroupConfig[]
  /** Number of teams advancing from previous stage (for knockout) */
  advancingTeamCount?: number
  /** Custom configuration from stage.configuration JSON */
  customConfig?: Record<string, unknown>
}

// ==========================================
// Time Allocation Types
// ==========================================

/**
 * Pitch availability for scheduling
 */
export interface PitchSlot {
  pitchId: string
  pitchName: string
  /** Available time slots for this pitch */
  availableFrom: Date
  availableTo: Date
  /** Matches already scheduled on this pitch */
  scheduledMatches: ScheduledTimeSlot[]
}

/**
 * Scheduled time slot for a match
 */
export interface ScheduledTimeSlot {
  matchTempId: string
  pitchId: string
  startTime: Date
  endTime: Date
}

/**
 * Tournament timing configuration
 */
export interface TimingConfig {
  /** Tournament start time */
  startTime: Date
  /** Match duration in minutes */
  matchDurationMinutes: number
  /** Transition time between matches in minutes */
  transitionTimeMinutes: number
  /** Available pitches */
  pitches: PitchSlot[]
}

/**
 * Match with allocated time slot
 */
export interface AllocatedMatch extends GeneratedMatch {
  pitchId: string
  scheduledStartTime: Date
  scheduledEndTime: Date
}

// ==========================================
// Constraint Types
// ==========================================

/**
 * Constraint violation
 */
export interface ConstraintViolation {
  type: 'REST_TIME' | 'DEPENDENCY' | 'PITCH_CONFLICT' | 'TIME_OVERLAP' | 'MISSING_TEAM'
  severity: 'error' | 'warning'
  message: string
  matchId?: string
  details?: Record<string, unknown>
}

/**
 * Constraint validation result
 */
export interface ConstraintResult {
  valid: boolean
  violations: ConstraintViolation[]
}

/**
 * Minimum rest time between matches for a team
 */
export interface RestTimeConfig {
  /** Minimum minutes between matches for same team */
  minimumRestMinutes: number
  /** Preferred rest time (generates warning if not met) */
  preferredRestMinutes?: number
}

// ==========================================
// Schedule Generation Types
// ==========================================

/**
 * Input for schedule generation
 */
export interface ScheduleGenerationInput {
  tournamentId: string
  stages: StageConfig[]
  timing: TimingConfig
  constraints?: {
    restTime?: RestTimeConfig
  }
}

/**
 * Result of schedule generation
 */
export interface ScheduleGenerationResult {
  success: boolean
  matches: AllocatedMatch[]
  warnings: ConstraintViolation[]
  errors: ConstraintViolation[]
  stats: {
    totalMatches: number
    totalDuration: number // minutes
    pitchUtilization: Record<string, number> // pitchId -> percentage
    averageRestTime: number // minutes
  }
}

// ==========================================
// GSL-Specific Types
// ==========================================

/**
 * GSL match identifiers for the 5-match format
 */
export type GSLMatchPosition = 'M1' | 'M2' | 'M3' | 'M4' | 'M5'

/**
 * GSL match result for determining advancement
 */
export interface GSLMatchResult {
  position: GSLMatchPosition
  winnerId: string | null
  loserId: string | null
}

/**
 * GSL group state during/after matches
 */
export interface GSLGroupState {
  groupId: string
  /** Team that won M3 (1st place, advances) */
  firstPlace: string | null
  /** Team that won M5 (2nd place, advances) */
  secondPlace: string | null
  /** Team that lost M4 (3rd place, eliminated) */
  thirdPlace: string | null
  /** Team that lost M5 (4th place, eliminated) */
  fourthPlace: string | null
}

// ==========================================
// Double Elimination Types
// ==========================================

/**
 * Bracket types in double elimination
 */
export type BracketType = 'winners' | 'losers' | 'grand_final'

/**
 * Double elimination match with bracket info
 */
export interface DoubleElimMatch extends GeneratedMatch {
  bracketType: BracketType
  /** Round within the bracket */
  bracketRound: number
}
