/**
 * Application Constants
 * 
 * Centralized location for all display labels, options, and formatters.
 * This ensures DRY principle - update labels in one place.
 * 
 * MAINTAINER NOTE: Add any repeated display values here.
 */

import type {
  EventStatus,
  TournamentStatus,
  TournamentStyle,
  TournamentFormat,
  StageType,
  RegistrationStatus,
  MatchStatus,
  InvitationStatus,
  RegistrationMode,
  ClubStatus,
} from '@/types'

// ===========================================
// Status Display Configuration
// ===========================================

export type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusConfig {
  label: string
  variant: StatusVariant
}

/**
 * Event status display configuration
 */
export const EVENT_STATUS_CONFIG: Record<EventStatus, StatusConfig> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  PUBLISHED: { label: 'Published', variant: 'info' },
  ACTIVE: { label: 'Active', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
}

/**
 * Tournament status display configuration
 */
export const TOURNAMENT_STATUS_CONFIG: Record<TournamentStatus, StatusConfig> = {
  DRAFT: { label: 'Draft', variant: 'default' },
  READY: { label: 'Ready', variant: 'info' },
  ACTIVE: { label: 'Active', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'default' },
}

/**
 * Registration status display configuration
 */
export const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, StatusConfig> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'success' },
  WITHDRAWN: { label: 'Withdrawn', variant: 'danger' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
}

/**
 * Match status display configuration
 */
export const MATCH_STATUS_CONFIG: Record<MatchStatus, StatusConfig> = {
  SCHEDULED: { label: 'Scheduled', variant: 'default' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  POSTPONED: { label: 'Postponed', variant: 'warning' },
}

/**
 * Invitation status display configuration
 */
export const INVITATION_STATUS_CONFIG: Record<InvitationStatus, StatusConfig> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  SENT: { label: 'Sent', variant: 'info' },
  OPENED: { label: 'Opened', variant: 'info' },
  REGISTERED: { label: 'Registered', variant: 'success' },
  EXPIRED: { label: 'Expired', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'default' },
}

/**
 * Get status config for any status type
 * Falls back to a default if status not found
 */
export function getStatusConfig(status: string): StatusConfig {
  const allConfigs: Record<string, StatusConfig> = {
    ...EVENT_STATUS_CONFIG,
    ...TOURNAMENT_STATUS_CONFIG,
    ...REGISTRATION_STATUS_CONFIG,
    ...MATCH_STATUS_CONFIG,
    ...INVITATION_STATUS_CONFIG,
  }
  return allConfigs[status] || { label: status, variant: 'default' }
}

// ===========================================
// Tournament Format Labels
// ===========================================

/**
 * Display labels for tournament formats
 */
export const TOURNAMENT_FORMAT_LABELS: Record<TournamentFormat, string> = {
  GROUP_STAGE: 'Group Stage',
  KNOCKOUT: 'Knockout',
  DOUBLE_ELIMINATION: 'Double Elimination',
  GROUP_KNOCKOUT: 'Group + Knockout',
  ROUND_ROBIN: 'Round Robin',
}

/**
 * Tournament format options for select dropdowns
 */
export const TOURNAMENT_FORMAT_OPTIONS: { value: TournamentFormat; label: string }[] = [
  { value: 'GROUP_KNOCKOUT', label: 'Group + Knockout' },
  { value: 'GROUP_STAGE', label: 'Group Stage Only' },
  { value: 'KNOCKOUT', label: 'Knockout Only' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination' },
]

/**
 * Format tournament format enum to display label
 */
export function formatTournamentFormat(format: TournamentFormat | string): string {
  return TOURNAMENT_FORMAT_LABELS[format as TournamentFormat] || format
}

// ===========================================
// Tournament Style Labels
// ===========================================

/**
 * Display labels for tournament styles
 */
export const TOURNAMENT_STYLE_LABELS: Record<TournamentStyle, string> = {
  COMPETITIVE: 'Competitive',
  RECREATIONAL: 'Recreational',
}

/**
 * Tournament style options for select dropdowns
 */
export const TOURNAMENT_STYLE_OPTIONS: { value: TournamentStyle; label: string }[] = [
  { value: 'COMPETITIVE', label: 'Competitive' },
  { value: 'RECREATIONAL', label: 'Recreational' },
]

/**
 * Format tournament style enum to display label
 */
export function formatTournamentStyle(style: TournamentStyle | string): string {
  return TOURNAMENT_STYLE_LABELS[style as TournamentStyle] || style
}

// ===========================================
// Stage Type Labels
// ===========================================

/**
 * Display labels for stage types
 */
export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_ROBIN: 'Round Robin',
  KNOCKOUT: 'Knockout',
  DOUBLE_ELIMINATION: 'Double Elimination',
  FINAL: 'Final',
}

