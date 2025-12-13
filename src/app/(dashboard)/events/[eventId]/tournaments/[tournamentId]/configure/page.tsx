import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getTournamentRegistrations } from '@/actions/team'
import { getTournamentPitches } from '@/actions/pitch'
import { getStagesWithDetails } from '@/actions/stage'
import { Button } from '@/components/ui/button'
import { PitchManager } from '@/components/pitches/pitch-manager'
import { StageBuilder } from '@/components/stages/stage-builder'

interface ConfigurePageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TournamentConfigurePage({ params }: ConfigurePageProps) {
  const { eventId, tournamentId } = await params

  const [tournamentResult, registrationsResult, pitchesResult, stagesResult] = await Promise.all([
    getTournament(tournamentId),
    getTournamentRegistrations(tournamentId),
    getTournamentPitches(tournamentId),
    getStagesWithDetails(tournamentId),
  ])

  if (!tournamentResult.success || !tournamentResult.data) {
    notFound()
  }

  const tournament = tournamentResult.data
  const registrations = registrationsResult.success ? registrationsResult.data?.registrations || [] : []
  const pitches = pitchesResult.success ? pitchesResult.data || [] : []
  const stages = stagesResult.success ? stagesResult.data || [] : []

  const confirmedTeams = registrations.filter(r => r.status === 'CONFIRMED')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/events/${eventId}`} className="hover:underline">
              ← Back to Event
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">Tournament Configuration</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/tournaments/${tournamentId}`}>
            <Button variant="secondary">View Details</Button>
          </Link>
          <Button disabled>Generate Schedule</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Confirmed Teams</p>
          <p className="text-2xl font-bold text-gray-900">{confirmedTeams.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Pitches Selected</p>
          <p className="text-2xl font-bold text-gray-900">{pitches.filter(p => p.isSelected).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Stages</p>
          <p className="text-2xl font-bold text-gray-900">{stages.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Groups</p>
          <p className="text-2xl font-bold text-gray-900">
            {stages.reduce((sum, s) => sum + s.groups.length, 0)}
          </p>
        </div>
      </div>

      {/* Pitch Selection */}
      <PitchManager
        tournamentId={tournamentId}
        eventId={tournament.eventId}
        initialPitches={pitches}
      />

      {/* Stage Builder */}
      <StageBuilder
        tournamentId={tournamentId}
        initialStages={stages}
        confirmedTeams={confirmedTeams}
      />
    </div>
  )
}
