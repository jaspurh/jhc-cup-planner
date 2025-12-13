import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/actions/event'
import { BrandingSettings } from '@/components/events/branding-settings'
import { EventDetailsForm, EventDeleteSection } from '@/components/events/event-details-form'
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
        {/* Event Details Form */}
        <EventDetailsForm event={event} />

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
        <EventDeleteSection event={event} />
      </div>
    </div>
  )
}
