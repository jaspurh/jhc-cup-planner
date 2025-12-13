'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  createInvitationSchema,
  bulkInvitationSchema,
} from '@/lib/schemas'
import { sendInvitationEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import { InvitationStatus } from '@/types'

const INVITATION_EXPIRY_DAYS = 14

/**
 * Create and send a single invitation
 */
export async function createInvitation(input: {
  tournamentId: string
  contactEmail: string
  contactName?: string
  teamName?: string
  message?: string
}): Promise<ActionResult<{ id: string; token: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const validated = createInvitationSchema.parse(input)

    // Verify tournament ownership
    const tournament = await db.tournament.findFirst({
      where: {
        id: validated.tournamentId,
        event: { ownerId: session.user.id }
      },
      include: { event: true }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    // Check for existing pending invitation
    const existingInvitation = await db.invitation.findFirst({
      where: {
        tournamentId: validated.tournamentId,
        contactEmail: validated.contactEmail,
        status: { in: ['PENDING', 'SENT', 'OPENED'] }
      }
    })

    if (existingInvitation) {
      return { success: false, error: 'An invitation for this email already exists' }
    }

    // Create invitation
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    const invitation = await db.invitation.create({
      data: {
        tournamentId: validated.tournamentId,
        contactEmail: validated.contactEmail,
        contactName: validated.contactName,
        teamName: validated.teamName,
        message: validated.message,
        sentById: session.user.id,
        expiresAt,
        status: 'PENDING',
      }
    })

    // Send email
    const emailResult = await sendInvitationEmail({
      to: validated.contactEmail,
      recipientName: validated.contactName,
      tournamentName: tournament.name,
      eventName: tournament.event.name,
      invitationToken: invitation.token,
      message: validated.message,
      expiresAt,
    })

    // Update status based on email result
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        status: emailResult.success ? 'SENT' : 'PENDING',
      }
    })

    logger.info('Invitation created', { 
      invitationId: invitation.id,
      tournamentId: validated.tournamentId,
      emailSent: emailResult.success,
      userId: session.user.id
    })

    revalidatePath(`/events/${tournament.eventId}/tournaments/${validated.tournamentId}`)

    return { success: true, data: { id: invitation.id, token: invitation.token } }
  } catch (error) {
    logger.error('Failed to create invitation', { error })
    return { success: false, error: 'Failed to create invitation' }
  }
}

/**
 * Create multiple invitations from CSV data
 */
export async function createBulkInvitations(input: {
  tournamentId: string
  invitations: Array<{
    contactEmail: string
    contactName?: string
    teamName?: string
  }>
}): Promise<ActionResult<{ 
  created: number
  skipped: number
  errors: string[]
}>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const validated = bulkInvitationSchema.parse(input)

    // Verify tournament ownership
    const tournament = await db.tournament.findFirst({
      where: {
        id: validated.tournamentId,
        event: { ownerId: session.user.id }
      },
      include: { event: true }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    // Get existing invitations
    const existingInvitations = await db.invitation.findMany({
      where: {
        tournamentId: validated.tournamentId,
        status: { in: ['PENDING', 'SENT', 'OPENED', 'REGISTERED'] }
      },
      select: { contactEmail: true }
    })
    const existingEmails = new Set(existingInvitations.map(i => i.contactEmail.toLowerCase()))

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const inv of validated.invitations) {
      // Skip if already invited
      if (existingEmails.has(inv.contactEmail.toLowerCase())) {
        skipped++
        continue
      }

      try {
        // Create invitation
        const invitation = await db.invitation.create({
          data: {
            tournamentId: validated.tournamentId,
            contactEmail: inv.contactEmail,
            contactName: inv.contactName,
            teamName: inv.teamName,
            sentById: session.user.id,
            expiresAt,
            status: 'PENDING',
          }
        })

        // Send email
        const emailResult = await sendInvitationEmail({
          to: inv.contactEmail,
          recipientName: inv.contactName,
          tournamentName: tournament.name,
          eventName: tournament.event.name,
          invitationToken: invitation.token,
          expiresAt,
        })

        if (emailResult.success) {
          await db.invitation.update({
            where: { id: invitation.id },
            data: { status: 'SENT' }
          })
        }

        created++
        existingEmails.add(inv.contactEmail.toLowerCase())
      } catch {
        errors.push(`Failed to invite ${inv.contactEmail}`)
      }
    }

    logger.info('Bulk invitations created', { 
      tournamentId: validated.tournamentId,
      created,
      skipped,
      errors: errors.length,
      userId: session.user.id
    })

    revalidatePath(`/events/${tournament.eventId}/tournaments/${validated.tournamentId}`)

    return { 
      success: true, 
      data: { created, skipped, errors } 
    }
  } catch (error) {
    logger.error('Failed to create bulk invitations', { error })
    return { success: false, error: 'Failed to create invitations' }
  }
}

