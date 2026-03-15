'use client'

import { ScheduledMatch } from '@/types'

interface MatchCardProps {
  match: ScheduledMatch
  compact?: boolean
  /** Registration ID of a team to highlight */
  highlightedTeamId?: string | null
}

/**
 * Displays a single match in a bracket format.
 * - TBD teams (source label set, no team assigned) show with dashed border and muted italic style
 * - Winner highlighted with a green left accent border instead of background color
 * - Accepts highlightedTeamId to trace a team's path through the bracket
 */
export function MatchCard({ match, compact = false, highlightedTeamId }: MatchCardProps) {
  const homeTeamName = match.homeTeam?.teamName ?? null
  const awayTeamName = match.awayTeam?.teamName ?? null

  const homeTBD = !homeTeamName
  const awayTBD = !awayTeamName

  const homeDisplay = homeTeamName ?? match.homeTeamSource ?? 'TBD'
  const awayDisplay = awayTeamName ?? match.awayTeamSource ?? 'TBD'

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

  const hasPenalties = hasResult && match.result!.homePenalties != null && match.result!.awayPenalties != null

  // Team path highlight - is either team the one we're tracking?
  const homeHighlighted = !!highlightedTeamId && match.homeTeam?.id === highlightedTeamId
  const awayHighlighted = !!highlightedTeamId && match.awayTeam?.id === highlightedTeamId
  const matchHighlighted = homeHighlighted || awayHighlighted

  // Whether the entire match card has a TBD slot
  const allTBD = homeTBD && awayTBD

  if (compact) {
    return (
      <div
        className={[
          'bg-white rounded text-xs',
          allTBD
            ? 'border border-dashed border-gray-300'
            : matchHighlighted
            ? 'border-2 border-blue-400 shadow-sm'
            : 'border border-gray-200',
        ].join(' ')}
        style={{ minWidth: 140 }}
      >
        {/* Home team row */}
        <div
          className={[
            'flex justify-between items-center px-2 py-1 border-b border-gray-100',
            homeWinner ? 'border-l-2 border-l-green-500' : '',
            homeHighlighted ? 'bg-blue-50' : '',
          ].join(' ')}
        >
          <span
            className={[
              'truncate flex-1',
              homeTBD ? 'text-gray-400 italic' : 'text-gray-900',
              homeWinner ? 'font-semibold' : '',
            ].join(' ')}
          >
            {homeDisplay}
          </span>
          {hasResult && (
            <span className={`ml-2 font-mono ${homeWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
              {match.result!.homeScore}
            </span>
          )}
        </div>

        {/* Away team row */}
        <div
          className={[
            'flex justify-between items-center px-2 py-1',
            hasPenalties ? 'border-b border-gray-100' : '',
            awayWinner ? 'border-l-2 border-l-green-500' : '',
            awayHighlighted ? 'bg-blue-50' : '',
          ].join(' ')}
        >
          <span
            className={[
              'truncate flex-1',
              awayTBD ? 'text-gray-400 italic' : 'text-gray-900',
              awayWinner ? 'font-semibold' : '',
            ].join(' ')}
          >
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
            Pen: {match.result!.homePenalties} – {match.result!.awayPenalties}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={[
        'bg-white rounded-lg shadow-sm',
        allTBD
          ? 'border-2 border-dashed border-gray-300'
          : matchHighlighted
          ? 'border-2 border-blue-400 shadow-md'
          : isCompleted
          ? 'border border-green-200'
          : 'border border-gray-200',
      ].join(' ')}
      style={{ minWidth: 180 }}
    >
      {/* Match header */}
      <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex justify-between">
        <span>#{match.matchNumber ?? '?'}</span>
        {match.bracketPosition && (
          <span className="font-mono text-gray-400">{match.bracketPosition}</span>
        )}
      </div>

      {/* Home team */}
      <div
        className={[
          'flex justify-between items-center px-3 py-2 border-b border-gray-100',
          homeWinner ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-transparent',
          homeHighlighted ? 'bg-blue-50' : '',
        ].join(' ')}
      >
        <span
          className={[
            'truncate flex-1 text-sm',
            homeTBD ? 'text-gray-400 italic' : 'text-gray-900',
            homeWinner ? 'font-semibold' : '',
          ].join(' ')}
        >
          {homeDisplay}
        </span>
        {hasResult && (
          <span className={`ml-2 text-lg font-mono ${homeWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
            {match.result!.homeScore}
          </span>
        )}
      </div>

      {/* Away team */}
      <div
        className={[
          'flex justify-between items-center px-3 py-2',
          awayWinner ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-transparent',
          awayHighlighted ? 'bg-blue-50' : '',
        ].join(' ')}
      >
        <span
          className={[
            'truncate flex-1 text-sm',
            awayTBD ? 'text-gray-400 italic' : 'text-gray-900',
            awayWinner ? 'font-semibold' : '',
          ].join(' ')}
        >
          {awayDisplay}
        </span>
        {hasResult && (
          <span className={`ml-2 text-lg font-mono ${awayWinner ? 'font-bold text-green-700' : 'text-gray-600'}`}>
            {match.result!.awayScore}
          </span>
        )}
      </div>

      {hasPenalties && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
          Pen: {match.result!.homePenalties} – {match.result!.awayPenalties}
        </div>
      )}
    </div>
  )
}
