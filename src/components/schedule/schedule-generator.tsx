'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  generateTournamentSchedule, 
  previewTournamentSchedule,
  clearTournamentSchedule,
  type ScheduleStats 
} from '@/actions/schedule'

interface ScheduleGeneratorProps {
  tournamentId: string
  eventId: string
  hasStages: boolean
  hasPitches: boolean
  hasTeams: boolean
  hasStartTime: boolean
  existingMatchCount: number
}

export function ScheduleGenerator({
  tournamentId,
  eventId,
  hasStages,
  hasPitches,
  hasTeams,
  hasStartTime,
  existingMatchCount,
}: ScheduleGeneratorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<ScheduleStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const canGenerate = hasStages && hasPitches && hasTeams && hasStartTime

  const missingItems: string[] = []
  if (!hasStages) missingItems.push('stages')
  if (!hasPitches) missingItems.push('pitches')
  if (!hasTeams) missingItems.push('teams assigned to groups')
  if (!hasStartTime) missingItems.push('tournament start time')

  const handlePreview = () => {
    setError(null)
    startTransition(async () => {
      const result = await previewTournamentSchedule({ tournamentId })
      if (result.success && result.data) {
        setPreview(result.data)
        setShowConfirm(true)
      } else {
        setError(result.error || 'Failed to preview schedule')
      }
    })
  }

  const handleGenerate = () => {
    setError(null)
    startTransition(async () => {
      const result = await generateTournamentSchedule({ tournamentId })
      if (result.success) {
        setPreview(null)
        setShowConfirm(false)
        router.push(`/events/${eventId}/tournaments/${tournamentId}/schedule`)
      } else {
        setError(result.error || 'Failed to generate schedule')
      }
    })
  }

  const handleClear = () => {
    setError(null)
    startTransition(async () => {
      const result = await clearTournamentSchedule(tournamentId)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error || 'Failed to clear schedule')
      }
    })
  }

  if (showConfirm && preview) {
    return (
      <Card className="p-4 border-blue-200 bg-blue-50">
        <h3 className="font-semibold text-gray-900 mb-3">Schedule Preview</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded p-3 border">
            <p className="text-xs text-gray-500">Total Matches</p>
            <p className="text-xl font-bold text-gray-900">{preview.totalMatches}</p>
          </div>
          <div className="bg-white rounded p-3 border">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-xl font-bold text-gray-900">{preview.totalDurationMinutes} min</p>
          </div>
          <div className="bg-white rounded p-3 border">
            <p className="text-xs text-gray-500">Avg Rest Time</p>
            <p className="text-xl font-bold text-gray-900">{preview.averageRestMinutes} min</p>
          </div>
          <div className="bg-white rounded p-3 border">
            <p className="text-xs text-gray-500">Est. End Time</p>
            <p className="text-lg font-bold text-gray-900">
              {preview.estimatedEndTime 
                ? new Date(preview.estimatedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'N/A'}
            </p>
          </div>
        </div>

        {preview.warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm font-medium text-yellow-800 mb-1">Warnings:</p>
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {preview.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {preview.warnings.length > 5 && (
                <li>... and {preview.warnings.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {preview.errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
            <ul className="text-sm text-red-700 list-disc list-inside">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {existingMatchCount > 0 && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
            <p className="text-sm text-orange-800">
              <strong>Warning:</strong> This will replace the existing {existingMatchCount} matches.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isPending || preview.errors.length > 0}
          >
            {isPending ? 'Generating...' : 'Confirm & Generate'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setShowConfirm(false)
              setPreview(null)
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {existingMatchCount > 0 ? (
        <>
          <Button
            variant="secondary"
            onClick={() => router.push(`/events/${eventId}/tournaments/${tournamentId}/schedule`)}
          >
            View Schedule ({existingMatchCount} matches)
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={isPending || !canGenerate}
          >
            {isPending ? 'Loading...' : 'Regenerate'}
          </Button>
          <Button
            variant="danger"
            onClick={handleClear}
            disabled={isPending}
          >
            Clear Schedule
          </Button>
        </>
      ) : (
        <Button
          onClick={handlePreview}
          disabled={isPending || !canGenerate}
          title={!canGenerate ? `Missing: ${missingItems.join(', ')}` : undefined}
        >
          {isPending ? 'Loading...' : 'Generate Schedule'}
        </Button>
      )}

      {!canGenerate && (
        <span className="text-sm text-gray-500">
          Missing: {missingItems.join(', ')}
        </span>
      )}

      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  )
}
