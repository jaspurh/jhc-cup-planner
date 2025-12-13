import { Card, CardContent } from '@/components/ui/card'

interface SuccessPageProps {
  searchParams: Promise<{ 
    tournament?: string
    event?: string
    invited?: string 
  }>
}

export default async function RegistrationSuccessPage({ searchParams }: SuccessPageProps) {
  const { tournament, event, invited } = await searchParams
  const wasInvited = invited === 'true'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="max-w-lg w-full">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Complete!</h2>
          
          {tournament && event && (
            <p className="text-gray-600 mb-4">
              You have been registered for <strong>{tournament}</strong> at <strong>{event}</strong>.
            </p>
          )}
          
          <p className="text-gray-500 mb-6">
            {wasInvited 
              ? 'Your team has been confirmed for the tournament.'
              : 'Your registration has been submitted and is pending confirmation by the organizer.'}
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">What happens next?</p>
            <p>
              {wasInvited 
                ? 'You will receive tournament updates and schedule information at the email address provided.'
                : 'The organizer will review your registration. You will receive a confirmation email once approved.'}
            </p>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            You can close this page now.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
