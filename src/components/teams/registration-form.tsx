'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { quickRegisterTeam } from '@/actions/team'
import type { ClubSummary } from '@/types'

interface RegistrationFormProps {
  tournamentId: string
  tournamentName: string
  eventName: string
  invitationToken?: string
  prefillData?: {
    teamName?: string
    contactName?: string
    contactEmail?: string
  }
  clubs?: ClubSummary[]
}

export function RegistrationForm({ 
  tournamentId, 
  tournamentName, 
  eventName,
  invitationToken,
  prefillData,
  clubs = [],
}: RegistrationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    const primaryClubId = formData.get('primaryClubId') as string
    const secondaryClubId = formData.get('secondaryClubId') as string

    const result = await quickRegisterTeam({
      tournamentId,
      teamName: formData.get('teamName') as string,
      contactName: formData.get('contactName') as string,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string || undefined,
      invitationToken,
      primaryClubId: primaryClubId || null,
      secondaryClubId: secondaryClubId || null,
    })

    setLoading(false)

    if (result.success) {
      // Redirect to success page
      const params = new URLSearchParams({
        tournament: tournamentName,
        event: eventName,
        invited: invitationToken ? 'true' : 'false',
      })
      router.push(`/register/success?${params.toString()}`)
    } else {
      setError(result.error || 'Failed to register')
    }
  }

  const hasClubs = clubs.length > 0

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Register Your Team</CardTitle>
        <CardDescription>
          {tournamentName} • {eventName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Input
            name="teamName"
            label="Team Name"
            placeholder="Enter your team name"
            defaultValue={prefillData?.teamName}
            required
          />

          <Input
            name="contactName"
            label="Contact Person"
            placeholder="Your name"
            defaultValue={prefillData?.contactName}
            required
          />

          <Input
            name="contactEmail"
            type="email"
            label="Email Address"
            placeholder="your@email.com"
            defaultValue={prefillData?.contactEmail}
            required
          />

          <Input
            name="contactPhone"
            type="tel"
            label="Phone Number (optional)"
            placeholder="+45 12 34 56 78"
          />

          {/* Club Affiliation Section */}
          {hasClubs && (
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Club Affiliation (optional)
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label htmlFor="primaryClubId" className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Club
                  </label>
                  <select
                    id="primaryClubId"
                    name="primaryClubId"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No club / Independent</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}{club.fullName ? ` - ${club.fullName}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    The club your team is mainly affiliated with
                  </p>
                </div>

                <div>
                  <label htmlFor="secondaryClubId" className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Club (optional)
                  </label>
                  <select
                    id="secondaryClubId"
                    name="secondaryClubId"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}{club.fullName ? ` - ${club.fullName}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    If some players are from another club
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Register Team
          </Button>

          <p className="text-xs text-center text-gray-500">
            By registering, you agree to receive tournament-related communications.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
