import { describe, it, expect, vi } from 'vitest'
import { PlatformRole, TournamentRoleType } from '@/generated/prisma'
import { makeSession } from '../helpers/mockAuth'
import {
  USER_ID,
  OWNER_ID,
  TOURNAMENT_ID,
  MATCH_ID,
  makeTournamentRecord,
  makeTournamentRoleRecord,
  makeMatchRecord,
} from '../helpers/fixtures'

// ==========================================
// Module mocks — vi.hoisted ensures initialization before vi.mock factories run
// ==========================================

const mockDbInstance = vi.hoisted(() => ({
  tournament: { findUnique: vi.fn(), findMany: vi.fn() },
  tournamentRole: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  user: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  match: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  matchResult: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
}))
const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ db: mockDbInstance }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Bypass schema validation — we test permission gates, not schema rules
vi.mock('@/lib/schemas/match', () => ({
  enterMatchResultSchema: { parse: (x: unknown) => x },
  updateMatchResultSchema: { parse: (x: unknown) => x },
}))

import {
  enterMatchResult,
  updateMatchResult,
  deleteMatchResult,
  saveLiveScore,
  startMatch,
} from '@/actions/match'

// ==========================================
// Helpers
// ==========================================

const VALID_ENTER_INPUT = {
  matchId: MATCH_ID,
  homeScore: 2,
  awayScore: 1,
}

const VALID_UPDATE_INPUT = {
  matchId: MATCH_ID,
  homeScore: 3,
  awayScore: 1,
}

/** Sets up a session and permission env for a user with a given tournament role */
function setupSessionWithRole(
  role: TournamentRoleType | null,
  userId = USER_ID,
  ownerId = OWNER_ID
) {
  mockAuth.mockResolvedValue(makeSession({ id: userId }))
  // canOrganizeTournament / canManageTournament both query tournament first
  mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId }))
  if (role === null) {
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
  } else {
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(role, { userId })
    )
  }
}

function setupEventOwnerSession(ownerId = USER_ID) {
  mockAuth.mockResolvedValue(makeSession({ id: ownerId }))
  mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId }))
}

function setupAdminSession() {
  mockAuth.mockResolvedValue(makeSession({ id: USER_ID, platformRole: PlatformRole.ADMIN }))
}

// ==========================================
// enterMatchResult — permission gates
// ==========================================

describe('enterMatchResult — permission gates', () => {
  it('unauthenticated → { success: false } with auth message', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('plain USER with no role → { success: false }', async () => {
    setupSessionWithRole(null)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    expect(result.success).toBe(false)
  })

  it('VIEWER role → { success: false }', async () => {
    setupSessionWithRole(TournamentRoleType.VIEWER)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    expect(result.success).toBe(false)
  })

  it('CONTACT_PERSON → gate passes (proceeds to business logic)', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    // $transaction mock: simulate no progression or advancement
    mockDbInstance.$transaction.mockImplementation(async (fn: (tx: typeof mockDbInstance) => Promise<{ id: string }>) => {
      mockDbInstance.matchResult.create.mockResolvedValue({ id: 'result-1' })
      mockDbInstance.match.update.mockResolvedValue({})
      mockDbInstance.match.findMany.mockResolvedValue([])
      return fn(mockDbInstance)
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    // Gate passes — succeeds or fails for business reasons, but NOT auth/permission
    if (!result.success) {
      expect(result.error).not.toMatch(/authentication/i)
      expect(result.error).not.toMatch(/permission/i)
    }
  })

  it('ORGANIZER → gate passes', async () => {
    setupSessionWithRole(TournamentRoleType.ORGANIZER)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    mockDbInstance.$transaction.mockImplementation(async (fn: (tx: typeof mockDbInstance) => Promise<{ id: string }>) => {
      mockDbInstance.matchResult.create.mockResolvedValue({ id: 'result-1' })
      mockDbInstance.match.update.mockResolvedValue({})
      mockDbInstance.match.findMany.mockResolvedValue([])
      return fn(mockDbInstance)
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    if (!result.success) {
      expect(result.error).not.toMatch(/permission/i)
    }
  })

  it('event owner → gate passes', async () => {
    setupEventOwnerSession()
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    mockDbInstance.$transaction.mockImplementation(async (fn: (tx: typeof mockDbInstance) => Promise<{ id: string }>) => {
      mockDbInstance.matchResult.create.mockResolvedValue({ id: 'result-1' })
      mockDbInstance.match.update.mockResolvedValue({})
      mockDbInstance.match.findMany.mockResolvedValue([])
      return fn(mockDbInstance)
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    if (!result.success) {
      expect(result.error).not.toMatch(/permission/i)
    }
  })

  it('PLATFORM ADMIN → gate passes', async () => {
    setupAdminSession()
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    mockDbInstance.$transaction.mockImplementation(async (fn: (tx: typeof mockDbInstance) => Promise<{ id: string }>) => {
      mockDbInstance.matchResult.create.mockResolvedValue({ id: 'result-1' })
      mockDbInstance.match.update.mockResolvedValue({})
      mockDbInstance.match.findMany.mockResolvedValue([])
      return fn(mockDbInstance)
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    if (!result.success) {
      expect(result.error).not.toMatch(/permission/i)
    }
  })

  it('match not found → { success: false, error: Match not found }', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })

  it('match already has a result → error about already having result', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ hasResult: true }))
    const result = await enterMatchResult(VALID_ENTER_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/already has a result/i)
  })
})

// ==========================================
// updateMatchResult — permission gates
// ==========================================

describe('updateMatchResult — permission gates', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await updateMatchResult(VALID_UPDATE_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no manager access → error', async () => {
    setupSessionWithRole(null)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await updateMatchResult(VALID_UPDATE_INPUT)
    expect(result.success).toBe(false)
  })

  it('match not found → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await updateMatchResult(VALID_UPDATE_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })

  it('no existing result → error "no result to update"', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ hasResult: false }))
    const result = await updateMatchResult(VALID_UPDATE_INPUT)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no result to update/i)
  })
})

// ==========================================
// deleteMatchResult — permission gates
// ==========================================

describe('deleteMatchResult — permission gates', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteMatchResult(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no manager access → error', async () => {
    setupSessionWithRole(null)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await deleteMatchResult(MATCH_ID)
    expect(result.success).toBe(false)
  })

  it('match not found → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await deleteMatchResult(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })

  it('no result to delete → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ hasResult: false }))
    const result = await deleteMatchResult(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no result to delete/i)
  })
})

// ==========================================
// saveLiveScore — permission gates
// ==========================================

describe('saveLiveScore — permission gates', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await saveLiveScore(MATCH_ID, 1, 0)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no manager access → error', async () => {
    setupSessionWithRole(null)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await saveLiveScore(MATCH_ID, 1, 0)
    expect(result.success).toBe(false)
  })

  it('match not found → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await saveLiveScore(MATCH_ID, 1, 0)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })
})

// ==========================================
// startMatch — permission gates
// ==========================================

describe('startMatch — permission gates', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await startMatch(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no manager access → error', async () => {
    setupSessionWithRole(null)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await startMatch(MATCH_ID)
    expect(result.success).toBe(false)
  })

  it('match not found → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await startMatch(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })

  it('match not SCHEDULED → error "Can only start scheduled matches"', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ status: 'IN_PROGRESS' }))
    const result = await startMatch(MATCH_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Can only start scheduled matches')
  })
})
