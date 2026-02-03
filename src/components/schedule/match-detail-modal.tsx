'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScheduledMatch } from '@/types'
import { updateMatchTime } from '@/actions/schedule'

interface MatchDetailModalProps {
  match: ScheduledMatch
  isOpen: boolean
  onClose: () => void
}

export function MatchDetailModal({ match, isOpen, onClose }: MatchDetailModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newStartTime, setNewStartTime] = useState(
    match.scheduledStartTime 
      ? new Date(match.scheduledStartTime).toISOString().slice(0, 16)
      : ''
  )

  if (!isOpen) return null

  const homeDisplay = match.homeTeam?.teamName || match.homeTeamSource || 'TBD'
  const awayDisplay = match.awayTeam?.teamName || match.awayTeamSource || 'TBD'

  const handleReschedule = () => {
    if (!newStartTime) return
    
    setError(null)
    startTransition(async () => {
      const result = await updateMatchTime(match.id, new Date(newStartTime))
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Failed to reschedule match')
      }
    })
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Not scheduled'
    return new Date(date).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning">Live</Badge>
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-900">Match #{match.matchNumber}</h2>
            <p className="text-sm text-gray-500">{match.stage.name}{match.group && ` • ${match.group.name}`}</p>
          </div>
          {getStatusBadge(match.status)}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Teams */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4">
              <div className="flex-1 text-right">
                <p className={`text-lg ${match.homeTeam ? 'font-semibold text-gray-900' : 'text-gray-500 italic'}`}>
                  {homeDisplay}
                </p>
              </div>
              <div className="flex-shrink-0">
                {match.result ? (
                  <span className="text-2xl font-bold text-gray-900">
                    {match.result.homeScore} - {match.result.awayScore}
                  </span>
                ) : (
                  <span className="text-xl text-gray-400">vs</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-lg ${match.awayTeam ? 'font-semibold text-gray-900' : 'text-gray-500 italic'}`}>
                  {awayDisplay}
                </p>
              </div>
            </div>
            
            {match.result?.homePenalties !== null && match.result?.homePenalties !== undefined && (
              <p className="text-sm text-gray-500 mt-1">
                Penalties: {match.result.homePenalties} - {match.result.awayPenalties}
              </p>
            )}
          </div>

          {/* Match Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Scheduled Start</p>
              <p className="font-medium text-gray-900">{formatDateTime(match.scheduledStartTime)}</p>
            </div>
            <div>
              <p className="text-gray-500">Scheduled End</p>
              <p className="font-medium text-gray-900">{formatDateTime(match.scheduledEndTime)}</p>
            </div>
            <div>
              <p className="text-gray-500">Pitch</p>
              <p className="font-medium text-gray-900">{match.pitch?.name || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-gray-500">Round</p>
              <p className="font-medium text-gray-900">{match.roundNumber || 'N/A'}</p>
            </div>
          </div>

          {/* Reschedule (only for scheduled matches) */}
          {match.status === 'SCHEDULED' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Reschedule Match</h3>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleReschedule}
                  disabled={isPending || !newStartTime}
                >
                  {isPending ? 'Saving...' : 'Update Time'}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
