import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/actions/tournament'
import { getGroupStandings, type GroupStandings } from '@/actions/match'
import { getBracketStages, getBracketMatches, getGSLGroupMatches } from '@/actions/bracket'
import { db } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { BracketView, supportsBracketView } from '@/components/brackets'
import { StageType, ScheduledMatch } from '@/types'

interface StandingsPageProps {
  params: Promise<{ eventId: string; tournamentId: string }>
}

export default async function TournamentStandingsPage({ params }: StandingsPageProps) {
  const { eventId, tournamentId } = await params

  const tournamentResult = await getTournament(tournamentId)

  if (!tournamentResult.success || !tournamentResult.data) {
    notFound()
  }

  const tournament = tournamentResult.data

  // Get all group stages for this tournament (for standings tables)
  const groupStages = await db.stage.findMany({
    where: {
      tournamentId,
      type: { in: ['GROUP_STAGE', 'ROUND_ROBIN'] },
    },
    orderBy: { order: 'asc' },
  })

  // Get standings for regular group stages
  const stageStandings: Array<{ stage: typeof groupStages[0]; standings: GroupStandings[] }> = []
  
  for (const stage of groupStages) {
    const result = await getGroupStandings(stage.id)
    if (result.success && result.data) {
      stageStandings.push({ stage, standings: result.data })
    }
  }

  // Get bracket stages (GSL, Knockout, Double Elimination, Final)
  const bracketStagesResult = await getBracketStages(tournamentId)
  const bracketStages = bracketStagesResult.success ? bracketStagesResult.data || [] : []

  // Fetch matches for each bracket stage
  const bracketData: Array<{
    stage: typeof bracketStages[0]
    matches: ScheduledMatch[]
    matchesByGroup?: Record<string, ScheduledMatch[]>
  }> = []

  for (const stage of bracketStages) {
    const matchesResult = await getBracketMatches(stage.id)
    if (matchesResult.success && matchesResult.data) {
      const matches = matchesResult.data
      
      // For GSL stages, also group by group
      if (stage.type === 'GSL_GROUPS' && stage.groups.length > 0) {
        const matchesByGroup: Record<string, ScheduledMatch[]> = {}
        for (const group of stage.groups) {
          matchesByGroup[group.id] = matches.filter(m => m.group?.id === group.id)
        }
        bracketData.push({ stage, matches, matchesByGroup })
      } else {
        bracketData.push({ stage, matches })
      }
    }
  }

  const hasContent = stageStandings.length > 0 || bracketData.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/events/${eventId}/tournaments/${tournamentId}/schedule`} className="hover:underline">
              ← Back to Schedule
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">Tournament Standings</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/tournaments/${tournamentId}/schedule`}>
            <Button variant="secondary">View Schedule</Button>
          </Link>
        </div>
      </div>

      {!hasContent ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Stages Yet</h2>
            <p className="text-gray-500 mb-6">
              This tournament doesn&apos;t have any stages with standings or brackets.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Regular Group Stage Standings (tables) */}
          {stageStandings.map(({ stage, standings }) => (
            <div key={stage.id}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{stage.name}</h2>
              
              {standings.length === 0 ? (
                <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
                  No matches completed yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {standings.map(group => (
                    <GroupTable key={group.groupId} group={group} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Bracket Stages (GSL, Knockout, Double Elimination) */}
          {bracketData.map(({ stage, matches, matchesByGroup }) => (
            <div key={stage.id} className="bg-white rounded-lg border overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h2 className="text-xl font-semibold text-gray-900">{stage.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {stage.type === 'GSL_GROUPS' && 'GSL Format Bracket'}
                  {stage.type === 'KNOCKOUT' && 'Single Elimination Bracket'}
                  {stage.type === 'DOUBLE_ELIMINATION' && 'Double Elimination Bracket'}
                  {stage.type === 'FINAL' && 'Finals'}
                </p>
              </div>
              
              {matches.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No matches scheduled yet
                </div>
              ) : stage.type === 'GSL_GROUPS' && matchesByGroup ? (
                // GSL: Show bracket for each group
                <div className="divide-y divide-gray-200">
                  {stage.groups.map(group => {
                    const groupMatches = matchesByGroup[group.id] || []
                    if (groupMatches.length === 0) return null
                    return (
                      <div key={group.id} className="p-4">
                        <BracketView 
                          matches={groupMatches} 
                          stageType={stage.type as StageType}
                          stageName={stage.name}
                          groupName={group.name}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Knockout/Double Elimination: Single bracket view
                <div className="p-4">
                  <BracketView 
                    matches={matches} 
                    stageType={stage.type as StageType}
                    stageName={stage.name}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-medium text-gray-900 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span><strong>P</strong> = Played</span>
          <span><strong>W</strong> = Won</span>
          <span><strong>D</strong> = Drawn</span>
          <span><strong>L</strong> = Lost</span>
          <span><strong>GF</strong> = Goals For</span>
          <span><strong>GA</strong> = Goals Against</span>
          <span><strong>GD</strong> = Goal Difference</span>
          <span><strong>Pts</strong> = Points (3 for win, 1 for draw)</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          <span className="inline-block w-4 h-4 bg-green-500 rounded-full align-middle mr-1"></span>
          Green positions indicate qualification for next stage
        </p>
      </div>
    </div>
  )
}

function GroupTable({ group }: { group: GroupStandings }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">{group.groupName}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-center w-10">P</th>
              <th className="px-3 py-2 text-center w-10">W</th>
              <th className="px-3 py-2 text-center w-10">D</th>
              <th className="px-3 py-2 text-center w-10">L</th>
              <th className="px-3 py-2 text-center w-12">GF</th>
              <th className="px-3 py-2 text-center w-12">GA</th>
              <th className="px-3 py-2 text-center w-12">GD</th>
              <th className="px-3 py-2 text-center w-12 font-bold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {group.standings.map((team, index) => (
              <tr 
                key={team.registrationId} 
                className={`${index < 2 ? 'bg-green-50' : ''} hover:bg-gray-50`}
              >
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    index < 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {team.position}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-gray-900">{team.teamName}</td>
                <td className="px-3 py-2 text-center text-gray-600">{team.played}</td>
                <td className="px-3 py-2 text-center text-green-600 font-medium">{team.won}</td>
                <td className="px-3 py-2 text-center text-gray-500">{team.drawn}</td>
                <td className="px-3 py-2 text-center text-red-600">{team.lost}</td>
                <td className="px-3 py-2 text-center text-gray-600">{team.goalsFor}</td>
                <td className="px-3 py-2 text-center text-gray-600">{team.goalsAgainst}</td>
                <td className="px-3 py-2 text-center font-medium">
                  <span className={team.goalDifference > 0 ? 'text-green-600' : team.goalDifference < 0 ? 'text-red-600' : 'text-gray-500'}>
                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-bold text-gray-900">{team.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
