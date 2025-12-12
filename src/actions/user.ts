'use server'

import { db } from '@/lib/db'
import { registerSchema } from '@/lib/schemas/auth'
import { logger } from '@/lib/logger'

export async function createUser(input: unknown) {
  try {
    const validated = registerSchema.parse(input)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' }
    }

    // TODO: Hash password with bcrypt before storing
    // const passwordHash = await bcrypt.hash(validated.password, 12)

    const user = await db.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash: validated.password, // TODO: Use hashed password
      },
    })

    logger.info('User created', { userId: user.id, email: user.email })

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    }
  } catch (error) {
    logger.error('Failed to create user', { error })

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getUserById(id: string) {
  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    })

    return user
  } catch (error) {
    logger.error('Failed to get user', { userId: id, error })
    return null
  }
}

