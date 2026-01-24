'use server'

/**
 * Schedule Server Actions
 * 
 * Server actions for generating, retrieving, and managing tournament schedules.
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { ActionResult, ScheduledMatch } from '@/types'
import {
  generateSchedule,
  dbStageToConfig,
  createTimingConfig,
  ScheduleGenerationResult,
  AllocatedMatch,
} from '@/lib/scheduling'
import { logger } from '@/lib/logger'

// ==========================================
// Types
// ==========================================

export interface GenerateScheduleInput {
  tournamentId: string
  /** Override start time (uses tournament.startTime if not provided) */
  startTime?: Date
  /** Minimum rest time between matches for same team (minutes) */
  minimumRestMinutes?: number
  /** Preferred rest time (generates warnings if not met) */
  preferredRestMinutes?: number
}

export interface ScheduleStats {
  totalMatches: number
  totalDurationMinutes: number
  estimatedEndTime: Date | null
  pitchUtilization: Record<string, number>
  averageRestMinutes: number
  warnings: string[]
  errors: string[]
}

// ==========================================
// Generate Schedule
// ==========================================

/**
 * Generate a schedule for a tournament
 * 
 * This will:
 * 1. Fetch tournament configuration (stages, groups, teams, pitches)
 * 2. Generate all matches based on stage types
 * 3. Allocate time slots
 * 4. Validate constraints
 * 5. Save matches to database
 * 6. Return schedule stats
 */
