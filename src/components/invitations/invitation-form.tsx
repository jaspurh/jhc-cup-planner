'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createInvitation } from '@/actions/invitation'

interface InvitationFormProps {
  tournamentId: string
  tournamentName: string
}

export function InvitationForm({ tournamentId, tournamentName }: InvitationFormProps) {
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
    
    const result = await createInvitation({
      tournamentId,
      contactEmail: formData.get('email') as string,
      contactName: formData.get('name') as string || undefined,
      teamName: formData.get('teamName') as string || undefined,
      message: formData.get('message') as string || undefined,
    })

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      e.currentTarget.reset()
      router.refresh()
    } else {
      setError(result.error || 'Failed to send invitation')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Invitation</CardTitle>
        <CardDescription>Invite a team to register for {tournamentName}</CardDescription>
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
              Invitation sent successfully!
            </div>
          )}

          <Input
            name="email"
            type="email"
            label="Email Address"
            placeholder="contact@team.com"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="name"
              label="Contact Name (optional)"
              placeholder="John Doe"
            />
            <Input
              name="teamName"
              label="Team Name (optional)"
              placeholder="Team name suggestion"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (optional)
            </label>
            <textarea
              name="message"
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add a personal message..."
            />
          </div>

          <Button type="submit" loading={loading}>
            Send Invitation
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
