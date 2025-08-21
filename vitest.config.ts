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
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Increased timeouts for React 19's async rendering patterns
    testTimeout: 20000,
    hookTimeout: 20000,
    clearMocks: true,
    restoreMocks: true,
    // Configure test environment for React 19 compatibility
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        // Enable React DevTools support and modern event handling
        runScripts: 'dangerously',
        // React 19 requires modern DOM features
        url: 'http://localhost:3000'
      }
    },
    // Configure test environment variables for React 19
    env: {
      NODE_ENV: 'test',
      IS_REACT_ACT_ENVIRONMENT: 'true',
      // React 19 specific flags
      REACT_VERSION: '19',
      REACT_CONCURRENT_MODE: 'true'
    },
    // Better async handling for React 19
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Coverage configuration  
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 35,
          functions: 35,
          lines: 35,
          statements: 35
        }
      }
    },
    // Exclude problematic files and patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/commitlint.test.ts',
      '**/poetry.test.ts',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    // Better error handling and debugging
    logHeapUsage: true,
    // Retry flaky tests once (common with async React 19 tests)
    retry: 1,
    // Better test isolation
    isolate: true
  },
})