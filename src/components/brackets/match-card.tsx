'use client'

import { ScheduledMatch } from '@/types'

interface MatchCardProps {
  match: ScheduledMatch
  compact?: boolean
}

/**
 * Displays a single match in a bracket format
 * Shows team names (or source labels for TBD), scores if completed
 */
export function MatchCard({ match, compact = false }: MatchCardProps) {
  const homeDisplay = match.homeTeam?.teamName || match.homeTeamSource || 'TBD'
  const awayDisplay = match.awayTeam?.teamName || match.awayTeamSource || 'TBD'
  const isCompleted = match.status === 'COMPLETED'
  const hasResult = !!match.result

  // Determine winner for highlighting
  let homeWinner = false
  let awayWinner = false
  if (hasResult && match.result) {
    if (match.result.homeScore > match.result.awayScore) {
      homeWinner = true
    } else if (match.result.awayScore > match.result.homeScore) {
      awayWinner = true
    } else if (match.result.homePenalties != null && match.result.awayPenalties != null) {
      homeWinner = match.result.homePenalties > match.result.awayPenalties
      awayWinner = match.result.awayPenalties > match.result.homePenalties
    }
  }

  // Check if there was a penalty shootout
  const hasPenalties = hasResult && match.result!.homePenalties != null && match.result!.awayPenalties != null

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded text-xs min-w-[140px]">
        <div className={`flex justify-between items-center px-2 py-1 border-b border-gray-100 ${homeWinner ? 'bg-green-50' : ''}`}>
          <span className={`truncate flex-1 ${match.homeTeam ? 'text-gray-900' : 'text-gray-400 italic'} ${homeWinner ? 'font-semibold' : ''}`}>
            {homeDisplay}
          </span>
          {hasResult && (
            <span className={`ml-2 font-mono ${homeWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
              {match.result!.homeScore}
            </span>
          )}
        </div>
        <div className={`flex justify-between items-center px-2 py-1 ${hasPenalties ? 'border-b border-gray-100' : ''} ${awayWinner ? 'bg-green-50' : ''}`}>
          <span className={`truncate flex-1 ${match.awayTeam ? 'text-gray-900' : 'text-gray-400 italic'} ${awayWinner ? 'font-semibold' : ''}`}>
            {awayDisplay}
          </span>
          {hasResult && (
            <span className={`ml-2 font-mono ${awayWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
              {match.result!.awayScore}
            </span>
          )}
        </div>
        {hasPenalties && (
          <div className="px-2 py-0.5 bg-gray-50 text-gray-500 text-center text-[10px]">
            Pen: {match.result!.homePenalties} - {match.result!.awayPenalties}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-white border rounded-lg shadow-sm min-w-[180px] ${isCompleted ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Match header */}
      <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex justify-between">
        <span>#{match.matchNumber || '?'}</span>
        {match.bracketPosition && (
          <span className="font-mono text-gray-400">{match.bracketPosition}</span>
        )}
      </div>
      
      {/* Home team */}
      <div className={`flex justify-between items-center px-3 py-2 border-b border-gray-100 ${homeWinner ? 'bg-green-50' : ''}`}>
        <span className={`truncate flex-1 text-sm ${match.homeTeam ? 'text-gray-900' : 'text-gray-400 italic'} ${homeWinner ? 'font-semibold' : ''}`}>
          {homeDisplay}
        </span>
        {hasResult && (
          <span className={`ml-2 text-lg font-mono ${homeWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
            {match.result!.homeScore}
          </span>
        )}
      </div>
      
      {/* Away team */}
      <div className={`flex justify-between items-center px-3 py-2 ${awayWinner ? 'bg-green-50' : ''}`}>
        <span className={`truncate flex-1 text-sm ${match.awayTeam ? 'text-gray-900' : 'text-gray-400 italic'} ${awayWinner ? 'font-semibold' : ''}`}>
          {awayDisplay}
        </span>
        {hasResult && (
          <span className={`ml-2 text-lg font-mono ${awayWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
            {match.result!.awayScore}
          </span>
        )}
      </div>

      {/* Penalties indicator */}
      {hasResult && match.result!.homePenalties != null && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
          Pen: {match.result!.homePenalties} - {match.result!.awayPenalties}
        </div>
      )}
    </div>
  )
}
