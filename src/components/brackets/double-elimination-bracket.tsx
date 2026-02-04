'use client'

import { ScheduledMatch } from '@/types'
import { MatchCard } from './match-card'

interface DoubleEliminationBracketProps {
  matches: ScheduledMatch[]
  stageName?: string
  compact?: boolean
}

/**
 * Double Elimination bracket visualization
 * Shows Winners bracket, Losers bracket, and Grand Final
 */
export function DoubleEliminationBracket({ matches, stageName, compact = false }: DoubleEliminationBracketProps) {
  // Separate matches by bracket type based on bracketPosition prefix
  const winnersMatches: ScheduledMatch[] = []
  const losersMatches: ScheduledMatch[] = []
  const grandFinalMatches: ScheduledMatch[] = []

  for (const match of matches) {
    const pos = match.bracketPosition || ''
    if (pos.startsWith('W-') || pos.startsWith('W')) {
      winnersMatches.push(match)
    } else if (pos.startsWith('LB-') || pos.startsWith('L-') || pos.startsWith('L')) {
      losersMatches.push(match)
    } else if (pos === 'GF' || pos === 'GF-R' || pos.includes('Grand')) {
      grandFinalMatches.push(match)
    } else {
      // Default to winners if no clear indicator
      winnersMatches.push(match)
    }
  }

  // Group by round within each bracket
  const groupByRound = (bracketMatches: ScheduledMatch[]) => {
    const byRound = new Map<number, ScheduledMatch[]>()
    for (const match of bracketMatches) {
      const round = match.roundNumber || 1
      if (!byRound.has(round)) {
        byRound.set(round, [])
      }
      byRound.get(round)!.push(match)
    }
    // Sort each round's matches
    for (const roundMatches of byRound.values()) {
      roundMatches.sort((a, b) => {
        const posA = a.bracketPosition || ''
        const posB = b.bracketPosition || ''
        return posA.localeCompare(posB)
      })
    }
    return byRound
  }

  const winnersByRound = groupByRound(winnersMatches)
  const losersByRound = groupByRound(losersMatches)
  
  const winnersRounds = Array.from(winnersByRound.keys()).sort((a, b) => a - b)
  const losersRounds = Array.from(losersByRound.keys()).sort((a, b) => a - b)

  if (matches.length === 0) {
    return (
      <div className="text-gray-500 text-sm p-4">
        No matches in bracket
      </div>
    )
  }

  return (
    <div className="p-4 overflow-x-auto">
      {stageName && (
        <h4 className="font-semibold text-gray-900 mb-4">{stageName}</h4>
      )}

      {/* Winners Bracket */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <h5 className="font-medium text-gray-700">Winners Bracket</h5>
        </div>
        
        <div className="flex gap-8 min-w-max">
          {winnersRounds.map((roundNum, roundIndex) => {
            const roundMatches = winnersByRound.get(roundNum) || []
            const spacingMultiplier = Math.pow(2, roundIndex)

            return (
              <div key={`W-${roundNum}`} className="flex flex-col">
                <div className="text-xs font-medium text-gray-500 text-center mb-4 pb-2 border-b border-gray-200">
                  {roundIndex === winnersRounds.length - 1 ? 'Winners Final' : `W Round ${roundNum}`}
                </div>
                <div 
                  className="flex flex-col justify-around flex-1"
                  style={{ gap: `${spacingMultiplier * 12}px` }}
                >
                  {roundMatches.map((match, matchIndex) => (
                    <div key={match.id} className="relative flex items-center">
                      <MatchCard match={match} compact={compact} />
                      {roundIndex < winnersRounds.length - 1 && (
                        <div className="absolute -right-4 top-1/2 w-4 border-t-2 border-blue-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grand Final */}
      {grandFinalMatches.length > 0 && (
        <div className="mb-8 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <h5 className="font-medium text-gray-700">Grand Final</h5>
          </div>
          
          <div className="flex gap-8">
            {grandFinalMatches
              .sort((a, b) => (a.bracketPosition || '').localeCompare(b.bracketPosition || ''))
              .map(match => (
                <div key={match.id} className="flex flex-col items-center">
                  <MatchCard match={match} compact={compact} />
                  {match.bracketPosition === 'GF-R' && (
                    <span className="text-xs text-gray-500 mt-1">If needed</span>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Losers Bracket */}
      {losersMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-400 rounded-full" />
            <h5 className="font-medium text-gray-700">Losers Bracket</h5>
          </div>
          
          <div className="flex gap-8 min-w-max">
            {losersRounds.map((roundNum, roundIndex) => {
              const roundMatches = losersByRound.get(roundNum) || []
              const spacingMultiplier = Math.max(1, Math.pow(2, Math.floor(roundIndex / 2)))

              return (
                <div key={`L-${roundNum}`} className="flex flex-col">
                  <div className="text-xs font-medium text-gray-500 text-center mb-4 pb-2 border-b border-gray-200">
                    {roundIndex === losersRounds.length - 1 ? 'Losers Final' : `L Round ${roundNum}`}
                  </div>
                  <div 
                    className="flex flex-col justify-around flex-1"
                    style={{ gap: `${spacingMultiplier * 8}px` }}
                  >
                    {roundMatches.map(match => (
                      <div key={match.id} className="relative flex items-center">
                        <MatchCard match={match} compact={compact} />
                        {roundIndex < losersRounds.length - 1 && (
                          <div className="absolute -right-4 top-1/2 w-4 border-t-2 border-red-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 flex gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span>Winners Bracket</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-400 rounded-full" />
          <span>Losers Bracket</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span>Grand Final</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for quick standings
 */
export function DoubleEliminationBracketCompact({ matches, stageName }: DoubleEliminationBracketProps) {
  return <DoubleEliminationBracket matches={matches} stageName={stageName} compact={true} />
}
