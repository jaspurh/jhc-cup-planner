import { describe, it, expect, vi } from 'vitest'
import { TournamentRoleType } from '@/generated/prisma'
import { makeSession } from '../helpers/mockAuth'
import {
  USER_ID,
  OWNER_ID,
  TOURNAMENT_ID,
  TARGET_USER_ID,
  ROLE_RECORD_ID,
  makeTournamentRecord,
  makeTournamentRoleRecord,
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
  $transaction: vi.fn(),
}))
const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ db: mockDbInstance }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { getTournamentRoles, assignTournamentRole, removeTournamentRole } from '@/actions/roles'

// ==========================================
// Helpers shared across tests
// ==========================================

function setupOrganizerSession() {
  mockAuth.mockResolvedValue(makeSession({ id: OWNER_ID }))
  // canOrganizeTournament: tournament.event.ownerId === OWNER_ID → true
  mockDbInstance.tournament.findUnique.mockResolvedValue(
    makeTournamentRecord({ ownerId: OWNER_ID })
  )
}

const ownerRecord = {
  id: OWNER_ID,
  name: 'Event Owner',
  email: 'owner@example.com',
}

const tournamentWithOwner = {
  id: TOURNAMENT_ID,
  event: {
    ownerId: OWNER_ID,
    owner: ownerRecord,
  },
}

// ==========================================
// getTournamentRoles
// ==========================================

describe('getTournamentRoles', () => {
  it('returns error when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getTournamentRoles(TOURNAMENT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('returns error when not organizer', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: USER_ID }))
    // User is not owner, no role record
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    const result = await getTournamentRoles(TOURNAMENT_ID)
    expect(result.success).toBe(false)
  })

  it('lists event owner first with isEventOwner: true and synthetic id owner-<id>', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findMany.mockResolvedValue([])
    mockDbInstance.tournament.findUnique
      // Second call (inside getTournamentRoles itself via Promise.all)
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID })) // permission check
      .mockResolvedValueOnce(tournamentWithOwner) // data fetch
    const result = await getTournamentRoles(TOURNAMENT_ID)
    expect(result.success).toBe(true)
    const members = result.data!
    expect(members[0].isEventOwner).toBe(true)
    expect(members[0].id).toBe(`owner-${OWNER_ID}`)
    expect(members[0].userId).toBe(OWNER_ID)
  })

  it('event owner has role ORGANIZER regardless of TournamentRole records', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findMany.mockResolvedValue([])
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID }))
      .mockResolvedValueOnce(tournamentWithOwner)
    const result = await getTournamentRoles(TOURNAMENT_ID)
    expect(result.data![0].role).toBe(TournamentRoleType.ORGANIZER)
  })

  it('deduplicates: skips a TournamentRole record for the event owner', async () => {
    setupOrganizerSession()
    // A role record for the event owner exists — should be skipped
    mockDbInstance.tournamentRole.findMany.mockResolvedValue([
      {
        ...makeTournamentRoleRecord(TournamentRoleType.ORGANIZER, { userId: OWNER_ID }),
        user: ownerRecord,
      },
    ])
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID }))
      .mockResolvedValueOnce(tournamentWithOwner)
    const result = await getTournamentRoles(TOURNAMENT_ID)
    // Only the synthetic owner entry, not a duplicate
    expect(result.data!.length).toBe(1)
    expect(result.data![0].isEventOwner).toBe(true)
  })

  it('non-owner members have isEventOwner: false', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findMany.mockResolvedValue([
      {
        ...makeTournamentRoleRecord(TournamentRoleType.CONTACT_PERSON, { userId: TARGET_USER_ID }),
        user: { id: TARGET_USER_ID, name: 'Target', email: 'target@example.com' },
      },
    ])
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID }))
      .mockResolvedValueOnce(tournamentWithOwner)
    const result = await getTournamentRoles(TOURNAMENT_ID)
    const nonOwner = result.data!.find(m => m.userId === TARGET_USER_ID)
    expect(nonOwner?.isEventOwner).toBe(false)
  })

  it('returns error when tournament not found during data fetch', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findMany.mockResolvedValue([])
    mockDbInstance.tournament.findUnique
      .mockResolvedValueOnce(makeTournamentRecord({ ownerId: OWNER_ID }))
      .mockResolvedValueOnce(null) // tournament not found on data fetch
    const result = await getTournamentRoles(TOURNAMENT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Tournament not found')
  })
})

// ==========================================
// assignTournamentRole
// ==========================================

const targetUserRecord = { id: TARGET_USER_ID, name: 'Target User', email: 'target@example.com' }

