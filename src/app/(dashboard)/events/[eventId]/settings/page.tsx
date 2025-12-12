import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/actions/event'
import { BrandingSettings } from '@/components/events/branding-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EventSettingsPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventSettingsPage({ params }: EventSettingsPageProps) {
  const { eventId } = await params
  const result = await getEvent(eventId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <Link href={`/events/${eventId}`} className="hover:text-gray-700">{event.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Settings</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Settings</h1>
          <p className="text-gray-500 mt-1">Configure your event details and branding</p>
        </div>
        <Link href={`/events/${eventId}`}>
          <Button variant="secondary">Back to Event</Button>
        </Link>
      </div>

      <div className="space-y-8">
        {/* Event Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Basic information about your event</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-gray-900 font-medium">{event.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="text-gray-900 font-medium">{event.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Start Date</dt>
                <dd className="text-gray-900 font-medium">
                  {new Date(event.startDate).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">End Date</dt>
                <dd className="text-gray-900 font-medium">
                  {new Date(event.endDate).toLocaleDateString()}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-gray-500">Description</dt>
                <dd className="text-gray-900">{event.description || 'No description'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Branding Settings */}
        <BrandingSettings 
          eventId={eventId}
          initialBranding={{
            logoUrl: event.logoUrl,
            primaryColor: event.primaryColor,
            secondaryColor: event.secondaryColor,
            accentColor: event.accentColor,
          }}
        />

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Delete Event</p>
                <p className="text-sm text-gray-500">
                  Permanently delete this event and all its tournaments
                </p>
              </div>
              <Button variant="danger">Delete Event</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
