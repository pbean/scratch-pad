import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'

/**
 * Phase 3: Test Parallelization - Vitest Sharding Configuration
 * 
 * This configuration enables intelligent test sharding for parallel execution
 * across multiple workers, with optimized resource management and monitoring.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/performance-setup.ts'],
    globals: true,
    
    // Phase 3A: Parallel Execution Configuration
    pool: 'threads', // Use threads for better parallelization
    poolOptions: {
      threads: {
        // Dynamic worker allocation based on available CPU cores
        minThreads: Math.max(1, Math.floor(os.cpus().length / 2)),
        maxThreads: Math.max(2, os.cpus().length - 1),
        singleThread: false, // Enable multi-threading
        isolate: true, // Ensure test isolation
        // Optimize thread usage for test types
        useAtomics: true, // Enable atomic operations for better synchronization
      }
    },
    
    // Sharding configuration for CI/CD
    ...(process.env.CI && {
      shard: process.env.VITEST_SHARD ? {
        index: parseInt(process.env.VITEST_SHARD_INDEX || '1'),
        count: parseInt(process.env.VITEST_SHARD_COUNT || '4')
      } : undefined
    }),
    
    // Performance-optimized timeouts
    testTimeout: 8000, // Reduced for faster execution
    hookTimeout: 5000,
    teardownTimeout: 3000,
    
    // Advanced test filtering and execution
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Enhanced test environment for React 19
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
      }
    },
    
    // Environment variables for performance tracking
    env: {
      NODE_ENV: 'test',
      PERFORMANCE_TRACKING_ENABLED: 'true',
      VITEST_SHARDED: process.env.CI ? 'true' : 'false',
      WORKER_ID: process.env.VITEST_WORKER_ID || '0'
    },
    
    // Phase 3B: Coverage and Monitoring Configuration
    coverage: {
      provider: 'v8', // Use V8 for better performance
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.trunk/**',
        '**/test/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 40,
          functions: 40,
          lines: 40,
          statements: 40
        }
      },
      // Enable parallel coverage collection
      allowExternal: true,
      skipFull: false
    },
    
    // Advanced reporting configuration
    reporters: [
      'default',
      'junit',
      // Performance reporter with sharding support
      ...(process.env.PERFORMANCE_TRACKING_ENABLED === 'true' ? [
        ['./src/test/performance-reporter.ts', {
          enableDetailedTiming: true,
          enableBudgetWarnings: true,
          exportPath: process.env.PERFORMANCE_REPORT_PATH || './performance-report.json',
          slowTestThreshold: 500000, // 500ms in microseconds
          showMemoryUsage: true,
          enableShardingMetrics: true,
          workerId: process.env.VITEST_WORKER_ID || '0'
        }]
      ] : [])
    ],
    
    // Optimized file watching and exclusions
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/commitlint.test.ts',
      '**/poetry.test.ts',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    
    // Performance optimizations
    logHeapUsage: true,
    retry: 1, // Reduced retry for faster execution
    isolate: true,
    sequence: {
      // Optimize test execution order
      shuffle: false, // Disable shuffle for consistent performance
      concurrent: true, // Enable concurrent execution
      setupFiles: 'parallel' // Run setup files in parallel
    },
    
    // Resource management
    maxConcurrency: process.env.CI 
      ? Math.min(4, os.cpus().length) 
      : Math.max(2, Math.floor(os.cpus().length / 2)),
    
    // File system optimizations
    deps: {
      optimizer: {
        web: {
          enabled: true
        }
      }
    },
    
    // Test output configuration
    outputFile: {
      junit: './test-results/junit-report.xml',
      json: './test-results/test-results.json'
    }
  }
})