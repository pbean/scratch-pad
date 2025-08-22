/**
 * Performance Tracking Setup for Vitest
 * 
 * Initializes high-resolution performance tracking for all tests.
 * This setup file is automatically loaded before test execution.
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import {
  setupVitestPerformanceTracking,
  performanceTracker,
  PERFORMANCE_BUDGETS,
  type PerformanceBudget
} from './performance-tracking'

// ============================================================================
// GLOBAL PERFORMANCE CONFIGURATION
// ============================================================================

/** Global performance tracking configuration */
const PERFORMANCE_CONFIG = {
  enabled: process.env.PERFORMANCE_TRACKING_ENABLED === 'true',
  enableBudgetWarnings: process.env.PERFORMANCE_BUDGET_WARNINGS !== 'false',
  exportPath: process.env.PERFORMANCE_REPORT_PATH,
  slowTestThreshold: parseInt(process.env.SLOW_TEST_THRESHOLD_MICROS || '1000000', 10), // 1s default
  memoryTracking: process.env.MEMORY_TRACKING_ENABLED === 'true',
}

// ============================================================================
// PERFORMANCE BUDGET CONFIGURATION
// ============================================================================

/** Default performance budgets by test type */
const TEST_BUDGETS: Record<string, PerformanceBudget> = {
  // Unit tests should be very fast
  'unit': PERFORMANCE_BUDGETS.UNIT_FAST,
  
  // Component tests can be a bit slower
  'component': PERFORMANCE_BUDGETS.UNIT_STANDARD,
  
  // Integration tests have more leeway
  'integration': PERFORMANCE_BUDGETS.INTEGRATION,
  
  // Default for unclassified tests
  'default': PERFORMANCE_BUDGETS.UNIT_STANDARD
}

// ============================================================================
// SETUP HOOKS
// ============================================================================

beforeAll(async () => {
  if (!PERFORMANCE_CONFIG.enabled) {
    console.log('📊 Performance tracking disabled')
    return
  }

  console.log('🚀 Initializing performance tracking...')
  
  // Set global performance budget
  const globalBudget = TEST_BUDGETS.default
  performanceTracker.setGlobalBudget(globalBudget)
  
  // Initialize Vitest performance hooks
  setupVitestPerformanceTracking()
  
  console.log(`✅ Performance tracking enabled`)
  console.log(`   - Budget warnings: ${PERFORMANCE_CONFIG.enableBudgetWarnings}`)
  console.log(`   - Slow test threshold: ${PERFORMANCE_CONFIG.slowTestThreshold / 1000}ms`)
  console.log(`   - Memory tracking: ${PERFORMANCE_CONFIG.memoryTracking}`)
  
  if (PERFORMANCE_CONFIG.exportPath) {
    console.log(`   - Export path: ${PERFORMANCE_CONFIG.exportPath}`)
  }
})

beforeEach(async (context) => {
  if (!PERFORMANCE_CONFIG.enabled) return
  
  // Determine test type and set appropriate budget
  const testType = determineTestType(context)
  const budget = TEST_BUDGETS[testType] || TEST_BUDGETS.default
  
  // Set budget for this specific test
  if (context.task?.id) {
    performanceTracker.setBudget(context.task.id, budget)
  }
  
  // Record setup phase completion
  performanceTracker.markSetupComplete()
})

afterEach(async (context) => {
  if (!PERFORMANCE_CONFIG.enabled) return
  
  // Mark cleanup phase
  performanceTracker.markCleanupStart()
  
  // Check for performance budget violations
  if (PERFORMANCE_CONFIG.enableBudgetWarnings && context.task?.id) {
    const metrics = performanceTracker.getMetrics(context.task.id)
    if (metrics && metrics.budgetViolations.length > 0) {
      console.warn(`⚠️  Performance budget violations in ${metrics.testName}:`)
      for (const violation of metrics.budgetViolations) {
        console.warn(`   - ${violation.message}`)
      }
    }
  }
})

