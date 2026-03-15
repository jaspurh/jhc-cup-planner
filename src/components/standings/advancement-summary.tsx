import { GroupAdvancementSummary, TBDSlotInfo } from '@/actions/match'

interface GroupAdvancementCalloutProps {
  group: GroupAdvancementSummary
}

/**
 * Callout shown below a group's standings table.
 * - Complete group: lists qualified teams and their next match.
 * - Incomplete group: shows progress ("3 of 6 matches remaining").
 */
export function GroupAdvancementCallout({ group }: GroupAdvancementCalloutProps) {
  const remaining = group.totalMatches - group.completedMatches

  if (group.isComplete && group.qualifiedTeams.length > 0) {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="text-green-600 mt-0.5">✓</span>
          <div className="text-sm">
            <span className="font-medium text-green-800">{group.groupName} complete.</span>{' '}
            <span className="text-green-700">
              {group.qualifiedTeams.map((team, idx) => (
                <span key={team.registrationId}>
                  {idx > 0 && ' and '}
                  <strong>{team.teamName}</strong>
                  {team.position > 0 && ` (${ordinal(team.position)})`}
                  {team.nextMatchLabel && (
                    <> → <span className="font-mono text-xs bg-green-100 px-1 rounded">{team.nextMatchLabel}</span></>
                  )}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (group.isComplete && group.qualifiedTeams.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <span>✓</span>
          <span className="font-medium">{group.groupName} complete.</span>
          <span className="text-green-600">Teams advancing to the next stage.</span>
        </div>
      </div>
    )
  }

  if (group.totalMatches === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="text-gray-400">◷</span>
        <span>
          <strong>{remaining}</strong> match{remaining !== 1 ? 'es' : ''} remaining in {group.groupName}
        </span>
        <span className="text-gray-400 text-xs">
          ({group.completedMatches}/{group.totalMatches} completed)
        </span>
      </div>
    </div>
  )
}

interface PendingSlotsPanelProps {
  pendingSlots: TBDSlotInfo[]
  standingsHref?: string
}

/**
 * Compact panel showing which bracket slots are still awaiting team assignment.
 * Shown on the schedule page above the bracket section when TBD slots exist.
 */
export function PendingSlotsPanel({ pendingSlots, standingsHref }: PendingSlotsPanelProps) {
  if (pendingSlots.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-amber-500 mt-0.5 text-sm">⏳</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 mb-2">
            {pendingSlots.length} bracket slot{pendingSlots.length !== 1 ? 's' : ''} awaiting advancement
          </p>
          <ul className="space-y-1">
            {pendingSlots.map(slot => {
              const label = slot.bracketPosition ?? slot.matchLabel ?? 'Match'
              const sources = [slot.homeSource, slot.awaySource].filter(Boolean)
              return (
                <li key={slot.matchId} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="font-mono bg-amber-100 px-1 rounded shrink-0">{label}</span>
                  <span className="text-amber-600">
                    Awaiting: {sources.join(' · ')}
                  </span>
                </li>
              )
            })}
          </ul>
          {standingsHref && (
            <a href={standingsHref} className="inline-block mt-2 text-xs text-amber-700 underline hover:text-amber-900">
              View standings →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
