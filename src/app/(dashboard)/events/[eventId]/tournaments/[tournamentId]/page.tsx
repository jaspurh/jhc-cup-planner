import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTournament } from '@/actions/tournament'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { formatTournamentFormat, formatTournamentStyle, formatStageType } from '@/lib/constants'

interface TournamentPageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { eventId, tournamentId } = await params
  const result = await getTournament(tournamentId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const tournament = result.data

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/events" className="hover:text-gray-700">Events</Link>
        <span className="mx-2">/</span>
        <Link href={`/events/${eventId}`} className="hover:text-gray-700">{tournament.event.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{tournament.name}</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          <p className="text-gray-500 mt-1">
            {formatTournamentFormat(tournament.format)} • {formatTournamentStyle(tournament.style)}
          </p>
          {tournament.description && (
            <p className="text-gray-600 mt-2">{tournament.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/schedule`}>
            <Button variant="secondary">Schedule</Button>
          </Link>
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
            <Button variant="secondary">Configure</Button>
          </Link>
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Teams</p>
            <p className="text-2xl font-bold text-gray-900">{tournament.teams.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Stages</p>
            <p className="text-2xl font-bold text-gray-900">{tournament.stages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Match Duration</p>
            <p className="text-2xl font-bold text-gray-900">{tournament.matchDurationMinutes} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-500">Pitches</p>
            <p className="text-2xl font-bold text-gray-900">{tournament.pitches.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Teams */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Teams ({tournament.teams.length})</CardTitle>
              <Link href={`/events/${eventId}/tournaments/${tournamentId}/teams`}>
                <Button variant="secondary" size="sm">Manage Teams</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {tournament.teams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">No teams registered yet</p>
                <Link href={`/events/${eventId}/tournaments/${tournamentId}/teams`}>
                  <Button size="sm">Invite Teams</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {tournament.teams.slice(0, 5).map((reg) => (
                  <div key={reg.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{reg.team.name}</p>
                      {reg.team.contactName && (
                        <p className="text-sm text-gray-500">{reg.team.contactName}</p>
                      )}
                    </div>
                    <StatusBadge status={reg.status} />
                  </div>
                ))}
                {tournament.teams.length > 5 && (
                  <Link 
                    href={`/events/${eventId}/tournaments/${tournamentId}/teams`}
                    className="block text-center text-sm text-blue-600 hover:underline pt-2"
                  >
                    View all {tournament.teams.length} teams →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stages */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Stages</CardTitle>
              <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
                <Button variant="secondary" size="sm">Configure</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {tournament.stages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No stages configured yet</p>
            ) : (
              <div className="space-y-3">
                {tournament.stages.map((stage, index) => (
                  <div key={stage.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {index + 1}. {stage.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatStageType(stage.type)} • {stage.matchCount} matches
                        </p>
                      </div>
                      {stage.gapMinutesBefore > 0 && (
                        <span className="text-xs text-gray-400">
                          +{stage.gapMinutesBefore} min gap
                        </span>
                      )}
                    </div>
                    {stage.groups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stage.groups.map((group) => (
                          <span 
                            key={group.id}
                            className="text-xs bg-white px-2 py-1 rounded border"
                          >
                            {group.name} ({group.teams.length} teams)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