describe('assignTournamentRole', () => {
  it('returns error when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await assignTournamentRole(TOURNAMENT_ID, 'x@x.com', TournamentRoleType.VIEWER)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('returns error when not organizer', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: USER_ID }))
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    const result = await assignTournamentRole(TOURNAMENT_ID, 'x@x.com', TournamentRoleType.VIEWER)
    expect(result.success).toBe(false)
  })

  it('returns error when target email not found', async () => {
    setupOrganizerSession()
    mockDbInstance.user.findUnique.mockResolvedValue(null)
    const result = await assignTournamentRole(
      TOURNAMENT_ID,
      'notfound@example.com',
      TournamentRoleType.VIEWER
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no user found/i)
  })

  it('returns error when target is the event owner', async () => {
    setupOrganizerSession()
    mockDbInstance.user.findUnique.mockResolvedValue({ ...targetUserRecord, id: OWNER_ID })
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    const result = await assignTournamentRole(
      TOURNAMENT_ID,
      'owner@example.com',
      TournamentRoleType.ORGANIZER
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/event owner/i)
  })

  it('upserts a TournamentRole and returns correct member', async () => {
    setupOrganizerSession()
    mockDbInstance.user.findUnique.mockResolvedValue(targetUserRecord)
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    mockDbInstance.tournamentRole.upsert.mockResolvedValue({
      id: ROLE_RECORD_ID,
      role: TournamentRoleType.CONTACT_PERSON,
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})

    const result = await assignTournamentRole(
      TOURNAMENT_ID,
      'target@example.com',
      TournamentRoleType.CONTACT_PERSON
    )
    expect(result.success).toBe(true)
    expect(result.data!.userId).toBe(TARGET_USER_ID)
    expect(result.data!.role).toBe(TournamentRoleType.CONTACT_PERSON)
    expect(result.data!.isEventOwner).toBe(false)
    expect(mockDbInstance.tournamentRole.upsert).toHaveBeenCalled()
  })

  it('calls writeAuditLog with action ROLE_ASSIGNED', async () => {
    setupOrganizerSession()
    mockDbInstance.user.findUnique.mockResolvedValue(targetUserRecord)
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    mockDbInstance.tournamentRole.upsert.mockResolvedValue({
      id: ROLE_RECORD_ID,
      role: TournamentRoleType.VIEWER,
    })
    mockDbInstance.auditLog.create.mockResolvedValue({})

    await assignTournamentRole(TOURNAMENT_ID, 'target@example.com', TournamentRoleType.VIEWER)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ROLE_ASSIGNED' }),
      })
    )
  })

  it('returns error string when db throws', async () => {
    setupOrganizerSession()
    mockDbInstance.user.findUnique.mockRejectedValue(new Error('DB failure'))
    const result = await assignTournamentRole(
      TOURNAMENT_ID,
      'target@example.com',
      TournamentRoleType.VIEWER
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('DB failure')
  })
})

// ==========================================
// removeTournamentRole
// ==========================================

describe('removeTournamentRole', () => {
  it('returns error when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/authentication/i)
  })

  it('returns error when not organizer', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: USER_ID }))
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: OWNER_ID }))
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    const result = await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(result.success).toBe(false)
  })

  it('returns error when roleId not found in db', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    const result = await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Role record not found')
  })

  it('returns error when roleId belongs to a different tournament', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue({
      userId: TARGET_USER_ID,
      tournamentId: 'other-tournament',
    })
    const result = await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Role record not found')
  })

  it('deletes the record', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue({
      userId: TARGET_USER_ID,
      tournamentId: TOURNAMENT_ID,
    })
    mockDbInstance.tournamentRole.delete.mockResolvedValue({})
    mockDbInstance.auditLog.create.mockResolvedValue({})

    await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(mockDbInstance.tournamentRole.delete).toHaveBeenCalledWith({
      where: { id: ROLE_RECORD_ID },
    })
  })

  it('calls writeAuditLog with action ROLE_REMOVED', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue({
      userId: TARGET_USER_ID,
      tournamentId: TOURNAMENT_ID,
    })
    mockDbInstance.tournamentRole.delete.mockResolvedValue({})
    mockDbInstance.auditLog.create.mockResolvedValue({})

    await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ROLE_REMOVED' }),
      })
    )
  })

  it('returns { success: true } on success', async () => {
    setupOrganizerSession()
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue({
      userId: TARGET_USER_ID,
      tournamentId: TOURNAMENT_ID,
    })
    mockDbInstance.tournamentRole.delete.mockResolvedValue({})
    mockDbInstance.auditLog.create.mockResolvedValue({})

    const result = await removeTournamentRole(TOURNAMENT_ID, ROLE_RECORD_ID)
    expect(result.success).toBe(true)
  })
})