export async function generateTournamentSchedule(
  input: GenerateScheduleInput
): Promise<ActionResult<ScheduleStats>> {
  try {
    const { tournamentId, startTime, minimumRestMinutes = 15, preferredRestMinutes = 30 } = input

    // Fetch tournament with all needed relations
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        event: true,
        stages: {
          orderBy: { order: 'asc' },
          include: {
            groups: {
              orderBy: { order: 'asc' },
              include: {
                teamAssignments: {
                  include: {
                    registration: {
                      include: {
                        team: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        pitches: {
          where: { isActive: true },
          include: {
            pitch: true,
          },
        },
      },
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    // Validate requirements
    if (tournament.stages.length === 0) {
      return { success: false, error: 'Tournament has no stages configured' }
    }

    if (tournament.pitches.length === 0) {
      return { success: false, error: 'Tournament has no active pitches' }
    }

    const effectiveStartTime = startTime || tournament.startTime
    if (!effectiveStartTime) {
      return { success: false, error: 'Tournament has no start time set' }
    }

    // Convert DB data to scheduling config
    const stageConfigs = tournament.stages.map((stage: typeof tournament.stages[number]) => dbStageToConfig({
      ...stage,
      groups: stage.groups.map((g: typeof stage.groups[number]) => ({
        ...g,
        teamAssignments: g.teamAssignments.map((ta: typeof g.teamAssignments[number]) => ({
          ...ta,
          registration: {
            ...ta.registration,
            registeredTeamName: ta.registration.registeredTeamName,
          },
        })),
      })),
    }))

    const pitches = tournament.pitches.map((tp: typeof tournament.pitches[number]) => ({
      id: tp.pitch.id,
      name: tp.pitch.name,
    }))

    const timingConfig = createTimingConfig(
      {
        startTime: effectiveStartTime,
        matchDurationMinutes: tournament.matchDurationMinutes,
        transitionTimeMinutes: tournament.transitionTimeMinutes,
      },
      pitches
    )

    // Generate schedule
    const result: ScheduleGenerationResult = generateSchedule({
      tournamentId,
      stages: stageConfigs,
      timing: timingConfig,
      constraints: {
        restTime: {
          minimumRestMinutes,
          preferredRestMinutes,
        },
      },
    })

    logger.info('Schedule generation completed', {
      tournamentId,
      totalMatches: result.stats.totalMatches,
      success: result.success,
      warnings: result.warnings.length,
      errors: result.errors.length,
    })

    // If there are critical errors, return without saving
    if (result.errors.length > 0) {
      return {
        success: false,
        error: `Schedule generation failed: ${result.errors.map(e => e.message).join('; ')}`,
        data: {
          totalMatches: result.stats.totalMatches,
          totalDurationMinutes: result.stats.totalDuration,
          estimatedEndTime: null,
          pitchUtilization: result.stats.pitchUtilization,
          averageRestMinutes: result.stats.averageRestTime,
          warnings: result.warnings.map(w => w.message),
          errors: result.errors.map(e => e.message),
        },
      }
    }

    // Delete existing matches for this tournament's stages
    const stageIds = tournament.stages.map((s: { id: string }) => s.id)
    await db.match.deleteMany({
      where: { stageId: { in: stageIds } },
    })

    // Save new matches
    await saveMatches(result.matches)

    // Calculate estimated end time
    let estimatedEndTime: Date | null = null
    if (result.matches.length > 0) {
      estimatedEndTime = result.matches.reduce(
        (latest, m) => m.scheduledEndTime > latest ? m.scheduledEndTime : latest,
        result.matches[0].scheduledEndTime
      )
    }

    // Revalidate tournament pages
    revalidatePath(`/events/${tournament.event.slug}/tournaments/${tournament.slug}`)
    revalidatePath(`/events/${tournament.event.slug}/tournaments/${tournament.slug}/schedule`)

    return {
      success: true,
      data: {
        totalMatches: result.stats.totalMatches,
        totalDurationMinutes: result.stats.totalDuration,
        estimatedEndTime,
        pitchUtilization: result.stats.pitchUtilization,
        averageRestMinutes: result.stats.averageRestTime,
        warnings: result.warnings.map(w => w.message),
        errors: [],
      },
    }
  } catch (error) {
    logger.error('Failed to generate schedule', { error, input })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate schedule',
    }
  }
}

/**
 * Save allocated matches to the database
 */
async function saveMatches(matches: AllocatedMatch[]): Promise<void> {
  // Sort by scheduled time for consistent match numbering
  const sortedMatches = [...matches].sort(
    (a, b) => a.scheduledStartTime.getTime() - b.scheduledStartTime.getTime()
  )

  // Create matches in database
  for (let i = 0; i < sortedMatches.length; i++) {
    const match = sortedMatches[i]
    
    await db.match.create({
      data: {
        stageId: match.stageId,
        groupId: match.groupId || null,
        pitchId: match.pitchId,
        homeRegistrationId: match.homeRegistrationId,
        awayRegistrationId: match.awayRegistrationId,
        homeTeamSource: match.metadata?.homeSource || null,
        awayTeamSource: match.metadata?.awaySource || null,
        matchNumber: i + 1, // Sequential numbering
        roundNumber: match.roundNumber,
        bracketPosition: match.bracketPosition || null,
        scheduledStartTime: match.scheduledStartTime,
        scheduledEndTime: match.scheduledEndTime,
        status: 'SCHEDULED',
      },
    })
  }
}

// ==========================================
// Get Schedule
// ==========================================

/**
 * Get the schedule for a tournament
 */
export async function getTournamentSchedule(
  tournamentId: string
): Promise<ActionResult<ScheduledMatch[]>> {
  try {
    const matches = await db.match.findMany({
      where: {
        stage: {
          tournamentId,
        },
      },
      include: {
        stage: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        pitch: {
          select: {
            id: true,
            name: true,
          },
        },
        homeTeam: {
          select: {
            id: true,
            registeredTeamName: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        awayTeam: {
          select: {
            id: true,
            registeredTeamName: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        result: true,
      },
      orderBy: [
        { scheduledStartTime: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    const scheduledMatches: ScheduledMatch[] = matches.map((m: typeof matches[number]) => ({
      id: m.id,
      matchNumber: m.matchNumber,
      roundNumber: m.roundNumber,
      bracketPosition: m.bracketPosition,
      scheduledStartTime: m.scheduledStartTime,
      scheduledEndTime: m.scheduledEndTime,
      status: m.status,
      stage: m.stage,
      group: m.group,
      pitch: m.pitch,
      homeTeam: m.homeTeam ? {
        id: m.homeTeam.id,
        teamName: m.homeTeam.registeredTeamName || m.homeTeam.team.name,
      } : null,
      awayTeam: m.awayTeam ? {
        id: m.awayTeam.id,
        teamName: m.awayTeam.registeredTeamName || m.awayTeam.team.name,
      } : null,
      homeTeamSource: m.homeTeamSource,
      awayTeamSource: m.awayTeamSource,
      result: m.result ? {
        homeScore: m.result.homeScore,
        awayScore: m.result.awayScore,
        homePenalties: m.result.homePenalties,
        awayPenalties: m.result.awayPenalties,
      } : null,
    }))

    return { success: true, data: scheduledMatches }
  } catch (error) {
    logger.error('Failed to get tournament schedule', { error, tournamentId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get schedule',
    }
  }
}

// ==========================================
// Clear Schedule
// ==========================================

/**
 * Clear all matches from a tournament's schedule
 */
export async function clearTournamentSchedule(
  tournamentId: string
): Promise<ActionResult> {
  try {
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        event: true,
        stages: {
          select: { id: true },
        },
      },
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    const stageIds = tournament.stages.map((s: { id: string }) => s.id)
    
    await db.match.deleteMany({
      where: { stageId: { in: stageIds } },
    })

    logger.info('Cleared tournament schedule', { tournamentId })

    revalidatePath(`/events/${tournament.event.slug}/tournaments/${tournament.slug}`)
    revalidatePath(`/events/${tournament.event.slug}/tournaments/${tournament.slug}/schedule`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to clear schedule', { error, tournamentId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear schedule',
    }
  }
}

// ==========================================
// Schedule Validation (Preview)
// ==========================================

/**
 * Preview schedule generation without saving
 * Useful for showing users what the schedule would look like
 */
export async function previewTournamentSchedule(
  input: GenerateScheduleInput
): Promise<ActionResult<ScheduleStats & { matchCount: number }>> {
  try {
    const { tournamentId, startTime, minimumRestMinutes = 15, preferredRestMinutes = 30 } = input

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            groups: {
              orderBy: { order: 'asc' },
              include: {
                teamAssignments: {
                  include: {
                    registration: {
                      include: {
                        team: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        pitches: {
          where: { isActive: true },
          include: {
            pitch: true,
          },
        },
      },
    })

    if (!tournament) {
      return { success: false, error: 'Tournament not found' }
    }

    if (tournament.stages.length === 0) {
      return { success: false, error: 'Tournament has no stages configured' }
    }

    if (tournament.pitches.length === 0) {
      return { success: false, error: 'Tournament has no active pitches' }
    }

    const effectiveStartTime = startTime || tournament.startTime
    if (!effectiveStartTime) {
      return { success: false, error: 'Tournament has no start time set' }
    }

    const stageConfigs = tournament.stages.map((stage: typeof tournament.stages[number]) => dbStageToConfig({
      ...stage,
      groups: stage.groups.map((g: typeof stage.groups[number]) => ({
        ...g,
        teamAssignments: g.teamAssignments.map((ta: typeof g.teamAssignments[number]) => ({
          ...ta,
          registration: {
            ...ta.registration,
            registeredTeamName: ta.registration.registeredTeamName,
          },
        })),
      })),
    }))

    const pitches = tournament.pitches.map((tp: typeof tournament.pitches[number]) => ({
      id: tp.pitch.id,
      name: tp.pitch.name,
    }))

    const timingConfig = createTimingConfig(
      {
        startTime: effectiveStartTime,
        matchDurationMinutes: tournament.matchDurationMinutes,
        transitionTimeMinutes: tournament.transitionTimeMinutes,
      },
      pitches
    )

    const result = generateSchedule({
      tournamentId,
      stages: stageConfigs,
      timing: timingConfig,
      constraints: {
        restTime: {
          minimumRestMinutes,
          preferredRestMinutes,
        },
      },
    })

    let estimatedEndTime: Date | null = null
    if (result.matches.length > 0) {
      estimatedEndTime = result.matches.reduce(
        (latest, m) => m.scheduledEndTime > latest ? m.scheduledEndTime : latest,
        result.matches[0].scheduledEndTime
      )
    }

    return {
      success: result.success,
      data: {
        matchCount: result.matches.length,
        totalMatches: result.stats.totalMatches,
        totalDurationMinutes: result.stats.totalDuration,
        estimatedEndTime,
        pitchUtilization: result.stats.pitchUtilization,
        averageRestMinutes: result.stats.averageRestTime,
        warnings: result.warnings.map(w => w.message),
        errors: result.errors.map(e => e.message),
      },
      error: result.errors.length > 0 ? result.errors[0].message : undefined,
    }
  } catch (error) {
    logger.error('Failed to preview schedule', { error, input })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview schedule',
    }
  }
}
