import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// FIXED CI CONFIG - Addresses actual root causes
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
    
    // Reasonable timeouts - not too short, not too long
    testTimeout: 15000,
    hookTimeout: 10000,
    
    // Clean mocks between tests
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Use threads for speed but limit for stability
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,  // Important for test isolation
        useAtomics: true,
        maxThreads: 2,   // Limited parallelism for CI stability
        minThreads: 1
      }
    },
    
    // Moderate concurrency 
    maxConcurrency: 2,
    
    // One retry for flaky tests
    retry: 1,
    
    // Disable coverage in tests (separate job for that)
    coverage: {
      enabled: false
    },
    
    // Better reporter for CI
    reporters: ['basic'],
    
    // Important: Bail on first failure in CI
    bail: process.env.CI ? 5 : 0,
    
    // Disable file watching
    watch: false,
    
    // CI-specific optimizations
    deps: {
      optimizer: {
        web: {
          enabled: false  // Disable optimization in CI for speed
        },
        ssr: {
          enabled: false
        }
      }
    },
    
    // Prevent hanging on unhandled promises
    dangerouslyIgnoreUnhandledErrors: false,
    
    // Short grace period for cleanup
    teardownTimeout: 1000
  }
})