import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getTournamentRegistrations } from '@/actions/team'
import { getTournamentPitches } from '@/actions/pitch'
import { getStagesWithDetails } from '@/actions/stage'
import { getTournamentRoles } from '@/actions/roles'
import { Button } from '@/components/ui/button'
import { PitchManager } from '@/components/pitches/pitch-manager'
import { StageBuilder } from '@/components/stages/stage-builder'
import { ScheduleGenerator } from '@/components/schedule/schedule-generator'
import { TournamentFlowDiagram } from '@/components/tournaments/tournament-flow-diagram'
import { TournamentRolesManager } from '@/components/roles/tournament-roles-manager'

interface ConfigurePageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TournamentConfigurePage({ params }: ConfigurePageProps) {
  const { eventId, tournamentId } = await params

  const [tournamentResult, registrationsResult, pitchesResult, stagesResult, rolesResult] = await Promise.all([
    getTournament(tournamentId),
    getTournamentRegistrations(tournamentId),
    getTournamentPitches(tournamentId),
    getStagesWithDetails(tournamentId),
    getTournamentRoles(tournamentId),
  ])

  if (!tournamentResult.success || !tournamentResult.data) {
    notFound()
  }

  const tournament = tournamentResult.data
  const registrations = registrationsResult.success ? registrationsResult.data?.registrations || [] : []
  const pitches = pitchesResult.success ? pitchesResult.data || [] : []
  const stages = stagesResult.success ? stagesResult.data || [] : []
  const roleMembers = rolesResult.success ? rolesResult.data || [] : []

  const confirmedTeams = registrations.filter(r => r.status === 'CONFIRMED')

  // Calculate schedule readiness
  const hasStages = stages.length > 0
  const hasPitches = pitches.filter(p => p.isSelected).length > 0
  const hasTeamsAssigned = stages.some(s => 
    s.groups.some(g => g.teamAssignments && g.teamAssignments.length > 0)
  )
  const hasStartTime = tournament.startTime !== null
  const existingMatchCount = stages.reduce((sum, s) => sum + (s._count?.matches || 0), 0)

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
        <div className="flex gap-2 items-center">
          <Link href={`/events/${eventId}/tournaments/${tournamentId}`}>
            <Button variant="secondary">View Details</Button>
          </Link>
        </div>
      </div>

      {/* Schedule Generator */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-900">Schedule Generation</h2>
            <p className="text-sm text-gray-500">Generate match schedule based on your configuration</p>
          </div>
          <ScheduleGenerator
            tournamentId={tournamentId}
            eventId={eventId}
            hasStages={hasStages}
            hasPitches={hasPitches}
            hasTeams={hasTeamsAssigned}
            hasStartTime={hasStartTime}
            existingMatchCount={existingMatchCount}
          />
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

      {/* Tournament Flow Overview */}
      {stages.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold text-gray-900 mb-1">Tournament Flow</h2>
          <p className="text-sm text-gray-500 mb-4">Stages and advancement pipeline</p>
          <TournamentFlowDiagram
            stages={stages.map(s => ({
              id: s.id,
              name: s.name,
              type: s.type,
              order: s.order,
              configuration: s.configuration as Record<string, unknown> | null,
              groups: s.groups.map(g => ({
                id: g.id,
                name: g.name,
                teams: g.teamAssignments ?? [],
              })),
              matchCount: s._count?.matches ?? 0,
            }))}
          />
        </div>
      )}

      {/* Stage Builder */}
      <StageBuilder
        tournamentId={tournamentId}
        initialStages={stages}
        confirmedTeams={confirmedTeams}
      />

      {/* Team & Access */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-gray-900 mb-1">Team & Access</h2>
        <p className="text-sm text-gray-500 mb-4">
          Control who can manage this tournament. Add users by their account email.
        </p>
        <TournamentRolesManager
          tournamentId={tournamentId}
          initialMembers={roleMembers}
        />
      </div>
    </div>
  )
}
