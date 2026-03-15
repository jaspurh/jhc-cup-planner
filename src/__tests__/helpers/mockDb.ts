import { vi } from 'vitest'

/**
 * Creates a mock Prisma client with all methods used in the RBAC layer as vi.fn().
 * Assign return values per-test with `.mockResolvedValue(...)`.
 */
export function createMockDb() {
  return {
    tournament: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    tournamentRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    match: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    matchResult: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}

export type MockDb = ReturnType<typeof createMockDb>
