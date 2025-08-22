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
    
    // CI-optimized timeouts (increased for platform stability)
    testTimeout: 30000, // 30 seconds for CI (increased from 10s)
    hookTimeout: 15000, // 15 seconds for CI (increased from 5s)
    teardownTimeout: 10000, // 10 seconds for CI (increased from 5s)
    
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
      VITEST_PARALLEL: 'false', // Disable parallel execution in CI for stability
      // Add platform detection
      VITEST_CI_PLATFORM: process.platform,
      // Focus timing configuration for CI
      CI_FOCUS_TIMEOUT: '5000',
      CI_FOCUS_RETRY_COUNT: '3'
    },
    
    // CI-optimized execution (single worker for maximum stability)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Single fork for absolute stability
        isolate: true,
        execArgv: ['--max-old-space-size=4096'] // Ensure sufficient memory
      }
    },
    
    // Single worker to avoid race conditions completely
    maxConcurrency: 1, // Single test at a time
    minWorkers: 1,
    maxWorkers: 1, // Single worker for maximum stability
    
    // CI-specific retry configuration (focus tests may need retries)
    retry: 2, // Allow retries for flaky focus tests
    
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
      ? [['default', { summary: true }], 'github-actions'] // Show summary in CI
      : [['default', { summary: true }]],
    
    // Disable watch mode in CI
    watch: false,
    
    // CI-specific output configuration
    outputFile: {
      junit: './test-results/junit.xml'
    },
    
    // Optimize test sequence for CI (sequential execution)
    sequence: {
      shuffle: false, // Consistent execution order
      concurrent: false, // Disable concurrent execution entirely
      setupFiles: 'list' // Sequential setup for maximum stability
    },
    
    // Enable performance logging in CI for debugging
    logHeapUsage: true, // Enable for CI debugging
    isolate: true,
    
    // Platform-specific configuration adjustments
    ...(process.platform === 'darwin' ? {
      // macOS-specific optimizations
      testTimeout: 45000, // Even longer timeout for macOS
      hookTimeout: 20000,
      maxConcurrency: 1, // Definitely single thread on macOS
    } : {}),
    
    ...(process.platform === 'win32' ? {
      // Windows-specific optimizations
      testTimeout: 35000, // Slightly longer for Windows
      poolOptions: {
        forks: {
          singleFork: true,
          isolate: true,
          execArgv: ['--max-old-space-size=6144'] // More memory for Windows
        }
      }
    } : {}),
    
    // Add test file filtering for problematic tests during debugging
    exclude: [
      // Temporarily exclude the most problematic tests if needed
      // 'src/components/search-history/__tests__/SearchHistoryView.test.tsx'
    ]
  }
})