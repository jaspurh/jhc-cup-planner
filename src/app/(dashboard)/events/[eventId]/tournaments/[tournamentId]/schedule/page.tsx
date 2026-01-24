import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getTournamentSchedule } from '@/actions/schedule'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScheduledMatch } from '@/types'

interface SchedulePageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TournamentSchedulePage({ params }: SchedulePageProps) {
  const { eventId, tournamentId } = await params

  const [tournamentResult, scheduleResult] = await Promise.all([
    getTournament(tournamentId),
    getTournamentSchedule(tournamentId),
  ])

  if (!tournamentResult.success || !tournamentResult.data) {
    notFound()
  }

  const tournament = tournamentResult.data
  const matches = scheduleResult.success ? scheduleResult.data || [] : []

  // Group matches by stage
  const matchesByStage = matches.reduce((acc, match) => {
    const stageId = match.stage.id
    if (!acc[stageId]) {
      acc[stageId] = {
        stageName: match.stage.name,
        stageType: match.stage.type,
        matches: [],
      }
    }
    acc[stageId].matches.push(match)
    return acc
  }, {} as Record<string, { stageName: string; stageType: string; matches: ScheduledMatch[] }>)

  // Group matches by pitch for timeline view
  const matchesByPitch = matches.reduce((acc, match) => {
    const pitchId = match.pitch?.id || 'unassigned'
    const pitchName = match.pitch?.name || 'Unassigned'
    if (!acc[pitchId]) {
      acc[pitchId] = { pitchName, matches: [] }
    }
    acc[pitchId].matches.push(match)
    return acc
  }, {} as Record<string, { pitchName: string; matches: ScheduledMatch[] }>)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`} className="hover:underline">
              ← Back to Configuration
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">Match Schedule</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
            <Button variant="secondary">Edit Configuration</Button>
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Matches</p>
          <p className="text-2xl font-bold text-gray-900">{matches.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Stages</p>
          <p className="text-2xl font-bold text-gray-900">{Object.keys(matchesByStage).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Pitches Used</p>
          <p className="text-2xl font-bold text-gray-900">{Object.keys(matchesByPitch).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-900">
            {matches.filter(m => m.status === 'COMPLETED').length}
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <p className="text-gray-500 mb-4">No matches scheduled yet.</p>
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
            <Button>Configure Tournament</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Timeline View by Pitch */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h2 className="font-semibold text-gray-900">Schedule by Pitch</h2>
            </div>
            <div className="divide-y">
              {Object.entries(matchesByPitch).map(([pitchId, { pitchName, matches: pitchMatches }]) => (
                <div key={pitchId} className="p-4">
                  <h3 className="font-medium text-gray-900 mb-3">{pitchName}</h3>
                  <div className="space-y-2">
                    {pitchMatches
                      .sort((a, b) => {
                        const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
                        const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
                        return aTime - bTime
                      })
                      .map((match) => (
                        <MatchRow key={match.id} match={match} showPitch={false} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Match List */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h2 className="font-semibold text-gray-900">All Matches</h2>
            </div>
            <div className="divide-y">
              {matches
                .sort((a, b) => {
                  const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
                  const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
                  return aTime - bTime
                })
                .map((match) => (
                  <MatchRow key={match.id} match={match} showPitch={true} />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MatchRow({ match, showPitch }: { match: ScheduledMatch; showPitch: boolean }) {
  const formatTime = (date: Date | null) => {
    if (!date) return '--:--'
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
      <div className="flex items-center gap-4">
        {/* Match Number */}
        <div className="w-12 text-center">
          <span className="text-sm font-medium text-gray-500">#{match.matchNumber}</span>
        </div>

        {/* Time */}
        <div className="w-20">
          <span className="font-mono text-sm font-semibold text-gray-900">{formatTime(match.scheduledStartTime)}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-2 min-w-[300px]">
          <span className={`${match.homeTeam ? 'text-gray-900 font-medium' : 'text-gray-500 italic text-sm'}`}>
            {match.homeTeam?.teamName || match.homeTeamSource || 'TBD'}
          </span>
          <span className="text-gray-400">vs</span>
          <span className={`${match.awayTeam ? 'text-gray-900 font-medium' : 'text-gray-500 italic text-sm'}`}>
            {match.awayTeam?.teamName || match.awayTeamSource || 'TBD'}
          </span>
        </div>

        {/* Result (if completed) */}
        {match.result && (
          <div className="font-bold text-gray-900">
            {match.result.homeScore} - {match.result.awayScore}
            {match.result.homePenalties !== null && (
              <span className="text-sm text-gray-500 ml-1">
                ({match.result.homePenalties}-{match.result.awayPenalties} pen)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Stage/Group */}
        <div className="text-sm text-gray-500">
          {match.stage.name}
          {match.group && <span> • {match.group.name}</span>}
        </div>

        {/* Pitch */}
        {showPitch && match.pitch && (
          <span className="text-sm text-gray-500">{match.pitch.name}</span>
        )}

        {/* Status */}
        {getStatusBadge(match.status)}
      </div>
    </div>
  )
}
