import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/permissions.ts',
        'src/actions/roles.ts',
        'src/actions/match.ts',
        'src/actions/schedule.ts',
      ],
      exclude: ['node_modules', '.next', 'src/generated'],
      reporter: ['text', 'lcov'],
      // Thresholds cover RBAC gate paths; match.ts/schedule.ts also contain
      // business-logic helpers (progression, saveMatches) tested elsewhere.
      thresholds: { lines: 40, functions: 75, branches: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
