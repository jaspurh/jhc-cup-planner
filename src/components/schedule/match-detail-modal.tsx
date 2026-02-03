'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScheduledMatch } from '@/types'
import { updateMatchTime } from '@/actions/schedule'
import { enterMatchResult, updateMatchResult, deleteMatchResult, startMatch, saveLiveScore } from '@/actions/match'

interface MatchDetailModalProps {
  match: ScheduledMatch
  isOpen: boolean
  onClose: () => void
}

export function MatchDetailModal({ match, isOpen, onClose }: MatchDetailModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'result' | 'reschedule'>('details')
  
  // Reschedule state
  const [newStartTime, setNewStartTime] = useState(
    match.scheduledStartTime 
      ? new Date(match.scheduledStartTime).toISOString().slice(0, 16)
      : ''
  )

  // Result state
  const [homeScore, setHomeScore] = useState(match.result?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(match.result?.awayScore ?? 0)
  const [homePenalties, setHomePenalties] = useState<number | ''>(match.result?.homePenalties ?? '')
  const [awayPenalties, setAwayPenalties] = useState<number | ''>(match.result?.awayPenalties ?? '')
  const [showPenalties, setShowPenalties] = useState(
    match.result?.homePenalties !== null && match.result?.homePenalties !== undefined
  )

  if (!isOpen) return null

  const homeDisplay = match.homeTeam?.teamName || match.homeTeamSource || 'TBD'
  const awayDisplay = match.awayTeam?.teamName || match.awayTeamSource || 'TBD'
  const hasTeams = match.homeTeam && match.awayTeam
  const hasResult = !!match.result

  const handleReschedule = () => {
    if (!newStartTime) return
    
    setError(null)
    startTransition(async () => {
      const result = await updateMatchTime(match.id, new Date(newStartTime))
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Failed to reschedule match')
      }
    })
  }

  const handleStartMatch = () => {
    setError(null)
    startTransition(async () => {
      const result = await startMatch(match.id)
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Failed to start match')
      }
    })
  }

  const handleSaveLiveScore = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveLiveScore(match.id, homeScore, awayScore)
      
      if (result.success) {
        router.refresh()
        // Don't close - allow continued updates
      } else {
        setError(result.error || 'Failed to save live score')
      }
    })
  }

  const handleEnterResult = () => {
    setError(null)
    startTransition(async () => {
      const resultData = {
        matchId: match.id,
        homeScore,
        awayScore,
        ...(showPenalties && homePenalties !== '' && awayPenalties !== '' 
          ? { homePenalties: homePenalties as number, awayPenalties: awayPenalties as number }
          : {}
        ),
      }
      
      const result = hasResult 
        ? await updateMatchResult(resultData)
        : await enterMatchResult(resultData)
      
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Failed to save result')
      }
    })
  }

  const handleDeleteResult = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteMatchResult(match.id)
      if (result.success) {
        router.refresh()
        onClose()
      } else {
        setError(result.error || 'Failed to delete result')
      }
    })
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Not scheduled'
    return new Date(date).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-900">Match #{match.matchNumber}</h2>
            <p className="text-sm text-gray-500">{match.stage.name}{match.group && ` • ${match.group.name}`}</p>
          </div>
          {getStatusBadge(match.status)}
        </div>

        {/* Tabs */}
        <div className="border-b flex">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'details' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('result')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'result' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {hasResult ? 'Edit Result' : 'Enter Result'}
          </button>
          {match.status === 'SCHEDULED' && (
            <button
              onClick={() => setActiveTab('reschedule')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'reschedule' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Reschedule
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Teams Display (shown in all tabs) */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-4">
              <div className="flex-1 text-right">
                <p className={`text-lg ${match.homeTeam ? 'font-semibold text-gray-900' : 'text-gray-500 italic'}`}>
                  {homeDisplay}
                </p>
              </div>
              <div className="flex-shrink-0">
                {match.result ? (
                  <span className="text-2xl font-bold text-gray-900">
                    {match.result.homeScore} - {match.result.awayScore}
                  </span>
                ) : (
                  <span className="text-xl text-gray-400">vs</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-lg ${match.awayTeam ? 'font-semibold text-gray-900' : 'text-gray-500 italic'}`}>
                  {awayDisplay}
                </p>
              </div>
            </div>
            
            {match.result?.homePenalties !== null && match.result?.homePenalties !== undefined && (
              <p className="text-sm text-gray-500 mt-1">
                Penalties: {match.result.homePenalties} - {match.result.awayPenalties}
              </p>
            )}
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Scheduled Start</p>
                  <p className="font-medium text-gray-900">{formatDateTime(match.scheduledStartTime)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Scheduled End</p>
                  <p className="font-medium text-gray-900">{formatDateTime(match.scheduledEndTime)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pitch</p>
                  <p className="font-medium text-gray-900">{match.pitch?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Round</p>
                  <p className="font-medium text-gray-900">{match.roundNumber || 'N/A'}</p>
                </div>
              </div>

              {/* Quick Actions */}
              {match.status === 'SCHEDULED' && hasTeams && (
                <div className="pt-4 border-t">
                  <Button onClick={handleStartMatch} disabled={isPending} className="w-full">
                    {isPending ? 'Starting...' : '▶️ Start Match'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Result Tab */}
          {activeTab === 'result' && (
            <div className="space-y-4">
              {!hasTeams ? (
                <div className="text-center py-4 text-gray-500">
                  <p>Cannot enter result until both teams are determined.</p>
                </div>
              ) : (
                <>
                  {/* Score Entry */}
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <label className="block text-sm text-gray-500 mb-1">{homeDisplay}</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={homeScore}
                        onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                        className="w-20 h-16 text-4xl text-center border-2 border-gray-300 rounded-lg font-bold text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <span className="text-2xl text-gray-400 mt-6">-</span>
                    <div className="text-center">
                      <label className="block text-sm text-gray-500 mb-1">{awayDisplay}</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={awayScore}
                        onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                        className="w-20 h-16 text-4xl text-center border-2 border-gray-300 rounded-lg font-bold text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </div>

                  {/* Penalties Toggle - always takes space, visibility controlled */}
                  <div className="text-center h-6">
                    <button
                      type="button"
                      onClick={() => setShowPenalties(!showPenalties)}
                      className={`text-sm text-blue-600 hover:underline transition-opacity ${
                        homeScore === awayScore ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      {showPenalties ? 'Remove penalty shootout' : '+ Add penalty shootout'}
                    </button>
                  </div>

                  {/* Penalties Entry */}
                  {showPenalties && homeScore === awayScore && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <div className="text-center">
                        <label className="block text-xs text-gray-500 mb-1">Penalties</label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={homePenalties}
                          onChange={(e) => setHomePenalties(e.target.value ? parseInt(e.target.value) : '')}
                          className="w-16 h-12 text-2xl text-center border-2 border-gray-300 rounded-lg font-bold text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-xl text-gray-400 mt-5">-</span>
                      <div className="text-center">
                        <label className="block text-xs text-gray-500 mb-1">Penalties</label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={awayPenalties}
                          onChange={(e) => setAwayPenalties(e.target.value ? parseInt(e.target.value) : '')}
                          className="w-16 h-12 text-2xl text-center border-2 border-gray-300 rounded-lg font-bold text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Save Buttons */}
                  <div className="space-y-2 pt-4">
                    {/* Live Score Button - visible when match is not completed */}
                    {match.status !== 'COMPLETED' && (
                      <Button 
                        variant="secondary"
                        onClick={handleSaveLiveScore} 
                        disabled={isPending}
                        className="w-full"
                      >
                        {isPending ? 'Saving...' : '📡 Save Live Score'}
                      </Button>
                    )}
                    
                    {/* Final Result Button */}
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleEnterResult} 
                        disabled={isPending}
                        className="flex-1"
                      >
                        {isPending ? 'Saving...' : match.status === 'COMPLETED' ? 'Update Final' : '✓ Save as Final Result'}
                      </Button>
                      {hasResult && (
                        <Button 
                          variant="danger"
                          onClick={handleDeleteResult}
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                    
                    {match.status !== 'COMPLETED' && (
                      <p className="text-xs text-gray-500 text-center">
                        Use &quot;Save Live Score&quot; for in-progress updates. &quot;Save as Final Result&quot; marks the match complete.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Reschedule Tab */}
          {activeTab === 'reschedule' && match.status === 'SCHEDULED' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Start Time</label>
                <input
                  type="datetime-local"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <Button
                onClick={handleReschedule}
                disabled={isPending || !newStartTime}
                className="w-full"
              >
                {isPending ? 'Saving...' : 'Update Time'}
              </Button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <p className="text-sm text-red-600 mt-4 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
