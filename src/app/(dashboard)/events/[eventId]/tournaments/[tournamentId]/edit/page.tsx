import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTournament } from '@/actions/tournament'
import { TournamentEditForm } from '@/components/tournaments/tournament-edit-form'

interface EditTournamentPageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function EditTournamentPage({ params }: EditTournamentPageProps) {
  const { eventId, tournamentId } = await params
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const result = await getTournament(tournamentId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const tournament = result.data

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/events" className="hover:text-gray-700">Events</Link>
          <span className="mx-2">/</span>
          <Link href={`/events/${eventId}`} className="hover:text-gray-700">{tournament.event.name}</Link>
          <span className="mx-2">/</span>
          <Link href={`/events/${eventId}/tournaments/${tournamentId}`} className="hover:text-gray-700">{tournament.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Edit</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Edit Tournament</h1>
        <p className="text-gray-500">Update tournament settings</p>
      </div>

      <TournamentEditForm 
        tournament={tournament}
        eventId={eventId}
        eventDates={{ start: tournament.event.startDate, end: tournament.event.endDate }}
      />
    </div>
  )
}
