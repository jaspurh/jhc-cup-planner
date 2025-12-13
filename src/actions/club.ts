'use server'

import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { 
  createClubSchema, 
  updateClubSchema,
  addClubAdminSchema,
  removeClubAdminSchema,
} from '@/lib/schemas'
import { revalidatePath } from 'next/cache'
import type { ActionResult, ClubWithAdmins, ClubSummary } from '@/types'
import { ClubStatus } from '@/types'

/**
 * Get all clubs (for selectors and lists)
 */
export async function getClubs(options?: {
  status?: ClubStatus
  includeStats?: boolean
}): Promise<ActionResult<ClubSummary[]>> {
  try {
    const clubs = await db.club.findMany({
      where: {
        status: options?.status ?? 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        logoUrl: true,
        primaryColor: true,
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: clubs }
  } catch (error) {
    logger.error('Failed to fetch clubs', { error })
    return { success: false, error: 'Failed to fetch clubs' }
  }
}

/**
 * Get all clubs with full details (admin view)
 */
export async function getClubsWithDetails(): Promise<ActionResult<ClubWithAdmins[]>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (user?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    const clubs = await db.club.findMany({
      include: {
        administrators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        },
        _count: {
          select: {
            primaryTeams: true,
            secondaryTeams: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: clubs }
  } catch (error) {
    logger.error('Failed to fetch clubs with details', { error })
    return { success: false, error: 'Failed to fetch clubs' }
  }
}

/**
 * Get a single club by ID
 */
export async function getClub(clubId: string): Promise<ActionResult<ClubWithAdmins>> {
  try {
    const club = await db.club.findUnique({
      where: { id: clubId },
      include: {
        administrators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        },
        _count: {
          select: {
            primaryTeams: true,
            secondaryTeams: true,
          }
        }
      },
    })

    if (!club) {
      return { success: false, error: 'Club not found' }
    }

    return { success: true, data: club }
  } catch (error) {
    logger.error('Failed to fetch club', { error, clubId })
    return { success: false, error: 'Failed to fetch club' }
  }
}

/**
 * Create a new club (admin only)
 */
export async function createClub(input: {
  name: string
  fullName?: string | null
  country?: string | null
  region?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (user?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    const validated = createClubSchema.parse(input)

    // Check for duplicate club name
    const existingClub = await db.club.findFirst({
      where: {
        name: {
          equals: validated.name,
          mode: 'insensitive'
        }
      }
    })

    if (existingClub) {
      return { success: false, error: 'A club with this name already exists' }
    }

    const club = await db.club.create({
      data: {
        name: validated.name,
        fullName: validated.fullName,
        country: validated.country,
        region: validated.region,
        logoUrl: validated.logoUrl,
        primaryColor: validated.primaryColor,
        secondaryColor: validated.secondaryColor,
      }
    })

    logger.info('Club created', { clubId: club.id, userId: session.user.id })

    revalidatePath('/admin/clubs')

    return { success: true, data: { id: club.id } }
  } catch (error) {
    logger.error('Failed to create club', { error })
    return { success: false, error: 'Failed to create club' }
  }
}

/**
 * Update a club (admin only)
 */
export async function updateClub(
  clubId: string,
  input: {
    name?: string
    fullName?: string | null
    country?: string | null
    region?: string | null
    logoUrl?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    status?: ClubStatus
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (user?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    const validated = updateClubSchema.parse(input)

    // Check if club exists
    const existingClub = await db.club.findUnique({
      where: { id: clubId }
    })

    if (!existingClub) {
      return { success: false, error: 'Club not found' }
    }

    // Check for duplicate name if name is being changed
    if (validated.name && validated.name.toLowerCase() !== existingClub.name.toLowerCase()) {
      const duplicateClub = await db.club.findFirst({
        where: {
          name: {
            equals: validated.name,
            mode: 'insensitive'
          },
          id: { not: clubId }
        }
      })

      if (duplicateClub) {
        return { success: false, error: 'A club with this name already exists' }
      }
    }

    const club = await db.club.update({
      where: { id: clubId },
      data: validated,
    })

    logger.info('Club updated', { clubId: club.id, userId: session.user.id })

    revalidatePath('/admin/clubs')
    revalidatePath(`/admin/clubs/${clubId}`)

    return { success: true, data: { id: club.id } }
  } catch (error) {
    logger.error('Failed to update club', { error, clubId })
    return { success: false, error: 'Failed to update club' }
  }
}

/**
 * Delete a club (admin only)
 */
export async function deleteClub(clubId: string): Promise<ActionResult<void>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (user?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    // Check if club exists and has teams
    const club = await db.club.findUnique({
      where: { id: clubId },
      include: {
        _count: {
          select: {
            primaryTeams: true,
            secondaryTeams: true,
          }
        }
      }
    })

    if (!club) {
      return { success: false, error: 'Club not found' }
    }

    if (club._count.primaryTeams > 0 || club._count.secondaryTeams > 0) {
      return { 
        success: false, 
        error: 'Cannot delete club with affiliated teams. Remove team affiliations first or set status to inactive.' 
      }
    }

    await db.club.delete({
      where: { id: clubId }
    })

    logger.info('Club deleted', { clubId, userId: session.user.id })

    revalidatePath('/admin/clubs')

    return { success: true }
  } catch (error) {
    logger.error('Failed to delete club', { error, clubId })
    return { success: false, error: 'Failed to delete club' }
  }
}

/**
 * Add a club administrator (admin only)
 */
export async function addClubAdmin(input: {
  clubId: string
  userId: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (currentUser?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    const validated = addClubAdminSchema.parse(input)

    // Check if club exists
    const club = await db.club.findUnique({
      where: { id: validated.clubId }
    })

    if (!club) {
      return { success: false, error: 'Club not found' }
    }

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id: validated.userId }
    })

    if (!targetUser) {
      return { success: false, error: 'User not found' }
    }

    // Check if already an admin
    const existingAdmin = await db.clubAdmin.findUnique({
      where: {
        clubId_userId: {
          clubId: validated.clubId,
          userId: validated.userId
        }
      }
    })

    if (existingAdmin) {
      return { success: false, error: 'User is already an administrator of this club' }
    }

    const clubAdmin = await db.clubAdmin.create({
      data: {
        clubId: validated.clubId,
        userId: validated.userId,
      }
    })

    logger.info('Club admin added', { 
      clubId: validated.clubId, 
      userId: validated.userId,
      addedBy: session.user.id 
    })

    revalidatePath(`/admin/clubs/${validated.clubId}`)

    return { success: true, data: { id: clubAdmin.id } }
  } catch (error) {
    logger.error('Failed to add club admin', { error })
    return { success: false, error: 'Failed to add club administrator' }
  }
}

/**
 * Remove a club administrator (admin only)
 */
export async function removeClubAdmin(input: {
  clubId: string
  userId: string
}): Promise<ActionResult<void>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user has admin permissions
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { platformRole: true }
    })

    if (currentUser?.platformRole !== 'ADMIN') {
      return { success: false, error: 'Not authorized' }
    }

    const validated = removeClubAdminSchema.parse(input)

    await db.clubAdmin.delete({
      where: {
        clubId_userId: {
          clubId: validated.clubId,
          userId: validated.userId
        }
      }
    })

    logger.info('Club admin removed', { 
      clubId: validated.clubId, 
      userId: validated.userId,
      removedBy: session.user.id 
    })

    revalidatePath(`/admin/clubs/${validated.clubId}`)

    return { success: true }
  } catch (error) {
    logger.error('Failed to remove club admin', { error })
    return { success: false, error: 'Failed to remove club administrator' }
  }
}

/**
 * Check if current user is a club admin
 */
export async function isClubAdmin(clubId: string): Promise<boolean> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return false
    }

    const clubAdmin = await db.clubAdmin.findUnique({
      where: {
        clubId_userId: {
          clubId,
          userId: session.user.id
        }
      }
    })

    return !!clubAdmin
  } catch {
    return false
  }
}

/**
 * Get clubs where current user is an admin
 */
export async function getMyClubs(): Promise<ActionResult<ClubSummary[]>> {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    const clubAdmins = await db.clubAdmin.findMany({
      where: { userId: session.user.id },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            fullName: true,
            logoUrl: true,
            primaryColor: true,
          }
        }
      }
    })

    const clubs = clubAdmins.map(ca => ca.club)

    return { success: true, data: clubs }
  } catch (error) {
    logger.error('Failed to fetch user clubs', { error })
    return { success: false, error: 'Failed to fetch clubs' }
  }
}
