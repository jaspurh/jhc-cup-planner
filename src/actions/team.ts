'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  createTeamSchema,
  registerTeamSchema,
  quickRegisterTeamSchema,
  updateRegistrationStatusSchema,
} from '@/lib/schemas'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import { RegistrationStatus } from '@/types'

/**
 * Create a new team (for authenticated users)
 */
export async function createTeam(input: {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const validated = createTeamSchema.parse(input)

    const team = await db.team.create({
      data: {
        name: validated.name,
        contactName: validated.contactName,
        contactEmail: validated.contactEmail,
        contactPhone: validated.contactPhone,
        createdById: session.user.id,
      }
    })

    logger.info('Team created', { teamId: team.id, userId: session.user.id })

    return { success: true, data: { id: team.id } }
  } catch (error) {
    logger.error('Failed to create team', { error })
    return { success: false, error: 'Failed to create team' }
  }
}

/**
 * Register an existing team for a tournament
 */
export async function registerTeamForTournament(input: {
  teamId: string
  tournamentId: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const validated = registerTeamSchema.parse(input)

    // Check if tournament exists and is open for registration
    const tournament = await db.tournament.findUnique({
      where: { id: validated.tournamentId },
      include: { event: true }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    if (tournament.status !== 'DRAFT' && tournament.status !== 'READY') {
      return { success: false, error: 'Tournament is not open for registration' }
    }

    // Check if team is already registered
    const existingReg = await db.teamRegistration.findUnique({
      where: {
        teamId_tournamentId: {
          teamId: validated.teamId,
          tournamentId: validated.tournamentId
        }
      }
    })

    if (existingReg) {
      return { success: false, error: 'Team is already registered' }
    }

    // Get team info for historical record
    const team = await db.team.findUnique({
      where: { id: validated.teamId }
    })

    if (!team) {
      return { success: false, error: 'Team not found' }
    }

    // Check for duplicate team name in tournament (case-insensitive)
    const duplicateName = await db.teamRegistration.findFirst({
      where: {
        tournamentId: validated.tournamentId,
        registeredTeamName: {
          equals: team.name,
          mode: 'insensitive'
        },
        status: {
          not: 'WITHDRAWN'
        }
      }
    })

    if (duplicateName) {
      return { 
        success: false, 
        error: 'A team with this name is already registered. Please use a unique name (e.g., add A, B, or 1, 2).' 
      }
    }

    // Create registration
    const registration = await db.teamRegistration.create({
      data: {
        teamId: validated.teamId,
        tournamentId: validated.tournamentId,
        status: 'PENDING',
        registeredTeamName: team.name,
      }
    })

    logger.info('Team registered for tournament', { 
      registrationId: registration.id,
      teamId: validated.teamId,
      tournamentId: validated.tournamentId 
    })

    revalidatePath(`/events/${tournament.eventId}/tournaments/${validated.tournamentId}`)

    return { success: true, data: { id: registration.id } }
  } catch (error) {
    logger.error('Failed to register team', { error })
    return { success: false, error: 'Failed to register team' }
  }
}

/**
 * Quick register - create team and register in one step
 * Used for public registration via invitation
 */
export async function quickRegisterTeam(input: {
  tournamentId: string
  teamName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  invitationToken?: string
  primaryClubId?: string | null
  secondaryClubId?: string | null
}): Promise<ActionResult<{ teamId: string; registrationId: string }>> {
  try {
    const validated = quickRegisterTeamSchema.parse(input)

    // Verify tournament exists and is open
    const tournament = await db.tournament.findUnique({
      where: { id: validated.tournamentId },
      include: { event: true }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    if (tournament.status !== 'DRAFT' && tournament.status !== 'READY') {
      return { success: false, error: 'Registration is closed' }
    }

    // If invitation token provided, validate it
    let invitation = null
    if (validated.invitationToken) {
      invitation = await db.invitation.findUnique({
        where: { token: validated.invitationToken }
      })

      if (!invitation) {
        return { success: false, error: 'Invalid invitation' }
      }

      if (invitation.status !== 'PENDING' && invitation.status !== 'SENT' && invitation.status !== 'OPENED') {
        return { success: false, error: 'Invitation is no longer valid' }
      }

      if (invitation.expiresAt < new Date()) {
        return { success: false, error: 'Invitation has expired' }
      }

      if (invitation.tournamentId !== validated.tournamentId) {
        return { success: false, error: 'Invitation is for a different tournament' }
      }
    }

    // Check for duplicate team name in tournament (case-insensitive)
    const duplicateName = await db.teamRegistration.findFirst({
      where: {
        tournamentId: validated.tournamentId,
        registeredTeamName: {
          equals: validated.teamName,
          mode: 'insensitive'
        },
        status: {
          not: 'WITHDRAWN'
        }
      }
    })

    if (duplicateName) {
      return { 
        success: false, 
        error: 'A team with this name is already registered for this tournament. Please use a unique name (e.g., add A, B, or 1, 2).' 
      }
    }

    // Create team and registration in transaction
    const result = await db.$transaction(async (tx) => {
      // Create team with club affiliation
      const team = await tx.team.create({
        data: {
          name: validated.teamName,
          contactName: validated.contactName,
          contactEmail: validated.contactEmail,
          contactPhone: validated.contactPhone,
          primaryClubId: validated.primaryClubId ?? null,
          secondaryClubId: validated.secondaryClubId ?? null,
        }
      })

      // Create registration
      const registration = await tx.teamRegistration.create({
        data: {
          teamId: team.id,
          tournamentId: validated.tournamentId,
          status: invitation ? 'CONFIRMED' : 'PENDING',
          registeredTeamName: validated.teamName,
          confirmedAt: invitation ? new Date() : null,
        }
      })

      // Update invitation if used
      if (invitation) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'REGISTERED',
            respondedAt: new Date(),
          }
        })
      }

      return { teamId: team.id, registrationId: registration.id }
    })

    logger.info('Quick registration completed', { 
      teamId: result.teamId,
      registrationId: result.registrationId,
      tournamentId: validated.tournamentId,
      viaInvitation: !!invitation
    })

    revalidatePath(`/events/${tournament.eventId}/tournaments/${validated.tournamentId}`)

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to quick register team', { error })
    return { success: false, error: 'Failed to register team' }
  }
}

