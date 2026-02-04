import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getTournamentSchedule } from '@/actions/schedule'
import { getGroupStandings, type GroupStandings } from '@/actions/match'
import { getBracketStages, getBracketMatches } from '@/actions/bracket'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { ScheduleView } from '@/components/schedule/schedule-view'
import { ScheduleActions } from '@/components/schedule/schedule-actions'
import { CompactStandingsDisplay } from '@/components/standings/group-standings'
import { BracketView } from '@/components/brackets'
import { StageType, ScheduledMatch } from '@/types'

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

  // Get group stages for standings display (regular groups and round robin, not GSL)
  const groupStages = await db.stage.findMany({
    where: {
      tournamentId,
      type: { in: ['GROUP_STAGE', 'ROUND_ROBIN'] },
    },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })

  // Fetch standings server-side for each group stage
  const stageStandings: Array<{ stageId: string; stageName: string; standings: GroupStandings[] }> = []
  for (const stage of groupStages) {
    const result = await getGroupStandings(stage.id)
    if (result.success && result.data && result.data.length > 0) {
      stageStandings.push({
        stageId: stage.id,
        stageName: stage.name,
        standings: result.data,
      })
    }
  }

  // Fetch bracket stages for compact display (including GSL groups)
  const bracketStagesResult = await getBracketStages(tournamentId)
  const bracketStages = bracketStagesResult.success ? bracketStagesResult.data || [] : []

  // Get matches for bracket stages (knockout, double elimination, final, AND GSL groups)
  const bracketViews: Array<{
    stageId: string
    stageName: string
    stageType: StageType
    matches: ScheduledMatch[]
    groups?: Array<{ id: string; name: string }>
    matchesByGroup?: Record<string, ScheduledMatch[]>
  }> = []

  for (const stage of bracketStages) {
    const matchesResult = await getBracketMatches(stage.id)
    if (matchesResult.success && matchesResult.data && matchesResult.data.length > 0) {
      const bracketEntry: typeof bracketViews[0] = {
        stageId: stage.id,
        stageName: stage.name,
        stageType: stage.type,
        matches: matchesResult.data,
      }
      
      // For GSL groups, organize matches by group
      if (stage.type === 'GSL_GROUPS' && stage.groups.length > 0) {
        bracketEntry.groups = stage.groups
        bracketEntry.matchesByGroup = {}
        for (const group of stage.groups) {
          bracketEntry.matchesByGroup[group.id] = matchesResult.data.filter(m => m.group?.id === group.id)
        }
      }
      
      bracketViews.push(bracketEntry)
    }
  }

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
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/standings`}>
            <Button variant="secondary">📊 Standings</Button>
          </Link>
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

      {/* Quick Standings (if group stages exist and have standings data) */}
      {stageStandings.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Quick Standings</h2>
            <Link href={`/events/${eventId}/tournaments/${tournamentId}/standings`} className="text-sm text-blue-600 hover:underline">
              View Full Standings →
            </Link>
          </div>
          {stageStandings.map(({ stageId, stageName, standings }) => (
            <div key={stageId}>
              <h3 className="text-sm font-medium text-gray-600 mb-2">{stageName}</h3>
              <CompactStandingsDisplay standings={standings} />
            </div>
          ))}
        </div>
      )}

      {/* Bracket Progress (GSL groups, knockout, double elimination, finals) */}
      {bracketViews.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Bracket Progress</h2>
            <Link href={`/events/${eventId}/tournaments/${tournamentId}/standings`} className="text-sm text-blue-600 hover:underline">
              View Full Brackets →
            </Link>
          </div>
          {bracketViews.map(({ stageId, stageName, stageType, matches, groups, matchesByGroup }) => (
            <div key={stageId} className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">{stageName}</h3>
              </div>
              <div className="overflow-x-auto">
                {stageType === 'GSL_GROUPS' && groups && matchesByGroup ? (
                  // GSL: Show bracket for each group
                  <div className="divide-y divide-gray-100">
                    {groups.map(group => {
                      const groupMatches = matchesByGroup[group.id] || []
                      if (groupMatches.length === 0) return null
                      return (
                        <BracketView 
                          key={group.id}
                          matches={groupMatches} 
                          stageType={stageType}
                          groupName={group.name}
                          compact={true}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <BracketView 
                    matches={matches} 
                    stageType={stageType}
                    stageName={stageName}
                    compact={true}
                  />
                )}
              </div>
            </div>
          ))}
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
