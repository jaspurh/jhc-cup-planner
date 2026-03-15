import { PlatformRole } from '@/generated/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
      platformRole: PlatformRole
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    platformRole: PlatformRole
  }
}
