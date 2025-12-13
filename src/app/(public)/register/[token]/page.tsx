import { notFound } from 'next/navigation'
import { getInvitationByToken } from '@/actions/invitation'
import { RegistrationForm } from '@/components/teams/registration-form'
import { Card, CardContent } from '@/components/ui/card'

interface RegisterPageProps {
  params: Promise<{ token: string }>
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { token } = await params
  const result = await getInvitationByToken(token)

  if (!result.success || !result.data) {
    notFound()
  }

  const { invitation } = result.data

  // Check if invitation is still valid
  if (invitation.status === 'REGISTERED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Registered</h2>
            <p className="text-gray-500">
              This invitation has already been used to register a team.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Cancelled</h2>
            <p className="text-gray-500">
              This invitation is no longer valid. Please contact the organizer.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = new Date(invitation.expiresAt) < new Date()
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h2>
            <p className="text-gray-500">
              This invitation has expired. Please contact the organizer for a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{invitation.tournament.eventName}</h1>
        <p className="text-gray-500 mt-2">Tournament: {invitation.tournament.name}</p>
      </div>

      <RegistrationForm
        tournamentId={invitation.tournament.id}
        tournamentName={invitation.tournament.name}
        eventName={invitation.tournament.eventName}
        invitationToken={token}
        prefillData={{
          teamName: invitation.teamName || undefined,
          contactName: invitation.contactName || undefined,
          contactEmail: invitation.contactEmail,
        }}
      />
    </div>
  )
}
