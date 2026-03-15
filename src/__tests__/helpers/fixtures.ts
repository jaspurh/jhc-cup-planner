import { PlatformRole, TournamentRoleType } from '@/generated/prisma'
import type { AuthenticatedUser } from '@/lib/permissions'

// ==========================================
// Shared IDs
// ==========================================

export const TOURNAMENT_ID = 'tournament-abc'
export const USER_ID = 'user-xyz'
export const OWNER_ID = 'owner-123'
export const TARGET_USER_ID = 'target-user-456'
export const ROLE_RECORD_ID = 'role-record-1'
export const MATCH_ID = 'match-abc'
export const STAGE_ID = 'stage-abc'

// ==========================================
// Entity builders
// ==========================================

export function makeUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: USER_ID,
    platformRole: PlatformRole.USER,
    ...overrides,
  }
}

export function makeAdminUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return makeUser({ platformRole: PlatformRole.ADMIN, ...overrides })
}

export function makeTournamentRecord(overrides?: { ownerId?: string }) {
  return {
    id: TOURNAMENT_ID,
    event: {
      ownerId: overrides?.ownerId ?? OWNER_ID,
      owner: {
        id: overrides?.ownerId ?? OWNER_ID,
        name: 'Event Owner',
        email: 'owner@example.com',
      },
    },
  }
}

export function makeTournamentRoleRecord(
  role: TournamentRoleType,
  overrides?: { id?: string; userId?: string; tournamentId?: string }
) {
  return {
    id: overrides?.id ?? ROLE_RECORD_ID,
    userId: overrides?.userId ?? USER_ID,
    tournamentId: overrides?.tournamentId ?? TOURNAMENT_ID,
    role,
    createdAt: new Date(),
  }
}

export function makeMatchRecord(overrides?: {
  id?: string
  status?: string
  tournamentId?: string
  hasResult?: boolean
}) {
  return {
    id: overrides?.id ?? MATCH_ID,
    status: overrides?.status ?? 'SCHEDULED',
    stageId: STAGE_ID,
    bracketPosition: null,
    homeRegistrationId: 'home-reg-1',
    awayRegistrationId: 'away-reg-1',
    homeTeamSource: null,
    awayTeamSource: null,
    actualStartTime: null,
    stage: {
      id: STAGE_ID,
      type: 'GROUP',
      tournamentId: overrides?.tournamentId ?? TOURNAMENT_ID,
      tournament: {
        id: overrides?.tournamentId ?? TOURNAMENT_ID,
        event: { id: 'event-1', slug: 'event-slug' },
        slug: 'tournament-slug',
      },
    },
    result: overrides?.hasResult
      ? { homeScore: 2, awayScore: 1, homePenalties: null, awayPenalties: null }
      : null,
  }
}