/**
 * Add team directly to tournament (admin action)
 * Creates team and registers as confirmed immediately
 */
export async function addTeamDirectly(input: {
  tournamentId: string
  teamName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}): Promise<ActionResult<{ teamId: string; registrationId: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify tournament exists and user has access
    const tournament = await db.tournament.findFirst({
      where: { 
        id: input.tournamentId,
        event: { ownerId: session.user.id }
      },
      include: { event: true }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found or access denied' }
    }

    // Check for duplicate team name (case-insensitive)
    const duplicateName = await db.teamRegistration.findFirst({
      where: {
        tournamentId: input.tournamentId,
        registeredTeamName: {
          equals: input.teamName,
          mode: 'insensitive'
        },
        status: {
          not: 'WITHDRAWN'
        }
      }
    })

    if (duplicateName) {
      return { 
        success: false, 
        error: 'A team with this name is already registered. Please use a unique name.' 
      }
    }

    // Create team and registration in transaction
    const result = await db.$transaction(async (tx) => {
      // Create team
      const team = await tx.team.create({
        data: {
          name: input.teamName,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          createdById: session.user.id,
        }
      })

      // Create registration as CONFIRMED
      const registration = await tx.teamRegistration.create({
        data: {
          teamId: team.id,
          tournamentId: input.tournamentId,
          status: 'CONFIRMED',
          registeredTeamName: input.teamName,
          confirmedAt: new Date(),
        }
      })

      return { teamId: team.id, registrationId: registration.id }
    })

    logger.info('Team added directly to tournament', { 
      teamId: result.teamId,
      registrationId: result.registrationId,
      tournamentId: input.tournamentId,
      addedBy: session.user.id
    })

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to add team directly', { error })
    return { success: false, error: 'Failed to add team' }
  }
}

/**
 * Add multiple teams directly to tournament (admin action)
 * Creates teams and registers as confirmed immediately
 */
