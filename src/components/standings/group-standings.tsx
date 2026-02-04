'use client'

import { useEffect, useState, useTransition } from 'react'
import { getGroupStandings, type GroupStandings, type TeamStanding } from '@/actions/match'

interface GroupStandingsDisplayProps {
  stageId: string
  stageName: string
}

export function GroupStandingsDisplay({ stageId, stageName }: GroupStandingsDisplayProps) {
  const [standings, setStandings] = useState<GroupStandings[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startTransition(async () => {
      const result = await getGroupStandings(stageId)
      if (result.success && result.data) {
        setStandings(result.data)
      } else {
        setError(result.error || 'Failed to load standings')
      }
    })
  }, [stageId])

  if (isPending) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">Loading standings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (standings.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">No standings available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">{stageName} Standings</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {standings.map(group => (
          <GroupTable key={group.groupId} group={group} />
        ))}
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
              <th className="px-3 py-2 text-center w-14">GF</th>
              <th className="px-3 py-2 text-center w-14">GA</th>
              <th className="px-3 py-2 text-center w-14">GD</th>
              <th className="px-3 py-2 text-center w-12 font-bold">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {group.standings.map((team, index) => (
              <StandingRow key={team.registrationId} team={team} isQualifying={index < 2} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StandingRow({ team, isQualifying }: { team: TeamStanding; isQualifying: boolean }) {
  return (
    <tr className={`${isQualifying ? 'bg-green-50' : ''} hover:bg-gray-50`}>
      <td className="px-3 py-2 text-center">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
          isQualifying ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {team.position}
        </span>
      </td>
      <td className="px-3 py-2 font-medium text-gray-900 truncate max-w-[150px]">
        {team.teamName}
      </td>
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
  )
}

// Compact version for embedding in schedule page (server-side data)
export function CompactStandingsDisplay({ standings }: { standings: GroupStandings[] }) {
  if (standings.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {standings.map(group => (
        <div key={group.groupId} className="bg-white rounded-lg border p-3">
          <h4 className="font-medium text-gray-900 text-sm mb-2">{group.groupName}</h4>
          <div className="space-y-1">
            {group.standings.slice(0, 4).map((team, index) => (
              <div 
                key={team.registrationId} 
                className={`flex justify-between items-center text-xs ${
                  index < 2 
                    ? 'text-gray-900 font-semibold' 
                    : 'text-gray-600'
                }`}
              >
                <span className="truncate flex-1 flex items-center gap-1">
                  <span className="w-3 text-center">{index < 2 ? <span className="text-green-500">●</span> : ''}</span>
                  <span className="w-3 text-right">{team.position}.</span>
                  <span className="truncate">{team.teamName}</span>
                </span>
                <span className="ml-2 font-semibold">{team.points}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Client-side version that fetches its own data (for backwards compatibility)
export function CompactStandings({ stageId }: { stageId: string }) {
  const [standings, setStandings] = useState<GroupStandings[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getGroupStandings(stageId)
      if (result.success && result.data) {
        setStandings(result.data)
      }
    })
  }, [stageId])

  if (isPending || standings.length === 0) {
    return null
  }

  return <CompactStandingsDisplay standings={standings} />
}
