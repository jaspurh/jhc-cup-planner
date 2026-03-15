import { describe, it, expect, vi } from 'vitest'
import { PlatformRole, TournamentRoleType } from '@/generated/prisma'
import { makeSession } from '../helpers/mockAuth'
import {
  USER_ID,
  TOURNAMENT_ID,
  OWNER_ID,
  ROLE_RECORD_ID,
  makeUser,
  makeAdminUser,
  makeTournamentRecord,
  makeTournamentRoleRecord,
} from '../helpers/fixtures'

// ==========================================
// Module mocks — must come before imports of the module under test
// vi.hoisted ensures these variables are initialized before vi.mock factories run
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
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDbInstance }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import {
  requireAuth,
  getCurrentUser,
  isPlatformAdmin,
  isPlatformSupport,
  requirePlatformAdmin,
  canOrganizeTournament,
  canManageTournament,
  requireOrganizer,
  requireManager,
  writeAuditLog,
  AuthError,
  PermissionError,
} from '@/lib/permissions'

// ==========================================
// requireAuth
// ==========================================

describe('requireAuth', () => {
  it('returns AuthenticatedUser when session is valid', async () => {
    mockAuth.mockResolvedValue(makeSession())
    const user = await requireAuth()
    expect(user.id).toBe(USER_ID)
    expect(user.platformRole).toBe(PlatformRole.USER)
  })

  it('defaults platformRole to USER when session omits it', async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } })
    const user = await requireAuth()
    expect(user.platformRole).toBe(PlatformRole.USER)
  })

  it('throws AuthError when auth() returns null', async () => {
    mockAuth.mockResolvedValue(null)
    await expect(requireAuth()).rejects.toThrow(AuthError)
  })

  it('throws AuthError when session.user has no id', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'x@x.com' } })
    await expect(requireAuth()).rejects.toThrow(AuthError)
  })

  it('AuthError.name is AuthError', async () => {
    mockAuth.mockResolvedValue(null)
    await expect(requireAuth()).rejects.toMatchObject({ name: 'AuthError' })
  })

  it('AuthError default message is Authentication required', async () => {
    mockAuth.mockResolvedValue(null)
    await expect(requireAuth()).rejects.toThrow('Authentication required')
  })
})

// ==========================================
// getCurrentUser
// ==========================================

describe('getCurrentUser', () => {
  it('returns AuthenticatedUser when signed in', async () => {
    mockAuth.mockResolvedValue(makeSession({ platformRole: PlatformRole.ADMIN }))
    const user = await getCurrentUser()
    expect(user).not.toBeNull()
    expect(user!.platformRole).toBe(PlatformRole.ADMIN)
  })

  it('returns null when auth() returns null', async () => {
    mockAuth.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns null when session.user has no id', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'x@x.com' } })
    expect(await getCurrentUser()).toBeNull()
  })

  it('defaults platformRole to USER when missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } })
    const user = await getCurrentUser()
    expect(user!.platformRole).toBe(PlatformRole.USER)
  })
})

// ==========================================
// isPlatformAdmin
// ==========================================

describe('isPlatformAdmin', () => {
  it('true for ADMIN', () => expect(isPlatformAdmin(makeAdminUser())).toBe(true))
  it('false for USER', () => expect(isPlatformAdmin(makeUser())).toBe(false))
  it('false for SUPPORT', () =>
    expect(isPlatformAdmin(makeUser({ platformRole: PlatformRole.SUPPORT }))).toBe(false))
})

// ==========================================
// isPlatformSupport
// ==========================================

describe('isPlatformSupport', () => {
  it('true for SUPPORT', () =>
    expect(isPlatformSupport(makeUser({ platformRole: PlatformRole.SUPPORT }))).toBe(true))
  it('true for ADMIN', () => expect(isPlatformSupport(makeAdminUser())).toBe(true))
  it('false for USER', () => expect(isPlatformSupport(makeUser())).toBe(false))
})

// ==========================================
// requirePlatformAdmin
// ==========================================

describe('requirePlatformAdmin', () => {
  it('does not throw when user is ADMIN', () => {
    expect(() => requirePlatformAdmin(makeAdminUser())).not.toThrow()
  })

  it('throws PermissionError when USER', () => {
    expect(() => requirePlatformAdmin(makeUser())).toThrow(PermissionError)
  })

  it('throws PermissionError when SUPPORT', () => {
    expect(() => requirePlatformAdmin(makeUser({ platformRole: PlatformRole.SUPPORT }))).toThrow(
      PermissionError
    )
  })

  it('PermissionError.name is PermissionError', () => {
    expect(() => requirePlatformAdmin(makeUser())).toThrow(
      expect.objectContaining({ name: 'PermissionError' })
    )
  })

  it('error message is Platform administrator access required', () => {
    expect(() => requirePlatformAdmin(makeUser())).toThrow(
      'Platform administrator access required'
    )
  })
})

// ==========================================
// canOrganizeTournament
// ==========================================

