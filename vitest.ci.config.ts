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
      './src/test/setup-ci.ts' // Use CI-specific setup
    ],
    globals: true,
    
    // CRITICAL: Sequential execution to prevent DOM sharing
    testTimeout: 15000,  // Increased for sequential runs
    hookTimeout: 8000,   
    teardownTimeout: 5000,
    
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Enhanced environment configuration for DOM isolation
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        url: 'http://localhost:3000'
      }
    },
    
    // CI-specific environment variables
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      PERFORMANCE_TRACKING_ENABLED: 'false',
      DISABLE_PERFORMANCE_TRACKING: 'true',
      REACT_TIMEOUT_OPTIMIZATION: 'false',
      VITEST_CI_MODE: 'true',
      VITEST_ISOLATION: 'true'
    },
    
    // CRITICAL: Use forks for complete process isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Force sequential execution
        isolate: true,     // Complete isolation
        execArgv: ['--max-old-space-size=4096'] // Increased memory for sequential runs
      }
    },
    
    // CRITICAL: Sequential execution settings
    maxConcurrency: 1,  // One test at a time
    minWorkers: 1,
    maxWorkers: 1,      // Single worker only
    
    retry: 2, // Allow retries for flaky CI issues
    
    // Fast coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'json-summary'],
      reportsDirectory: './coverage',
      timeout: 60000, // Increased for sequential runs
      thresholds: {
        global: {
          branches: 30,
          functions: 30,   
          lines: 30,       
          statements: 30   
        }
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/test-utils.tsx',
        '**/setup*.ts',
        '**/performance*.ts',
        '**/async-timeout-utils.ts'
      ]
    },
    
    // Minimal reporters for CI speed
    reporters: [['default', { summary: true, verbose: false }]],
    
    // Disable watch mode
    watch: false,
    
    // Output configuration
    outputFile: {
      junit: './test-results/junit.xml'
    },
    
    // CRITICAL: Sequential test execution
    sequence: {
      shuffle: false,      // Consistent order
      concurrent: false,   // No concurrency
      setupFiles: 'list'  // Sequential setup
    },
    
    // Enhanced logging for debugging
    logHeapUsage: true,
    isolate: true,
    
    // Platform-specific optimizations for stability
    ...(process.platform === 'darwin' ? {
      testTimeout: 20000,  // Extra time for macOS
      hookTimeout: 10000
    } : {}),
    
    ...(process.platform === 'win32' ? {
      testTimeout: 18000,
      poolOptions: {
        forks: {
          singleFork: true,
          isolate: true,
          execArgv: ['--max-old-space-size=4096']
        }
      }
    } : {}),
    
    // Exclude problematic test patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      // Exclude performance-heavy tests in CI
      '**/performance*.test.{ts,tsx}',
      '**/performance*.spec.{ts,tsx}'
    ]
  }
})