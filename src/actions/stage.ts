'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { createStageSchema, updateStageSchema, createGroupSchema, assignTeamToGroupSchema } from '@/lib/schemas'
import type { ActionResult } from '@/types'
import type { Stage, Group, StageType } from '@/generated/prisma'

// ==========================================
// Stage Actions
// ==========================================

export async function createStage(input: {
  name: string
  tournamentId: string
  type: StageType
  order?: number
  bufferTimeMinutes?: number
  configuration?: Record<string, unknown>
}): Promise<ActionResult<Stage>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const maxOrder = await db.stage.aggregate({
    where: { tournamentId: input.tournamentId },
    _max: { order: true },
  })

  const order = input.order ?? (maxOrder._max.order ?? 0) + 1

  const validated = createStageSchema.safeParse({ ...input, order })

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    const stage = await db.stage.create({
      data: {
        name: validated.data.name,
        tournamentId: validated.data.tournamentId,
        type: validated.data.type,
        order: validated.data.order,
        bufferTimeMinutes: validated.data.bufferTimeMinutes,
        configuration: validated.data.configuration as object | undefined,
      },
    })

    return { success: true, data: stage }
  } catch (error) {
    console.error('Failed to create stage:', error)
    return { success: false, error: 'Failed to create stage' }
  }
}

export async function updateStage(
  stageId: string,
  input: { name?: string; order?: number; bufferTimeMinutes?: number; configuration?: Record<string, unknown> }
): Promise<ActionResult<Stage>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const validated = updateStageSchema.safeParse(input)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    const stage = await db.stage.update({
      where: { id: stageId },
      data: { ...validated.data, configuration: validated.data.configuration as object | undefined },
    })

    return { success: true, data: stage }
  } catch (error) {
    console.error('Failed to update stage:', error)
    return { success: false, error: 'Failed to update stage' }
  }
}

export async function deleteStage(stageId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const stage = await db.stage.findUnique({
      where: { id: stageId },
      select: { tournamentId: true, order: true },
    })

    if (!stage) {
      return { success: false, error: 'Stage not found' }
    }

    await db.$transaction([
      db.stage.delete({ where: { id: stageId } }),
      db.stage.updateMany({
        where: { tournamentId: stage.tournamentId, order: { gt: stage.order } },
        data: { order: { decrement: 1 } },
      }),
    ])

    return { success: true }
  } catch (error) {
    console.error('Failed to delete stage:', error)
    return { success: false, error: 'Failed to delete stage' }
  }
}

export async function getStagesWithDetails(tournamentId: string): Promise<ActionResult<Array<Stage & {
  groups: Array<Group & {
    teamAssignments: Array<{
      id: string
      seedPosition: number | null
      registration: { id: string; registeredTeamName: string | null; team: { id: string; name: string } }
    }>
  }>
  _count: { matches: number }
}>>> {
  try {
    const stages = await db.stage.findMany({
      where: { tournamentId },
      include: {
        groups: {
          include: {
            teamAssignments: {
              include: {
                registration: {
                  select: { id: true, registeredTeamName: true, team: { select: { id: true, name: true } } },
                },
              },
              orderBy: { seedPosition: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
        _count: { select: { matches: true } },
      },
      orderBy: { order: 'asc' },
    })

    return { success: true, data: stages }
  } catch (error) {
    console.error('Failed to get stages:', error)
    return { success: false, error: 'Failed to get stages' }
  }
}

// ==========================================
// Group Actions
// ==========================================

export async function createGroup(input: {
  name: string
  stageId: string
  order?: number
  roundRobinType?: 'SINGLE' | 'DOUBLE'
}): Promise<ActionResult<Group>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const maxOrder = await db.group.aggregate({
    where: { stageId: input.stageId },
    _max: { order: true },
  })

  const order = input.order ?? (maxOrder._max.order ?? 0) + 1

  const validated = createGroupSchema.safeParse({ ...input, order, roundRobinType: input.roundRobinType ?? 'SINGLE' })

  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    const group = await db.group.create({ data: validated.data })
    return { success: true, data: group }
  } catch (error) {
    console.error('Failed to create group:', error)
    return { success: false, error: 'Failed to create group' }
  }
}

export async function updateGroup(
  groupId: string,
  input: { name?: string; roundRobinType?: 'SINGLE' | 'DOUBLE' }
): Promise<ActionResult<Group>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const group = await db.group.update({
      where: { id: groupId },
      data: input,
    })

    return { success: true, data: group }
  } catch (error) {
    console.error('Failed to update group:', error)
    return { success: false, error: 'Failed to update group' }
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { stageId: true, order: true },
    })

    if (!group) {
      return { success: false, error: 'Group not found' }
    }

    await db.$transaction([
      db.group.delete({ where: { id: groupId } }),
      db.group.updateMany({
        where: { stageId: group.stageId, order: { gt: group.order } },
        data: { order: { decrement: 1 } },
      }),
    ])

    return { success: true }
  } catch (error) {
    console.error('Failed to delete group:', error)
    return { success: false, error: 'Failed to delete group' }
  }
}

