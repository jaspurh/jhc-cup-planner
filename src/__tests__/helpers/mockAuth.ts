import { PlatformRole } from '@/generated/prisma'
import { USER_ID } from './fixtures'

/**
 * Builds a minimal Next-Auth session object for use in `auth()` mocks.
 */
export function makeSession(overrides?: {
  id?: string
  platformRole?: PlatformRole
}) {
  return {
    user: {
      id: overrides?.id ?? USER_ID,
      email: 'user@example.com',
      name: 'Test User',
      platformRole: overrides?.platformRole ?? PlatformRole.USER,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  }
}
