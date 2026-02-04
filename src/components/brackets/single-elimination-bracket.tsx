'use client'

import { ScheduledMatch } from '@/types'
import { MatchCard } from './match-card'

interface SingleEliminationBracketProps {
  matches: ScheduledMatch[]
  stageName?: string
  compact?: boolean
}

/**
 * Single Elimination bracket visualization
 * Displays matches in rounds from left to right, with connecting lines
 */
export function SingleEliminationBracket({ matches, stageName, compact = false }: SingleEliminationBracketProps) {
  // Layout dimensions
  const cardW = compact ? 150 : 180
  const cardH = compact ? 56 : 76
  const labelH = 20
  const gapX = compact ? 40 : 56
  const gapY = compact ? 16 : 24

  // Separate 3rd place match
  const thirdPlaceMatch = matches.find(m => 
    m.bracketPosition === '3P' || 
    m.bracketPosition?.includes('3P') ||
    m.bracketPosition?.toLowerCase().includes('third')
  )

  // Get regular matches (excluding 3rd place)
  const regularMatches = matches.filter(m => 
    m.bracketPosition !== '3P' && 
    !m.bracketPosition?.includes('3P') &&
    !m.bracketPosition?.toLowerCase().includes('third')
  )

  // Group matches by round
  const matchesByRound = new Map<number, ScheduledMatch[]>()
  for (const match of regularMatches) {
    const round = match.roundNumber || 1
    if (!matchesByRound.has(round)) {
      matchesByRound.set(round, [])
    }
    matchesByRound.get(round)!.push(match)
  }

  // Sort rounds and matches within rounds
  const rounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b)
  for (const round of rounds) {
    matchesByRound.get(round)!.sort((a, b) => {
      const posA = a.bracketPosition || ''
      const posB = b.bracketPosition || ''
      if (posA && posB) return posA.localeCompare(posB)
      return (a.matchNumber || 0) - (b.matchNumber || 0)
    })
  }

  const numRounds = rounds.length

  const getRoundName = (roundNum: number, totalRounds: number) => {
    const roundsFromFinal = totalRounds - roundNum
    if (roundsFromFinal === 0) return 'Final'
    if (roundsFromFinal === 1) return 'Semifinals'
    if (roundsFromFinal === 2) return 'Quarterfinals'
    return `Round ${roundNum}`
  }

  if (regularMatches.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4">
        No matches in bracket
      </div>
    )
  }

  // Calculate positions for each match
  interface MatchPosition {
    match: ScheduledMatch
    x: number
    y: number
    roundIndex: number
  }

  const positions: MatchPosition[] = []
  let maxY = 0

  // First pass: calculate Y positions for first round
  const firstRoundMatches = matchesByRound.get(rounds[0]) || []
  firstRoundMatches.forEach((match, idx) => {
    const y = idx * (cardH + labelH + gapY)
    positions.push({ match, x: 0, y, roundIndex: 0 })
    maxY = Math.max(maxY, y + cardH + labelH)
  })

  // Subsequent rounds: center between feeding matches
  for (let roundIdx = 1; roundIdx < rounds.length; roundIdx++) {
    const roundNum = rounds[roundIdx]
    const roundMatches = matchesByRound.get(roundNum) || []
    const x = roundIdx * (cardW + gapX)

    roundMatches.forEach((match, idx) => {
      // Find the two matches from previous round that feed into this one
      const prevRoundPositions = positions.filter(p => p.roundIndex === roundIdx - 1)
      const feedingMatch1 = prevRoundPositions[idx * 2]
      const feedingMatch2 = prevRoundPositions[idx * 2 + 1]

      let y: number
      if (feedingMatch1 && feedingMatch2) {
        // Center between the two feeding matches
        const center1 = feedingMatch1.y + cardH / 2
        const center2 = feedingMatch2.y + cardH / 2
        y = (center1 + center2) / 2 - cardH / 2
      } else if (feedingMatch1) {
        y = feedingMatch1.y
      } else {
        y = idx * (cardH + labelH + gapY)
      }

      positions.push({ match, x, y, roundIndex: roundIdx })
      maxY = Math.max(maxY, y + cardH + labelH)
    })
  }

  // Add 3rd place match position (under the final)
  let thirdPlacePos: { x: number; y: number } | null = null
  if (thirdPlaceMatch && positions.length > 0) {
    const finalPos = positions.find(p => p.roundIndex === rounds.length - 1)
    if (finalPos) {
      thirdPlacePos = {
        x: finalPos.x,
        y: maxY + gapY
      }
      maxY = thirdPlacePos.y + cardH + labelH
    }
  }

  // Total dimensions
  const totalW = rounds.length * (cardW + gapX) - gapX
  const totalH = maxY + 10

  // Helper to get center Y of a card
  const centerY = (topY: number) => topY + cardH / 2

  return (
    <div className="p-4 overflow-x-auto">
      {stageName && (
        <h4 className="font-semibold text-gray-900 mb-4">{stageName}</h4>
      )}

      {/* Column Headers */}
      <div className="flex mb-2 text-xs text-gray-500 font-medium">
        {rounds.map((roundNum, idx) => (
          <div key={roundNum} style={{ width: cardW, marginRight: idx < rounds.length - 1 ? gapX : 0 }} className="text-center">
            {getRoundName(roundNum, numRounds)}
          </div>
        ))}
      </div>

      {/* SVG Container with absolute positioned match cards */}
      <div className="relative" style={{ width: totalW, height: totalH }}>
        
        {/* SVG for all connecting lines */}
        <svg 
          className="absolute top-0 left-0 pointer-events-none"
          width={totalW} 
          height={totalH}
        >
          {/* Draw lines from each match to the next round */}
          {positions.map((pos, idx) => {
            // Find if this match feeds into a next round match
            if (pos.roundIndex >= rounds.length - 1) return null

            const nextRoundPositions = positions.filter(p => p.roundIndex === pos.roundIndex + 1)
            const targetIdx = Math.floor(positions.filter(p => p.roundIndex === pos.roundIndex).indexOf(pos) / 2)
            const targetPos = nextRoundPositions[targetIdx]

            if (!targetPos) return null

            const startX = pos.x + cardW
            const startY = centerY(pos.y)
            const endX = targetPos.x
            const endY = centerY(targetPos.y)
            const midX = startX + gapX * 0.6

            return (
              <path 
                key={`line-${pos.match.id}`}
                d={`
                  M ${startX} ${startY}
                  L ${midX} ${startY}
                  L ${midX} ${endY}
                  L ${endX} ${endY}
                `}
                fill="none" stroke="#9ca3af" strokeWidth="2"
              />
            )
          })}
        </svg>

        {/* Match cards */}
        {positions.map((pos) => (
          <div 
            key={pos.match.id}
            className="absolute" 
            style={{ left: pos.x, top: pos.y, width: cardW }}
          >
            <MatchCard match={pos.match} compact={compact} />
          </div>
        ))}

        {/* 3rd Place Match */}
        {thirdPlaceMatch && thirdPlacePos && (
          <div 
            className="absolute" 
            style={{ left: thirdPlacePos.x, top: thirdPlacePos.y, width: cardW }}
          >
            <div className="text-xs text-gray-500 font-medium text-center mb-1 pt-2 border-t border-gray-200">
              Third Place
            </div>
            <MatchCard match={thirdPlaceMatch} compact={compact} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version for quick standings
 */
export function SingleEliminationBracketCompact({ matches, stageName }: SingleEliminationBracketProps) {
  return <SingleEliminationBracket matches={matches} stageName={stageName} compact={true} />
}
