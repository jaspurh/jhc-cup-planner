'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { updateTournament, deleteTournament } from '@/actions/tournament'
import { 
  TOURNAMENT_STYLE_OPTIONS, 
  TOURNAMENT_FORMAT_OPTIONS,
  TIMING_CONSTRAINTS,
} from '@/lib/constants'
import type { TournamentWithDetails } from '@/types'

interface TournamentEditFormProps {
  tournament: TournamentWithDetails
  eventId: string
  eventDates?: { start: Date; end: Date } | null
}

export function TournamentEditForm({ tournament, eventId, eventDates }: TournamentEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const startTimeValue = formData.get('startTime') as string

    const result = await updateTournament(tournament.id, {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      style: formData.get('style') as 'COMPETITIVE' | 'RECREATIONAL',
      format: formData.get('format') as 'GROUP_STAGE' | 'KNOCKOUT' | 'DOUBLE_ELIMINATION' | 'GROUP_KNOCKOUT' | 'ROUND_ROBIN',
      matchDurationMinutes: parseInt(formData.get('matchDurationMinutes') as string),
      transitionTimeMinutes: parseInt(formData.get('transitionTimeMinutes') as string),
      startTime: startTimeValue ? new Date(startTimeValue) : null,
    })

    setLoading(false)

    if (result.success) {
      router.push(`/events/${eventId}/tournaments/${tournament.id}`)
      router.refresh()
    } else {
      setError(result.error || 'Failed to update tournament')
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    
    const result = await deleteTournament(tournament.id)

    if (result.success) {
      router.push(`/events/${eventId}`)
      router.refresh()
    } else {
      setError(result.error || 'Failed to delete tournament')
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Details</CardTitle>
          <CardDescription>Update basic tournament information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              name="name"
              label="Tournament Name"
              placeholder="e.g., U11 Boys Championship"
              defaultValue={tournament.name}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400"
                placeholder="Brief description of the tournament..."
                defaultValue={tournament.description || ''}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Style
                </label>
                <select
                  name="style"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  defaultValue={tournament.style}
                >
                  {TOURNAMENT_STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Format
                </label>
                <select
                  name="format"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  defaultValue={tournament.format}
                >
                  {TOURNAMENT_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DateTimePicker
              name="startTime"
              label="Tournament Start Time"
              defaultValue={tournament.startTime}
              eventDates={eventDates}
              helpText="Required for schedule generation"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="matchDurationMinutes"
                type="number"
                label="Match Duration (minutes)"
                defaultValue={tournament.matchDurationMinutes}
                min={TIMING_CONSTRAINTS.minMatchDuration}
                max={TIMING_CONSTRAINTS.maxMatchDuration}
                required
              />

              <Input
                name="transitionTimeMinutes"
                type="number"
                label="Transition Time (minutes)"
                defaultValue={tournament.transitionTimeMinutes}
                min={TIMING_CONSTRAINTS.minTransitionTime}
                max={TIMING_CONSTRAINTS.maxTransitionTime}
                required
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={loading}>
                Save Changes
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Delete Tournament</p>
                <p className="text-sm text-gray-500">
                  Permanently delete this tournament and all associated data (teams, matches, results).
                </p>
              </div>
              <Button 
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Tournament
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="font-medium text-red-800 mb-2">
                Are you sure you want to delete &quot;{tournament.name}&quot;?
              </p>
              <p className="text-sm text-red-600 mb-4">
                This will permanently delete the tournament, all {tournament.teams.length} team registrations, 
                all stages, matches, and results. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteLoading}
                >
                  Yes, Delete Tournament
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
