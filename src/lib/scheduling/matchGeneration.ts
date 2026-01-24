/**
 * Match Generation Module
 * 
 * Generates matches for different tournament formats:
 * - Round-Robin (single/double)
 * - GSL Groups (5-match dual tournament)
 * - Knockout (single elimination)
 * - Double Elimination
 */

import { RoundRobinType } from '@/types'
import {
  GeneratedMatch,
  TeamSlot,
  StageConfig,
  GSLMatchPosition,
  IncomingTeamSlot,
} from './types'

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generate a unique temporary ID for a match
 */
function generateTempId(stageId: string, groupId: string | undefined, matchNum: number): string {
  const groupPart = groupId ? `-${groupId.slice(-4)}` : ''
  return `${stageId.slice(-6)}${groupPart}-M${matchNum}`
}

/**
 * Create a base match object
 */
function createBaseMatch(
  stageId: string,
  groupId: string | undefined,
  matchNumber: number,
  roundNumber: number,
  homeId: string | null,
  awayId: string | null
): GeneratedMatch {
  return {
    tempId: generateTempId(stageId, groupId, matchNumber),
    stageId,
    groupId,
    homeRegistrationId: homeId,
    awayRegistrationId: awayId,
    matchNumber,
    roundNumber,
    dependsOn: [],
  }
}

// ==========================================
// Round-Robin Match Generation
// ==========================================

/**
 * Generate round-robin matches for a group of teams
 * Uses the "circle method" for balanced scheduling
 * 
 * @param teams - Teams in the group
 * @param roundRobinType - SINGLE or DOUBLE round-robin
 * @param stageId - Stage ID
 * @param groupId - Group ID (optional for single-pool tournaments)
 * @returns Array of generated matches
 */
export function generateRoundRobinMatches(
  teams: TeamSlot[],
  roundRobinType: RoundRobinType,
  stageId: string,
  groupId?: string
): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []
  const n = teams.length
  
  if (n < 2) {
    return matches
  }

  // Circle method: fix one team, rotate others
  // For odd number of teams, add a "bye" team
  const teamList = [...teams]
  const hasBye = n % 2 === 1
  if (hasBye) {
    teamList.push({ registrationId: 'BYE', seedPosition: -1 })
  }

  const numTeams = teamList.length
  const numRounds = numTeams - 1
  let matchNumber = 1

  // Generate first leg (or only leg for SINGLE)
  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < numTeams / 2; i++) {
      const home = teamList[i]
      const away = teamList[numTeams - 1 - i]

      // Skip bye matches
      if (home.registrationId === 'BYE' || away.registrationId === 'BYE') {
        continue
      }

      // Alternate home/away for fairness
      const isHomeFirst = (round + i) % 2 === 0
      const match = createBaseMatch(
        stageId,
        groupId,
        matchNumber++,
        round + 1,
        isHomeFirst ? home.registrationId : away.registrationId,
        isHomeFirst ? away.registrationId : home.registrationId
      )
      matches.push(match)
    }

    // Rotate teams (keep first team fixed)
    const lastTeam = teamList.pop()!
    teamList.splice(1, 0, lastTeam)
  }

  // Generate second leg for DOUBLE round-robin
  if (roundRobinType === 'DOUBLE') {
    const firstLegMatches = [...matches]
    for (const firstLeg of firstLegMatches) {
      const match = createBaseMatch(
        stageId,
        groupId,
        matchNumber++,
        numRounds + Math.floor((matchNumber - firstLegMatches.length - 1) / (numTeams / 2)) + 1,
        firstLeg.awayRegistrationId, // Swap home/away
        firstLeg.homeRegistrationId
      )
      match.metadata = {
        ...match.metadata,
        homeSource: `Return leg of match ${firstLeg.matchNumber}`,
      }
      matches.push(match)
    }
  }

  return matches
}

// ==========================================
// GSL Group Match Generation (5-match format)
// ==========================================

/**
 * GSL (Global StarCraft League) dual tournament format:
 * 
 *         M1: A vs B          M2: C vs D
 *              |                   |
 *         Winner M1           Winner M2
 *              |                   |
 *              +----> M3 <--------+     (Winners Match)
 *              |                   |
 *         Loser M1            Loser M2
 *              |                   |
 *              +----> M4 <--------+     (Losers Match)
 *                      |
 *                 Winner M4
 *                      |
 *         Loser M3 ----> M5 <---- Winner M4  (Decider Match)
 * 
 * Results:
 * - Winner of M3: 1st place (advances)
 * - Winner of M5: 2nd place (advances)
 * - Loser of M4: 4th place (eliminated)
 * - Loser of M5: 3rd place (eliminated)
 */
