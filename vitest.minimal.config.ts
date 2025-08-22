import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Minimal Vitest Configuration for Debugging Timeout Issues
 * 
 * This configuration removes all complex optimizations and performance tracking
 * to isolate the core timeout problems in the test suite.
 */
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
    setupFiles: ['./src/test/minimal-setup.ts'], // Single, minimal setup file
    globals: true,
    
    // Simple, consistent timeouts
    testTimeout: 8000,   // 8 seconds - matches original vitest config
    hookTimeout: 5000,   // 5 seconds for before/after hooks
    teardownTimeout: 3000, // 3 seconds for cleanup
    
    // Basic cleanup
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Basic JSDOM configuration - no advanced features
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
      }
    },
    
    // Disable performance tracking and complex features
    env: {
      NODE_ENV: 'test',
      PERFORMANCE_TRACKING_ENABLED: 'false',
      REACT_TIMEOUT_OPTIMIZATION: 'false',
      VITEST_MINIMAL_MODE: 'true'
    },
    
    // Single-threaded execution for debugging
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Single process for easier debugging
        isolate: true
      }
    },
    
    // Basic coverage - no advanced features
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/test/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    },
    
    // Standard exclusions only
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**'
    ],
    
    // Basic execution configuration
    logHeapUsage: false,
    retry: 0, // No retries to avoid masking timeout issues
    isolate: true,
    
    // Sequential execution for debugging
    sequence: {
      shuffle: false,
      concurrent: false, // Sequential execution to isolate issues
      setupFiles: 'list'
    },
    
    // Single concurrency for debugging
    maxConcurrency: 1,
    
    // Standard reporters only
    reporters: ['default'],
    
    // No file optimization for debugging
    deps: {
      optimizer: {
        web: {
          enabled: false // Disable for simpler debugging
        }
      }
    },
    
    // No watch mode optimizations
    watch: false,
    watchExclude: []
  }
})