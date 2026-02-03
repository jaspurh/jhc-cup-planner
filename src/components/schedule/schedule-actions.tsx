'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { clearTournamentSchedule } from '@/actions/schedule'

interface ScheduleActionsProps {
  tournamentId: string
  eventId: string
  matchCount: number
}

export function ScheduleActions({ tournamentId, eventId, matchCount }: ScheduleActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClear = () => {
    setError(null)
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

  return (
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
            variant="danger" 
            onClick={() => setShowClearConfirm(true)}
          >
            Clear Schedule
          </Button>
        </>
      )}
    </div>
  )
}
