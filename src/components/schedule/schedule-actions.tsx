'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { clearTournamentSchedule, resetDependentTeamAssignments } from '@/actions/schedule'

interface ScheduleActionsProps {
  tournamentId: string
  eventId: string
  matchCount: number
}

export function ScheduleActions({ tournamentId, eventId, matchCount }: ScheduleActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleClear = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await clearTournamentSchedule(tournamentId)
      if (result.success) {
        setShowClearConfirm(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to clear schedule')
      }
    })
  }

  const handleResetTeams = () => {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await resetDependentTeamAssignments(tournamentId)
      if (result.success) {
        setShowResetConfirm(false)
        setMessage(`Reset ${result.data?.resetCount || 0} team assignments`)
        router.refresh()
      } else {
        setError(result.error || 'Failed to reset teams')
      }
    })
  }

  const handlePrint = () => {
    window.print()
  }

  if (showClearConfirm) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
        <span className="text-sm text-red-700">
          Clear all {matchCount} matches?
        </span>
        <Button
          variant="danger"
          size="sm"
          onClick={handleClear}
          disabled={isPending}
        >
          {isPending ? 'Clearing...' : 'Yes, Clear'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowClearConfirm(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    )
  }

  if (showResetConfirm) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        <span className="text-sm text-amber-700">
          Reset all TBD team assignments? (keeps match structure)
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleResetTeams}
          disabled={isPending}
        >
          {isPending ? 'Resetting...' : 'Yes, Reset'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowResetConfirm(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {message && (
        <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
          {message}
        </div>
      )}
      <div className="flex gap-2">
        <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
          <Button variant="secondary">Edit Configuration</Button>
        </Link>
        
        {matchCount > 0 && (
          <>
            <Button variant="secondary" onClick={handlePrint}>
              🖨️ Print
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowResetConfirm(true)}
            >
              Reset TBD Teams
            </Button>
            <Button 
              variant="danger" 
              onClick={() => setShowClearConfirm(true)}
            >
              Clear Schedule
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
