import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: 'jsdom', // Using jsdom for compatibility
    setupFiles: [
      './src/test/setup.ts', 
      './src/test/performance-setup.ts'
    ],
    globals: true,
    css: true, // Enable CSS handling with happy-dom
    
    // Phase 3: Optimized timeouts for parallel execution
    testTimeout: 8000, // Reduced from 10s for faster execution
    hookTimeout: 5000, // Reduced from 10s
    teardownTimeout: 3000, // Added explicit teardown timeout
    
    clearMocks: true,
    restoreMocks: true,
    mockReset: true, // Added for better test isolation
    
    // Phase 3: Enhanced environment configuration
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        runScripts: 'dangerously',
        url: 'http://localhost:3000'
      }
    },
    
    // Phase 3: Environment variables for parallel execution
    env: {
      NODE_ENV: 'test',
      PERFORMANCE_TRACKING_ENABLED: 'true',
      REACT_TIMEOUT_OPTIMIZATION: 'true',
      VITEST_PARALLEL: process.env.CI ? 'true' : 'false'
    },
    
    // Phase 3: Optimized parallel execution
    pool: process.env.CI ? 'threads' : 'forks',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: Math.min(4, os.cpus().length),
        singleThread: false,
        isolate: true,
        useAtomics: true
      },
      forks: {
        singleFork: false,
        isolate: true
      }
    },
    
    // Phase 3: Enhanced coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
        '**/node_modules/**',
        '**/dist/**',
        '**/.trunk/**',
        '**/test/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    },
    
    // Phase 3: Optimized file exclusions
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/commitlint.test.ts',
      '**/poetry.test.ts',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    
    // Phase 3: Performance and debugging optimizations
    logHeapUsage: true,
    retry: 0, // Disabled to get accurate failure counts
    isolate: true,
    
    // Phase 3: Test execution optimization
    sequence: {
      shuffle: false, // Consistent execution order
      concurrent: true,
      setupFiles: 'parallel'
    },
    
    // Phase 3: Enhanced reporters with performance tracking
    reporters: [
      'default',
      // Add performance reporter in parallel environments
      ...(process.env.PERFORMANCE_TRACKING_ENABLED === 'true' ? [
        ['./src/test/performance-reporter.ts', {
          enableDetailedTiming: !process.env.CI,
          enableBudgetWarnings: true,
          exportPath: process.env.PERFORMANCE_REPORT_PATH || './test-results/performance.json',
          slowTestThreshold: process.env.CI ? 2000000 : 1000000, // 2s in CI, 1s locally
          showMemoryUsage: !process.env.CI,
          enableShardingMetrics: !!process.env.VITEST_SHARD,
          workerId: process.env.VITEST_WORKER_ID || '0'
        }]
      ] : [])
    ],
    
    // Phase 3: File system optimizations
    deps: {
      optimizer: {
        web: {
          enabled: true
        }
      }
    },
    
    // Phase 3: Resource management
    maxConcurrency: process.env.CI 
      ? Math.min(4, os.cpus().length) 
      : Math.max(2, Math.floor(os.cpus().length / 2)),
    
    // Phase 3: Output configuration for CI integration
    outputFile: process.env.CI ? {
      junit: './test-results/junit.xml',
      json: './test-results/results.json'
    } : undefined,
    
    // Phase 3: Watch mode optimizations
    watch: !process.env.CI,
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test-results/**'
    ]
  },
})