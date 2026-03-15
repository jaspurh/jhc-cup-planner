import { describe, it, expect, vi } from 'vitest'
import { PlatformRole, TournamentRoleType } from '@/generated/prisma'
import { makeSession } from '../helpers/mockAuth'
import {
  USER_ID,
  OWNER_ID,
  TOURNAMENT_ID,
  MATCH_ID,
  STAGE_ID,
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
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ db: mockDbInstance }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

// Mock the scheduling engine — we only care about permission gates here
vi.mock('@/lib/scheduling', () => ({
  generateSchedule: vi.fn().mockReturnValue({
    success: true,
    matches: [],
    stats: { totalMatches: 0, totalDuration: 0, pitchUtilization: {}, averageRestTime: 0 },
    warnings: [],
    errors: [],
  }),
  dbStageToConfig: vi.fn().mockReturnValue({}),
  createTimingConfig: vi.fn().mockReturnValue({}),
}))

import {
  generateTournamentSchedule,
  clearTournamentSchedule,
  resetDependentTeamAssignments,
  updateMatchTime,
} from '@/actions/schedule'

// ==========================================
// Helpers
// ==========================================

function setupSessionWithRole(role: TournamentRoleType | null, userId = USER_ID, ownerId = OWNER_ID) {
  mockAuth.mockResolvedValue(makeSession({ id: userId }))
  mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId }))
  if (role === null) {
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
  } else {
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(role, { userId })
    )
  }
}

function setupOrganizerSession(userId = OWNER_ID) {
  mockAuth.mockResolvedValue(makeSession({ id: userId }))
  // event owner → canOrganizeTournament returns true
  mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: userId }))
}

function setupAdminSession() {
  mockAuth.mockResolvedValue(makeSession({ id: USER_ID, platformRole: PlatformRole.ADMIN }))
}

const minimalTournament = {
  id: TOURNAMENT_ID,
  slug: 'tournament-slug',
  startTime: new Date('2025-01-18T09:00:00Z'),
  matchDurationMinutes: 5,
  transitionTimeMinutes: 1,
  // ownerId must be present for canOrganizeTournament's event-owner path
  event: { id: 'event-1', slug: 'event-slug', ownerId: OWNER_ID },
  stages: [
    {
      id: STAGE_ID,
      order: 0,
      groups: [],
      configuration: null,
    },
  ],
  pitches: [
    {
      pitch: { id: 'pitch-1', name: 'Pitch 1' },
      isActive: true,
    },
  ],
}

// ==========================================
// generateTournamentSchedule — permission gates
// ==========================================

describe('generateTournamentSchedule — permission gates', () => {
  it('unauthenticated → error with auth message', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('plain USER with no role → error', async () => {
    setupSessionWithRole(null)
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.success).toBe(false)
  })

  it('CONTACT_PERSON role → error (organizer required)', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/organizer/i)
  })

  it('ORGANIZER role → gate passes', async () => {
    setupSessionWithRole(TournamentRoleType.ORGANIZER)
    mockDbInstance.tournament.findUnique.mockResolvedValue(minimalTournament)
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.error).not.toMatch(/organizer/i)
    expect(result.error).not.toMatch(/authentication/i)
  })

  it('event owner → gate passes', async () => {
    setupOrganizerSession()
    mockDbInstance.tournament.findUnique.mockResolvedValue(minimalTournament)
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.error).not.toMatch(/organizer/i)
    expect(result.error).not.toMatch(/authentication/i)
  })

  it('PLATFORM ADMIN → gate passes', async () => {
    setupAdminSession()
    mockDbInstance.tournament.findUnique.mockResolvedValue(minimalTournament)
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.error).not.toMatch(/authentication/i)
  })

  it('tournament not found after auth → error', async () => {
    setupOrganizerSession()
    // First call: permission check (needs ownerId to pass for event owner)
    // Second call: data fetch returns null → tournament not found
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID }))
      .mockResolvedValueOnce(null)
    const result = await generateTournamentSchedule({ tournamentId: TOURNAMENT_ID })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})

// ==========================================
// clearTournamentSchedule — permission gates + behavior
// ==========================================