export async function addTeamsBulk(input: {
  tournamentId: string
  teams: Array<{
    teamName: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
  }>
}): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify tournament exists and user has access
    const tournament = await db.tournament.findFirst({
      where: { 
        id: input.tournamentId,
        event: { ownerId: session.user.id }
      }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found or access denied' }
    }

    // Get existing team names for duplicate check
    const existingRegistrations = await db.teamRegistration.findMany({
      where: {
        tournamentId: input.tournamentId,
        status: { not: 'WITHDRAWN' }
      },
      select: { registeredTeamName: true }
    })

    const existingNames = new Set(
      existingRegistrations
        .map(r => r.registeredTeamName?.toLowerCase())
        .filter(Boolean)
    )

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const teamData of input.teams) {
      const normalizedName = teamData.teamName.toLowerCase()

      // Check for duplicate
      if (existingNames.has(normalizedName)) {
        skipped++
        continue
      }

      try {
        // Create team and registration
        await db.$transaction(async (tx) => {
          const team = await tx.team.create({
            data: {
              name: teamData.teamName,
              contactName: teamData.contactName,
              contactEmail: teamData.contactEmail,
              contactPhone: teamData.contactPhone,
              createdById: session.user.id,
            }
          })

          await tx.teamRegistration.create({
            data: {
              teamId: team.id,
              tournamentId: input.tournamentId,
              status: 'CONFIRMED',
              registeredTeamName: teamData.teamName,
              confirmedAt: new Date(),
            }
          })
        })

        existingNames.add(normalizedName)
        created++
      } catch (err) {
        errors.push(`Failed to add "${teamData.teamName}"`)
        logger.error('Failed to add team in bulk', { teamName: teamData.teamName, error: err })
      }
    }

    logger.info('Bulk team add completed', { 
      tournamentId: input.tournamentId,
      created,
      skipped,
      errors: errors.length,
      addedBy: session.user.id
    })

    return { success: true, data: { created, skipped, errors } }
  } catch (error) {
    logger.error('Failed to add teams in bulk', { error })
    return { success: false, error: 'Failed to add teams' }
  }
}

/**
 * Update registration status (confirm, reject, withdraw)
 */
export async function updateRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const validated = updateRegistrationStatusSchema.parse({ registrationId, status })

    // Get registration with tournament/event info
    const registration = await db.teamRegistration.findUnique({
      where: { id: validated.registrationId },
      include: {
        tournament: {
          include: { event: true }
        }
      }
    })

    if (!registration) {
      return { success: false, error: 'Registration not found' }
    }

    // Check if user is event owner
    if (registration.tournament.event.ownerId !== session.user.id) {
      return { success: false, error: 'Not authorized' }
    }

    // If withdrawing, also remove from any groups the team is assigned to
    if (validated.status === 'WITHDRAWN') {
      await db.groupTeamAssignment.deleteMany({
        where: { registrationId: validated.registrationId }
      })
      
      logger.info('Removed team from all groups on withdrawal', { 
        registrationId: validated.registrationId 
      })
    }

    // Update registration
    await db.teamRegistration.update({
      where: { id: validated.registrationId },
      data: {
        status: validated.status,
        confirmedAt: validated.status === 'CONFIRMED' ? new Date() : undefined,
      }
    })

    logger.info('Registration status updated', { 
      registrationId: validated.registrationId,
      newStatus: validated.status,
      userId: session.user.id
    })

    revalidatePath(`/events/${registration.tournament.eventId}/tournaments/${registration.tournamentId}`)

    return { success: true, data: { id: validated.registrationId } }
  } catch (error) {
    logger.error('Failed to update registration status', { error })
    return { success: false, error: 'Failed to update registration' }
  }
}

/**
 * Get registrations for a tournament
 */
export async function getTournamentRegistrations(tournamentId: string): Promise<ActionResult<{
  registrations: Array<{
    id: string
    teamId: string
    teamName: string
    contactName: string | null
    contactEmail: string | null
    status: RegistrationStatus
    registeredAt: Date
    confirmedAt: Date | null
    primaryClub: { id: string; name: string; primaryColor: string | null } | null
    secondaryClub: { id: string; name: string; primaryColor: string | null } | null
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

    const registrations = await db.teamRegistration.findMany({
      where: { tournamentId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            contactName: true,
            contactEmail: true,
            primaryClub: {
              select: {
                id: true,
                name: true,
                primaryColor: true,
              }
            },
            secondaryClub: {
              select: {
                id: true,
                name: true,
                primaryColor: true,
              }
            },
          }
        }
      },
      orderBy: { registeredAt: 'desc' }
    })

    return {
      success: true,
      data: {
        registrations: registrations.map(r => ({
          id: r.id,
          teamId: r.team.id,
          teamName: r.registeredTeamName || r.team.name,
          contactName: r.team.contactName,
          contactEmail: r.team.contactEmail,
          status: r.status,
          registeredAt: r.registeredAt,
          confirmedAt: r.confirmedAt,
          primaryClub: r.team.primaryClub,
          secondaryClub: r.team.secondaryClub,
        }))
      }
    }
  } catch (error) {
    logger.error('Failed to get registrations', { error })
    return { success: false, error: 'Failed to load registrations' }
  }
}
