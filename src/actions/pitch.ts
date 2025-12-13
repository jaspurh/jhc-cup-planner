'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'
import type { Pitch, Venue, TournamentPitch } from '@/generated/prisma'

// ==========================================
// Pitch Schemas
// ==========================================

const createPitchSchema = z.object({
  name: z.string().min(1, 'Pitch name is required').max(50),
  eventId: z.string().cuid(),
  venueId: z.string().cuid().optional().nullable(),
  capacity: z.number().int().min(0).max(100000).optional().nullable(),
})

const updatePitchSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  venueId: z.string().cuid().optional().nullable(),
  capacity: z.number().int().min(0).max(100000).optional().nullable(),
})

// ==========================================
// Event-Level Pitch Actions
// ==========================================

export async function createPitch(input: {
  name: string
  eventId: string
  venueId?: string | null
  capacity?: number | null
}): Promise<ActionResult<Pitch>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const validated = createPitchSchema.safeParse(input)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    const existing = await db.pitch.findFirst({
      where: {
        eventId: validated.data.eventId,
        name: { equals: validated.data.name, mode: 'insensitive' },
      },
    })

    if (existing) {
      return { success: false, error: 'A pitch with this name already exists for this event' }
    }

    const pitch = await db.pitch.create({
      data: {
        name: validated.data.name,
        eventId: validated.data.eventId,
        venueId: validated.data.venueId ?? null,
        capacity: validated.data.capacity ?? null,
      },
    })

    revalidatePath(`/events/${validated.data.eventId}`)

    return { success: true, data: pitch }
  } catch (error) {
    console.error('Failed to create pitch:', error)
    return { success: false, error: 'Failed to create pitch' }
  }
}

export async function updatePitch(
  pitchId: string,
  input: { name?: string; venueId?: string | null; capacity?: number | null }
): Promise<ActionResult<Pitch>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const validated = updatePitchSchema.safeParse(input)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    if (validated.data.name) {
      const pitch = await db.pitch.findUnique({
        where: { id: pitchId },
        select: { eventId: true },
      })

      if (pitch) {
        const existing = await db.pitch.findFirst({
          where: {
            eventId: pitch.eventId,
            name: { equals: validated.data.name, mode: 'insensitive' },
            id: { not: pitchId },
          },
        })

        if (existing) {
          return { success: false, error: 'A pitch with this name already exists for this event' }
        }
      }
    }

    const updated = await db.pitch.update({
      where: { id: pitchId },
      data: validated.data,
    })

    return { success: true, data: updated }
  } catch (error) {
    console.error('Failed to update pitch:', error)
    return { success: false, error: 'Failed to update pitch' }
  }
}

export async function deletePitch(pitchId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const matchCount = await db.match.count({ where: { pitchId } })

    if (matchCount > 0) {
      return { success: false, error: `Cannot delete pitch with ${matchCount} scheduled matches` }
    }

    await db.pitch.delete({ where: { id: pitchId } })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete pitch:', error)
    return { success: false, error: 'Failed to delete pitch' }
  }
}

export async function getEventPitches(eventId: string): Promise<ActionResult<Array<Pitch & {
  venue: Venue | null
  _count: { matches: number; tournaments: number }
}>>> {
  try {
    const pitches = await db.pitch.findMany({
      where: { eventId },
      include: {
        venue: true,
        _count: { select: { matches: true, tournaments: true } },
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: pitches }
  } catch (error) {
    console.error('Failed to get pitches:', error)
    return { success: false, error: 'Failed to get pitches' }
  }
}

// ==========================================
// Tournament-Pitch Selection Actions
// ==========================================

export async function getTournamentPitches(tournamentId: string): Promise<ActionResult<Array<{
  pitch: Pitch & { venue: Venue | null }
  isSelected: boolean
  tournamentPitchId: string | null
  matchCount: number
}>>> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { eventId: true },
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    const eventPitches = await db.pitch.findMany({
      where: { eventId: tournament.eventId },
      include: {
        venue: true,
        tournaments: { where: { tournamentId } },
        matches: { where: { stage: { tournamentId } } },
      },
      orderBy: { name: 'asc' },
    })

    const result = eventPitches.map(pitch => ({
      pitch: {
        id: pitch.id,
        name: pitch.name,
        venueId: pitch.venueId,
        eventId: pitch.eventId,
        capacity: pitch.capacity,
        createdAt: pitch.createdAt,
        updatedAt: pitch.updatedAt,
        venue: pitch.venue,
      },
      isSelected: pitch.tournaments.length > 0 && pitch.tournaments[0].isActive,
      tournamentPitchId: pitch.tournaments.length > 0 ? pitch.tournaments[0].id : null,
      matchCount: pitch.matches.length,
    }))

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to get tournament pitches:', error)
    return { success: false, error: 'Failed to get tournament pitches' }
  }
}

export async function toggleTournamentPitch(
  tournamentId: string,
  pitchId: string,
  isActive: boolean
): Promise<ActionResult<TournamentPitch>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    if (!isActive) {
      const matchCount = await db.match.count({
        where: { pitchId, stage: { tournamentId } },
      })

      if (matchCount > 0) {
        return { success: false, error: `Cannot deselect pitch with ${matchCount} scheduled matches` }
      }
    }

    const tournamentPitch = await db.tournamentPitch.upsert({
      where: { tournamentId_pitchId: { tournamentId, pitchId } },
      update: { isActive },
      create: { tournamentId, pitchId, isActive },
    })

    return { success: true, data: tournamentPitch }
  } catch (error) {
    console.error('Failed to toggle tournament pitch:', error)
    return { success: false, error: 'Failed to update pitch selection' }
  }
}

export async function selectAllPitchesForTournament(tournamentId: string): Promise<ActionResult<{ count: number }>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { eventId: true },
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    const eventPitches = await db.pitch.findMany({
      where: { eventId: tournament.eventId },
      select: { id: true },
    })

    const operations = eventPitches.map(pitch =>
      db.tournamentPitch.upsert({
        where: { tournamentId_pitchId: { tournamentId, pitchId: pitch.id } },
        update: { isActive: true },
        create: { tournamentId, pitchId: pitch.id, isActive: true },
      })
    )

    await db.$transaction(operations)

    return { success: true, data: { count: eventPitches.length } }
  } catch (error) {
    console.error('Failed to select all pitches:', error)
    return { success: false, error: 'Failed to select pitches' }
  }
}