describe('clearTournamentSchedule', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await clearTournamentSchedule(TOURNAMENT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no organizer access → error', async () => {
    setupSessionWithRole(null)
    const result = await clearTournamentSchedule(TOURNAMENT_ID)
    expect(result.success).toBe(false)
  })

  it('tournament not found → error', async () => {
    setupOrganizerSession()
    // First call: permission check returns tournament; second: data fetch returns null
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID })) // permission check in requireOrganizer (skipped for owner)
      .mockResolvedValueOnce(null)
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const result = await clearTournamentSchedule(TOURNAMENT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('calls writeAuditLog with action SCHEDULE_CLEARED', async () => {
    setupOrganizerSession()
    mockDbInstance.auditLog.create.mockResolvedValue({})
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      stages: [{ id: STAGE_ID }],
    })
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    await clearTournamentSchedule(TOURNAMENT_ID)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SCHEDULE_CLEARED' }),
      })
    )
  })

  it('calls db.match.deleteMany with the tournament stage IDs', async () => {
    setupOrganizerSession()
    mockDbInstance.auditLog.create.mockResolvedValue({})
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      stages: [{ id: STAGE_ID }],
    })
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    await clearTournamentSchedule(TOURNAMENT_ID)
    expect(mockDbInstance.match.deleteMany).toHaveBeenCalledWith({
      where: { stageId: { in: [STAGE_ID] } },
    })
  })

  it('calls revalidatePath for the schedule URL', async () => {
    setupOrganizerSession()
    mockDbInstance.auditLog.create.mockResolvedValue({})
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      stages: [{ id: STAGE_ID }],
    })
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    await clearTournamentSchedule(TOURNAMENT_ID)
    expect(mockRevalidatePath).toHaveBeenCalled()
  })

  it('returns { success: true }', async () => {
    setupOrganizerSession()
    mockDbInstance.auditLog.create.mockResolvedValue({})
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      stages: [{ id: STAGE_ID }],
    })
    mockDbInstance.match.deleteMany.mockResolvedValue({ count: 0 })
    const result = await clearTournamentSchedule(TOURNAMENT_ID)
    expect(result.success).toBe(true)
  })
})

// ==========================================
// resetDependentTeamAssignments — permission gates + behavior
// ==========================================

describe('resetDependentTeamAssignments', () => {
  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await resetDependentTeamAssignments(TOURNAMENT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('no organizer access → error', async () => {
    setupSessionWithRole(null)
    const result = await resetDependentTeamAssignments(TOURNAMENT_ID)
    expect(result.success).toBe(false)
  })

  it('returns { resetCount: 0 } when no stages with order > 0', async () => {
    setupOrganizerSession()
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      // only stage with order 0
      stages: [{ id: STAGE_ID, type: 'GROUP', order: 0 }],
    })
    const result = await resetDependentTeamAssignments(TOURNAMENT_ID)
    expect(result.success).toBe(true)
    expect((result as { success: true; data: { resetCount: number } }).data.resetCount).toBe(0)
  })

  it('calls db.match.updateMany when applicable stages exist', async () => {
    setupOrganizerSession()
    mockDbInstance.tournament.findUnique.mockResolvedValue({
      ...minimalTournament,
      stages: [
        { id: STAGE_ID, type: 'GROUP', order: 0 },
        { id: 'stage-2', type: 'KNOCKOUT', order: 1 },
      ],
    })
    mockDbInstance.match.updateMany.mockResolvedValue({ count: 2 })
    await resetDependentTeamAssignments(TOURNAMENT_ID)
    expect(mockDbInstance.match.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stageId: { in: ['stage-2'] } }),
      })
    )
  })
})

// ==========================================
// updateMatchTime — permission gates
// ==========================================

describe('updateMatchTime', () => {
  const newStartTime = new Date('2025-01-18T10:00:00Z')

  it('unauthenticated → error', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await updateMatchTime(MATCH_ID, newStartTime)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('VIEWER role → error', async () => {
    setupSessionWithRole(TournamentRoleType.VIEWER)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord())
    const result = await updateMatchTime(MATCH_ID, newStartTime)
    expect(result.success).toBe(false)
  })

  it('CONTACT_PERSON → gate passes (reaches business logic)', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ status: 'SCHEDULED' }))
    mockDbInstance.match.update.mockResolvedValue({})
    const result = await updateMatchTime(MATCH_ID, newStartTime)
    // Gate passed — succeeded or failed for business reasons, but NOT auth/permission
    if (!result.success) {
      expect(result.error).not.toMatch(/permission/i)
      expect(result.error).not.toMatch(/authentication/i)
    }
    // success is also acceptable
  })

  it('match not found → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(null)
    const result = await updateMatchTime(MATCH_ID, newStartTime)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Match not found')
  })

  it('match not SCHEDULED → error', async () => {
    setupSessionWithRole(TournamentRoleType.CONTACT_PERSON)
    mockDbInstance.match.findUnique.mockResolvedValue(makeMatchRecord({ status: 'COMPLETED' }))
    const result = await updateMatchTime(MATCH_ID, newStartTime)
    expect(result.success).toBe(false)
    // Should refuse to reschedule non-scheduled matches
    expect(result.error).toBeTruthy()
  })
})
