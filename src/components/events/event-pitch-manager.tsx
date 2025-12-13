'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createPitch, updatePitch, deletePitch } from '@/actions/pitch'
import type { Pitch, Venue } from '@/generated/prisma'

interface EventPitch extends Pitch {
  venue: Venue | null
  _count: { matches: number; tournaments: number }
}

interface EventPitchManagerProps {
  eventId: string
  initialPitches: EventPitch[]
}

export function EventPitchManager({ eventId, initialPitches }: EventPitchManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newPitchName, setNewPitchName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pitches = initialPitches

  const refreshData = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleAddPitch = async () => {
    if (!newPitchName.trim()) return

    setError(null)
    const result = await createPitch({ name: newPitchName.trim(), eventId })

    if (result.success) {
      setNewPitchName('')
      refreshData()
    } else {
      setError(result.error || 'Failed to create pitch')
    }
  }

  const handleEditPitch = async (pitchId: string) => {
    if (!editName.trim()) return

    setError(null)
    const result = await updatePitch(pitchId, { name: editName.trim() })

    if (result.success) {
      setEditingId(null)
      setEditName('')
      refreshData()
    } else {
      setError(result.error || 'Failed to update pitch')
    }
  }

  const handleDeletePitch = async (pitchId: string) => {
    if (!confirm('Are you sure you want to delete this pitch?')) return

    setError(null)
    const result = await deletePitch(pitchId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to delete pitch')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playing Fields</CardTitle>
        <CardDescription>
          Manage pitches for this event. Pitches can be assigned to tournaments during configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add new pitch */}
        <div className="flex gap-2">
          <Input
            placeholder="Add new pitch..."
            value={newPitchName}
            onChange={(e) => setNewPitchName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPitch()}
          />
          <Button onClick={handleAddPitch} disabled={!newPitchName.trim() || isPending}>
            Add Pitch
          </Button>
        </div>

        {/* Pitch list */}
        {pitches.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No pitches added yet. Add your first pitch above.
          </p>
        ) : (
          <div className="space-y-2">
            {pitches.map((pitch) => (
              <div
                key={pitch.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
              >
                {editingId === pitch.id ? (
                  <div className="flex gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditPitch(pitch.id)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleEditPitch(pitch.id)} disabled={isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-gray-900">{pitch.name}</p>
                      <div className="flex gap-2 text-sm text-gray-500">
                        {pitch.venue && <span>{pitch.venue.name}</span>}
                        {pitch._count.tournaments > 0 && (
                          <span>• {pitch._count.tournaments} tournament{pitch._count.tournaments !== 1 ? 's' : ''}</span>
                        )}
                        {pitch._count.matches > 0 && (
                          <span>• {pitch._count.matches} match{pitch._count.matches !== 1 ? 'es' : ''}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(pitch.id)
                          setEditName(pitch.name)
                        }}
                        disabled={isPending}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeletePitch(pitch.id)}
                        disabled={isPending || pitch._count.matches > 0 || pitch._count.tournaments > 0}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
