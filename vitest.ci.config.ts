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
    
    // CI-optimized timeouts (reduced for faster failures)
    testTimeout: 10000, // 10 seconds for CI (faster failure detection)
    hookTimeout: 5000, // 5 seconds for CI
    teardownTimeout: 5000, // 5 seconds for CI
    
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
      PERFORMANCE_TRACKING_ENABLED: 'false', // Disabled for CI to reduce overhead
      REACT_TIMEOUT_OPTIMIZATION: 'false', // Disable optimization in CI
      VITEST_PARALLEL: 'false' // Disable parallel execution in CI for stability
    },
    
    // CI-optimized execution (enable limited parallelism for better performance)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false, // Allow 2 forks for better performance
        isolate: true
      }
    },
    
    // Limited concurrent test execution in CI
    maxConcurrency: 1, // Single worker for stability
    minWorkers: 1,
    maxWorkers: 1, // Single worker to avoid race conditions
    
    // CI-specific retry configuration
    retry: 1, // Reduce from 2 to 1 for faster execution
    
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
    
    // CI-specific reporter configuration (remove deprecated basic reporter)
    reporters: process.env.GITHUB_ACTIONS 
      ? [['default', { summary: false }], 'github-actions']
      : [['default', { summary: false }]],
    
    // Disable watch mode in CI
    watch: false,
    
    // CI-specific output configuration
    outputFile: {
      junit: './test-results/junit.xml'
    },
    
    // Optimize test sequence for CI
    sequence: {
      shuffle: false, // Consistent execution order
      concurrent: true, // Enable concurrent execution with limited workers
      setupFiles: 'parallel'
    },
    
    // Disable performance logging in CI to reduce noise
    logHeapUsage: false, // Disable to reduce CI log output
    isolate: true
  }
})