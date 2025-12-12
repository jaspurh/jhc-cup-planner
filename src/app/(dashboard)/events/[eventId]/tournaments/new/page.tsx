import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEvent } from '@/actions/event'
import { TournamentForm } from '@/components/tournaments/tournament-form'

interface NewTournamentPageProps {
  params: Promise<{ eventId: string }>
}

export default async function NewTournamentPage({ params }: NewTournamentPageProps) {
  const { eventId } = await params
  const result = await getEvent(eventId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <Link href={`/events/${eventId}`} className="hover:text-gray-700">{event.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New Tournament</span>
      </nav>

      <TournamentForm eventId={eventId} eventName={event.name} />
    </div>
  )
}
