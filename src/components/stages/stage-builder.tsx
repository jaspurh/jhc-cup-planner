'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  createStage,
  updateStage,
  deleteStage,
  createGroup,
  updateGroup,
  deleteGroup,
  assignTeamToGroup,
  removeTeamFromGroup,
  autoDistributeTeams,
} from '@/actions/stage'
import type { StageType, Group } from '@/generated/prisma'

interface TeamRegistration {
  id: string
  teamId: string
  teamName: string
  contactName: string | null
  contactEmail: string | null
  status: string
}

interface StageWithGroups {
  id: string
  name: string
  type: StageType
  order: number
  bufferTimeMinutes: number
  configuration: unknown
  groups: Array<Group & {
    roundRobinType: 'SINGLE' | 'DOUBLE'
    teamAssignments: Array<{
      id: string
      seedPosition: number | null
      registration: {
        id: string
        registeredTeamName: string | null
        team: { id: string; name: string }
      }
    }>
  }>
  _count: { matches: number }
}

interface StageBuilderProps {
  tournamentId: string
  initialStages: StageWithGroups[]
  confirmedTeams: TeamRegistration[]
}

// Stage templates based on spec
const STAGE_TEMPLATES = [
  {
    type: 'GROUP_STAGE' as StageType,
    label: 'Group Stage',
    description: 'Teams divided into groups, round-robin within each',
    defaultName: 'Group Stage',
    hasGroups: true,
    configType: 'groups',
  },
  {
    type: 'GSL_GROUPS' as StageType,
    label: 'GSL Groups',
    description: 'Dual tournament format (4 teams, 5 matches per group)',
    defaultName: 'GSL Group Stage',
    hasGroups: true,
    configType: 'gsl_groups',
  },
  {
    type: 'ROUND_ROBIN' as StageType,
    label: 'Round Robin',
    description: 'All teams in one pool play each other',
    defaultName: 'Round Robin',
    hasGroups: false,
    configType: 'roundrobin',
  },
  {
    type: 'KNOCKOUT' as StageType,
    label: 'Knockout / Elimination',
    description: 'Single elimination bracket matches',
    defaultName: 'Elimination Round',
    hasGroups: false,
    configType: 'knockout',
  },
  {
    type: 'DOUBLE_ELIMINATION' as StageType,
    label: 'Double Elimination',
    description: 'Winners & losers brackets (lose twice = out)',
    defaultName: 'Double Elimination',
    hasGroups: false,
    configType: 'double_elimination',
  },
  {
    type: 'FINAL' as StageType,
    label: 'Finals',
    description: 'Final match, placement matches, or finals group',
    defaultName: 'Finals',
    hasGroups: false,
    configType: 'finals',
  },
]

