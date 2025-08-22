import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// SIMPLIFIED CI CONFIG - No complexity, just run tests
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup-ci.ts'],
    globals: true,
    
    // Simple timeouts - no fancy logic
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Basic mocking
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Simple pool - single thread for CI reliability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Single process - no parallelism issues
        isolate: false,    // No isolation overhead
      }
    },
    
    // No workers - sequential execution
    maxConcurrency: 1,
    maxWorkers: 1,
    
    // No retries - if it fails, it fails
    retry: 0,
    
    // No coverage in CI - just run tests
    coverage: {
      enabled: false
    },
    
    // Simple reporter
    reporters: process.env.CI ? ['basic'] : ['verbose'],
    
    // Disable watchers
    watch: false,
  }
})