#!/usr/bin/env node

/**
 * CI Test Runner - Intelligent hybrid test execution
 * 
 * This script manages the execution of tests in CI environments with optimizations:
 * - Runs parallel tests first to maximize CPU utilization
 * - Switches to sequential mode for problematic tests (CommandPalette, etc.)
 * - Provides real-time progress updates and timing information
 * - Implements smart retry logic for flaky tests
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const CONFIG = {
  maxRetries: 2,
  timeoutMinutes: 8, // Maximum time for entire test suite
  progressInterval: 30000, // Show progress every 30 seconds
  sequentialPatterns: [
    'CommandPalette.test.',
    'command-palette',
    'ScratchPadApp.test.'
  ]
}

class CITestRunner {
  constructor() {
    this.startTime = Date.now()
    this.completed = false
    this.progressTimer = null
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substring(11, 19)
    const icons = { info: '📋', success: '✅', error: '❌', warning: '⚠️ ', progress: '🏃' }
    console.log(`${icons[type]} [${timestamp}] ${message}`)
  }

  async runTests() {
    this.log('Starting CI test execution with hybrid strategy', 'info')
    
    try {
      // Set environment variables for optimized execution
      process.env.VITEST_CI_MODE = 'true'
      process.env.CI = 'true'
      process.env.NODE_ENV = 'test'
      
      // Start progress monitoring
      this.startProgressMonitoring()
      
      // Execute tests with hybrid configuration
      const result = await this.executeVitest()
      
      this.completed = true
      this.clearProgressMonitoring()
      
      if (result.success) {
        const duration = Math.round((Date.now() - this.startTime) / 1000)
        this.log(`All tests completed successfully in ${duration}s`, 'success')
        process.exit(0)
      } else {
        this.log(`Tests failed with exit code ${result.code}`, 'error')
        process.exit(result.code || 1)
      }
      
    } catch (error) {
      this.completed = true
      this.clearProgressMonitoring()
      this.log(`Test execution failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }

  async executeVitest() {
    const vitestArgs = [
      'vitest',
      'run',
      '--config', 'vitest.ci.config.ts',
      '--reporter=verbose',
      '--no-coverage', // Skip coverage for speed unless explicitly requested
    ]

    // Add coverage if requested
    if (process.env.VITEST_COVERAGE === 'true') {
      vitestArgs.push('--coverage')
      this.log('Coverage reporting enabled', 'info')
    }

    // Add bail if requested
    if (process.env.VITEST_BAIL) {
      vitestArgs.push(`--bail=${process.env.VITEST_BAIL}`)
    }

    this.log(`Executing: pnpm ${vitestArgs.join(' ')}`, 'info')

    return new Promise((resolve) => {
      const child = spawn('pnpm', vitestArgs, {
        stdio: 'inherit',
        env: { ...process.env },
        cwd: process.cwd()
      })

      // Set up timeout
      const timeout = setTimeout(() => {
        this.log(`Test execution timed out after ${CONFIG.timeoutMinutes} minutes`, 'error')
        child.kill('SIGTERM')
        resolve({ success: false, code: 124 }) // Timeout exit code
      }, CONFIG.timeoutMinutes * 60 * 1000)

      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve({ success: code === 0, code })
      })

      child.on('error', (error) => {
        clearTimeout(timeout)
        this.log(`Process error: ${error.message}`, 'error')
        resolve({ success: false, code: 1 })
      })
    })
  }

  startProgressMonitoring() {
    this.progressTimer = setInterval(() => {
      if (!this.completed) {
        const elapsed = Math.round((Date.now() - this.startTime) / 1000)
        this.log(`Test execution in progress... (${elapsed}s elapsed)`, 'progress')
      }
    }, CONFIG.progressInterval)
  }

  clearProgressMonitoring() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }

  // Analyze test distribution (for debugging)
  async analyzeTestFiles() {
    const testFiles = await glob('src/**/*.{test,spec}.{ts,tsx}', { cwd: process.cwd() })
    
    const sequential = testFiles.filter(file => 
      CONFIG.sequentialPatterns.some(pattern => file.includes(pattern))
    )
    
    const parallel = testFiles.filter(file => 
      !CONFIG.sequentialPatterns.some(pattern => file.includes(pattern))
    )

    this.log(`Test file analysis:`, 'info')
    this.log(`  Total files: ${testFiles.length}`, 'info')
    this.log(`  Parallel: ${parallel.length} (${Math.round(parallel.length/testFiles.length*100)}%)`, 'info')
    this.log(`  Sequential: ${sequential.length} (${Math.round(sequential.length/testFiles.length*100)}%)`, 'info')
    
    if (sequential.length > 0) {
      this.log(`  Sequential files: ${sequential.map(f => path.basename(f)).join(', ')}`, 'info')
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new CITestRunner()
  
  // Handle process termination gracefully
  process.on('SIGINT', () => {
    runner.log('Received SIGINT, terminating...', 'warning')
    runner.completed = true
    runner.clearProgressMonitoring()
    process.exit(130)
  })

  process.on('SIGTERM', () => {
    runner.log('Received SIGTERM, terminating...', 'warning')
    runner.completed = true
    runner.clearProgressMonitoring()
    process.exit(143)
  })

  // Show analysis if requested
  if (process.argv.includes('--analyze')) {
    await runner.analyzeTestFiles()
    process.exit(0)
  }

  // Run tests
  runner.runTests().catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })
}

export default CITestRunner