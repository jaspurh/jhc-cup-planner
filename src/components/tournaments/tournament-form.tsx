'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { createTournament } from '@/actions/tournament'
import { 
  TOURNAMENT_FORMAT_OPTIONS, 
  TOURNAMENT_STYLE_OPTIONS,
  DEFAULT_TOURNAMENT_TIMING,
  TIMING_CONSTRAINTS,
} from '@/lib/constants'

interface TournamentFormProps {
  eventId: string
  eventName: string
  eventDates?: { start: Date; end: Date } | null
}

export function TournamentForm({ eventId, eventName, eventDates }: TournamentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const startTimeValue = formData.get('startTime') as string
    
    const result = await createTournament({
      eventId,
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      style: formData.get('style') as 'COMPETITIVE' | 'RECREATIONAL',
      format: formData.get('format') as 'GROUP_STAGE' | 'KNOCKOUT' | 'DOUBLE_ELIMINATION' | 'GROUP_KNOCKOUT' | 'ROUND_ROBIN',
      matchDurationMinutes: parseInt(formData.get('matchDuration') as string) || DEFAULT_TOURNAMENT_TIMING.matchDurationMinutes,
      transitionTimeMinutes: parseInt(formData.get('transitionTime') as string) || DEFAULT_TOURNAMENT_TIMING.transitionTimeMinutes,
      startTime: startTimeValue ? new Date(startTimeValue) : undefined,
    })

    setLoading(false)

    if (result.success && result.data) {
      router.push(`/events/${eventId}/tournaments/${result.data.id}`)
    } else {
      setError(result.error || 'Failed to create tournament')
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Tournament</CardTitle>
        <p className="text-sm text-gray-500">For {eventName}</p>
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
            placeholder="e.g., Under-9 Boys"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the tournament..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style
              </label>
              <select
                name="style"
                defaultValue="COMPETITIVE"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TOURNAMENT_STYLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format
              </label>
              <select
                name="format"
                defaultValue="GROUP_KNOCKOUT"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TOURNAMENT_FORMAT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DateTimePicker
            name="startTime"
            label="Start Time (optional)"
            eventDates={eventDates}
            helpText="Required for schedule generation. Can be set later."
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="matchDuration"
              label="Match Duration (minutes)"
              type="number"
              min={TIMING_CONSTRAINTS.minMatchDuration}
              max={TIMING_CONSTRAINTS.maxMatchDuration}
              defaultValue={DEFAULT_TOURNAMENT_TIMING.matchDurationMinutes}
            />
            <Input
              name="transitionTime"
              label="Transition Time (minutes)"
              type="number"
              min={TIMING_CONSTRAINTS.minTransitionTime}
              max={TIMING_CONSTRAINTS.maxTransitionTime}
              defaultValue={DEFAULT_TOURNAMENT_TIMING.transitionTimeMinutes}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>
              Create Tournament
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
