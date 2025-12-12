'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  createEventSchema, 
  updateEventSchema,
  type CreateEventInput, 
  type UpdateEventInput 
} from '@/lib/schemas'
import { generateUniqueSlug } from '@/lib/utils/slug'
import { revalidatePath } from 'next/cache'
import type { ActionResult, EventWithTournaments } from '@/types'

/**
 * Get all events for the current user
 */
export async function getMyEvents(): Promise<ActionResult<EventWithTournaments[]>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const events = await db.event.findMany({
      where: { ownerId: session.user.id },
      include: {
        tournaments: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            style: true,
            format: true,
            startTime: true,
            _count: {
              select: { teams: true }
            }
          }
        }
      },
      orderBy: { startDate: 'desc' }
    })

    const result: EventWithTournaments[] = events.map(event => ({
      ...event,
      tournaments: event.tournaments.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        style: t.style,
        format: t.format,
        startTime: t.startTime,
        teamCount: t._count.teams
      }))
    }))

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get events', { error })
    return { success: false, error: 'Failed to load events' }
  }
}

/**
 * Get a single event by ID
 */
export async function getEvent(eventId: string): Promise<ActionResult<EventWithTournaments>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const event = await db.event.findFirst({
      where: { 
        id: eventId,
        ownerId: session.user.id 
      },
      include: {
        tournaments: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            style: true,
            format: true,
            startTime: true,
            _count: {
              select: { teams: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    })

    if (!event) {
      return { success: false, error: 'Event not found' }
    }

    const result: EventWithTournaments = {
      ...event,
      tournaments: event.tournaments.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        style: t.style,
        format: t.format,
        startTime: t.startTime,
        teamCount: t._count.teams
      }))
    }

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get event', { error, eventId })
    return { success: false, error: 'Failed to load event' }
  }
}

/**
 * Create a new event
 */
export async function createEvent(input: CreateEventInput): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate input
    const validated = createEventSchema.parse(input)

    // Generate unique slug
    const existingSlugs = await db.event.findMany({
      select: { slug: true }
    })
    const slug = generateUniqueSlug(validated.name, existingSlugs.map(e => e.slug))

    // Create event
    const event = await db.event.create({
      data: {
        name: validated.name,
        description: validated.description,
        slug,
        startDate: validated.startDate,
        endDate: validated.endDate,
        status: 'DRAFT',
        ownerId: session.user.id
      }
    })

    logger.info('Event created', { eventId: event.id, userId: session.user.id })
    
    revalidatePath('/dashboard')
    revalidatePath('/events')

    return { success: true, data: { id: event.id, slug: event.slug } }
  } catch (error) {
    logger.error('Failed to create event', { error })
    return { success: false, error: 'Failed to create event' }
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(
  eventId: string, 
  input: UpdateEventInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check ownership
    const existing = await db.event.findFirst({
      where: { id: eventId, ownerId: session.user.id }
    })

    if (!existing) {
      return { success: false, error: 'Event not found' }
    }

    // Validate input
    const validated = updateEventSchema.parse(input)

    // Update slug if name changed
    let slug = existing.slug
    if (validated.name && validated.name !== existing.name) {
      const existingSlugs = await db.event.findMany({
        where: { id: { not: eventId } },
        select: { slug: true }
      })
      slug = generateUniqueSlug(validated.name, existingSlugs.map(e => e.slug))
    }

    // Update event
    await db.event.update({
      where: { id: eventId },
      data: {
        ...validated,
        slug
      }
    })

    logger.info('Event updated', { eventId, userId: session.user.id })
    
    revalidatePath('/dashboard')
    revalidatePath('/events')
    revalidatePath(`/events/${eventId}`)

    return { success: true, data: { id: eventId } }
  } catch (error) {
    logger.error('Failed to update event', { error, eventId })
    return { success: false, error: 'Failed to update event' }
  }
}

/**
 * Delete an event (and all its tournaments)
 */
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check ownership
    const existing = await db.event.findFirst({
      where: { id: eventId, ownerId: session.user.id }
    })

    if (!existing) {
      return { success: false, error: 'Event not found' }
    }

    // Delete event (cascades to tournaments)
    await db.event.delete({
      where: { id: eventId }
    })

    logger.info('Event deleted', { eventId, userId: session.user.id })
    
    revalidatePath('/dashboard')
    revalidatePath('/events')

    return { success: true }
  } catch (error) {
    logger.error('Failed to delete event', { error, eventId })
    return { success: false, error: 'Failed to delete event' }
  }
}
