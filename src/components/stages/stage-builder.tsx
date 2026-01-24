'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  createStage,
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
  gapMinutesBefore: number
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
    gapMinutesBefore: number
    numGroups?: number
    roundRobinType?: 'SINGLE' | 'DOUBLE'
    numMatches?: number
  }) => {
    setError(null)
    
    const stageConfig = template.hasGroups
      ? { numGroups: config.numGroups || 4, roundRobinType: config.roundRobinType || 'SINGLE' }
      : { numMatches: config.numMatches || 4 }

    const result = await createStage({
      name: config.name,
      tournamentId,
      type: template.type,
      gapMinutesBefore: config.gapMinutesBefore,
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
    gapMinutesBefore: number
    numGroups?: number
    roundRobinType?: 'SINGLE' | 'DOUBLE'
    numMatches?: number
  }) => void
  onCancel: () => void
  isPending: boolean
}

function AddStageForm({ onAdd, onCancel, isPending }: AddStageFormProps) {
  const [selectedType, setSelectedType] = useState<StageType | null>(null)
  const [name, setName] = useState('')
  const [gapMinutes, setGapMinutes] = useState(0)
  const [numGroups, setNumGroups] = useState(4)
  const [roundRobinType, setRoundRobinType] = useState<'SINGLE' | 'DOUBLE'>('SINGLE')
  const [numMatches, setNumMatches] = useState(4)

  const selectedTemplate = STAGE_TEMPLATES.find(t => t.type === selectedType)

  const handleSubmit = () => {
    if (!selectedTemplate || !name.trim()) return
    onAdd(selectedTemplate, {
      name: name.trim(),
      gapMinutesBefore: gapMinutes,
      numGroups: selectedTemplate.hasGroups ? numGroups : undefined,
      roundRobinType: selectedTemplate.hasGroups ? roundRobinType : undefined,
      numMatches: !selectedTemplate.hasGroups ? numMatches : undefined,
    })
  }

  return (
    <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
      <h3 className="font-semibold text-gray-900">Add New Stage</h3>

      {/* Stage Type Selection */}
      {!selectedType ? (
        <div className="grid grid-cols-3 gap-3">
          {STAGE_TEMPLATES.map(template => (
            <button
              key={template.type}
              onClick={() => {
                setSelectedType(template.type)
                setName(template.defaultName)
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
              Gap Before Stage (minutes)
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
              Time gap after previous stage ends before this stage starts
            </p>
          </div>

          {/* Group Stage specific */}
          {selectedTemplate?.configType === 'groups' && (
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
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n} groups</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                GSL format: 4 teams per group, 5 matches each. Total teams needed: {numGroups * 4}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Elimination Matches
              </label>
              <select
                value={numMatches}
                onChange={(e) => setNumMatches(parseInt(e.target.value))}
                className="border rounded-md px-3 py-2 text-gray-900 bg-white"
              >
                <option value={1}>1 match</option>
                <option value={2}>2 matches</option>
                <option value={3}>3 matches</option>
                <option value={4}>4 matches (Quarterfinals)</option>
                <option value={8}>8 matches (Round of 16)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Single elimination - losers are out
              </p>
            </div>
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

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
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
}: StageCardProps) {
  const [newGroupName, setNewGroupName] = useState('')

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    onAddGroup(stage.id, newGroupName.trim())
    setNewGroupName('')
  }

  const config = stage.configuration as { numGroups?: number; roundRobinType?: string; numMatches?: number } | null

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
              {stage.gapMinutesBefore > 0 && (
                <span>• {stage.gapMinutesBefore} min gap before</span>
              )}
              {config?.roundRobinType && (
                <span>• {config.roundRobinType.toLowerCase()} round-robin</span>
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
  unassignedTeams: TeamRegistration[]
  isPending: boolean
  onUpdateRoundRobin: (groupId: string, roundRobinType: 'SINGLE' | 'DOUBLE') => void
  onDeleteGroup: (groupId: string) => void
  onAssignTeam: (groupId: string, registrationId: string) => void
  onRemoveTeam: (assignmentId: string) => void
}

function GroupCard({
  group,
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
        {/* Round-robin type selector */}
        <select
          value={group.roundRobinType}
          onChange={(e) => onUpdateRoundRobin(group.id, e.target.value as 'SINGLE' | 'DOUBLE')}
          disabled={isPending}
          className="mt-1 w-full text-xs border rounded px-1 py-0.5 text-gray-700 bg-white"
        >
          <option value="SINGLE">Single RR</option>
          <option value="DOUBLE">Double RR</option>
        </select>
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
