'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  enterMatchResultSchema, 
  updateMatchResultSchema,
  type EnterMatchResultInput,
  type UpdateMatchResultInput 
} from '@/lib/schemas/match'
import type { ActionResult } from '@/types'

// ==========================================
// Enter Match Result
// ==========================================

/**
 * Enter a result for a match
 * Also handles knockout progression by updating dependent matches
 */
export async function enterMatchResult(
  input: EnterMatchResultInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = enterMatchResultSchema.parse(input)

    // Get match with stage and tournament info
    const match = await db.match.findUnique({
      where: { id: validated.matchId },
      include: {
        stage: {
          include: {
            tournament: {
              include: { event: true },
            },
          },
        },
        result: true,
      },
    })

    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    if (match.result) {
      return { success: false, error: 'Match already has a result. Use update instead.' }
    }

    // Create result and update match status
    const result = await db.$transaction(async (tx) => {
      // Create the result
      const matchResult = await tx.matchResult.create({
        data: {
          matchId: validated.matchId,
          homeScore: validated.homeScore,
          awayScore: validated.awayScore,
          homePenalties: validated.homePenalties,
          awayPenalties: validated.awayPenalties,
          notes: validated.notes,
          enteredById: session.user?.id,
        },
      })

      // Update match status to COMPLETED
      await tx.match.update({
        where: { id: validated.matchId },
        data: { 
          status: 'COMPLETED',
          actualEndTime: new Date(),
        },
      })

      // Handle knockout progression
      await handleKnockoutProgression(tx, match, validated.homeScore, validated.awayScore, validated.homePenalties, validated.awayPenalties)

      return matchResult
    })

    logger.info('Match result entered', { 
      matchId: validated.matchId, 
      homeScore: validated.homeScore, 
      awayScore: validated.awayScore 
    })

    const tournament = match.stage.tournament
    revalidatePath(`/events/${tournament.event.id}/tournaments/${tournament.id}/schedule`)

    return { success: true, data: { id: result.id } }
  } catch (error) {
    logger.error('Failed to enter match result', { error, input })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enter result',
    }
  }
}

// ==========================================
// Update Match Result
// ==========================================

/**
 * Update an existing match result
 */
export async function updateMatchResult(
  input: UpdateMatchResultInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateMatchResultSchema.parse(input)

    const match = await db.match.findUnique({
      where: { id: validated.matchId },
      include: {
        stage: {
          include: {
            tournament: {
              include: { event: true },
            },
          },
        },
        result: true,
      },
    })

    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    if (!match.result) {
      return { success: false, error: 'Match has no result to update' }
    }

    // Update result and mark match as completed
    const result = await db.$transaction(async (tx) => {
      const updatedResult = await tx.matchResult.update({
        where: { matchId: validated.matchId },
        data: {
          homeScore: validated.homeScore ?? match.result!.homeScore,
          awayScore: validated.awayScore ?? match.result!.awayScore,
          homePenalties: validated.homePenalties,
          awayPenalties: validated.awayPenalties,
          notes: validated.notes,
        },
      })

      // Mark match as completed
      await tx.match.update({
        where: { id: validated.matchId },
        data: {
          status: 'COMPLETED',
          actualEndTime: new Date(),
        },
      })

      return updatedResult
    })

    // If scores changed, re-handle knockout progression
    if (validated.homeScore !== undefined || validated.awayScore !== undefined) {
      const newHomeScore = validated.homeScore ?? match.result.homeScore
      const newAwayScore = validated.awayScore ?? match.result.awayScore
      await handleKnockoutProgression(
        db, 
        match, 
        newHomeScore, 
        newAwayScore, 
        validated.homePenalties ?? match.result.homePenalties,
        validated.awayPenalties ?? match.result.awayPenalties
      )
    }

    logger.info('Match result updated', { matchId: validated.matchId })

    const tournament = match.stage.tournament
    revalidatePath(`/events/${tournament.event.id}/tournaments/${tournament.id}/schedule`)

    return { success: true, data: { id: result.id } }
  } catch (error) {
    logger.error('Failed to update match result', { error, input })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update result',
    }
  }
}

