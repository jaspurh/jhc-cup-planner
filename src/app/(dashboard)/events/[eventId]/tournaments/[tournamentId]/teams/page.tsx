import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTournament } from '@/actions/tournament'
import { getTournamentRegistrations } from '@/actions/team'
import { getTournamentInvitations } from '@/actions/invitation'
import { Button } from '@/components/ui/button'
import { TeamList } from '@/components/teams/team-list'
import { AddTeamForm } from '@/components/teams/add-team-form'
import { InvitationList } from '@/components/invitations/invitation-list'
import { CSVImport } from '@/components/invitations/csv-import'

interface TeamsPageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { eventId, tournamentId } = await params
  
  const [tournamentResult, registrationsResult, invitationsResult] = await Promise.all([
    getTournament(tournamentId),
    getTournamentRegistrations(tournamentId),
    getTournamentInvitations(tournamentId),
  ])
  
  if (!tournamentResult.success || !tournamentResult.data) {
    notFound()
  }

  const tournament = tournamentResult.data
  const registrations = registrationsResult.success ? registrationsResult.data?.registrations || [] : []
  const invitations = invitationsResult.success ? invitationsResult.data?.invitations || [] : []

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <Link href={`/events/${eventId}`} className="hover:text-gray-700">{tournament.event.name}</Link>
        <span className="mx-2">/</span>
        <Link href={`/events/${eventId}/tournaments/${tournamentId}`} className="hover:text-gray-700">{tournament.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Teams</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams & Invitations</h1>
          <p className="text-gray-500 mt-1">{tournament.name}</p>
        </div>
        <Link href={`/events/${eventId}/tournaments/${tournamentId}`}>
          <Button variant="secondary">Back to Tournament</Button>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left column: Registered Teams */}
        <div className="space-y-6">
          <TeamList 
            registrations={registrations} 
            tournamentId={tournamentId}
          />
        </div>

        {/* Right column: Add Teams & Invitations */}
        <div className="space-y-6">
          <AddTeamForm 
            tournamentId={tournamentId}
            tournamentName={tournament.name}
          />
          
          <CSVImport 
            tournamentId={tournamentId}
            tournamentName={tournament.name}
          />
          
          <InvitationList 
            invitations={invitations}
            tournamentId={tournamentId}
          />
        </div>
      </div>
    </div>
  )
}
