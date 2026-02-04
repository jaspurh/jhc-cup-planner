'use server'

/**
 * Bracket Server Actions
 * 
 * Server actions for fetching bracket/knockout match data for visualization.
 */

import { db } from '@/lib/db'
import { ActionResult, ScheduledMatch, StageType } from '@/types'
import { logger } from '@/lib/logger'

// ==========================================
// Types
// ==========================================

export interface BracketStage {
  id: string
  name: string
  type: StageType
  order: number
  groups: {
    id: string
    name: string
  }[]
}

export interface BracketData {
  stage: BracketStage
  matches: ScheduledMatch[]
  // For GSL stages, matches grouped by group
  matchesByGroup?: Map<string, ScheduledMatch[]>
}

// ==========================================
// Get Bracket Stages for Tournament
// ==========================================

/**
 * Get all stages that support bracket visualization
 */
export async function getBracketStages(
  tournamentId: string
): Promise<ActionResult<BracketStage[]>> {
  try {
    const bracketTypes: StageType[] = ['KNOCKOUT', 'DOUBLE_ELIMINATION', 'FINAL', 'GSL_GROUPS']
    
    const stages = await db.stage.findMany({
      where: {
        tournamentId,
        type: { in: bracketTypes },
      },
      orderBy: { order: 'asc' },
      include: {
        groups: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const result: BracketStage[] = stages.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type as StageType,
      order: s.order,
      groups: s.groups,
    }))

    return { success: true, data: result }
  } catch (error) {
    logger.error('Failed to get bracket stages', { error, tournamentId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bracket stages',
    }
  }
}

// ==========================================
// Get Bracket Matches for Stage
// ==========================================

/**
 * Get all matches for a bracket stage, organized for visualization
 */
export async function getBracketMatches(
  stageId: string
): Promise<ActionResult<ScheduledMatch[]>> {
  try {
    const matches = await db.match.findMany({
      where: { stageId },
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
        { roundNumber: 'asc' },
        { bracketPosition: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    const scheduledMatches: ScheduledMatch[] = matches.map(m => ({
      id: m.id,
      matchNumber: m.matchNumber,
      roundNumber: m.roundNumber,
      bracketPosition: m.bracketPosition,
      scheduledStartTime: m.scheduledStartTime,
      scheduledEndTime: m.scheduledEndTime,
      status: m.status as ScheduledMatch['status'],
      stage: {
        id: m.stage.id,
        name: m.stage.name,
        type: m.stage.type as StageType,
      },
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
    logger.error('Failed to get bracket matches', { error, stageId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bracket matches',
    }
  }
}

// ==========================================
// Get GSL Group Bracket Matches
// ==========================================

/**
 * Get matches for a specific GSL group
 */
export async function getGSLGroupMatches(
  groupId: string
): Promise<ActionResult<ScheduledMatch[]>> {
  try {
    const matches = await db.match.findMany({
      where: { groupId },
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
        { bracketPosition: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    const scheduledMatches: ScheduledMatch[] = matches.map(m => ({
      id: m.id,
      matchNumber: m.matchNumber,
      roundNumber: m.roundNumber,
      bracketPosition: m.bracketPosition,
      scheduledStartTime: m.scheduledStartTime,
      scheduledEndTime: m.scheduledEndTime,
      status: m.status as ScheduledMatch['status'],
      stage: {
        id: m.stage.id,
        name: m.stage.name,
        type: m.stage.type as StageType,
      },
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
    logger.error('Failed to get GSL group matches', { error, groupId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get GSL group matches',
    }
  }
}
