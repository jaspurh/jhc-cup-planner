'use client'

import { useState, useCallback } from 'react'
import { ScheduledMatch } from '@/types'

/**
 * Hook for tracking which team the user is hovering/selecting in a bracket.
 * Returns the currently highlighted team ID and the set of match IDs
 * that include that team (for highlighting their path through the bracket).
 */
export function useTeamPath(matches: ScheduledMatch[]) {
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null)

  const highlightTeam = useCallback((registrationId: string | null) => {
    setHighlightedTeamId(registrationId)
  }, [])

  const clearHighlight = useCallback(() => {
    setHighlightedTeamId(null)
  }, [])

  // The set of match IDs containing the highlighted team
  const highlightedMatchIds = new Set<string>()
  if (highlightedTeamId) {
    for (const match of matches) {
      if (
        match.homeTeam?.id === highlightedTeamId ||
        match.awayTeam?.id === highlightedTeamId
      ) {
        highlightedMatchIds.add(match.id)
      }
    }
  }

  return { highlightedTeamId, highlightedMatchIds, highlightTeam, clearHighlight }
}