describe('canOrganizeTournament', () => {
  it('returns true for PLATFORM ADMIN without DB query', async () => {
    const result = await canOrganizeTournament(makeAdminUser(), TOURNAMENT_ID)
    expect(result).toBe(true)
    expect(mockDbInstance.tournament.findUnique).not.toHaveBeenCalled()
  })

  it('returns true when user is event owner', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: USER_ID }))
    const result = await canOrganizeTournament(makeUser(), TOURNAMENT_ID)
    expect(result).toBe(true)
  })

  it('returns false when tournament not found', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(null)
    const result = await canOrganizeTournament(makeUser(), TOURNAMENT_ID)
    expect(result).toBe(false)
  })

  it('returns true when TournamentRole is ORGANIZER', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.ORGANIZER)
    )
    expect(await canOrganizeTournament(makeUser(), TOURNAMENT_ID)).toBe(true)
  })

  it('returns false when TournamentRole is CONTACT_PERSON', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.CONTACT_PERSON)
    )
    expect(await canOrganizeTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })

  it('returns false when TournamentRole is VIEWER', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.VIEWER)
    )
    expect(await canOrganizeTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })

  it('returns false when no TournamentRole record exists', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    expect(await canOrganizeTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })
})

// ==========================================
// canManageTournament
// ==========================================

describe('canManageTournament', () => {
  it('returns true for PLATFORM ADMIN without DB query', async () => {
    const result = await canManageTournament(makeAdminUser(), TOURNAMENT_ID)
    expect(result).toBe(true)
    expect(mockDbInstance.tournament.findUnique).not.toHaveBeenCalled()
  })

  it('returns true when user is event owner', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: USER_ID }))
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(true)
  })

  it('returns false when tournament not found', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(null)
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })

  it('returns true when role is ORGANIZER', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.ORGANIZER)
    )
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(true)
  })

  it('returns true when role is CONTACT_PERSON', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.CONTACT_PERSON)
    )
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(true)
  })

  it('returns false when role is VIEWER', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(
      makeTournamentRoleRecord(TournamentRoleType.VIEWER)
    )
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })

  it('returns false when no role record', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    expect(await canManageTournament(makeUser(), TOURNAMENT_ID)).toBe(false)
  })
})

// ==========================================
// requireOrganizer
// ==========================================

describe('requireOrganizer', () => {
  it('resolves without throwing when canOrganizeTournament is true', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: USER_ID }))
    await expect(requireOrganizer(makeUser(), TOURNAMENT_ID)).resolves.toBeUndefined()
  })

  it("throws PermissionError 'You must be an organizer...' when false", async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    await expect(requireOrganizer(makeUser(), TOURNAMENT_ID)).rejects.toThrow(
      'You must be an organizer of this tournament'
    )
  })

  it('calls logger.warn on denial', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    await expect(requireOrganizer(makeUser(), TOURNAMENT_ID)).rejects.toThrow()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Permission denied: requireOrganizer',
      expect.objectContaining({ userId: USER_ID, tournamentId: TOURNAMENT_ID })
    )
  })
})

// ==========================================
// requireManager
// ==========================================

describe('requireManager', () => {
  it('resolves without throwing when canManageTournament is true', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord({ ownerId: USER_ID }))
    await expect(requireManager(makeUser(), TOURNAMENT_ID)).resolves.toBeUndefined()
  })

  it("throws PermissionError 'You do not have permission...' when false", async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    await expect(requireManager(makeUser(), TOURNAMENT_ID)).rejects.toThrow(
      'You do not have permission to manage this tournament'
    )
  })

  it('calls logger.warn on denial', async () => {
    mockDbInstance.tournament.findUnique.mockResolvedValue(makeTournamentRecord())
    mockDbInstance.tournamentRole.findUnique.mockResolvedValue(null)
    await expect(requireManager(makeUser(), TOURNAMENT_ID)).rejects.toThrow()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Permission denied: requireManager',
      expect.objectContaining({ userId: USER_ID, tournamentId: TOURNAMENT_ID })
    )
  })
})

// ==========================================
// writeAuditLog
// ==========================================

describe('writeAuditLog', () => {
  it('calls db.auditLog.create with correct fields', async () => {
    mockDbInstance.auditLog.create.mockResolvedValue({})
    await writeAuditLog(USER_ID, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        action: 'TEST_ACTION',
        entityType: 'Tournament',
        entityId: TOURNAMENT_ID,
      }),
    })
  })

  it('passes undefined for details when not provided', async () => {
    mockDbInstance.auditLog.create.mockResolvedValue({})
    await writeAuditLog(USER_ID, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: undefined }),
    })
  })

  it('serializes details via JSON round-trip', async () => {
    mockDbInstance.auditLog.create.mockResolvedValue({})
    const details = { foo: 'bar', count: 1 }
    await writeAuditLog(USER_ID, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID, details)
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: { foo: 'bar', count: 1 } }),
    })
  })

  it('does not throw when db.auditLog.create rejects', async () => {
    mockDbInstance.auditLog.create.mockRejectedValue(new Error('DB down'))
    await expect(
      writeAuditLog(USER_ID, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID)
    ).resolves.toBeUndefined()
  })

  it('calls logger.error when db.auditLog.create rejects', async () => {
    const err = new Error('DB down')
    mockDbInstance.auditLog.create.mockRejectedValue(err)
    await writeAuditLog(USER_ID, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to write audit log',
      expect.objectContaining({ error: err })
    )
  })

  it('accepts null userId', async () => {
    mockDbInstance.auditLog.create.mockResolvedValue({})
    await expect(
      writeAuditLog(null, 'TEST_ACTION', 'Tournament', TOURNAMENT_ID)
    ).resolves.toBeUndefined()
    expect(mockDbInstance.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null }),
    })
  })
})
