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
    setupFiles: ['./src/test/setup.ts'], // ONLY setup.ts, NO performance tracking
    globals: true,
    
    // Minimal timeouts
    testTimeout: 5000,
    hookTimeout: 3000,
    teardownTimeout: 2000,
    
    // Essential cleanup
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Basic jsdom config
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
      }
    },
    
    // Disable performance features
    logHeapUsage: false,
    retry: 0,
    isolate: true,
    
    // Single-threaded execution for stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true
      }
    },
    
    // Basic reporter only
    reporters: ['basic'],
    
    // No coverage, no output files, no extra features
    coverage: {
      enabled: false
    }
  }
})