// ==========================================
// Delete Match Result
// ==========================================

/**
 * Delete a match result (revert to scheduled)
 */
export async function deleteMatchResult(
  matchId: string
): Promise<ActionResult<void>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        stage: {
          include: {
            tournament: {
              include: { event: true },
            },
          },
        },
        result: true,
      },
    })

    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    if (!match.result) {
      return { success: false, error: 'Match has no result to delete' }
    }

    await db.$transaction(async (tx) => {
      // Delete the result
      await tx.matchResult.delete({
        where: { matchId },
      })

      // Revert match status to SCHEDULED
      await tx.match.update({
        where: { id: matchId },
        data: { 
          status: 'SCHEDULED',
          actualEndTime: null,
        },
      })

      // Clear any dependent knockout progressions
      await clearKnockoutProgression(tx, match)
    })

    logger.info('Match result deleted', { matchId })

    const tournament = match.stage.tournament
    revalidatePath(`/events/${tournament.event.id}/tournaments/${tournament.id}/schedule`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to delete match result', { error, matchId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete result',
    }
  }
}

// ==========================================
// Start Match (set to IN_PROGRESS)
// ==========================================

// ==========================================
// Save Live Score (without completing match)
// ==========================================

/**
 * Save a live/temporary score without completing the match
 * Used for showing in-progress scores
 */
export async function saveLiveScore(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        stage: {
          include: {
            tournament: {
              include: { event: true },
            },
          },
        },
        result: true,
      },
    })

    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    // Start the match if not already started
    const newStatus = match.status === 'SCHEDULED' ? 'IN_PROGRESS' : match.status

    if (match.result) {
      // Update existing result
      await db.$transaction([
        db.matchResult.update({
          where: { matchId },
          data: { homeScore, awayScore },
        }),
        db.match.update({
          where: { id: matchId },
          data: { 
            status: newStatus,
            actualStartTime: match.actualStartTime || new Date(),
          },
        }),
      ])
    } else {
      // Create new result
      await db.$transaction([
        db.matchResult.create({
          data: {
            matchId,
            homeScore,
            awayScore,
            enteredById: session.user?.id,
          },
        }),
        db.match.update({
          where: { id: matchId },
          data: { 
            status: newStatus,
            actualStartTime: match.actualStartTime || new Date(),
          },
        }),
      ])
    }

    logger.info('Live score saved', { matchId, homeScore, awayScore })

    const tournament = match.stage.tournament
    revalidatePath(`/events/${tournament.event.id}/tournaments/${tournament.id}/schedule`)

    return { success: true, data: { id: matchId } }
  } catch (error) {
    logger.error('Failed to save live score', { error, matchId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save live score',
    }
  }
}

// ==========================================
// Start Match (set to IN_PROGRESS)
// ==========================================

export async function startMatch(matchId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        stage: {
          include: {
            tournament: {
              include: { event: true },
            },
          },
        },
      },
    })

    if (!match) {
      return { success: false, error: 'Match not found' }
    }

    if (match.status !== 'SCHEDULED') {
      return { success: false, error: 'Can only start scheduled matches' }
    }

    await db.match.update({
      where: { id: matchId },
      data: { 
        status: 'IN_PROGRESS',
        actualStartTime: new Date(),
      },
    })

    logger.info('Match started', { matchId })

    const tournament = match.stage.tournament
    revalidatePath(`/events/${tournament.event.id}/tournaments/${tournament.id}/schedule`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to start match', { error, matchId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start match',
    }
  }
}

// ==========================================
// Helper: Handle Knockout Progression
// ==========================================

type PrismaTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function handleKnockoutProgression(
  tx: PrismaTransaction | typeof db,
  match: {
    id: string
    bracketPosition: string | null
    homeRegistrationId: string | null
    awayRegistrationId: string | null
    stageId: string
    stage: { type: string }
  },
  homeScore: number,
  awayScore: number,
  homePenalties?: number | null,
  awayPenalties?: number | null
): Promise<void> {
  // Only handle knockout/elimination stages
  const knockoutTypes = ['KNOCKOUT', 'DOUBLE_ELIMINATION', 'FINAL']
  if (!knockoutTypes.includes(match.stage.type)) {
    return
  }

  // Determine winner
  let winnerId: string | null = null
  let loserId: string | null = null

  if (homeScore > awayScore) {
    winnerId = match.homeRegistrationId
    loserId = match.awayRegistrationId
  } else if (awayScore > homeScore) {
    winnerId = match.awayRegistrationId
    loserId = match.homeRegistrationId
  } else if (homePenalties != null && awayPenalties != null) {
    // Decided by penalties (use != null to check for both null and undefined)
    const homePen = homePenalties as number
    const awayPen = awayPenalties as number
    if (homePen > awayPen) {
      winnerId = match.homeRegistrationId
      loserId = match.awayRegistrationId
    } else if (awayPen > homePen) {
      winnerId = match.awayRegistrationId
      loserId = match.homeRegistrationId
    }
  }

  if (!winnerId) {
    // Draw with no penalty result - can't progress
    return
  }

  // Find matches that depend on this match's winner
  // Convention: homeTeamSource or awayTeamSource contains "Winner M{matchNumber}" or similar
  const dependentMatches = await tx.match.findMany({
    where: {
      stageId: match.stageId,
      OR: [
        { homeTeamSource: { contains: `Winner` } },
        { awayTeamSource: { contains: `Winner` } },
      ],
    },
  })

  // Match pattern: "Winner M1", "Winner Match 1", etc.
  const matchIdPattern = new RegExp(`Winner.*${match.bracketPosition}|Winner.*M${match.bracketPosition}`, 'i')
  
  for (const depMatch of dependentMatches) {
    let updateData: { homeRegistrationId?: string; awayRegistrationId?: string } = {}
    
    if (depMatch.homeTeamSource && matchIdPattern.test(depMatch.homeTeamSource)) {
      updateData.homeRegistrationId = winnerId
    }
    if (depMatch.awayTeamSource && matchIdPattern.test(depMatch.awayTeamSource)) {
      updateData.awayRegistrationId = winnerId
    }

    if (Object.keys(updateData).length > 0) {
      await tx.match.update({
        where: { id: depMatch.id },
        data: updateData,
      })
    }
  }

  // Also check for loser bracket matches in double elimination
  if (match.stage.type === 'DOUBLE_ELIMINATION' && loserId) {
    const loserPattern = new RegExp(`Loser.*${match.bracketPosition}|Loser.*M${match.bracketPosition}`, 'i')
    
    for (const depMatch of dependentMatches) {
      let updateData: { homeRegistrationId?: string; awayRegistrationId?: string } = {}
      
      if (depMatch.homeTeamSource && loserPattern.test(depMatch.homeTeamSource)) {
        updateData.homeRegistrationId = loserId
      }
      if (depMatch.awayTeamSource && loserPattern.test(depMatch.awayTeamSource)) {
        updateData.awayRegistrationId = loserId
      }

      if (Object.keys(updateData).length > 0) {
        await tx.match.update({
          where: { id: depMatch.id },
          data: updateData,
        })
      }
    }
  }
}

// ==========================================
// Helper: Clear Knockout Progression
// ==========================================

