import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['packages/**/*.spec.ts', 'packages/**/*.test.ts', 'apps/**/*.spec.ts', 'apps/**/*.test.ts'],
  },
})
