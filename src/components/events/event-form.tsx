'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createEvent } from '@/actions/event'

export function EventForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    
    const result = await createEvent({
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      startDate: new Date(formData.get('startDate') as string),
      endDate: new Date(formData.get('endDate') as string),
    })

    setLoading(false)

    if (result.success && result.data) {
      router.push(`/events/${result.data.id}`)
    } else {
      setError(result.error || 'Failed to create event')
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Event</CardTitle>
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
            label="Event Name"
            placeholder="e.g., Indoor Football Championship 2025"
            required
            error={errors.name}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe your event..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="startDate"
              label="Start Date"
              type="date"
              required
              error={errors.startDate}
            />
            <Input
              name="endDate"
              label="End Date"
              type="date"
              required
              error={errors.endDate}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>
              Create Event
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
