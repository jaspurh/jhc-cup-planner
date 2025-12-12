// Extend NextAuth types
import { DefaultSession } from 'next-auth'

// ==========================================
// Import Prisma types and enums
// ==========================================

import {
  EventStatus,
  TournamentStatus,
  TournamentStyle,
  TournamentFormat,
  StageType,
  RoundRobinType,
  TeamMemberRole,
  RegistrationStatus,
  MatchStatus,
  InvitationStatus,
  TournamentRoleType,
  PlatformRole,
} from '@/generated/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

// ==========================================
// Re-export Prisma types for convenience
// ==========================================

export type {
  User,
  Account,
  Session as DbSession,
  Event,
  Tournament,
  Stage,
  Group,
  GroupTeamAssignment,
  GroupStanding,
  Team,
  TeamMember,
  TeamRegistration,
  Match,
  MatchResult,
  Venue,
  Pitch,
  Invitation,
  TournamentRole,
  AuditLog,
} from '@/generated/prisma'

// Re-export enums
export {
  EventStatus,
  TournamentStatus,
  TournamentStyle,
  TournamentFormat,
  StageType,
  RoundRobinType,
  TeamMemberRole,
  RegistrationStatus,
  MatchStatus,
  InvitationStatus,
  TournamentRoleType,
  PlatformRole,
}

// ==========================================
// Application Types
// ==========================================

// Event with relations
export interface EventWithTournaments {
  id: string
  name: string
  description: string | null
  slug: string
  startDate: Date
  endDate: Date
  status: EventStatus
  ownerId: string
  createdAt: Date
  updatedAt: Date
  // Branding
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  // Relations
  tournaments: TournamentSummary[]
}

// Tournament summary for lists
export interface TournamentSummary {
  id: string
  name: string
  slug: string
  status: TournamentStatus
  style: TournamentStyle
  format: TournamentFormat
  startTime: Date | null
  teamCount: number
}

// Tournament with full details
export interface TournamentWithDetails {
  id: string
  name: string
  description: string | null
  slug: string
  eventId: string
  status: TournamentStatus
  style: TournamentStyle
  format: TournamentFormat
  matchDurationMinutes: number
  transitionTimeMinutes: number
  startTime: Date | null
  endTime: Date | null
  createdAt: Date
  updatedAt: Date
  event: {
    id: string
    name: string
    slug: string
  }
  stages: StageWithGroups[]
  teams: TeamRegistrationWithTeam[]
  pitches: PitchInfo[]
}

// Stage with groups
export interface StageWithGroups {
  id: string
  name: string
  type: StageType
  order: number
  gapMinutesBefore: number
  configuration: unknown
  startTime: Date | null
  endTime: Date | null
  groups: GroupWithTeams[]
  matchCount: number
}

// Group with team assignments
export interface GroupWithTeams {
  id: string
  name: string
  order: number
  roundRobinType: RoundRobinType
  teams: {
    id: string
    teamName: string
    seedPosition: number | null
  }[]
}

// Team registration with team info
export interface TeamRegistrationWithTeam {
  id: string
  teamId: string
  status: RegistrationStatus
  registeredAt: Date
  confirmedAt: Date | null
  team: {
    id: string
    name: string
    contactName: string | null
    contactEmail: string | null
  }
}

// Pitch info
export interface PitchInfo {
  id: string
  name: string
  capacity: number | null
  venue: {
    id: string
    name: string
  } | null
}

// Match with full details for schedule display
export interface ScheduledMatch {
  id: string
  matchNumber: number | null
  roundNumber: number | null
  bracketPosition: string | null
  scheduledStartTime: Date | null
  scheduledEndTime: Date | null
  status: MatchStatus
  stage: {
    id: string
    name: string
    type: StageType
  }
  group: {
    id: string
    name: string
  } | null
  pitch: {
    id: string
    name: string
  } | null
  homeTeam: {
    id: string
    teamName: string
  } | null
  awayTeam: {
    id: string
    teamName: string
  } | null
  result: {
    homeScore: number
    awayScore: number
    homePenalties: number | null
    awayPenalties: number | null
  } | null
}

// Standing for display
export interface StandingRow {
  position: number
  teamId: string
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

// ==========================================
// Action Result Types
// ==========================================

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ==========================================
// Permission Types
// ==========================================

export type Permission =
  | 'event:create'
  | 'event:read'
  | 'event:update'
  | 'event:delete'
  | 'tournament:create'
  | 'tournament:read'
  | 'tournament:update'
  | 'tournament:delete'
  | 'tournament:manage_teams'
  | 'tournament:manage_schedule'
  | 'tournament:enter_results'
  | 'team:register'
  | 'team:manage'
  | 'invitation:send'
  | 'invitation:manage'

// Tournament-level role permissions
export const TOURNAMENT_ROLE_PERMISSIONS: Record<TournamentRoleType, Permission[]> = {
  ORGANIZER: [
    'tournament:read',
    'tournament:update',
    'tournament:delete',
    'tournament:manage_teams',
    'tournament:manage_schedule',
    'tournament:enter_results',
    'team:manage',
    'invitation:send',
    'invitation:manage',
  ],
  CONTACT_PERSON: [
    'tournament:read',
    'tournament:manage_teams',
    'invitation:send',
  ],
  VIEWER: [
    'tournament:read',
  ],
}

// Platform-level role permissions
export type PlatformPermission =
  | 'platform:admin'
  | 'platform:support'
  | 'users:read'
  | 'users:manage'
  | 'events:read_all'
  | 'events:manage_all'
  | 'system:config'

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  USER: [],
  SUPPORT: [
    'platform:support',
    'users:read',
    'events:read_all',
  ],
  ADMIN: [
    'platform:admin',
    'platform:support',
    'users:read',
    'users:manage',
    'events:read_all',
    'events:manage_all',
    'system:config',
  ],
}