/**
 * Format stage type enum to display label
 */
export function formatStageType(type: StageType | string): string {
  return STAGE_TYPE_LABELS[type as StageType] || type
}

// ===========================================
// Default Values
// ===========================================

/**
 * Default timing configuration for tournaments
 */
export const DEFAULT_TOURNAMENT_TIMING = {
  matchDurationMinutes: 5,
  transitionTimeMinutes: 1,
} as const

/**
 * Timing constraints
 */
export const TIMING_CONSTRAINTS = {
  minMatchDuration: 1,
  maxMatchDuration: 120,
  minTransitionTime: 0,
  maxTransitionTime: 30,
} as const

// ===========================================
// Registration Mode Labels
// ===========================================

/**
 * Display labels for registration modes
 */
export const REGISTRATION_MODE_LABELS: Record<RegistrationMode, string> = {
  OPEN: 'Open Registration',
  INVITE_ONLY: 'Invite Only',
  CLUB_ADMIN: 'Club Admin Only',
  CLUB_MEMBERS: 'Club Members Only',
}

/**
 * Registration mode descriptions for help text
 */
export const REGISTRATION_MODE_DESCRIPTIONS: Record<RegistrationMode, string> = {
  OPEN: 'Anyone with the registration link can register a team',
  INVITE_ONLY: 'Only teams that receive an invitation can register',
  CLUB_ADMIN: 'Only club administrators can register teams for their club',
  CLUB_MEMBERS: 'Only users affiliated with a registered club can register',
}

/**
 * Registration mode options for select dropdowns
 */
export const REGISTRATION_MODE_OPTIONS: { value: RegistrationMode; label: string; description: string }[] = [
  { value: 'OPEN', label: 'Open Registration', description: 'Anyone can register' },
  { value: 'INVITE_ONLY', label: 'Invite Only', description: 'By invitation only' },
  { value: 'CLUB_ADMIN', label: 'Club Admin Only', description: 'Club admins register for their club' },
  { value: 'CLUB_MEMBERS', label: 'Club Members Only', description: 'Registered club members only' },
]

/**
 * Format registration mode enum to display label
 */
export function formatRegistrationMode(mode: RegistrationMode | string): string {
  return REGISTRATION_MODE_LABELS[mode as RegistrationMode] || mode
}

// ===========================================
// Club Status Labels
// ===========================================

/**
 * Club status display configuration
 */
export const CLUB_STATUS_CONFIG: Record<ClubStatus, StatusConfig> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INACTIVE: { label: 'Inactive', variant: 'default' },
}

// ===========================================
// Stage Type Options
// ===========================================

/**
 * Stage type options for select dropdowns
 */
export const STAGE_TYPE_OPTIONS: { value: StageType; label: string; description: string }[] = [
  { value: 'GROUP_STAGE', label: 'Group Stage', description: 'Round-robin matches within groups' },
  { value: 'ROUND_ROBIN', label: 'Round Robin', description: 'All teams play each other (no groups)' },
  { value: 'KNOCKOUT', label: 'Knockout', description: 'Single elimination bracket' },
  { value: 'DOUBLE_ELIMINATION', label: 'Double Elimination', description: 'Winners & losers brackets' },
  { value: 'FINAL', label: 'Final', description: 'Championship and placement matches' },
]
