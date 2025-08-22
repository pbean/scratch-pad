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
    
    // Sharding configuration for parallel execution
    shard: {
      count: parseInt(process.env.VITEST_SHARD_COUNT || '4'),
      index: parseInt(process.env.VITEST_SHARD_INDEX || '1') - 1
    },
    
    // CI-optimized timeouts for sharded execution
    testTimeout: 45000, // 45 seconds per test (increased for shard stability)
    hookTimeout: 20000, // 20 seconds for hooks
    teardownTimeout: 15000, // 15 seconds for teardown
    
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
    
    // Shard-specific environment variables
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      VITEST_SHARD: 'true',
      VITEST_SHARD_INDEX: process.env.VITEST_SHARD_INDEX || '1',
      VITEST_SHARD_COUNT: process.env.VITEST_SHARD_COUNT || '4',
      VITEST_WORKER_ID: process.env.VITEST_WORKER_ID || 'shard-1',
      PERFORMANCE_TRACKING_ENABLED: 'false', // Disabled for CI to reduce overhead
      REACT_TIMEOUT_OPTIMIZATION: 'false'
    },
    
    // Shard-optimized execution configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Single fork per shard for stability
        isolate: true
      }
    },
    
    // Shard-optimized worker configuration
    maxWorkers: 1, // Single worker per shard
    minWorkers: 1,
    maxConcurrency: 1, // Sequential execution within shard
    
    // Shard-specific retry configuration
    retry: 0, // No retries in sharded mode to avoid complexity
    
    // Shard-specific coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['json'], // JSON only for easier aggregation
      reportsDirectory: `./coverage/shard-${process.env.VITEST_SHARD_INDEX || '1'}`,
      thresholds: undefined, // Disable thresholds for individual shards
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
    
    // Shard-specific reporters
    reporters: [
      ['default', { summary: false }], // Minimal output per shard
      ['json', { file: `./test-results/frontend/shard-${process.env.VITEST_SHARD_INDEX || '1'}/results.json` }]
    ],
    
    // Disable watch mode in CI
    watch: false,
    
    // Shard-specific output configuration
    outputFile: {
      json: `./test-results/frontend/shard-${process.env.VITEST_SHARD_INDEX || '1'}/results.json`
    },
    
    // Test sequence optimization for sharding
    sequence: {
      shuffle: false, // Consistent order for reliable sharding
      concurrent: false, // Sequential execution within shard
      setupFiles: 'list' // Sequential setup for stability
    },
    
    // Disable performance logging in sharded CI
    logHeapUsage: false,
    isolate: true
  }
})