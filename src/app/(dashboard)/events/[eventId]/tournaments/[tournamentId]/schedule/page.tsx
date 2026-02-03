import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getTournamentSchedule, clearTournamentSchedule } from '@/actions/schedule'
import { Button } from '@/components/ui/button'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { ScheduleActions } from '@/components/schedule/schedule-actions'

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

  // Calculate stats
  const totalMatches = matches.length
  const completedMatches = matches.filter(m => m.status === 'COMPLETED').length
  const inProgressMatches = matches.filter(m => m.status === 'IN_PROGRESS').length
  const scheduledMatches = matches.filter(m => m.status === 'SCHEDULED').length
  
  // Get unique stages and pitches
  const uniqueStages = new Set(matches.map(m => m.stage.id)).size
  const uniquePitches = new Set(matches.filter(m => m.pitch).map(m => m.pitch!.id)).size
  
  // Time range
  const sortedMatches = [...matches].sort((a, b) => {
    const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
    const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
    return aTime - bTime
  })
  const firstMatch = sortedMatches[0]
  const lastMatch = sortedMatches[sortedMatches.length - 1]

  return (
    <div className="space-y-6">
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
          <ScheduleActions 
            tournamentId={tournamentId}
            eventId={eventId}
            matchCount={totalMatches}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Matches</p>
          <p className="text-2xl font-bold text-gray-900">{totalMatches}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Stages</p>
          <p className="text-2xl font-bold text-gray-900">{uniqueStages}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Pitches</p>
          <p className="text-2xl font-bold text-gray-900">{uniquePitches}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedMatches}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Time Range</p>
          <p className="text-lg font-bold text-gray-900">
            {firstMatch?.scheduledStartTime 
              ? `${formatTime(firstMatch.scheduledStartTime)} - ${formatTime(lastMatch?.scheduledEndTime)}`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {totalMatches > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Tournament Progress</span>
            <span className="text-gray-900 font-medium">
              {completedMatches} of {totalMatches} matches completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(completedMatches / totalMatches) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Completed: {completedMatches}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              In Progress: {inProgressMatches}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Scheduled: {scheduledMatches}
            </span>
          </div>
        </div>
      )}

      {/* Schedule Content */}
      {matches.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Schedule Yet</h2>
            <p className="text-gray-500 mb-6">
              Configure your tournament stages and teams, then generate a schedule.
            </p>
            <Link href={`/events/${eventId}/tournaments/${tournamentId}/configure`}>
              <Button>Configure Tournament</Button>
            </Link>
          </div>
        </div>
      ) : (
        <ScheduleView 
          matches={matches}
          tournamentId={tournamentId}
          eventId={eventId}
        />
      )}
    </div>
  )
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return '--:--'
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
