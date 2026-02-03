'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  createTournamentSchema, 
  updateTournamentSchema,
  type CreateTournamentInput, 
  type UpdateTournamentInput 
} from '@/lib/schemas'
import { generateUniqueSlug } from '@/lib/utils/slug'
import { revalidatePath } from 'next/cache'
import type { ActionResult, TournamentWithDetails } from '@/types'
import { TournamentStatus } from '@/types'

/**
 * Get a single tournament with full details
 */
export async function getTournament(tournamentId: string): Promise<ActionResult<TournamentWithDetails>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const tournament = await db.tournament.findFirst({
      where: { 
        id: tournamentId,
        event: { ownerId: session.user.id }
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            startDate: true,
            endDate: true,
          }
        },
        stages: {
          include: {
            groups: {
              include: {
                teamAssignments: {
                  include: {
                    registration: {
                      include: {
                        team: {
                          select: { name: true }
                        }
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            },
            _count: {
              select: { matches: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                contactName: true,
                contactEmail: true
              }
            }
          },
          orderBy: { registeredAt: 'desc' }
        },
        pitches: {
          where: { isActive: true },
          include: {
            pitch: {
              include: {
                venue: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    const result: TournamentWithDetails = {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      slug: tournament.slug,
      eventId: tournament.eventId,
      status: tournament.status,
      style: tournament.style,
      format: tournament.format,
      matchDurationMinutes: tournament.matchDurationMinutes,
      transitionTimeMinutes: tournament.transitionTimeMinutes,
      startTime: tournament.startTime,
      endTime: tournament.endTime,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
      event: tournament.event,
      stages: tournament.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        type: stage.type,
        order: stage.order,
        bufferTimeMinutes: stage.bufferTimeMinutes,
        configuration: stage.configuration,
        startTime: stage.startTime,
        endTime: stage.endTime,
        matchCount: stage._count.matches,
        groups: stage.groups.map(group => ({
          id: group.id,
          name: group.name,
          order: group.order,
          roundRobinType: group.roundRobinType,
          teams: group.teamAssignments.map(ta => ({
            id: ta.registration.id,
            teamName: ta.registration.team.name,
            seedPosition: ta.seedPosition
          }))
        }))
      })),
      teams: tournament.teams.map(reg => ({
        id: reg.id,
        teamId: reg.teamId,
        status: reg.status,
        registeredAt: reg.registeredAt,
        confirmedAt: reg.confirmedAt,
        team: reg.team
      })),
      pitches: tournament.pitches.map(tp => ({
        id: tp.pitch.id,
        name: tp.pitch.name,
        capacity: tp.pitch.capacity,
        venue: tp.pitch.venue
      }))
    }

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get tournament', { error, tournamentId })
    return { success: false, error: 'Failed to load tournament' }
  }
}

/**
 * Create a new tournament within an event
 */
export async function createTournament(input: CreateTournamentInput): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate input
    const validated = createTournamentSchema.parse(input)

    // Check event ownership
    const event = await db.event.findFirst({
      where: { id: validated.eventId, ownerId: session.user.id }
    })

    if (!event) {
      return { success: false, error: 'Event not found' }
    }

    // Generate unique slug within event
    const existingSlugs = await db.tournament.findMany({
      where: { eventId: validated.eventId },
      select: { slug: true }
    })
    const slug = generateUniqueSlug(validated.name, existingSlugs.map(t => t.slug))

    // Create tournament
    const tournament = await db.tournament.create({
      data: {
        name: validated.name,
        description: validated.description,
        slug,
        eventId: validated.eventId,
        status: 'DRAFT',
        style: validated.style,
        format: validated.format,
        matchDurationMinutes: validated.matchDurationMinutes,
        transitionTimeMinutes: validated.transitionTimeMinutes,
        startTime: validated.startTime
      }
    })

    // Assign creator as organizer
    await db.tournamentRole.create({
      data: {
        userId: session.user.id,
        tournamentId: tournament.id,
        role: 'ORGANIZER'
      }
    })

    logger.info('Tournament created', { 
      tournamentId: tournament.id, 
      eventId: validated.eventId,
      userId: session.user.id 
    })
    
    revalidatePath(`/events/${validated.eventId}`)

    return { success: true, data: { id: tournament.id, slug: tournament.slug } }
  } catch (error) {
    logger.error('Failed to create tournament', { error })
    return { success: false, error: 'Failed to create tournament' }
  }
}

/**
 * Update an existing tournament
 */
export async function updateTournament(
  tournamentId: string, 
  input: UpdateTournamentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check ownership via event
    const existing = await db.tournament.findFirst({
      where: { 
        id: tournamentId,
        event: { ownerId: session.user.id }
      },
      include: { event: true }
    })

    if (!existing) {
      return { success: false, error: 'Tournament not found' }
    }

    // Validate input
    const validated = updateTournamentSchema.parse(input)

    // Update slug if name changed
    let slug = existing.slug
    if (validated.name && validated.name !== existing.name) {
      const existingSlugs = await db.tournament.findMany({
        where: { 
          eventId: existing.eventId,
          id: { not: tournamentId } 
        },
        select: { slug: true }
      })
      slug = generateUniqueSlug(validated.name, existingSlugs.map(t => t.slug))
    }

    // Update tournament
    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        ...validated,
        slug
      }
    })

    logger.info('Tournament updated', { tournamentId, userId: session.user.id })
    
    revalidatePath(`/events/${existing.eventId}`)
    revalidatePath(`/events/${existing.eventId}/tournaments/${tournamentId}`)

    return { success: true, data: { id: tournamentId } }
  } catch (error) {
    logger.error('Failed to update tournament', { error, tournamentId })
    return { success: false, error: 'Failed to update tournament' }
  }
}