export function generateGSLMatches(
  teams: TeamSlot[],
  stageId: string,
  groupId: string,
  groupName?: string
): GeneratedMatch[] {
  // GSL requires exactly 4 teams, but we can generate with placeholders if teams not yet assigned
  const hasTeams = teams.length === 4
  
  // Sort by seed position if available
  const sortedTeams = hasTeams 
    ? [...teams].sort((a, b) => (a.seedPosition ?? 999) - (b.seedPosition ?? 999))
    : []

  const teamA = sortedTeams[0] || null
  const teamB = sortedTeams[1] || null
  const teamC = sortedTeams[2] || null
  const teamD = sortedTeams[3] || null
  
  const matches: GeneratedMatch[] = []
  const baseId = (pos: GSLMatchPosition) => `${stageId.slice(-6)}-${groupId.slice(-4)}-${pos}`
  const groupLabel = groupName || 'Group'

  // M1: A vs B (Opening Match 1)
  matches.push({
    tempId: baseId('M1'),
    stageId,
    groupId,
    homeRegistrationId: teamA?.registrationId || null,
    awayRegistrationId: teamB?.registrationId || null,
    matchNumber: 1,
    roundNumber: 1,
    bracketPosition: 'M1',
    dependsOn: [],
    metadata: {
      homeSource: hasTeams ? `Seed 1` : `${groupLabel} Slot 1`,
      awaySource: hasTeams ? `Seed 2` : `${groupLabel} Slot 2`,
    },
  })

  // M2: C vs D (Opening Match 2)
  matches.push({
    tempId: baseId('M2'),
    stageId,
    groupId,
    homeRegistrationId: teamC?.registrationId || null,
    awayRegistrationId: teamD?.registrationId || null,
    matchNumber: 2,
    roundNumber: 1,
    bracketPosition: 'M2',
    dependsOn: [],
    metadata: {
      homeSource: hasTeams ? `Seed 3` : `${groupLabel} Slot 3`,
      awaySource: hasTeams ? `Seed 4` : `${groupLabel} Slot 4`,
    },
  })

  // M3: Winner M1 vs Winner M2 (Winners Match)
  matches.push({
    tempId: baseId('M3'),
    stageId,
    groupId,
    homeRegistrationId: null, // TBD
    awayRegistrationId: null, // TBD
    matchNumber: 3,
    roundNumber: 2,
    bracketPosition: 'M3',
    dependsOn: [baseId('M1'), baseId('M2')],
    metadata: {
      homeSource: 'Winner of M1',
      awaySource: 'Winner of M2',
    },
  })

  // M4: Loser M1 vs Loser M2 (Losers Match - Elimination)
  matches.push({
    tempId: baseId('M4'),
    stageId,
    groupId,
    homeRegistrationId: null, // TBD
    awayRegistrationId: null, // TBD
    matchNumber: 4,
    roundNumber: 2,
    bracketPosition: 'M4',
    dependsOn: [baseId('M1'), baseId('M2')],
    metadata: {
      homeSource: 'Loser of M1',
      awaySource: 'Loser of M2',
    },
  })

  // M5: Loser M3 vs Winner M4 (Decider Match)
  matches.push({
    tempId: baseId('M5'),
    stageId,
    groupId,
    homeRegistrationId: null, // TBD
    awayRegistrationId: null, // TBD
    matchNumber: 5,
    roundNumber: 3,
    bracketPosition: 'M5',
    dependsOn: [baseId('M3'), baseId('M4')],
    metadata: {
      homeSource: 'Loser of M3',
      awaySource: 'Winner of M4',
      isDecider: true,
    },
  })

  return matches
}

// ==========================================
// Knockout Match Generation (Single Elimination)
// ==========================================

/**
 * Generate single elimination bracket matches
 * 
 * @param teamCount - Number of teams in the bracket
 * @param stageId - Stage ID
 * @param seedOrder - Optional seed order for matchups (legacy, use incomingTeams instead)
 * @param incomingTeams - Teams coming from previous stages with source labels
 * @param hasThirdPlace - Whether to include a 3rd place match
 * @returns Array of generated matches
 */