export function StageBuilder({ tournamentId, initialStages, confirmedTeams }: StageBuilderProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showAddStage, setShowAddStage] = useState(false)

  const stages = initialStages

  const refreshData = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleAddStage = async (template: typeof STAGE_TEMPLATES[0], config: {
    name: string
    bufferTimeMinutes: number
    numGroups?: number
    roundRobinType?: 'SINGLE' | 'DOUBLE'
    numMatches?: number
    groupSchedulingMode?: 'sequential' | 'interleaved'
    hasThirdPlace?: boolean
    advancingTeamsPerGroup?: number
  }) => {
    setError(null)
    
    const stageConfig = template.hasGroups
      ? { 
          numGroups: config.numGroups || 4, 
          roundRobinType: config.roundRobinType || 'SINGLE',
          groupSchedulingMode: config.groupSchedulingMode || 'sequential',
          // Include advancingTeamsPerGroup for regular groups (GSL is always 2)
          advancingTeamsPerGroup: template.configType === 'groups' 
            ? (config.advancingTeamsPerGroup || 2) 
            : 2,
        }
      : { 
          advancingTeamCount: config.numMatches || 4,
          hasThirdPlace: config.hasThirdPlace || false,
        }

    const result = await createStage({
      name: config.name,
      tournamentId,
      type: template.type,
      bufferTimeMinutes: config.bufferTimeMinutes,
      configuration: stageConfig,
    })

    if (result.success) {
      // If group stage, auto-create groups
      if (template.hasGroups && config.numGroups) {
        const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        for (let i = 0; i < config.numGroups; i++) {
          await createGroup({
            name: `Group ${groupNames[i] || i + 1}`,
            stageId: result.data!.id,
          })
        }
      }
      setShowAddStage(false)
      refreshData()
    } else {
      setError(result.error || 'Failed to create stage')
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage and all its groups?')) return

    setError(null)
    const result = await deleteStage(stageId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to delete stage')
    }
  }

  const handleUpdateStageConfig = async (stageId: string, updates: Record<string, unknown>) => {
    setError(null)
    
    // Separate direct stage fields from configuration fields
    const { bufferTimeMinutes, ...configFields } = updates
    
    const updateData: { bufferTimeMinutes?: number; configuration?: Record<string, unknown> } = {}
    
    // bufferTimeMinutes is a direct column on Stage
    if (bufferTimeMinutes !== undefined) {
      updateData.bufferTimeMinutes = bufferTimeMinutes as number
    }
    
    // Other fields (groupSchedulingMode, advancingTeamsPerGroup, etc.) go into configuration JSON
    if (Object.keys(configFields).length > 0) {
      // Find the stage to merge with existing configuration
      const stage = stages.find(s => s.id === stageId)
      const existingConfig = (stage?.configuration as Record<string, unknown>) || {}
      updateData.configuration = { ...existingConfig, ...configFields }
    }
    
    const result = await updateStage(stageId, updateData)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to update stage configuration')
    }
  }

  const handleAddGroup = async (stageId: string, groupName: string) => {
    setError(null)
    const result = await createGroup({ name: groupName, stageId })

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to create group')
    }
  }

  const handleUpdateGroupRoundRobin = async (groupId: string, roundRobinType: 'SINGLE' | 'DOUBLE') => {
    setError(null)
    const result = await updateGroup(groupId, { roundRobinType })

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to update group')
    }
  }

  const handleDeleteGroup = async (groupId: string) => {
    setError(null)
    const result = await deleteGroup(groupId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to delete group')
    }
  }

  const handleAssignTeam = async (groupId: string, registrationId: string) => {
    setError(null)
    const result = await assignTeamToGroup({ groupId, registrationId })

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to assign team')
    }
  }

  const handleRemoveTeam = async (assignmentId: string) => {
    setError(null)
    const result = await removeTeamFromGroup(assignmentId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to remove team')
    }
  }

  const handleAutoDistribute = async (stageId: string) => {
    setError(null)
    const result = await autoDistributeTeams(stageId)

    if (result.success) {
      refreshData()
    } else {
      setError(result.error || 'Failed to distribute teams')
    }
  }

  const getAssignedTeamIds = (): Set<string> => {
    const ids = new Set<string>()
    stages.forEach(stage => {
      stage.groups.forEach(group => {
        group.teamAssignments.forEach(a => ids.add(a.registration.id))
      })
    })
    return ids
  }

  const assignedTeamIds = getAssignedTeamIds()
  const unassignedTeams = confirmedTeams.filter(t => !assignedTeamIds.has(t.id))

  // Calculate teams available for the next stage based on existing stages
  const calculateTeamsFromPreviousStages = (): { totalTeams: number; advancingTeams: number; lastStageType: StageType | null } => {
    if (stages.length === 0) {
      // First stage - use confirmed teams
      return { totalTeams: confirmedTeams.length, advancingTeams: confirmedTeams.length, lastStageType: null }
    }

    const lastStage = stages[stages.length - 1]
    const config = lastStage.configuration as Record<string, unknown> | null
    
    // Calculate advancing teams based on stage type
    if (lastStage.type === 'GROUP_STAGE') {
      // Read advancingTeamsPerGroup from config, default to 2
      const advancingPerGroup = (config?.advancingTeamsPerGroup as number) || 2
      const teamsPerGroup = lastStage.groups[0]?.teamAssignments?.length || 4
      return { 
        totalTeams: lastStage.groups.length * teamsPerGroup,
        advancingTeams: lastStage.groups.length * advancingPerGroup,
        lastStageType: lastStage.type
      }
    } else if (lastStage.type === 'GSL_GROUPS') {
      // GSL: 2 advance from each group (winner + runner-up from decider)
      return { 
        totalTeams: lastStage.groups.length * 4,
        advancingTeams: lastStage.groups.length * 2,
        lastStageType: lastStage.type
      }
    } else if (lastStage.type === 'KNOCKOUT') {
      // Knockout: 1 winner advances (or 2 if we count 3rd place)
      const numMatches = (config?.advancingTeamCount as number) || 4
      const hasThirdPlace = (config?.hasThirdPlace as boolean) || false
      return { 
        totalTeams: numMatches,
        advancingTeams: hasThirdPlace ? 2 : 1, // winner + 3rd place or just winner
        lastStageType: lastStage.type
      }
    } else if (lastStage.type === 'ROUND_ROBIN') {
      // Round robin - assume top N advance based on group size
      const teamCount = lastStage.groups[0]?.teamAssignments?.length || 4
      return { 
        totalTeams: teamCount,
        advancingTeams: Math.min(4, teamCount), // top 4 or all
        lastStageType: lastStage.type
      }
    }
    
    // Default fallback
    return { totalTeams: confirmedTeams.length, advancingTeams: 4, lastStageType: lastStage.type }
  }

  const previousStageInfo = calculateTeamsFromPreviousStages()

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Tournament Structure</CardTitle>
            <CardDescription>
              Configure stages and assign {confirmedTeams.length} confirmed teams to groups
            </CardDescription>
          </div>
          {!showAddStage && (
            <Button onClick={() => setShowAddStage(true)} disabled={isPending}>
              + Add Stage
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add Stage Form */}
        {showAddStage && (
          <AddStageForm
            onAdd={handleAddStage}
            onCancel={() => setShowAddStage(false)}
            isPending={isPending}
            isFirstStage={stages.length === 0}
            totalConfirmedTeams={confirmedTeams.length}
            teamsFromPreviousStage={previousStageInfo.advancingTeams}
            lastStageType={previousStageInfo.lastStageType}
          />
        )}

        {/* Stages list */}
        {stages.length === 0 && !showAddStage ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
            <p className="text-gray-500 mb-4">No stages configured yet</p>
            <Button onClick={() => setShowAddStage(true)}>
              Add Your First Stage
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {stages.map((stage, index) => (
              <StageCard
                key={stage.id}
                stage={stage}
                stageNumber={index + 1}
                unassignedTeams={unassignedTeams}
                isPending={isPending}
                onDeleteStage={handleDeleteStage}
                onAddGroup={handleAddGroup}
                onUpdateGroupRoundRobin={handleUpdateGroupRoundRobin}
                onDeleteGroup={handleDeleteGroup}
                onAssignTeam={handleAssignTeam}
                onRemoveTeam={handleRemoveTeam}
                onAutoDistribute={handleAutoDistribute}
                onUpdateStageConfig={handleUpdateStageConfig}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Add Stage Form Component
interface AddStageFormProps {
  onAdd: (template: typeof STAGE_TEMPLATES[0], config: {
    name: string
    bufferTimeMinutes: number
    numGroups?: number
    roundRobinType?: 'SINGLE' | 'DOUBLE'
    numMatches?: number
    groupSchedulingMode?: 'sequential' | 'interleaved'
    hasThirdPlace?: boolean
    advancingTeamsPerGroup?: number
  }) => void
  onCancel: () => void
  isPending: boolean
  isFirstStage: boolean
  totalConfirmedTeams: number
  teamsFromPreviousStage: number
  lastStageType: StageType | null
}

function AddStageForm({ 
  onAdd, 
  onCancel, 
  isPending,
  isFirstStage,
  totalConfirmedTeams,
  teamsFromPreviousStage,
  lastStageType
}: AddStageFormProps) {
  const [selectedType, setSelectedType] = useState<StageType | null>(null)
  const [name, setName] = useState('')
  const [gapMinutes, setGapMinutes] = useState(0)
  const [numGroups, setNumGroups] = useState(4)
  const [roundRobinType, setRoundRobinType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE')
  const [numMatches, setNumMatches] = useState(4)
  const [hasThirdPlace, setHasThirdPlace] = useState(false)
  const [groupSchedulingMode, setGroupSchedulingMode] = useState<'sequential' | 'interleaved'>('sequential')
  const [advancingTeamsPerGroup, setAdvancingTeamsPerGroup] = useState(2)

  const selectedTemplate = STAGE_TEMPLATES.find(t => t.type === selectedType)

  // Calculate available teams for this stage
  const availableTeams = isFirstStage ? totalConfirmedTeams : teamsFromPreviousStage

  // Calculate valid group options based on available teams (for GSL which requires 4 per group)
  const getValidGSLGroupOptions = (): number[] => {
    const maxGroups = Math.floor(availableTeams / 4)
    return [1, 2, 3, 4, 5, 6, 7, 8].filter(n => n <= maxGroups)
  }

  // Calculate valid knockout options (must be power of 2 and <= available teams)
  const getValidKnockoutOptions = (): number[] => {
    const options = [2, 4, 8, 16, 32, 64]
    return options.filter(n => n <= availableTeams)
  }

  // Get validation info (warning, not blocking for regular groups)
  const getValidationInfo = (): { type: 'warning' | 'error' | 'info' | null; message: string } | null => {
    if (!selectedTemplate) return null
    
    if (selectedTemplate.configType === 'groups') {
      // Regular group stage - flexible, just show info
      return {
        type: 'info',
        message: `${availableTeams} teams available. You can configure group sizes after creation.`
      }
    } else if (selectedTemplate.configType === 'gsl_groups') {
      const teamsNeeded = numGroups * 4
      if (teamsNeeded > availableTeams) {
        return {
          type: 'error',
          message: `${numGroups} GSL groups need ${teamsNeeded} teams (4 per group), but only ${availableTeams} available.`
        }
      }
      return {
        type: 'info',
        message: `${numGroups} groups × 4 teams = ${teamsNeeded} teams. ${availableTeams} available.`
      }
    } else if (selectedTemplate.configType === 'knockout') {
      if (numMatches > availableTeams) {
        return {
          type: 'error',
          message: `Knockout needs ${numMatches} teams, but only ${availableTeams} available.`
        }
      }
      return {
        type: 'info',
        message: `${numMatches}-team bracket. ${availableTeams} teams available from previous stage.`
      }
    }
    return null
  }

  const validationInfo = getValidationInfo()
  const hasBlockingError = validationInfo?.type === 'error'

  const handleSubmit = () => {
    if (!selectedTemplate || !name.trim() || hasBlockingError) return
    onAdd(selectedTemplate, {
      name: name.trim(),
      bufferTimeMinutes: gapMinutes,
      numGroups: selectedTemplate.hasGroups ? numGroups : undefined,
      roundRobinType: selectedTemplate.hasGroups ? roundRobinType : undefined,
      numMatches: !selectedTemplate.hasGroups ? numMatches : undefined,
      groupSchedulingMode: selectedTemplate.hasGroups ? groupSchedulingMode : undefined,
      hasThirdPlace: selectedTemplate.configType === 'knockout' ? hasThirdPlace : undefined,
      // Only for regular GROUP_STAGE (GSL is fixed at 2)
      advancingTeamsPerGroup: selectedTemplate.configType === 'groups' ? advancingTeamsPerGroup : undefined,
    })
  }

  return (
    <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-gray-900">Add New Stage</h3>
        <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border">
          {isFirstStage ? (
            <span>{totalConfirmedTeams} confirmed teams</span>
          ) : (
            <span>{teamsFromPreviousStage} teams from previous stage</span>
          )}
        </div>
      </div>

      {/* Stage Type Selection */}
      {!selectedType ? (
        <div className="grid grid-cols-3 gap-3">
          {STAGE_TEMPLATES.map(template => (
            <button
              key={template.type}
              onClick={() => {
                setSelectedType(template.type)
                setName(template.defaultName)
                
                // Set sensible defaults based on available teams
                if (template.configType === 'gsl_groups') {
                  const validGSL = [1, 2, 3, 4, 5, 6, 7, 8].filter(n => n * 4 <= availableTeams)
                  if (validGSL.length > 0) {
                    setNumGroups(validGSL[validGSL.length - 1])
                  }
                } else if (template.configType === 'knockout') {
                  const validKnockout = [2, 4, 8, 16, 32, 64].filter(n => n <= availableTeams)
                  if (validKnockout.length > 0) {
                    setNumMatches(validKnockout[validKnockout.length - 1])
                  }
                }
              }}
              className="p-4 border rounded-lg bg-white hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
            >
              <p className="font-medium text-gray-900">{template.label}</p>
              <p className="text-sm text-gray-500">{template.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stage Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Group Stage, Quarterfinals"
            />
          </div>

          {/* Gap Minutes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buffer Time (minutes)
            </label>
            <Input
              type="number"
              min={0}
              max={120}
              value={gapMinutes}
              onChange={(e) => setGapMinutes(parseInt(e.target.value) || 0)}
              className="w-32"
            />
            <p className="text-xs text-gray-500 mt-1">
              Extra time for this stage/group (injuries, introductions, unforeseen delays)
            </p>
          </div>

          {/* Group Stage specific */}
          {selectedTemplate?.configType === 'groups' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Groups
                </label>
                <select
                  value={numGroups}
                  onChange={(e) => setNumGroups(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2 text-gray-900 bg-white"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n} groups</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Each group&apos;s round-robin type can be configured individually after creation
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teams Advancing per Group
                </label>
                <select
                  value={advancingTeamsPerGroup}
                  onChange={(e) => setAdvancingTeamsPerGroup(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2 text-gray-900 bg-white"
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} team{n > 1 ? 's' : ''} per group</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Total advancing: {numGroups * advancingTeamsPerGroup} teams
                </p>
              </div>
            </>
          )}

          {/* GSL Groups specific */}
          {selectedTemplate?.configType === 'gsl_groups' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Groups
              </label>
              <select
                value={numGroups}
                onChange={(e) => setNumGroups(parseInt(e.target.value))}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                {getValidGSLGroupOptions().length > 0 ? (
                  getValidGSLGroupOptions().map(n => (
                    <option key={n} value={n}>{n} groups ({n * 4} teams)</option>
                  ))
                ) : (
                  <option disabled>Not enough teams (need at least 4)</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                GSL format: 4 teams per group, 5 matches each • 2 advance per group
              </p>
            </div>
          )}

          {/* Group Scheduling Mode (for any stage with groups) */}
          {selectedTemplate?.hasGroups && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Scheduling Order
              </label>
              <select
                value={groupSchedulingMode}
                onChange={(e) => setGroupSchedulingMode(e.target.value as 'sequential' | 'interleaved')}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                <option value="sequential">Sequential (all Group A, then Group B, etc.)</option>
                <option value="interleaved">Interleaved (alternate between groups)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Sequential is recommended when groups are separated by location or referee availability
              </p>
            </div>
          )}

          {/* Round Robin (no groups) specific */}
          {selectedTemplate?.configType === 'roundrobin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Round-Robin Type
              </label>
              <select
                value={roundRobinType}
                onChange={(e) => setRoundRobinType(e.target.value as 'SINGLE' | 'DOUBLE')}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                <option value="SINGLE">Single round-robin (each team plays once)</option>
                <option value="DOUBLE">Double round-robin (each team plays twice)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                All teams play against each other in one pool
              </p>
            </div>
          )}

          {/* Knockout specific */}
          {selectedTemplate?.configType === 'knockout' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Teams
                </label>
                <select
                  value={numMatches}
                  onChange={(e) => setNumMatches(parseInt(e.target.value))}
                  className="border rounded-md px-3 py-2 text-gray-900 bg-white"
                >
                  {getValidKnockoutOptions().length > 0 ? (
                    getValidKnockoutOptions().map(n => (
                      <option key={n} value={n}>
                        {n} teams ({n === 2 ? 'Final only' : n === 4 ? 'Semifinals' : n === 8 ? 'Quarterfinals' : `Round of ${n}`})
                      </option>
                    ))
                  ) : (
                    <option disabled>Not enough teams (need at least 2)</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Single elimination bracket • {availableTeams} teams available
                </p>
              </div>
              
              {numMatches >= 4 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasThirdPlace"
                    checked={hasThirdPlace}
                    onChange={(e) => setHasThirdPlace(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasThirdPlace" className="text-sm text-gray-700">
                    Include 3rd place match (semifinal losers)
                  </label>
                </div>
              )}
            </>
          )}

          {/* Finals specific */}
          {selectedTemplate?.configType === 'finals' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finals Format
              </label>
              <select
                value={numMatches}
                onChange={(e) => setNumMatches(parseInt(e.target.value))}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                <option value={1}>Final match only (1st vs 2nd)</option>
                <option value={2}>Final + 3rd place match</option>
                <option value={3}>Finals group - 3 teams round-robin</option>
                <option value={4}>Finals group - 4 teams round-robin</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {numMatches <= 2 
                  ? 'Single elimination matches for final placements'
                  : 'Teams play round-robin to determine final standings'}
              </p>
            </div>
          )}

          {/* Double Elimination specific */}
          {selectedTemplate?.configType === 'double_elimination' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Teams
              </label>
              <select
                value={numMatches}
                onChange={(e) => setNumMatches(parseInt(e.target.value))}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                <option value={4}>4 teams</option>
                <option value={8}>8 teams</option>
                <option value={16}>16 teams</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Teams must lose twice to be eliminated (winners & losers brackets)
              </p>
            </div>
          )}

          {/* Validation Info */}
          {validationInfo && (
            <div className={`px-3 py-2 rounded-md text-sm ${
              validationInfo.type === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700' 
                : validationInfo.type === 'warning'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-600'
            }`}>
              {validationInfo.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={!name.trim() || isPending || hasBlockingError}>
              Create Stage
            </Button>
            <Button variant="secondary" onClick={() => setSelectedType(null)}>
              Back
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Stage Card Component
interface StageCardProps {
  stage: StageWithGroups
  stageNumber: number
  unassignedTeams: TeamRegistration[]
  isPending: boolean
  onDeleteStage: (stageId: string) => void
  onAddGroup: (stageId: string, name: string) => void
  onUpdateGroupRoundRobin: (groupId: string, roundRobinType: 'SINGLE' | 'DOUBLE') => void
  onDeleteGroup: (groupId: string) => void
  onAssignTeam: (groupId: string, registrationId: string) => void
  onRemoveTeam: (assignmentId: string) => void
  onAutoDistribute: (stageId: string) => void
}

function StageCard({
  stage,
  stageNumber,
  unassignedTeams,
  isPending,
  onDeleteStage,
  onAddGroup,
  onUpdateGroupRoundRobin,
  onDeleteGroup,
  onAssignTeam,
  onRemoveTeam,
  onAutoDistribute,
  onUpdateStageConfig,
}: StageCardProps & { onUpdateStageConfig: (stageId: string, config: Record<string, unknown>) => void }) {
  const [newGroupName, setNewGroupName] = useState('')

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    onAddGroup(stage.id, newGroupName.trim())
    setNewGroupName('')
  }

  const config = stage.configuration as { numGroups?: number; roundRobinType?: string; numMatches?: number; groupSchedulingMode?: string; hasThirdPlace?: boolean; advancingTeamsPerGroup?: number } | null

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Stage Header */}
      <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium">
            {stageNumber}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">{stage.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Badge variant={
                stage.type === 'GROUP_STAGE' ? 'info' :
                stage.type === 'GSL_GROUPS' ? 'info' :
                stage.type === 'ROUND_ROBIN' ? 'info' :
                stage.type === 'KNOCKOUT' ? 'warning' :
                stage.type === 'DOUBLE_ELIMINATION' ? 'warning' :
                'success'
              }>
                {stage.type === 'GROUP_STAGE' ? 'Group Stage' :
                 stage.type === 'GSL_GROUPS' ? 'GSL Groups' :
                 stage.type === 'ROUND_ROBIN' ? 'Round Robin' :
                 stage.type === 'KNOCKOUT' ? 'Knockout' :
                 stage.type === 'DOUBLE_ELIMINATION' ? 'Double Elim' :
                 'Finals'}
              </Badge>
              {stage.bufferTimeMinutes > 0 && (
                <span>• {stage.bufferTimeMinutes} min buffer</span>
              )}
              {config?.roundRobinType && (
                <span>• {config.roundRobinType.toLowerCase()} round-robin</span>
              )}
              {config?.groupSchedulingMode && (
                <span>• {config.groupSchedulingMode} scheduling</span>
              )}
              {stage._count.matches > 0 && (
                <span>• {stage._count.matches} matches</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(stage.type === 'GROUP_STAGE' || stage.type === 'GSL_GROUPS') && unassignedTeams.length > 0 && stage.groups.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAutoDistribute(stage.id)}
              disabled={isPending}
            >
              Auto-Distribute Teams
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteStage(stage.id)}
            disabled={isPending || stage._count.matches > 0}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Stage Content */}
      <div className="p-4">
        {(stage.type === 'GROUP_STAGE' || stage.type === 'GSL_GROUPS') ? (
          <div className="space-y-4">
            {/* Stage Settings */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-300 shadow-sm">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-3">
                  <label className="text-gray-800 font-semibold whitespace-nowrap">Match Order:</label>
                  <select
                    value={config?.groupSchedulingMode || 'interleaved'}
                    onChange={(e) => onUpdateStageConfig(stage.id, { 
                      ...config, 
                      groupSchedulingMode: e.target.value 
                    })}
                    disabled={isPending || stage._count.matches > 0}
                    className="border-2 border-blue-400 rounded-lg px-4 py-2 text-sm bg-white font-semibold text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="sequential">Sequential (all Group A, then B...)</option>
                    <option value="interleaved">Interleaved (alternate groups)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Buffer Time:</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={stage.bufferTimeMinutes}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0
                      onUpdateStageConfig(stage.id, { bufferTimeMinutes: newValue })
                    }}
                    disabled={stage._count.matches > 0}
                    className="w-16 font-bold text-gray-900 bg-white px-2 py-1 rounded border text-center disabled:bg-gray-100"
                  />
                  <span className="text-gray-500">min</span>
                  {config?.groupSchedulingMode === 'sequential' && stage.bufferTimeMinutes > 0 && (
                    <span className="text-blue-600 text-xs">(added between groups)</span>
                  )}
                </div>
                
                {/* Advancing teams per group - only for regular group stages */}
                {stage.type === 'GROUP_STAGE' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Advancing:</span>
                    <select
                      value={(config?.advancingTeamsPerGroup as number) || 2}
                      onChange={(e) => {
                        onUpdateStageConfig(stage.id, { advancingTeamsPerGroup: parseInt(e.target.value) })
                      }}
                      disabled={stage._count.matches > 0}
                      className="font-bold text-gray-900 bg-white px-2 py-1 rounded border disabled:bg-gray-100"
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{n} per group</option>
                      ))}
                    </select>
                    <span className="text-blue-600 text-xs">
                      ({stage.groups.length * ((config?.advancingTeamsPerGroup as number) || 2)} total)
                    </span>
                  </div>
                )}
              </div>
              {stage._count.matches > 0 && (
                <p className="text-xs text-gray-500 mt-2">Clear the schedule to change these settings</p>
              )}
            </div>

            {/* Add Group */}
            <div className="flex gap-2">
              <Input
                placeholder="Add group (e.g., Group E)..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                className="max-w-xs"
              />
              <Button onClick={handleAddGroup} disabled={!newGroupName.trim() || isPending} size="sm">
                Add Group
              </Button>
            </div>

            {/* Groups Grid */}
            {stage.groups.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No groups configured</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {stage.groups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    stageType={stage.type}
                    unassignedTeams={unassignedTeams}
                    isPending={isPending}
                    onUpdateRoundRobin={onUpdateGroupRoundRobin}
                    onDeleteGroup={onDeleteGroup}
                    onAssignTeam={onAssignTeam}
                    onRemoveTeam={onRemoveTeam}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            {config?.numMatches || 0} matches will be generated when schedule is created.
            Teams advance from previous stage based on standings.
          </p>
        )}
      </div>
    </div>
  )
}

// Group Card Component
interface GroupCardProps {
  group: StageWithGroups['groups'][0]
  stageType: StageType
  unassignedTeams: TeamRegistration[]
  isPending: boolean
  onUpdateRoundRobin: (groupId: string, roundRobinType: 'SINGLE' | 'DOUBLE') => void
  onDeleteGroup: (groupId: string) => void
  onAssignTeam: (groupId: string, registrationId: string) => void
  onRemoveTeam: (assignmentId: string) => void
}

function GroupCard({
  group,
  stageType,
  unassignedTeams,
  isPending,
  onUpdateRoundRobin,
  onDeleteGroup,
  onAssignTeam,
  onRemoveTeam,
}: GroupCardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState('')

  const handleAssign = () => {
    if (!selectedTeamId) return
    onAssignTeam(group.id, selectedTeamId)
    setSelectedTeamId('')
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 px-3 py-2 border-b">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-gray-900">{group.name}</h4>
          <button
            onClick={() => onDeleteGroup(group.id)}
            disabled={isPending || group.teamAssignments.length > 0}
            className="text-gray-400 hover:text-red-500 text-lg disabled:opacity-30 disabled:cursor-not-allowed"
            title={group.teamAssignments.length > 0 ? 'Remove teams first' : 'Delete group'}
          >
            ×
          </button>
        </div>
        {/* Round-robin type selector - only for GROUP_STAGE, not GSL */}
        {stageType === 'GROUP_STAGE' && (
          <select
            value={group.roundRobinType}
            onChange={(e) => onUpdateRoundRobin(group.id, e.target.value as 'SINGLE' | 'DOUBLE')}
            disabled={isPending}
            className="mt-1 w-full text-xs border rounded px-1 py-0.5 text-gray-700 bg-white"
          >
            <option value="SINGLE">Single RR</option>
            <option value="DOUBLE">Double RR</option>
          </select>
        )}
        {stageType === 'GSL_GROUPS' && (
          <p className="mt-1 text-xs text-gray-500">5 matches (dual tournament)</p>
        )}
      </div>

      <div className="p-3 space-y-2">
        {/* Team list */}
        {group.teamAssignments.length > 0 ? (
          <div className="space-y-1">
            {group.teamAssignments.map((assignment, index) => (
              <div key={assignment.id} className="flex justify-between items-center text-sm py-1 px-2 bg-gray-50 rounded">
                <span className="text-gray-900">
                  <span className="text-gray-400 mr-2">{index + 1}.</span>
                  {assignment.registration.registeredTeamName || assignment.registration.team.name}
                </span>
                <button
                  onClick={() => onRemoveTeam(assignment.id)}
                  disabled={isPending}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2">No teams</p>
        )}

        {/* Add team dropdown */}
        {unassignedTeams.length > 0 && (
          <div className="flex gap-1 pt-1 border-t">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="flex-1 text-sm border rounded px-2 py-1 text-gray-900 bg-white"
            >
              <option value="">+ Add team</option>
              {unassignedTeams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.teamName}
                </option>
              ))}
            </select>
            {selectedTeamId && (
              <Button size="sm" onClick={handleAssign} disabled={isPending}>
                Add
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
