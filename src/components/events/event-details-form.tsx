'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { updateEvent, deleteEvent } from '@/actions/event'
import type { EventWithTournaments } from '@/types'

interface EventDetailsFormProps {
  event: EventWithTournaments
}

export function EventDetailsForm({ event }: EventDetailsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)

    const result = await updateEvent(event.id, {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      startDate: new Date(formData.get('startDate') as string),
      endDate: new Date(formData.get('endDate') as string),
    })

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } else {
      setError(result.error || 'Failed to update event')
    }
  }

  // Format date for input[type="date"]
  const formatDateForInput = (date: Date) => {
    return new Date(date).toISOString().split('T')[0]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Details</CardTitle>
        <CardDescription>Edit basic information about your event</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
              Event details updated successfully!
            </div>
          )}

          <Input
            name="name"
            label="Event Name"
            placeholder="e.g., Indoor Football Championship 2025"
            defaultValue={event.name}
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
              placeholder="Brief description of the event..."
              defaultValue={event.description || ''}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              name="startDate"
              type="date"
              label="Start Date"
              defaultValue={formatDateForInput(event.startDate)}
              required
            />
            <Input
              name="endDate"
              type="date"
              label="End Date"
              defaultValue={formatDateForInput(event.endDate)}
              required
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

interface EventDeleteSectionProps {
  event: EventWithTournaments
}

export function EventDeleteSection({ event }: EventDeleteSectionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleDelete() {
    setLoading(true)
    
    const result = await deleteEvent(event.id)

    if (result.success) {
      router.push('/events')
      router.refresh()
    } else {
      setError(result.error || 'Failed to delete event')
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-600">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {!showConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Delete Event</p>
              <p className="text-sm text-gray-500">
                Permanently delete this event and all its tournaments
              </p>
            </div>
            <Button variant="danger" onClick={() => setShowConfirm(true)}>
              Delete Event
            </Button>
          </div>
        ) : (
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="font-medium text-red-800 mb-2">
              Are you sure you want to delete &quot;{event.name}&quot;?
            </p>
            <p className="text-sm text-red-600 mb-4">
              This will permanently delete the event, all {event.tournaments.length} tournament(s), 
              all team registrations, matches, and results. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="danger"
                onClick={handleDelete}
                loading={loading}
              >
                Yes, Delete Event
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
