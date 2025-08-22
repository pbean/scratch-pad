import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    setupFiles: [
      './src/test/setup.ts', 
      './src/test/performance-setup.ts'
    ],
    globals: true,
    
    // CI-specific: Much longer timeouts for slower CI environment
    testTimeout: 60000, // 60 seconds for CI (vs 8s locally)
    hookTimeout: 30000, // 30 seconds for CI (vs 5s locally)
    teardownTimeout: 15000, // 15 seconds for CI (vs 3s locally)
    
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Enhanced React 19 environment configuration
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
      }
    },
    
    // CI-specific environment variables
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      PERFORMANCE_TRACKING_ENABLED: 'false', // Disable for CI to reduce overhead
      REACT_TIMEOUT_OPTIMIZATION: 'false', // Disable optimization in CI
      VITEST_PARALLEL: 'false' // Disable parallel execution in CI for stability
    },
    
    // CI-specific: Single-threaded execution for stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Single fork for CI stability
        isolate: true
      }
    },
    
    // Disable concurrent test execution in CI
    maxConcurrency: 1,
    minWorkers: 1,
    maxWorkers: 1,
    
    // CI-specific retry configuration
    retry: 2, // Retry failed tests twice in CI
    
    // Coverage configuration for CI
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 40,
          functions: 40,
          lines: 40,
          statements: 40
        }
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/test-utils.tsx',
        '**/setup.ts',
        '**/performance-setup.ts'
      ]
    },
    
    // CI-specific reporter configuration
    reporters: process.env.GITHUB_ACTIONS 
      ? ['default', 'github-actions']
      : ['default'],
    
    // Disable watch mode in CI
    watch: false,
    
    // CI-specific output configuration
    outputFile: {
      junit: './test-results/junit.xml'
    }
  }
})