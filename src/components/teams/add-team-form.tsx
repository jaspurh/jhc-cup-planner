'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createInvitation } from '@/actions/invitation'
import { addTeamDirectly } from '@/actions/team'

interface AddTeamFormProps {
  tournamentId: string
  tournamentName: string
}

type AddMode = 'invite' | 'direct'

export function AddTeamForm({ tournamentId, tournamentName }: AddTeamFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<AddMode>('invite')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const name = formData.get('name') as string
    const teamName = formData.get('teamName') as string

    if (mode === 'invite') {
      // Send invitation
      const result = await createInvitation({
        tournamentId,
        contactEmail: email,
        contactName: name || undefined,
        teamName: teamName || undefined,
        message: formData.get('message') as string || undefined,
      })

      if (result.success) {
        setSuccess('Invitation sent successfully! The team will receive an email with registration link.')
        e.currentTarget.reset()
        startTransition(() => router.refresh())
      } else {
        setError(result.error || 'Failed to send invitation')
      }
    } else {
      // Add team directly
      if (!teamName.trim()) {
        setError('Team name is required when adding directly')
        return
      }

      const result = await addTeamDirectly({
        tournamentId,
        teamName: teamName.trim(),
        contactName: name || undefined,
        contactEmail: email || undefined,
        contactPhone: formData.get('phone') as string || undefined,
      })

      if (result.success) {
        setSuccess(`Team "${teamName}" has been added and confirmed for the tournament!`)
        e.currentTarget.reset()
        startTransition(() => router.refresh())
      } else {
        setError(result.error || 'Failed to add team')
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Team</CardTitle>
        <CardDescription>
          {mode === 'invite' 
            ? `Send an invitation for ${tournamentName}` 
            : `Directly add a team to ${tournamentName}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => { setMode('invite'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'invite'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📧 Send Invitation
          </button>
          <button
            type="button"
            onClick={() => { setMode('direct'); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'direct'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ➕ Add Directly
          </button>
        </div>

        {/* Mode Description */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          {mode === 'invite' ? (
            <>
              <strong>Send Invitation:</strong> The team contact will receive an email with a 
              registration link. They complete the registration themselves.
            </>
          ) : (
            <>
              <strong>Add Directly:</strong> Add the team immediately to the tournament as confirmed. 
              No email will be sent. Use this for walk-ups or phone registrations.
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
              {success}
            </div>
          )}

          <Input
            name="teamName"
            label={mode === 'invite' ? 'Team Name (optional)' : 'Team Name'}
            placeholder="Enter team name"
            required={mode === 'direct'}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="name"
              label="Contact Name"
              placeholder="John Doe"
              required={mode === 'direct'}
            />
            <Input
              name="email"
              type="email"
              label={mode === 'invite' ? 'Email Address' : 'Email (optional)'}
              placeholder="contact@team.com"
              required={mode === 'invite'}
            />
          </div>

          {mode === 'direct' && (
            <Input
              name="phone"
              label="Phone (optional)"
              placeholder="+45 12 34 56 78"
            />
          )}

          {mode === 'invite' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message (optional)
              </label>
              <textarea
                name="message"
                rows={2}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add a personal message to the invitation..."
              />
            </div>
          )}

          <Button type="submit" loading={isPending} className="w-full">
            {mode === 'invite' ? '📧 Send Invitation' : '➕ Add Team to Tournament'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
