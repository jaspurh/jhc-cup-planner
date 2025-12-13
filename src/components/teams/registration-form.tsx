'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { quickRegisterTeam } from '@/actions/team'

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
}

export function RegistrationForm({ 
  tournamentId, 
  tournamentName, 
  eventName,
  invitationToken,
  prefillData 
}: RegistrationFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    const result = await quickRegisterTeam({
      tournamentId,
      teamName: formData.get('teamName') as string,
      contactName: formData.get('contactName') as string,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string || undefined,
      invitationToken,
    })

    setLoading(false)

    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error || 'Failed to register')
    }
  }

  if (success) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Complete!</h2>
          <p className="text-gray-500 mb-4">
            {invitationToken 
              ? 'Your team has been confirmed for the tournament.'
              : 'Your registration has been submitted and is pending confirmation.'}
          </p>
          <p className="text-sm text-gray-400">
            You will receive updates at the email address provided.
          </p>
        </CardContent>
      </Card>
    )
  }

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
