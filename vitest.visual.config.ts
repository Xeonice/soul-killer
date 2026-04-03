import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/visual/**/*.visual.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
})
