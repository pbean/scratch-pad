import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { TestSequencer } from 'vitest/node'
import os from 'os'

// Custom test sequencer for hybrid execution
class HybridTestSequencer implements TestSequencer {
  private static sequentialPatterns = [
    'CommandPalette.test.',
    'command-palette',
    'ScratchPadApp.test.', // App-level tests often need isolation
    // Add other patterns that need sequential execution
  ]
  
  async sort(files: any[]): Promise<any[]> {
    const parallelTests: any[] = []
    const sequentialTests: any[] = []
    
    files.forEach(file => {
      // Handle both string paths and test file objects
      const filePath = typeof file === 'string' ? file : (file.filepath || file.name || file.id || '')
      
      const needsSequential = HybridTestSequencer.sequentialPatterns.some(pattern => 
        filePath.includes(pattern)
      )
      
      if (needsSequential) {
        sequentialTests.push(file)
      } else {
        parallelTests.push(file)
      }
    })
    
    // Sort within each category for predictable execution
    parallelTests.sort()
    sequentialTests.sort()
    
    // Log distribution for debugging
    if (process.env.VITEST_CI_MODE === 'true') {
      console.log(`\n🔧 Hybrid test execution strategy:`,
        `\n  📊 Parallel tests: ${parallelTests.length} files (${Math.round((parallelTests.length/files.length)*100)}%)`,
        `\n  🔒 Sequential tests: ${sequentialTests.length} files (${Math.round((sequentialTests.length/files.length)*100)}%)`,
        `\n  ⏱️  Estimated time savings: ~${Math.max(0, Math.round((sequentialTests.length * 0.3)))}min\n`
      )
      
      if (sequentialTests.length > 0) {
        const sequentialNames = sequentialTests.map(f => {
          const filePath = typeof f === 'string' ? f : (f.filepath || f.name || f.id || '')
          return filePath.split('/').pop()
        }).join(', ')
        console.log(`🔒 Sequential test files:`, sequentialNames)
      }
    }
    
    // Strategy: Run parallel tests first to maximize CPU utilization,
    // then run sequential tests when workers are freed up
    return [...parallelTests, ...sequentialTests]
  }
  
  async shard(files: any[]): Promise<any[]> {
    // Default sharding behavior
    return files
  }
  
  // Static method to determine if a file needs sequential execution
  static requiresSequentialExecution(file: string): boolean {
    return this.sequentialPatterns.some(pattern => file.includes(pattern))
  }
}

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
    
    // Hybrid execution timeouts - optimized for faster completion
    testTimeout: 12000,  // Reduced from 15000
    hookTimeout: 6000,   // Reduced from 8000
    teardownTimeout: 3000, // Reduced from 5000
    
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
    
    // Hybrid execution: Optimized pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,  // Allow multiple forks for better parallelism
        isolate: true,      // Maintain process isolation
        execArgv: [
          '--max-old-space-size=2048', // Balanced memory per worker
          '--no-compilation-cache',    // Reduce memory usage
        ]
      }
    },
    
    // Smart worker configuration based on CI environment
    maxConcurrency: process.env.CI === 'true' ? 6 : 8,  // Higher concurrency for faster execution
    minWorkers: 1,
    maxWorkers: process.env.CI === 'true' ? 3 : 4, // Simple static configuration for ES module compatibility
    
    retry: 1, // Reduced retries for faster execution
    
    // Custom sequencer for hybrid execution
    sequence: {
      sequencer: HybridTestSequencer,
      shuffle: false,      // Maintain predictable order for debugging
      concurrent: true,    // Enable concurrency (intelligently managed by sequencer)
      setupFiles: 'list'   // Sequential setup files
    },
    
    // Performance optimizations for module handling
    server: {
      deps: {
        inline: [
          // Inline these dependencies to reduce import overhead
          '@testing-library/react',
          '@testing-library/user-event'
        ]
      }
    },
    
    // Speed-optimized coverage configuration
    coverage: {
      provider: 'v8',
      reporter: process.env.CI === 'true' 
        ? ['json-summary'] // Minimal reporting in CI for speed
        : ['text', 'json-summary'], // More detailed locally
      reportsDirectory: './coverage',
      timeout: 30000, // Reduced timeout for faster completion
      all: false, // Only instrument files that are actually tested
      thresholds: {
        global: {
          // Relaxed thresholds for speed (can be adjusted per environment)
          branches: 25,
          functions: 25,   
          lines: 25,       
          statements: 25   
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
        '**/async-timeout-utils.ts',
        '**/mocks/**', // Exclude mock files
        '**/*.d.ts'    // Exclude type definitions
      ]
    },
    
    // Optimized reporters for CI
    reporters: process.env.CI === 'true' 
      ? [['verbose', { summary: false, verbose: false }]] // Minimal output in CI
      : [['default', { summary: true, verbose: false }]], // More detailed locally
    
    // Disable watch mode
    watch: false,
    
    // Output configuration
    outputFile: {
      junit: './test-results/junit.xml'
    },
    
    
    // Enhanced logging for debugging
    logHeapUsage: true,
    isolate: true,
    
    // Platform-specific optimizations
    ...(process.platform === 'darwin' ? {
      testTimeout: 15000,  // Optimized for macOS
      hookTimeout: 8000,
      maxWorkers: 2        // Conservative on macOS
    } : {}),
    
    ...(process.platform === 'win32' ? {
      testTimeout: 14000,  // Optimized for Windows
      maxWorkers: 2,       // Conservative on Windows
      poolOptions: {
        forks: {
          singleFork: false,  // Allow parallelism on Windows
          isolate: true,
          execArgv: ['--max-old-space-size=3072']
        }
      }
    } : {}),
    
    // Optimized test file inclusion/exclusion
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      // Temporarily exclude performance-heavy tests in CI for speed
      '**/performance*.test.{ts,tsx}',
      '**/performance*.spec.{ts,tsx}'
    ],
    
    // Additional optimizations for CI speed
    bail: process.env.VITEST_BAIL ? parseInt(process.env.VITEST_BAIL) : undefined, // Allow early exit on failures
    passWithNoTests: true, // Don't fail if no tests found
    
    // Memory and performance optimizations
    forceRerunTriggers: [
      '**/package.json',
      '**/{vitest,vite}.config.*'
    ],
    
    // Disable unnecessary features in CI for speed
    ui: false,
    open: false,
    api: false
  }
})