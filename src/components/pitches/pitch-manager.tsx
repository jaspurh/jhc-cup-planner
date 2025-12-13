'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createPitch, toggleTournamentPitch, selectAllPitchesForTournament } from '@/actions/pitch'
import type { Pitch, Venue } from '@/generated/prisma'

interface TournamentPitchData {
  pitch: Pitch & { venue: Venue | null }
  isSelected: boolean
  tournamentPitchId: string | null
  matchCount: number
}

interface PitchManagerProps {
  tournamentId: string
  eventId: string
  initialPitches: TournamentPitchData[]
}

export function PitchManager({ tournamentId, eventId, initialPitches }: PitchManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [newPitchName, setNewPitchName] = useState('')
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
      // Also select it for this tournament
      await toggleTournamentPitch(tournamentId, result.data!.id, true)
      refreshData()
    } else {
      setError(result.error || 'Failed to create pitch')
    }
  }

  const handleTogglePitch = async (pitchId: string, isSelected: boolean) => {
    setError(null)
    const result = await toggleTournamentPitch(tournamentId, pitchId, !isSelected)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to update pitch selection')
    }
  }

  const handleSelectAll = async () => {
    setError(null)
    const result = await selectAllPitchesForTournament(tournamentId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to select all pitches')
    }
  }

  const selectedCount = pitches.filter(p => p.isSelected).length

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Playing Fields</CardTitle>
            <CardDescription>
              Select which pitches to use for this tournament ({selectedCount} of {pitches.length} selected)
            </CardDescription>
          </div>
          {pitches.length > 0 && selectedCount < pitches.length && (
            <Button variant="secondary" size="sm" onClick={handleSelectAll} disabled={isPending}>
              Select All
            </Button>
          )}
        </div>
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
            Add
          </Button>
        </div>

        {/* Pitch list */}
        {pitches.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No pitches available. Add pitches above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {pitches.map(({ pitch, isSelected, matchCount }) => (
              <div
                key={pitch.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTogglePitch(pitch.id, isSelected)}
                    disabled={isPending || (isSelected && matchCount > 0)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{pitch.name}</p>
                    {pitch.venue && (
                      <p className="text-sm text-gray-500">{pitch.venue.name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {pitch.capacity && <span>{pitch.capacity} capacity</span>}
                  {matchCount > 0 && (
                    <span className="text-blue-600">{matchCount} matches</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