export function generateKnockoutMatches(
  teamCount: number,
  stageId: string,
  seedOrder?: string[],
  incomingTeams?: IncomingTeamSlot[],
  hasThirdPlace: boolean = false
): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []
  
  // Calculate bracket size (must be power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)))
  const numRounds = Math.log2(bracketSize)

  // Build a map of seed -> source info
  const seedSourceMap = new Map<number, IncomingTeamSlot>()
  if (incomingTeams) {
    for (const team of incomingTeams) {
      seedSourceMap.set(team.seedPosition, team)
    }
  }

  // Generate round names
  const roundNames: Record<number, string> = {
    1: bracketSize === 2 ? 'F' : bracketSize === 4 ? 'SF' : bracketSize === 8 ? 'QF' : 'R1',
    2: bracketSize === 4 ? 'F' : bracketSize === 8 ? 'SF' : bracketSize === 16 ? 'QF' : 'R2',
    3: bracketSize === 8 ? 'F' : bracketSize === 16 ? 'SF' : 'R3',
    4: bracketSize === 16 ? 'F' : 'SF',
    5: 'F',
  }

  // Standard bracket seeding for first round
  // 1 vs 16, 8 vs 9, 5 vs 12, 4 vs 13, 3 vs 14, 6 vs 11, 7 vs 10, 2 vs 15
  function getStandardSeedMatchup(bracketSize: number): number[][] {
    if (bracketSize === 2) return [[1, 2]]
    if (bracketSize === 4) return [[1, 4], [2, 3]]
    if (bracketSize === 8) return [[1, 8], [4, 5], [3, 6], [2, 7]]
    if (bracketSize === 16) return [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]]
    // For larger brackets, generate programmatically
    const matchups: number[][] = []
    for (let i = 0; i < bracketSize / 2; i++) {
      matchups.push([i + 1, bracketSize - i])
    }
    return matchups
  }

  let matchNumber = 1
  const matchIdsByRound: Map<number, string[]> = new Map()

  // Generate first round matches
  const firstRoundMatchups = getStandardSeedMatchup(bracketSize)
  const firstRoundIds: string[] = []

  for (let i = 0; i < firstRoundMatchups.length; i++) {
    const [seed1, seed2] = firstRoundMatchups[i]
    const roundName = roundNames[1] || `R1`
    const bracketPos = `${roundName}${i + 1}`
    const tempId = `${stageId.slice(-6)}-${bracketPos}`

    // Get team info from incoming teams or seed order
    const homeIncoming = seedSourceMap.get(seed1)
    const awayIncoming = seedSourceMap.get(seed2)
    
    // Determine registration IDs (from incoming teams, seed order, or null)
    const homeId = homeIncoming?.registrationId ?? (seed1 <= teamCount ? (seedOrder?.[seed1 - 1] ?? null) : null)
    const awayId = awayIncoming?.registrationId ?? (seed2 <= teamCount ? (seedOrder?.[seed2 - 1] ?? null) : null)
    
    // Determine source labels
    const homeSource = homeIncoming?.sourceLabel ?? `Seed ${seed1}`
    const awaySource = awayIncoming?.sourceLabel ?? `Seed ${seed2}`
    
    // Only skip if BOTH teams are truly missing (byes for bracket padding)
    const isBye = seed1 > teamCount && seed2 > teamCount

    if (!isBye) {
      const match: GeneratedMatch = {
        tempId,
        stageId,
        groupId: undefined,
        homeRegistrationId: homeId,
        awayRegistrationId: awayId,
        matchNumber: matchNumber++,
        roundNumber: 1,
        bracketPosition: bracketPos,
        dependsOn: [],
        metadata: {
          homeSource,
          awaySource,
        },
      }
      matches.push(match)
      firstRoundIds.push(tempId)
    } else {
      // For byes, the non-null team advances automatically
      // We still record the position for dependency tracking
      firstRoundIds.push(`BYE-${bracketPos}`)
    }
  }
  matchIdsByRound.set(1, firstRoundIds)

  // Generate subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const prevRoundIds = matchIdsByRound.get(round - 1) || []
    const roundIds: string[] = []
    const matchesInRound = prevRoundIds.length / 2
    const roundName = roundNames[round] || `R${round}`

    for (let i = 0; i < matchesInRound; i++) {
      const bracketPos = matchesInRound === 1 ? roundName : `${roundName}${i + 1}`
      const tempId = `${stageId.slice(-6)}-${bracketPos}`

      const dep1 = prevRoundIds[i * 2]
      const dep2 = prevRoundIds[i * 2 + 1]

      // Filter out bye dependencies
      const realDeps = [dep1, dep2].filter(d => !d.startsWith('BYE-'))

      const match: GeneratedMatch = {
        tempId,
        stageId,
        groupId: undefined,
        homeRegistrationId: null, // TBD
        awayRegistrationId: null, // TBD
        matchNumber: matchNumber++,
        roundNumber: round,
        bracketPosition: bracketPos,
        dependsOn: realDeps,
        metadata: {
          homeSource: dep1.startsWith('BYE-') ? 'Bye' : `Winner of ${dep1.split('-').pop()}`,
          awaySource: dep2.startsWith('BYE-') ? 'Bye' : `Winner of ${dep2.split('-').pop()}`,
        },
      }
      matches.push(match)
      roundIds.push(tempId)
    }
    matchIdsByRound.set(round, roundIds)
  }

  // Add 3rd place match if requested and we have semifinals (4+ teams)
  if (hasThirdPlace && numRounds >= 2) {
    const semifinalIds = matchIdsByRound.get(numRounds - 1) || []
    if (semifinalIds.length === 2) {
      const thirdPlaceMatch: GeneratedMatch = {
        tempId: `${stageId.slice(-6)}-3P`,
        stageId,
        groupId: undefined,
        homeRegistrationId: null,
        awayRegistrationId: null,
        matchNumber: matchNumber++,
        roundNumber: numRounds, // Same round as final but scheduled before
        bracketPosition: '3P',
        dependsOn: semifinalIds.filter(id => !id.startsWith('BYE-')),
        metadata: {
          homeSource: `Loser of ${semifinalIds[0].split('-').pop()}`,
          awaySource: `Loser of ${semifinalIds[1].split('-').pop()}`,
          isThirdPlace: true,
        },
      }
      matches.push(thirdPlaceMatch)
    }
  }

  return matches
}

