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
    setupFiles: ['./src/test/setup.minimal.ts'], // Use simplified setup
    globals: true,
    
    // Fast timeouts
    testTimeout: 3000,
    hookTimeout: 2000,
    
    // Essential cleanup
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Basic jsdom
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: true,
        html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
      }
    },
    
    // Stable execution
    retry: 0,
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true
      }
    },
    
    reporters: ['verbose']
  }
})