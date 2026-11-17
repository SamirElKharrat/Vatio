import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: './test/global-setup.js',
    // Todos los tests comparten la base vatios_test
    fileParallelism: false,
  },
})