/**
 * Get invitations for a tournament
 */
export async function getTournamentInvitations(tournamentId: string): Promise<ActionResult<{
  invitations: Array<{
    id: string
    token: string
    contactEmail: string
    contactName: string | null
    teamName: string | null
    status: InvitationStatus
    sentAt: Date
    expiresAt: Date
  }>
}>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify access
    const tournament = await db.tournament.findFirst({
      where: {
        id: tournamentId,
        event: { ownerId: session.user.id }
      }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    const invitations = await db.invitation.findMany({
      where: { tournamentId },
      orderBy: { sentAt: 'desc' }
    })

    return {
      success: true,
      data: {
        invitations: invitations.map(inv => ({
          id: inv.id,
          token: inv.token,
          contactEmail: inv.contactEmail,
          contactName: inv.contactName,
          teamName: inv.teamName,
          status: inv.status,
          sentAt: inv.sentAt,
          expiresAt: inv.expiresAt,
        }))
      }
    }
  } catch (error) {
    logger.error('Failed to get invitations', { error })
    return { success: false, error: 'Failed to load invitations' }
  }
}

/**
 * Resend an invitation
 */
export async function resendInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
      include: {
        tournament: {
          include: { event: true }
        }
      }
    })

    if (!invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    if (invitation.tournament.event.ownerId !== session.user.id) {
      return { success: false, error: 'Not authorized' }
    }

    if (invitation.status === 'REGISTERED') {
      return { success: false, error: 'Invitation already used' }
    }

    // Extend expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    // Resend email
    const emailResult = await sendInvitationEmail({
      to: invitation.contactEmail,
      recipientName: invitation.contactName ?? undefined,
      tournamentName: invitation.tournament.name,
      eventName: invitation.tournament.event.name,
      invitationToken: invitation.token,
      message: invitation.message ?? undefined,
      expiresAt,
    })

    await db.invitation.update({
      where: { id: invitationId },
      data: {
        status: emailResult.success ? 'SENT' : 'PENDING',
        expiresAt,
        sentAt: new Date(),
      }
    })

    logger.info('Invitation resent', { invitationId, userId: session.user.id })

    return { success: true }
  } catch (error) {
    logger.error('Failed to resend invitation', { error })
    return { success: false, error: 'Failed to resend invitation' }
  }
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
      include: {
        tournament: {
          include: { event: true }
        }
      }
    })

    if (!invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    if (invitation.tournament.event.ownerId !== session.user.id) {
      return { success: false, error: 'Not authorized' }
    }

    if (invitation.status === 'REGISTERED') {
      return { success: false, error: 'Cannot cancel - already registered' }
    }

    await db.invitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' }
    })

    logger.info('Invitation cancelled', { invitationId, userId: session.user.id })

    revalidatePath(`/events/${invitation.tournament.eventId}/tournaments/${invitation.tournamentId}`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to cancel invitation', { error })
    return { success: false, error: 'Failed to cancel invitation' }
  }
}

/**
 * Get invitation by token (public - for registration page)
 */
export async function getInvitationByToken(token: string): Promise<ActionResult<{
  invitation: {
    id: string
    contactEmail: string
    contactName: string | null
    teamName: string | null
    status: InvitationStatus
    expiresAt: Date
    tournament: {
      id: string
      name: string
      eventName: string
    }
  }
}>> {
  try {
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        tournament: {
          include: {
            event: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (!invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    // Mark as opened if first time
    if (invitation.status === 'SENT') {
      await db.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'OPENED',
          openedAt: new Date(),
        }
      })
    }

    return {
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          contactEmail: invitation.contactEmail,
          contactName: invitation.contactName,
          teamName: invitation.teamName,
          status: invitation.status === 'SENT' ? 'OPENED' : invitation.status,
          expiresAt: invitation.expiresAt,
          tournament: {
            id: invitation.tournamentId,
            name: invitation.tournament.name,
            eventName: invitation.tournament.event.name,
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to get invitation', { error })
    return { success: false, error: 'Failed to load invitation' }
  }
}
