// Extend NextAuth types
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

// Re-export Prisma types for convenience
export type { User, Account, Session as DbSession } from '@/generated/prisma'