// ==========================================
// Team Assignment Actions
// ==========================================

export async function assignTeamToGroup(input: {
  groupId: string
  registrationId: string
  seedPosition?: number
}): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const validated = assignTeamToGroupSchema.safeParse(input)
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message }
  }

  try {
    const group = await db.group.findUnique({
      where: { id: validated.data.groupId },
      select: { stageId: true },
    })

    if (!group) {
      return { success: false, error: 'Group not found' }
    }

    const existingAssignment = await db.groupTeamAssignment.findFirst({
      where: { registrationId: validated.data.registrationId, group: { stageId: group.stageId } },
    })

    if (existingAssignment) {
      return { success: false, error: 'Team is already assigned to a group in this stage' }
    }

    let seedPosition = validated.data.seedPosition
    if (!seedPosition) {
      const maxSeed = await db.groupTeamAssignment.aggregate({
        where: { groupId: validated.data.groupId },
        _max: { seedPosition: true },
      })
      seedPosition = (maxSeed._max.seedPosition ?? 0) + 1
    }

    const assignment = await db.groupTeamAssignment.create({
      data: { groupId: validated.data.groupId, registrationId: validated.data.registrationId, seedPosition },
    })

    return { success: true, data: { id: assignment.id } }
  } catch (error) {
    console.error('Failed to assign team to group:', error)
    return { success: false, error: 'Failed to assign team to group' }
  }
}

export async function removeTeamFromGroup(assignmentId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    await db.groupTeamAssignment.delete({ where: { id: assignmentId } })
    return { success: true }
  } catch (error) {
    console.error('Failed to remove team from group:', error)
    return { success: false, error: 'Failed to remove team from group' }
  }
}

export async function autoDistributeTeams(stageId: string): Promise<ActionResult<{ assigned: number }>> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const stage = await db.stage.findUnique({
      where: { id: stageId },
      include: {
        groups: { include: { teamAssignments: true }, orderBy: { order: 'asc' } },
        tournament: { include: { teams: { where: { status: 'CONFIRMED' } } } },
      },
    })

    if (!stage) {
      return { success: false, error: 'Stage not found' }
    }

    if (stage.groups.length === 0) {
      return { success: false, error: 'No groups configured for this stage' }
    }

    const assignedRegistrationIds = new Set(
      stage.groups.flatMap(g => g.teamAssignments.map(a => a.registrationId))
    )

    const unassignedTeams = stage.tournament.teams.filter(t => !assignedRegistrationIds.has(t.id))

    if (unassignedTeams.length === 0) {
      return { success: true, data: { assigned: 0 } }
    }

    const shuffled = [...unassignedTeams].sort(() => Math.random() - 0.5)

    const assignments: { groupId: string; registrationId: string; seedPosition: number }[] = []
    let groupIndex = 0
    let direction = 1

    for (const team of shuffled) {
      const group = stage.groups[groupIndex]
      const currentTeamCount = group.teamAssignments.length + assignments.filter(a => a.groupId === group.id).length

      assignments.push({ groupId: group.id, registrationId: team.id, seedPosition: currentTeamCount + 1 })

      groupIndex += direction
      if (groupIndex >= stage.groups.length) {
        groupIndex = stage.groups.length - 1
        direction = -1
      } else if (groupIndex < 0) {
        groupIndex = 0
        direction = 1
      }
    }

    await db.groupTeamAssignment.createMany({ data: assignments })

    return { success: true, data: { assigned: assignments.length } }
  } catch (error) {
    console.error('Failed to auto-distribute teams:', error)
    return { success: false, error: 'Failed to auto-distribute teams' }
  }
}