/**
 * Update tournament status
 */
export async function updateTournamentStatus(
  tournamentId: string, 
  status: TournamentStatus
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check ownership via event
    const existing = await db.tournament.findFirst({
      where: { 
        id: tournamentId,
        event: { ownerId: session.user.id }
      }
    })

    if (!existing) {
      return { success: false, error: 'Tournament not found' }
    }

    // Validate status transition
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      DRAFT: ['READY', 'ARCHIVED'],
      READY: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      ACTIVE: ['COMPLETED'],
      COMPLETED: ['ARCHIVED'],
      ARCHIVED: ['DRAFT']
    }

    if (!validTransitions[existing.status].includes(status)) {
      return { 
        success: false, 
        error: `Cannot transition from ${existing.status} to ${status}` 
      }
    }

    // Update status
    await db.tournament.update({
      where: { id: tournamentId },
      data: { status }
    })

    logger.info('Tournament status updated', { 
      tournamentId, 
      oldStatus: existing.status,
      newStatus: status,
      userId: session.user.id 
    })
    
    revalidatePath(`/events/${existing.eventId}`)
    revalidatePath(`/events/${existing.eventId}/tournaments/${tournamentId}`)

    return { success: true, data: { id: tournamentId } }
  } catch (error) {
    logger.error('Failed to update tournament status', { error, tournamentId })
    return { success: false, error: 'Failed to update tournament status' }
  }
}

/**
 * Delete a tournament
 */
export async function deleteTournament(tournamentId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check ownership via event
    const existing = await db.tournament.findFirst({
      where: { 
        id: tournamentId,
        event: { ownerId: session.user.id }
      }
    })

    if (!existing) {
      return { success: false, error: 'Tournament not found' }
    }

    // Don't allow deleting active tournaments
    if (existing.status === 'ACTIVE') {
      return { success: false, error: 'Cannot delete an active tournament' }
    }

    // Delete tournament (cascades)
    await db.tournament.delete({
      where: { id: tournamentId }
    })

    logger.info('Tournament deleted', { tournamentId, userId: session.user.id })
    
    revalidatePath(`/events/${existing.eventId}`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to delete tournament', { error, tournamentId })
    return { success: false, error: 'Failed to delete tournament' }
  }
}
