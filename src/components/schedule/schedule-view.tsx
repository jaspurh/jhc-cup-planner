'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScheduledMatch } from '@/types'
import { MatchDetailModal } from './match-detail-modal'

type ViewMode = 'stage' | 'time' | 'pitch'

interface ScheduleViewProps {
  matches: ScheduledMatch[]
  tournamentId: string
  eventId: string
}

export function ScheduleView({ matches, tournamentId, eventId }: ScheduleViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<ScheduledMatch | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('stage')
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    // Start with all stages expanded
    return new Set(matches.map(m => m.stage.id))
  })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Start with all groups expanded
    return new Set(matches.filter(m => m.group).map(m => `${m.stage.id}-${m.group?.id}`))
  })

  // Toggle stage expansion
  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages)
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId)
    } else {
      newExpanded.add(stageId)
    }
    setExpandedStages(newExpanded)
  }

  // Toggle group expansion
  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  // Expand all
  const expandAll = () => {
    const allStages = new Set(matches.map(m => m.stage.id))
    const allGroups = new Set(matches.filter(m => m.group).map(m => `${m.stage.id}-${m.group?.id}`))
    setExpandedStages(allStages)
    setExpandedGroups(allGroups)
  }

  // Collapse all
  const collapseAll = () => {
    setExpandedStages(new Set())
    setExpandedGroups(new Set())
  }

  // Group matches by stage
  const matchesByStage = matches.reduce((acc, match) => {
    const stageId = match.stage.id
    if (!acc[stageId]) {
      acc[stageId] = {
        stage: match.stage,
        matches: [],
        groups: {} as Record<string, { group: typeof match.group; matches: ScheduledMatch[] }>,
      }
    }
    acc[stageId].matches.push(match)
    
    // Also group by group within stage
    if (match.group) {
      const groupId = match.group.id
      if (!acc[stageId].groups[groupId]) {
        acc[stageId].groups[groupId] = { group: match.group, matches: [] }
      }
      acc[stageId].groups[groupId].matches.push(match)
    }
    
    return acc
  }, {} as Record<string, { 
    stage: ScheduledMatch['stage']; 
    matches: ScheduledMatch[];
    groups: Record<string, { group: typeof matches[0]['group']; matches: ScheduledMatch[] }>;
  }>)

  // Sort stages by first match time
  const sortedStages = Object.values(matchesByStage).sort((a, b) => {
    const aTime = a.matches[0]?.scheduledStartTime ? new Date(a.matches[0].scheduledStartTime).getTime() : 0
    const bTime = b.matches[0]?.scheduledStartTime ? new Date(b.matches[0].scheduledStartTime).getTime() : 0
    return aTime - bTime
  })

  // Group matches by pitch
  const matchesByPitch = matches.reduce((acc, match) => {
    const pitchId = match.pitch?.id || 'unassigned'
    const pitchName = match.pitch?.name || 'Unassigned'
    if (!acc[pitchId]) {
      acc[pitchId] = { pitchName, matches: [] }
    }
    acc[pitchId].matches.push(match)
    return acc
  }, {} as Record<string, { pitchName: string; matches: ScheduledMatch[] }>)

  // All matches sorted by time
  const sortedByTime = [...matches].sort((a, b) => {
    const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
    const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
    return aTime - bTime
  })

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'stage' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('stage')}
          >
            By Stage
          </Button>
          <Button
            variant={viewMode === 'time' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('time')}
          >
            By Time
          </Button>
          <Button
            variant={viewMode === 'pitch' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('pitch')}
          >
            By Pitch
          </Button>
        </div>
        
        {viewMode === 'stage' && (
          <div className="flex gap-2">
            <button 
              onClick={expandAll}
              className="text-sm text-blue-600 hover:underline"
            >
              Expand All
            </button>
            <span className="text-gray-300">|</span>
            <button 
              onClick={collapseAll}
              className="text-sm text-blue-600 hover:underline"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Stage View */}
      {viewMode === 'stage' && (
        <div className="space-y-4">
          {sortedStages.map(({ stage, matches: stageMatches, groups }) => {
            const isExpanded = expandedStages.has(stage.id)
            const stageStart = stageMatches[0]?.scheduledStartTime
            const stageEnd = stageMatches[stageMatches.length - 1]?.scheduledEndTime
            const hasGroups = Object.keys(groups).length > 0
            
            return (
              <div key={stage.id} className="bg-white rounded-lg border overflow-hidden">
                {/* Stage Header */}
                <button
                  onClick={() => toggleStage(stage.id)}
                  className="w-full px-4 py-3 bg-gray-100 border-b flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{stage.name}</h3>
                      <p className="text-sm text-gray-500">
                        {stageMatches.length} matches • {formatStageType(stage.type)}
                        {hasGroups && ` • ${Object.keys(groups).length} groups`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {stageStart && (
                      <>
                        {formatTime(stageStart)} - {formatTime(stageEnd)}
                      </>
                    )}
                  </div>
                </button>

                {/* Stage Content */}
                {isExpanded && (
                  <div className="divide-y">
                    {hasGroups ? (
                      // Render groups
                      Object.entries(groups)
                        .sort(([, a], [, b]) => {
                          const aTime = a.matches[0]?.scheduledStartTime ? new Date(a.matches[0].scheduledStartTime).getTime() : 0
                          const bTime = b.matches[0]?.scheduledStartTime ? new Date(b.matches[0].scheduledStartTime).getTime() : 0
                          return aTime - bTime
                        })
                        .map(([groupId, { group, matches: groupMatches }]) => {
                          const groupKey = `${stage.id}-${groupId}`
                          const isGroupExpanded = expandedGroups.has(groupKey)
                          const groupStart = groupMatches[0]?.scheduledStartTime
                          const groupEnd = groupMatches[groupMatches.length - 1]?.scheduledEndTime
                          
                          return (
                            <div key={groupId}>
                              {/* Group Header */}
                              <button
                                onClick={() => toggleGroup(groupKey)}
                                className="w-full px-4 py-2 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{isGroupExpanded ? '▼' : '▶'}</span>
                                  <span className="font-medium text-gray-700">{group?.name}</span>
                                  <span className="text-sm text-gray-500">({groupMatches.length} matches)</span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {formatTime(groupStart)} - {formatTime(groupEnd)}
                                </span>
                              </button>
                              
                              {/* Group Matches */}
                              {isGroupExpanded && (
                                <div className="divide-y divide-gray-100">
                                  {groupMatches
                                    .sort((a, b) => {
                                      const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
                                      const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
                                      return aTime - bTime
                                    })
                                    .map(match => (
                                      <MatchCard 
                                        key={match.id} 
                                        match={match} 
                                        showGroup={false}
                                        onClick={() => setSelectedMatch(match)}
                                      />
                                    ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                    ) : (
                      // No groups - render matches directly
                      <div className="divide-y divide-gray-100">
                        {stageMatches
                          .sort((a, b) => {
                            const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
                            const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
                            return aTime - bTime
                          })
                          .map(match => (
                            <MatchCard 
                              key={match.id} 
                              match={match} 
                              showGroup={false}
                              onClick={() => setSelectedMatch(match)}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Time View */}
      {viewMode === 'time' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-semibold text-gray-900">All Matches by Time</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedByTime.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                showGroup={true} 
                showStage={true}
                onClick={() => setSelectedMatch(match)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pitch View */}
      {viewMode === 'pitch' && (
        <div className="space-y-4">
          {Object.entries(matchesByPitch).map(([pitchId, { pitchName, matches: pitchMatches }]) => (
            <div key={pitchId} className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">{pitchName}</h3>
                <span className="text-sm text-gray-500">{pitchMatches.length} matches</span>
              </div>
              <div className="divide-y divide-gray-100">
                {pitchMatches
                  .sort((a, b) => {
                    const aTime = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : 0
                    const bTime = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : 0
                    return aTime - bTime
                  })
                  .map(match => (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      showGroup={true} 
                      showStage={true} 
                      showPitch={false}
                      onClick={() => setSelectedMatch(match)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  )
}

// Helper components and functions

function formatTime(date: Date | null | undefined): string {
  if (!date) return '--:--'
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatStageType(type: string): string {
  const labels: Record<string, string> = {
    GROUP_STAGE: 'Round Robin Groups',
    GSL_GROUPS: 'GSL Groups',
    KNOCKOUT: 'Knockout',
    DOUBLE_ELIMINATION: 'Double Elimination',
    ROUND_ROBIN: 'Round Robin',
    FINAL: 'Final',
  }
  return labels[type] || type
}

interface MatchCardProps {
  match: ScheduledMatch
  showGroup?: boolean
  showStage?: boolean
  showPitch?: boolean
  onClick?: () => void
}

function MatchCard({ match, showGroup = true, showStage = false, showPitch = true, onClick }: MatchCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning">Live</Badge>
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const homeDisplay = match.homeTeam?.teamName || match.homeTeamSource || 'TBD'
  const awayDisplay = match.awayTeam?.teamName || match.awayTeamSource || 'TBD'
  const isPlaceholder = !match.homeTeam || !match.awayTeam

  return (
    <div 
      className={`px-4 py-3 hover:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {/* Left side: Match info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Match number */}
          <div className="w-10 flex-shrink-0">
            <span className="text-xs font-medium text-gray-400">#{match.matchNumber}</span>
          </div>

          {/* Time */}
          <div className="w-14 flex-shrink-0">
            <span className="font-mono text-sm font-semibold text-gray-900">
              {formatTime(match.scheduledStartTime)}
            </span>
          </div>

          {/* Teams */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`truncate ${match.homeTeam ? 'text-gray-900 font-medium' : 'text-gray-500 italic text-sm'}`}>
                {homeDisplay}
              </span>
              <span className="text-gray-400 flex-shrink-0">vs</span>
              <span className={`truncate ${match.awayTeam ? 'text-gray-900 font-medium' : 'text-gray-500 italic text-sm'}`}>
                {awayDisplay}
              </span>
            </div>
            
            {/* Match label if placeholder */}
            {isPlaceholder && (
              <p className="text-xs text-blue-600 mt-0.5">
                {match.homeTeamSource && match.awayTeamSource 
                  ? `${match.homeTeamSource} vs ${match.awayTeamSource}`
                  : 'Pending previous results'}
              </p>
            )}
          </div>

          {/* Result */}
          {match.result && (
            <div className="flex-shrink-0 font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
              {match.result.homeScore} - {match.result.awayScore}
              {match.result.homePenalties != null && match.result.awayPenalties != null && (
                <span className="text-xs text-gray-500 ml-1">
                  (p: {match.result.homePenalties}-{match.result.awayPenalties})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: Metadata and status */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {/* Stage/Group info */}
          <div className="text-right text-sm">
            {showStage && (
              <span className="text-gray-500">{match.stage.name}</span>
            )}
            {showStage && showGroup && match.group && (
              <span className="text-gray-400"> • </span>
            )}
            {showGroup && match.group && (
              <span className="text-gray-500">{match.group.name}</span>
            )}
          </div>

          {/* Pitch */}
          {showPitch && match.pitch && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
              {match.pitch.name}
            </span>
          )}

          {/* Status */}
          {getStatusBadge(match.status)}
        </div>
      </div>
    </div>
  )
}
