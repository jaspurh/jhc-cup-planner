'use server'

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { requireAuth, requireOrganizer, writeAuditLog } from '@/lib/permissions'
import { TournamentRoleType } from '@/generated/prisma'
import { ActionResult } from '@/types'

export interface TournamentRoleMember {
  id: string          // TournamentRole record id
  userId: string
  role: TournamentRoleType
  userName: string | null
  userEmail: string
  isEventOwner: boolean
}

// ==========================================
// Read
// ==========================================

/**
 * List all role assignments for a tournament, including the implicit event owner.
 */
export async function getTournamentRoles(
  tournamentId: string
): Promise<ActionResult<TournamentRoleMember[]>> {
  try {
    const user = await requireAuth()
    await requireOrganizer(user, tournamentId)

    const [roles, tournament] = await Promise.all([
      db.tournamentRole.findMany({
        where: { tournamentId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.tournament.findUnique({
        where: { id: tournamentId },
        select: { event: { select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } } } },
      }),
    ])

    if (!tournament) return { success: false, error: 'Tournament not found' }

    const eventOwner = tournament.event.owner
    const members: TournamentRoleMember[] = []

    // Always show the event owner first (implicit organizer)
    members.push({
      id: `owner-${eventOwner.id}`,
      userId: eventOwner.id,
      role: TournamentRoleType.ORGANIZER,
      userName: eventOwner.name,
      userEmail: eventOwner.email,
      isEventOwner: true,
    })

    // Explicit role records (skip if same user as event owner to avoid duplication)
    for (const r of roles) {
      if (r.userId === eventOwner.id) continue
      members.push({
        id: r.id,
        userId: r.userId,
        role: r.role,
        userName: r.user.name,
        userEmail: r.user.email,
        isEventOwner: false,
      })
    }

    return { success: true, data: members }
  } catch (error) {
    logger.error('Failed to get tournament roles', { error, tournamentId })
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get roles' }
  }
}

// ==========================================
// Write
// ==========================================

/**
 * Assign (or update) a role for a user on a tournament.
 * Looks up the user by email.
 */
export async function assignTournamentRole(
  tournamentId: string,
  email: string,
  role: TournamentRoleType
): Promise<ActionResult<TournamentRoleMember>> {
  try {
    const currentUser = await requireAuth()
    await requireOrganizer(currentUser, tournamentId)

    const targetUser = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })
    if (!targetUser) {
      return { success: false, error: `No user found with email: ${email}` }
    }

    // Check the target isn't the event owner (they're implicit organizers, no record needed)
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { event: { select: { ownerId: true } } },
    })
    if (tournament?.event.ownerId === targetUser.id) {
      return { success: false, error: 'The event owner already has organizer access implicitly' }
    }

    const record = await db.tournamentRole.upsert({
      where: { userId_tournamentId: { userId: targetUser.id, tournamentId } },
      create: { userId: targetUser.id, tournamentId, role },
      update: { role },
    })

    await writeAuditLog(currentUser.id, 'ROLE_ASSIGNED', 'Tournament', tournamentId, {
      targetUserId: targetUser.id,
      role,
    })

    logger.info('Tournament role assigned', {
      assignedBy: currentUser.id,
      targetUser: targetUser.id,
      tournamentId,
      role,
    })

    return {
      success: true,
      data: {
        id: record.id,
        userId: targetUser.id,
        role: record.role,
        userName: targetUser.name,
        userEmail: targetUser.email,
        isEventOwner: false,
      },
    }
  } catch (error) {
    logger.error('Failed to assign tournament role', { error, tournamentId, email, role })
    return { success: false, error: error instanceof Error ? error.message : 'Failed to assign role' }
  }
}

/**
 * Remove a user's explicit role from a tournament.
 */
export async function removeTournamentRole(
  tournamentId: string,
  roleId: string
): Promise<ActionResult<void>> {
  try {
    const currentUser = await requireAuth()
    await requireOrganizer(currentUser, tournamentId)

    const record = await db.tournamentRole.findUnique({
      where: { id: roleId },
      select: { userId: true, tournamentId: true },
    })
    if (!record || record.tournamentId !== tournamentId) {
      return { success: false, error: 'Role record not found' }
    }

    await db.tournamentRole.delete({ where: { id: roleId } })

    await writeAuditLog(currentUser.id, 'ROLE_REMOVED', 'Tournament', tournamentId, {
      targetUserId: record.userId,
    })

    return { success: true, data: undefined }
  } catch (error) {
    logger.error('Failed to remove tournament role', { error, tournamentId, roleId })
    return { success: false, error: error instanceof Error ? error.message : 'Failed to remove role' }
  }
}
