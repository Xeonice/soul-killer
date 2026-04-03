import { defineConfig } from 'vitest/config'

export default defineConfig({
  ssr: {
    noExternal: false,
    external: ['node-pty'],
  },
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    pool: 'forks',
    server: {
      deps: {
        external: ['node-pty'],
        inline: [],
      },
    },
  },
})