// ==========================================
// Double Elimination Match Generation
// ==========================================

/**
 * Generate double elimination bracket matches
 * Teams must lose twice to be eliminated
 * 
 * @param teamCount - Number of teams
 * @param stageId - Stage ID
 * @param seedOrder - Optional seed order
 * @returns Array of generated matches
 */
export function generateDoubleEliminationMatches(
  teamCount: number,
  stageId: string,
  seedOrder?: string[]
): GeneratedMatch[] {
  const matches: GeneratedMatch[] = []
  
  // Calculate bracket sizes
  const winnersBracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)))
  const numWinnersRounds = Math.log2(winnersBracketSize)
  
  let matchNumber = 1

  // Generate Winners Bracket (same as single elimination)
  const winnersMatches = generateKnockoutMatches(teamCount, stageId, seedOrder)
  
  // Rename and tag as winners bracket
  for (const match of winnersMatches) {
    match.tempId = `${stageId.slice(-6)}-W-${match.bracketPosition}`
    match.bracketPosition = `W-${match.bracketPosition}`
    match.matchNumber = matchNumber++
    match.metadata = {
      ...match.metadata,
      bracketType: 'winners',
    }
    // Update dependencies to winners bracket format
    match.dependsOn = match.dependsOn.map(d => {
      if (d.startsWith('BYE-')) return d
      const pos = d.split('-').pop()
      return `${stageId.slice(-6)}-W-${pos}`
    })
    matches.push(match)
  }

  // Generate Losers Bracket
  // Losers bracket has more rounds: for N winners rounds, we have 2*(N-1) losers rounds
  // Round 1: Losers from W-R1
  // Round 2: Winners of LB-R1 vs Losers from W-R2
  // etc.

  const losersRounds = 2 * (numWinnersRounds - 1)
  const loserMatchIdsByRound: Map<number, string[]> = new Map()

  // First losers round: losers from first winners round play each other
  const firstWinnersRoundMatches = winnersMatches.filter(m => m.roundNumber === 1)
  const lbR1Ids: string[] = []
  
  for (let i = 0; i < firstWinnersRoundMatches.length / 2; i++) {
    const bracketPos = `LB-R1-${i + 1}`
    const tempId = `${stageId.slice(-6)}-${bracketPos}`
    
    const dep1 = firstWinnersRoundMatches[i * 2]
    const dep2 = firstWinnersRoundMatches[i * 2 + 1]

    const match: GeneratedMatch = {
      tempId,
      stageId,
      groupId: undefined,
      homeRegistrationId: null,
      awayRegistrationId: null,
      matchNumber: matchNumber++,
      roundNumber: 1,
      bracketPosition: bracketPos,
      dependsOn: [dep1.tempId, dep2.tempId],
      metadata: {
        homeSource: `Loser of ${dep1.bracketPosition}`,
        awaySource: `Loser of ${dep2.bracketPosition}`,
        bracketType: 'losers',
      },
    }
    matches.push(match)
    lbR1Ids.push(tempId)
  }
  loserMatchIdsByRound.set(1, lbR1Ids)

  // Subsequent losers rounds alternate between:
  // - Playing among themselves (shrink)
  // - Receiving drop-downs from winners bracket
  let currentLBMatches = lbR1Ids
  let winnersRound = 2

  for (let lbRound = 2; lbRound <= losersRounds; lbRound++) {
    const isDropDownRound = lbRound % 2 === 0
    const roundIds: string[] = []

    if (isDropDownRound && winnersRound <= numWinnersRounds) {
      // This round receives losers from winners bracket
      const droppingMatches = winnersMatches.filter(m => m.roundNumber === winnersRound)
      
      for (let i = 0; i < currentLBMatches.length; i++) {
        const bracketPos = `LB-R${lbRound}-${i + 1}`
        const tempId = `${stageId.slice(-6)}-${bracketPos}`
        
        const lbWinner = currentLBMatches[i]
        const wbLoser = droppingMatches[i % droppingMatches.length]

        const match: GeneratedMatch = {
          tempId,
          stageId,
          groupId: undefined,
          homeRegistrationId: null,
          awayRegistrationId: null,
          matchNumber: matchNumber++,
          roundNumber: lbRound,
          bracketPosition: bracketPos,
          dependsOn: [lbWinner, wbLoser.tempId],
          metadata: {
            homeSource: `Winner of ${lbWinner.split('-').slice(-2).join('-')}`,
            awaySource: `Loser of ${wbLoser.bracketPosition}`,
            bracketType: 'losers',
          },
        }
        matches.push(match)
        roundIds.push(tempId)
      }
      winnersRound++
    } else {
      // Shrink round: LB winners play each other
      for (let i = 0; i < currentLBMatches.length / 2; i++) {
        const bracketPos = `LB-R${lbRound}-${i + 1}`
        const tempId = `${stageId.slice(-6)}-${bracketPos}`

        const match: GeneratedMatch = {
          tempId,
          stageId,
          groupId: undefined,
          homeRegistrationId: null,
          awayRegistrationId: null,
          matchNumber: matchNumber++,
          roundNumber: lbRound,
          bracketPosition: bracketPos,
          dependsOn: [currentLBMatches[i * 2], currentLBMatches[i * 2 + 1]],
          metadata: {
            homeSource: `Winner of LB-R${lbRound - 1}`,
            awaySource: `Winner of LB-R${lbRound - 1}`,
            bracketType: 'losers',
          },
        }
        matches.push(match)
        roundIds.push(tempId)
      }
    }

    loserMatchIdsByRound.set(lbRound, roundIds)
    currentLBMatches = roundIds
  }

  // Grand Final: Winners bracket champion vs Losers bracket champion
  const wbFinal = winnersMatches.find(m => m.bracketPosition?.includes('W-F'))
  const lbFinal = currentLBMatches[0]

  if (wbFinal && lbFinal) {
    const grandFinal: GeneratedMatch = {
      tempId: `${stageId.slice(-6)}-GF`,
      stageId,
      groupId: undefined,
      homeRegistrationId: null,
      awayRegistrationId: null,
      matchNumber: matchNumber++,
      roundNumber: numWinnersRounds + 1,
      bracketPosition: 'GF',
      dependsOn: [wbFinal.tempId, lbFinal],
      metadata: {
        homeSource: 'Winners Bracket Champion',
        awaySource: 'Losers Bracket Champion',
        bracketType: 'grand_final',
      },
    }
    matches.push(grandFinal)

    // Grand Final Reset (if LB champion wins first GF)
    const grandFinalReset: GeneratedMatch = {
      tempId: `${stageId.slice(-6)}-GF-R`,
      stageId,
      groupId: undefined,
      homeRegistrationId: null,
      awayRegistrationId: null,
      matchNumber: matchNumber++,
      roundNumber: numWinnersRounds + 2,
      bracketPosition: 'GF-R',
      dependsOn: [`${stageId.slice(-6)}-GF`],
      metadata: {
        homeSource: 'If LB Champion wins GF',
        awaySource: 'Bracket Reset Match',
        bracketType: 'grand_final',
        isDecider: true,
      },
    }
    matches.push(grandFinalReset)
  }

  return matches
}