async function clearKnockoutProgression(
  tx: PrismaTransaction | typeof db,
  match: {
    id: string
    bracketPosition: string | null
    stageId: string
    stage: { type: string }
  }
): Promise<void> {
  const knockoutTypes = ['KNOCKOUT', 'DOUBLE_ELIMINATION', 'FINAL']
  if (!knockoutTypes.includes(match.stage.type)) {
    return
  }

  // Find matches that might have been populated from this match
  const dependentMatches = await tx.match.findMany({
    where: {
      stageId: match.stageId,
      OR: [
        { homeTeamSource: { contains: `Winner` } },
        { awayTeamSource: { contains: `Winner` } },
        { homeTeamSource: { contains: `Loser` } },
        { awayTeamSource: { contains: `Loser` } },
      ],
    },
  })

  const matchPattern = new RegExp(`(Winner|Loser).*${match.bracketPosition}|M${match.bracketPosition}`, 'i')

  for (const depMatch of dependentMatches) {
    let updateData: { homeRegistrationId?: null; awayRegistrationId?: null } = {}
    
    if (depMatch.homeTeamSource && matchPattern.test(depMatch.homeTeamSource)) {
      updateData.homeRegistrationId = null
    }
    if (depMatch.awayTeamSource && matchPattern.test(depMatch.awayTeamSource)) {
      updateData.awayRegistrationId = null
    }

    if (Object.keys(updateData).length > 0) {
      await tx.match.update({
        where: { id: depMatch.id },
        data: updateData,
      })
    }
  }
}

// ==========================================
// Get Group Standings
// ==========================================

export interface TeamStanding {
  registrationId: string
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  position: number
}

export interface GroupStandings {
  groupId: string
  groupName: string
  standings: TeamStanding[]
}

/**
 * Calculate standings for a group stage
 */
export async function getGroupStandings(
  stageId: string
): Promise<ActionResult<GroupStandings[]>> {
  try {
    const stage = await db.stage.findUnique({
      where: { id: stageId },
      include: {
        groups: {
          orderBy: { order: 'asc' },
          include: {
            teamAssignments: {
              include: {
                registration: {
                  include: { team: true },
                },
              },
            },
          },
        },
        matches: {
          where: { status: 'COMPLETED' },
          include: {
            result: true,
            homeTeam: {
              include: { team: true },
            },
            awayTeam: {
              include: { team: true },
            },
          },
        },
      },
    })

    if (!stage) {
      return { success: false, error: 'Stage not found' }
    }

    const groupStandings: GroupStandings[] = []

    for (const group of stage.groups) {
      // Initialize standings for all teams in group
      const standingsMap = new Map<string, TeamStanding>()
      
      for (const assignment of group.teamAssignments) {
        standingsMap.set(assignment.registrationId, {
          registrationId: assignment.registrationId,
          teamName: assignment.registration.registeredTeamName || assignment.registration.team.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          position: 0,
        })
      }

      // Process matches for this group
      const groupMatches = stage.matches.filter(m => m.groupId === group.id)
      
      for (const match of groupMatches) {
        if (!match.result || !match.homeRegistrationId || !match.awayRegistrationId) {
          continue
        }

        const homeStanding = standingsMap.get(match.homeRegistrationId)
        const awayStanding = standingsMap.get(match.awayRegistrationId)

        if (!homeStanding || !awayStanding) {
          continue
        }

        const { homeScore, awayScore } = match.result

        // Update played
        homeStanding.played++
        awayStanding.played++

        // Update goals
        homeStanding.goalsFor += homeScore
        homeStanding.goalsAgainst += awayScore
        awayStanding.goalsFor += awayScore
        awayStanding.goalsAgainst += homeScore

        // Update results
        if (homeScore > awayScore) {
          homeStanding.won++
          homeStanding.points += 3
          awayStanding.lost++
        } else if (awayScore > homeScore) {
          awayStanding.won++
          awayStanding.points += 3
          homeStanding.lost++
        } else {
          homeStanding.drawn++
          awayStanding.drawn++
          homeStanding.points += 1
          awayStanding.points += 1
        }
      }

      // Calculate goal difference and sort
      const standings = Array.from(standingsMap.values())
      standings.forEach(s => {
        s.goalDifference = s.goalsFor - s.goalsAgainst
      })

      // Sort by: points, goal difference, goals for
      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference
        return b.goalsFor - a.goalsFor
      })

      // Assign positions
      standings.forEach((s, i) => {
        s.position = i + 1
      })

      groupStandings.push({
        groupId: group.id,
        groupName: group.name,
        standings,
      })
    }

    return { success: true, data: groupStandings }
  } catch (error) {
    logger.error('Failed to get group standings', { error, stageId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get standings',
    }
  }
}
