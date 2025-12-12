import Link from 'next/link'
import { EventForm } from '@/components/events/event-form'

export default function NewEventPage() {
  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New Event</span>
      </nav>

      <EventForm />
    </div>
  )
}