// ==========================================
// Stage Match Generation Orchestrator
// ==========================================

/**
 * Generate all matches for a stage based on its type
 */
export function generateStageMatches(stage: StageConfig): GeneratedMatch[] {
  switch (stage.type) {
    case 'GROUP_STAGE':
      if (!stage.groups || stage.groups.length === 0) {
        throw new Error('GROUP_STAGE requires groups')
      }
      return stage.groups.flatMap(group =>
        generateRoundRobinMatches(group.teams, group.roundRobinType, stage.stageId, group.groupId)
      )

    case 'GSL_GROUPS':
      if (!stage.groups || stage.groups.length === 0) {
        throw new Error('GSL_GROUPS requires groups')
      }
      return stage.groups.flatMap(group =>
        generateGSLMatches(group.teams, stage.stageId, group.groupId, group.groupName)
      )

    case 'ROUND_ROBIN':
      // Single pool round-robin (no groups)
      const allTeams = stage.groups?.[0]?.teams || []
      const rrType = stage.groups?.[0]?.roundRobinType || 'SINGLE'
      return generateRoundRobinMatches(allTeams, rrType, stage.stageId)

    case 'KNOCKOUT':
      const knockoutTeamCount = stage.advancingTeamCount || 0
      const hasThirdPlace = (stage.customConfig as { hasThirdPlace?: boolean })?.hasThirdPlace || false
      return generateKnockoutMatches(knockoutTeamCount, stage.stageId, undefined, stage.incomingTeams, hasThirdPlace)

    case 'DOUBLE_ELIMINATION':
      const deTeamCount = stage.advancingTeamCount || 0
      return generateDoubleEliminationMatches(deTeamCount, stage.stageId)

    case 'FINAL':
      // Finals stage - get source labels from incoming teams or use defaults
      const finalist1 = stage.incomingTeams?.find(t => t.seedPosition === 1)
      const finalist2 = stage.incomingTeams?.find(t => t.seedPosition === 2)
      const matches: GeneratedMatch[] = [{
        tempId: `${stage.stageId.slice(-6)}-F`,
        stageId: stage.stageId,
        groupId: undefined,
        homeRegistrationId: finalist1?.registrationId ?? null,
        awayRegistrationId: finalist2?.registrationId ?? null,
        matchNumber: 1,
        roundNumber: 1,
        bracketPosition: 'F',
        dependsOn: [],
        metadata: {
          homeSource: finalist1?.sourceLabel ?? 'Finalist 1',
          awaySource: finalist2?.sourceLabel ?? 'Finalist 2',
        },
      }]
      
      // Check if there's a 3rd place match
      const includeThirdPlace = (stage.customConfig as { hasThirdPlace?: boolean })?.hasThirdPlace
      if (includeThirdPlace) {
        const thirdPlace1 = stage.incomingTeams?.find(t => t.seedPosition === 3)
        const thirdPlace2 = stage.incomingTeams?.find(t => t.seedPosition === 4)
        matches.push({
          tempId: `${stage.stageId.slice(-6)}-3P`,
          stageId: stage.stageId,
          groupId: undefined,
          homeRegistrationId: thirdPlace1?.registrationId ?? null,
          awayRegistrationId: thirdPlace2?.registrationId ?? null,
          matchNumber: 2,
          roundNumber: 1,
          bracketPosition: '3P',
          dependsOn: [],
          metadata: {
            homeSource: thirdPlace1?.sourceLabel ?? '3rd Place Contender 1',
            awaySource: thirdPlace2?.sourceLabel ?? '3rd Place Contender 2',
          },
        })
      }
      return matches

    default:
      throw new Error(`Unknown stage type: ${stage.type}`)
  }
}

/**
 * Generate matches for all stages in a tournament
 */
export function generateAllMatches(stages: StageConfig[]): GeneratedMatch[] {
  // Sort stages by order
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)
  
  const allMatches: GeneratedMatch[] = []
  
  for (const stage of sortedStages) {
    const stageMatches = generateStageMatches(stage)
    allMatches.push(...stageMatches)
  }

  return allMatches
}
