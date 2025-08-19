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
    testTimeout: 10000, // Increased timeout for complex tests
    hookTimeout: 10000,
    clearMocks: true,
    restoreMocks: true,
    // Configure test environment for React 19
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>'
      }
    },
    // Configure test environment
    env: {
      NODE_ENV: 'test'
    },
    // Coverage configuration  
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 30,
          functions: 30,
          lines: 30,
          statements: 30
        }
      }
    },
    // Exclude problematic files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/commitlint.test.ts',
      '**/poetry.test.ts',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ]
  },
})