afterAll(async () => {
  if (!PERFORMANCE_CONFIG.enabled) return
  
  // Generate performance summary
  const stats = performanceTracker.generatePerformanceStats()
  
  console.log('\n📊 Test Performance Summary:')
  console.log(`   Total tests: ${stats.totalTests}`)
  
  if (stats.totalTests > 0) {
    console.log(`   Average duration: ${formatMicroseconds(stats.avgDurationMicros)}`)
    console.log(`   Slowest test: ${formatMicroseconds(stats.maxDurationMicros)}`)
    console.log(`   Budget violations: ${stats.failingTests}`)
    
    // Warn about slow tests
    if (stats.maxDurationMicros > PERFORMANCE_CONFIG.slowTestThreshold) {
      console.warn(`⚠️  Some tests exceeded slow threshold (${formatMicroseconds(PERFORMANCE_CONFIG.slowTestThreshold)})`)
    }
    
    // Show memory usage if tracking is enabled
    if (PERFORMANCE_CONFIG.memoryTracking && typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      console.log(`   Memory usage: ${formatBytes(memory.usedJSHeapSize)}`)
    }
  }
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine test type based on test context and file path
 */
function determineTestType(context: any): string {
  const filePath = context.task?.file?.name || ''
  const testName = context.task?.name || ''
  
  // Analyze file path patterns
  if (filePath.includes('integration') || filePath.includes('e2e')) {
    return 'integration'
  }
  
  if (filePath.includes('component') || filePath.includes('__tests__')) {
    return 'component'
  }
  
  // Analyze test name patterns
  if (testName.toLowerCase().includes('integration')) {
    return 'integration'
  }
  
  if (testName.toLowerCase().includes('component') || testName.toLowerCase().includes('render')) {
    return 'component'
  }
  
  // Default to unit test
  return 'unit'
}

/**
 * Format microseconds for human-readable display
 */
function formatMicroseconds(micros: number): string {
  if (micros >= 1000000) {
    return `${(micros / 1000000).toFixed(2)}s`
  } else if (micros >= 1000) {
    return `${(micros / 1000).toFixed(2)}ms`
  } else {
    return `${micros.toFixed(0)}μs`
  }
}

/**
 * Format bytes for human-readable display
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)}${units[unitIndex]}`
}

// ============================================================================
// EXPORTS FOR MANUAL PERFORMANCE TRACKING
// ============================================================================

// Re-export performance tracking utilities for use in individual tests
export {
  performanceTracker,
  PERFORMANCE_BUDGETS,
  PERFORMANCE_CONFIG
} from './performance-tracking'

// Export helper functions for manual performance tracking
export const perf = {
  /**
   * Mark a performance checkpoint
   */
  mark: (name: string, metadata?: Record<string, any>) => {
    if (PERFORMANCE_CONFIG.enabled) {
      performanceTracker.addMarker(name, metadata)
    }
  },
  
  /**
   * Time an operation
   */
  time: async <T>(name: string, operation: () => T | Promise<T>): Promise<T> => {
    if (!PERFORMANCE_CONFIG.enabled) {
      return await operation()
    }
    
    const startMarker = `${name}_start`
    const endMarker = `${name}_end`
    
    performanceTracker.addMarker(startMarker)
    try {
      const result = await operation()
      performanceTracker.addMarker(endMarker)
      return result
    } catch (error) {
      performanceTracker.addMarker(`${name}_error`, { 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }
  },
  
  /**
   * Check if performance tracking is enabled
   */
  isEnabled: () => PERFORMANCE_CONFIG.enabled,
  
  /**
   * Get current performance configuration
   */
  getConfig: () => ({ ...PERFORMANCE_CONFIG })
}

// ============================================================================
// CONSOLE OUTPUT STYLING
// ============================================================================

// Enhance console output for better visibility
if (PERFORMANCE_CONFIG.enabled) {
  const originalLog = console.log
  const originalWarn = console.warn
  
  console.log = (...args) => {
    if (args[0]?.toString().startsWith('📊') || args[0]?.toString().startsWith('🚀')) {
      originalLog('\x1b[36m%s\x1b[0m', ...args) // Cyan for performance logs
    } else {
      originalLog(...args)
    }
  }
  
  console.warn = (...args) => {
    if (args[0]?.toString().includes('Performance') || args[0]?.toString().startsWith('⚠️')) {
      originalWarn('\x1b[33m%s\x1b[0m', ...args) // Yellow for performance warnings
    } else {
      originalWarn(...args)
    }
  }
}