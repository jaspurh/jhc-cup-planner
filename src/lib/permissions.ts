import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { PlatformRole, TournamentRoleType } from '@/generated/prisma'
import { logger } from '@/lib/logger'

// ==========================================
// Types
// ==========================================

export interface AuthenticatedUser {
  id: string
  platformRole: PlatformRole
}

export class PermissionError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'PermissionError'
  }
}

export class AuthError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'AuthError'
  }
}

// Role hierarchy for tournament roles (higher index = more permissions)
const TOURNAMENT_ROLE_HIERARCHY: TournamentRoleType[] = [
  TournamentRoleType.VIEWER,
  TournamentRoleType.CONTACT_PERSON,
  TournamentRoleType.ORGANIZER,
]

function tournamentRoleRank(role: TournamentRoleType): number {
  return TOURNAMENT_ROLE_HIERARCHY.indexOf(role)
}

// ==========================================
// Core Auth
// ==========================================

/**
 * Get the currently authenticated user, throwing AuthError if not signed in.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new AuthError()
  }
  const sessionUser = session.user as { id: string; platformRole?: PlatformRole }
  return {
    id: sessionUser.id,
    platformRole: sessionUser.platformRole ?? PlatformRole.USER,
  }
}

/**
 * Get the current user without throwing — returns null if not signed in.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const sessionUser = session.user as { id: string; platformRole?: PlatformRole }
  return {
    id: sessionUser.id,
    platformRole: sessionUser.platformRole ?? PlatformRole.USER,
  }
}

// ==========================================
// Platform Role Checks
// ==========================================

export function isPlatformAdmin(user: AuthenticatedUser): boolean {
  return user.platformRole === PlatformRole.ADMIN
}

export function isPlatformSupport(user: AuthenticatedUser): boolean {
  return user.platformRole === PlatformRole.SUPPORT || user.platformRole === PlatformRole.ADMIN
}

// ==========================================
// Tournament Permission Checks
// ==========================================

/**
 * Returns true if the user can perform organizer-level actions on this tournament.
 * An organizer can: configure stages, generate schedules, manage roles, etc.
 *
 * Grants access if the user is:
 *  - Platform ADMIN
 *  - The owner of the event that contains this tournament
 *  - Has a TournamentRole of ORGANIZER on this tournament
 */
export async function canOrganizeTournament(
  user: AuthenticatedUser,
  tournamentId: string
): Promise<boolean> {
  if (isPlatformAdmin(user)) return true

  // Check if user owns the event
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { event: { select: { ownerId: true } } },
  })
  if (!tournament) return false
  if (tournament.event.ownerId === user.id) return true

  // Check for explicit ORGANIZER tournament role
  const roleRecord = await db.tournamentRole.findUnique({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
  })
  return roleRecord?.role === TournamentRoleType.ORGANIZER
}

/**
 * Returns true if the user can perform contact-person-level actions.
 * A contact person can: enter results, reschedule matches, manage team status.
 *
 * Grants access if the user is ORGANIZER-level OR has CONTACT_PERSON role.
 */
export async function canManageTournament(
  user: AuthenticatedUser,
  tournamentId: string
): Promise<boolean> {
  if (isPlatformAdmin(user)) return true

  // Check if user owns the event
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { event: { select: { ownerId: true } } },
  })
  if (!tournament) return false
  if (tournament.event.ownerId === user.id) return true

  // Check for ORGANIZER or CONTACT_PERSON tournament role
  const roleRecord = await db.tournamentRole.findUnique({
    where: { userId_tournamentId: { userId: user.id, tournamentId } },
  })
  if (!roleRecord) return false
  return tournamentRoleRank(roleRecord.role) >= tournamentRoleRank(TournamentRoleType.CONTACT_PERSON)
}

// ==========================================
// Require helpers (throw on failure)
// ==========================================

/**
 * Throw PermissionError unless user can organize this tournament.
 */
export async function requireOrganizer(
  user: AuthenticatedUser,
  tournamentId: string
): Promise<void> {
  const allowed = await canOrganizeTournament(user, tournamentId)
  if (!allowed) {
    logger.warn('Permission denied: requireOrganizer', { userId: user.id, tournamentId })
    throw new PermissionError('You must be an organizer of this tournament')
  }
}

/**
 * Throw PermissionError unless user can manage this tournament (CONTACT_PERSON or above).
 */
export async function requireManager(
  user: AuthenticatedUser,
  tournamentId: string
): Promise<void> {
  const allowed = await canManageTournament(user, tournamentId)
  if (!allowed) {
    logger.warn('Permission denied: requireManager', { userId: user.id, tournamentId })
    throw new PermissionError('You do not have permission to manage this tournament')
  }
}

/**
 * Throw PermissionError unless user is a platform admin.
 */
export function requirePlatformAdmin(user: AuthenticatedUser): void {
  if (!isPlatformAdmin(user)) {
    throw new PermissionError('Platform administrator access required')
  }
}

// ==========================================
// Audit Logging
// ==========================================

export async function writeAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    })
  } catch (error) {
    // Audit log failures must never break the main operation
    logger.error('Failed to write audit log', { error, action, entityType, entityId })
  }
}
