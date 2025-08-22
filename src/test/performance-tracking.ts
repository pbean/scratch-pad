/**
 * High-Resolution Test Performance Tracking Utilities
 * 
 * Provides microsecond-precision timing for test duration monitoring,
 * performance budgets, and test optimization insights for both Vitest
 * and integration with Rust backend performance metrics.
 */

import { beforeEach, afterEach } from 'vitest'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * High-resolution timestamp with microsecond precision
 */
export interface HighResTimestamp {
  /** Epoch milliseconds (Date.now() equivalent) */
  epochMs: number
  /** High-resolution performance counter (performance.now() equivalent) */
  perfMs: number
  /** Nanosecond precision component (if available via process.hrtime) */
  nanos?: bigint
}

/**
 * Test performance metrics collected during execution
 */
export interface TestPerformanceMetrics {
  /** Unique test identifier */
  testId: string
  /** Test name/description */
  testName: string
  /** Test file path */
  testFile: string
  /** Start timestamp */
  startTime: HighResTimestamp
  /** End timestamp */
  endTime?: HighResTimestamp
  /** Total duration in microseconds */
  durationMicros?: number
  /** Setup phase duration in microseconds */
  setupDurationMicros?: number
  /** Execution phase duration in microseconds */
  executionDurationMicros?: number
  /** Cleanup phase duration in microseconds */
  cleanupDurationMicros?: number
  /** Memory usage at start (bytes) */
  memoryStartBytes?: number
  /** Memory usage at end (bytes) */
  memoryEndBytes?: number
  /** Peak memory usage during test (bytes) */
  memoryPeakBytes?: number
  /** Test result status */
  status: 'passed' | 'failed' | 'skipped' | 'timeout'
  /** Error message if failed */
  error?: string
  /** Custom performance markers */
  markers: PerformanceMarker[]
  /** Performance budget violations */
  budgetViolations: BudgetViolation[]
}

/**
 * Custom performance markers within a test
 */
export interface PerformanceMarker {
  /** Marker name */
  name: string
  /** Timestamp when marker was created */
  timestamp: HighResTimestamp
  /** Duration from test start in microseconds */
  fromStartMicros: number
  /** Optional metadata */
  metadata?: Record<string, any>
}

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  /** Maximum allowed test duration in microseconds */
  maxDurationMicros: number
  /** Maximum allowed setup time in microseconds */
  maxSetupMicros?: number
  /** Maximum allowed memory usage in bytes */
  maxMemoryBytes?: number
  /** Maximum allowed markers (prevent excessive profiling) */
  maxMarkers?: number
  /** Custom budget rules */
  customRules?: BudgetRule[]
}

/**
 * Custom budget rule definition
 */
export interface BudgetRule {
  /** Rule name */
  name: string
  /** Rule evaluation function */
  evaluate: (metrics: TestPerformanceMetrics) => boolean
  /** Error message when rule is violated */
  message: string
  /** Severity level */
  severity: 'warning' | 'error'
}

/**
 * Budget violation result
 */
export interface BudgetViolation {
  /** Rule that was violated */
  rule: string
  /** Actual value that caused violation */
  actualValue: number
  /** Expected/budgeted value */
  budgetedValue: number
  /** Severity level */
  severity: 'warning' | 'error'
  /** Descriptive message */
  message: string
}

/**
 * Performance report configuration
 */
export interface PerformanceReportConfig {
  /** Output format */
  format: 'json' | 'csv' | 'html' | 'console'
  /** Include detailed metrics */
  includeDetails: boolean
  /** Include performance trends */
  includeTrends: boolean
  /** Output file path (for non-console formats) */
  outputPath?: string
  /** Minimum duration threshold for inclusion (microseconds) */
  minDurationMicros?: number
  /** Group results by test file */
  groupByFile: boolean
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  /** Total number of tests analyzed */
  totalTests: number
  /** Tests that passed performance budgets */
  passingTests: number
  /** Tests that failed performance budgets */
  failingTests: number
  /** Average test duration in microseconds */
  avgDurationMicros: number
  /** Median test duration in microseconds */
  medianDurationMicros: number
  /** 95th percentile duration in microseconds */
  p95DurationMicros: number
  /** Fastest test duration in microseconds */
  minDurationMicros: number
  /** Slowest test duration in microseconds */
  maxDurationMicros: number
  /** Total test suite duration in microseconds */
  totalDurationMicros: number
  /** Tests by file */
  testsByFile: Map<string, TestPerformanceMetrics[]>
}

// ============================================================================
// GLOBAL STATE AND CONFIGURATION
// ============================================================================

/** Global performance tracking state */
class PerformanceTracker {
  private metrics: Map<string, TestPerformanceMetrics> = new Map()
  private currentTest: TestPerformanceMetrics | null = null
  private budgets: Map<string, PerformanceBudget> = new Map()
  private globalBudget: PerformanceBudget | null = null
  private enabled: boolean = true

  /** Enable/disable performance tracking */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /** Check if tracking is enabled */
  isEnabled(): boolean {
    return this.enabled
  }

  /** Get all collected metrics */
  getAllMetrics(): TestPerformanceMetrics[] {
    return Array.from(this.metrics.values())
  }

  /** Get metrics for specific test */
  getMetrics(testId: string): TestPerformanceMetrics | undefined {
    return this.metrics.get(testId)
  }

  /** Clear all metrics */
  clear() {
    this.metrics.clear()
    this.currentTest = null
  }

  /** Set performance budget for specific test */
  setBudget(testId: string, budget: PerformanceBudget) {
    this.budgets.set(testId, budget)
  }

  /** Set global performance budget */
  setGlobalBudget(budget: PerformanceBudget) {
    this.globalBudget = budget
  }

  /** Start tracking a test */
  startTest(testId: string, testName: string, testFile: string): TestPerformanceMetrics {
    if (!this.enabled) return this.createDummyMetrics(testId, testName, testFile)

    const startTime = createHighResTimestamp()
    const metrics: TestPerformanceMetrics = {
      testId,
      testName,
      testFile,
      startTime,
      status: 'passed',
      markers: [],
      budgetViolations: [],
      memoryStartBytes: this.getMemoryUsage()
    }

    this.currentTest = metrics
    this.metrics.set(testId, metrics)
    return metrics
  }

  /** End tracking current test */
  endTest(status: TestPerformanceMetrics['status'], error?: string) {
    if (!this.enabled || !this.currentTest) return

    const endTime = createHighResTimestamp()
    this.currentTest.endTime = endTime
    this.currentTest.status = status
    if (error) this.currentTest.error = error

    // Calculate durations
    this.currentTest.durationMicros = calculateMicrosecondsDiff(
      this.currentTest.startTime,
      endTime
    )

    // Memory metrics
    this.currentTest.memoryEndBytes = this.getMemoryUsage()

    // Check performance budgets
    this.checkBudgets(this.currentTest)

    this.currentTest = null
  }

  /** Add performance marker to current test */
  addMarker(name: string, metadata?: Record<string, any>) {
    if (!this.enabled || !this.currentTest) return

    const timestamp = createHighResTimestamp()
    const fromStartMicros = calculateMicrosecondsDiff(
      this.currentTest.startTime,
      timestamp
    )

    this.currentTest.markers.push({
      name,
      timestamp,
      fromStartMicros,
      metadata
    })
  }

  /** Record setup phase completion */
  markSetupComplete() {
    if (!this.enabled || !this.currentTest) return

    const setupEndTime = createHighResTimestamp()
    this.currentTest.setupDurationMicros = calculateMicrosecondsDiff(
      this.currentTest.startTime,
      setupEndTime
    )
    this.addMarker('setup_complete')
  }

  /** Record execution phase start */
  markExecutionStart() {
    if (!this.enabled || !this.currentTest) return
    this.addMarker('execution_start')
  }

  /** Record cleanup phase start */
  markCleanupStart() {
    if (!this.enabled || !this.currentTest) return
    this.addMarker('cleanup_start')
  }

  /** Get current memory usage */
  private getMemoryUsage(): number {
    // Use performance.memory if available (Chromium-based environments)
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize || 0
    }

    // Fallback to process.memoryUsage() if in Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }

    return 0
  }

  /** Check performance budgets for a test */
  private checkBudgets(metrics: TestPerformanceMetrics) {
    const budget = this.budgets.get(metrics.testId) || this.globalBudget
    if (!budget || !metrics.durationMicros) return

    // Check duration budget
    if (metrics.durationMicros > budget.maxDurationMicros) {
      metrics.budgetViolations.push({
        rule: 'max_duration',
        actualValue: metrics.durationMicros,
        budgetedValue: budget.maxDurationMicros,
        severity: 'error',
        message: `Test exceeded maximum duration: ${formatMicroseconds(metrics.durationMicros)} > ${formatMicroseconds(budget.maxDurationMicros)}`
      })
    }

    // Check setup duration budget
    if (budget.maxSetupMicros && metrics.setupDurationMicros && 
        metrics.setupDurationMicros > budget.maxSetupMicros) {
      metrics.budgetViolations.push({
        rule: 'max_setup_duration',
        actualValue: metrics.setupDurationMicros,
        budgetedValue: budget.maxSetupMicros,
        severity: 'warning',
        message: `Test setup exceeded budget: ${formatMicroseconds(metrics.setupDurationMicros)} > ${formatMicroseconds(budget.maxSetupMicros)}`
      })
    }

    // Check memory budget
    if (budget.maxMemoryBytes && metrics.memoryPeakBytes && 
        metrics.memoryPeakBytes > budget.maxMemoryBytes) {
      metrics.budgetViolations.push({
        rule: 'max_memory',
        actualValue: metrics.memoryPeakBytes,
        budgetedValue: budget.maxMemoryBytes,
        severity: 'error',
        message: `Test exceeded memory budget: ${formatBytes(metrics.memoryPeakBytes)} > ${formatBytes(budget.maxMemoryBytes)}`
      })
    }

    // Check marker count budget
    if (budget.maxMarkers && metrics.markers.length > budget.maxMarkers) {
      metrics.budgetViolations.push({
        rule: 'max_markers',
        actualValue: metrics.markers.length,
        budgetedValue: budget.maxMarkers,
        severity: 'warning',
        message: `Test exceeded marker budget: ${metrics.markers.length} > ${budget.maxMarkers}`
      })
    }

    // Check custom rules
    if (budget.customRules) {
      for (const rule of budget.customRules) {
        if (!rule.evaluate(metrics)) {
          metrics.budgetViolations.push({
            rule: rule.name,
            actualValue: 0, // Custom rules may not have numeric values
            budgetedValue: 0,
            severity: rule.severity,
            message: rule.message
          })
        }
      }
    }
  }

  /** Create dummy metrics when tracking is disabled */
  private createDummyMetrics(testId: string, testName: string, testFile: string): TestPerformanceMetrics {
    return {
      testId,
      testName,
      testFile,
      startTime: createHighResTimestamp(),
      status: 'passed',
      markers: [],
      budgetViolations: []
    }
  }

  /** Generate performance statistics from collected metrics */
  generatePerformanceStats(): PerformanceStats {
    const allMetrics = this.getAllMetrics()
    const durations = allMetrics
      .map(m => m.durationMicros)
      .filter((d): d is number => d !== undefined)
      .sort((a, b) => a - b)

    const testsByFile = new Map<string, TestPerformanceMetrics[]>()
    for (const metric of allMetrics) {
      const fileMetrics = testsByFile.get(metric.testFile) || []
      fileMetrics.push(metric)
      testsByFile.set(metric.testFile, fileMetrics)
    }

    return {
      totalTests: allMetrics.length,
      passingTests: allMetrics.filter(m => m.budgetViolations.length === 0).length,
      failingTests: allMetrics.filter(m => m.budgetViolations.length > 0).length,
      avgDurationMicros: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      medianDurationMicros: durations[Math.floor(durations.length / 2)] || 0,
      p95DurationMicros: durations[Math.floor(durations.length * 0.95)] || 0,
      minDurationMicros: durations[0] || 0,
      maxDurationMicros: durations[durations.length - 1] || 0,
      totalDurationMicros: durations.reduce((a, b) => a + b, 0),
      testsByFile
    }
  }
}

/** Global performance tracker instance */
export const performanceTracker = new PerformanceTracker()

// ============================================================================
// HIGH-RESOLUTION TIMING UTILITIES
// ============================================================================

/**
 * Create high-resolution timestamp with multiple precision levels
 */
export function createHighResTimestamp(): HighResTimestamp {
  const epochMs = Date.now()
  const perfMs = performance.now()
  
  // Try to get nanosecond precision if available (Node.js)
  let nanos: bigint | undefined
  if (typeof process !== 'undefined' && process.hrtime && process.hrtime.bigint) {
    try {
      nanos = process.hrtime.bigint()
    } catch (error) {
      // Ignore errors, nanosecond precision is optional
    }
  }

  return {
    epochMs,
    perfMs,
    nanos
  }
}

/**
 * Calculate difference between two timestamps in microseconds
 */
export function calculateMicrosecondsDiff(start: HighResTimestamp, end: HighResTimestamp): number {
  // Use nanosecond precision if available
  if (start.nanos && end.nanos) {
    const diffNanos = end.nanos - start.nanos
    return Number(diffNanos) / 1000 // Convert to microseconds
  }
  
  // Fall back to performance.now() precision (sub-millisecond)
  const diffMs = end.perfMs - start.perfMs
  return Math.round(diffMs * 1000) // Convert to microseconds
}

/**
 * Format microseconds for human-readable display
 */
export function formatMicroseconds(micros: number): string {
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
export function formatBytes(bytes: number): string {
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
// PERFORMANCE BUDGET PRESETS
// ============================================================================

/** Common performance budget presets */
export const PERFORMANCE_BUDGETS = {
  /** Fast unit tests (< 100ms) */
  UNIT_FAST: {
    maxDurationMicros: 100_000, // 100ms
    maxSetupMicros: 10_000,     // 10ms
    maxMemoryBytes: 50_000_000, // 50MB
    maxMarkers: 10
  },

  /** Standard unit tests (< 1s) */
  UNIT_STANDARD: {
    maxDurationMicros: 1_000_000, // 1s
    maxSetupMicros: 100_000,      // 100ms
    maxMemoryBytes: 100_000_000,  // 100MB
    maxMarkers: 20
  },

  /** Integration tests (< 5s) */
  INTEGRATION: {
    maxDurationMicros: 5_000_000, // 5s
    maxSetupMicros: 1_000_000,    // 1s
    maxMemoryBytes: 500_000_000,  // 500MB
    maxMarkers: 50
  },

  /** End-to-end tests (< 30s) */
  E2E: {
    maxDurationMicros: 30_000_000, // 30s
    maxSetupMicros: 10_000_000,    // 10s
    maxMemoryBytes: 1_000_000_000, // 1GB
    maxMarkers: 100
  }
} as const

// ============================================================================
// VITEST INTEGRATION
// ============================================================================

/**
 * Vitest-specific performance hooks
 */
export function setupVitestPerformanceTracking() {
  beforeEach((context) => {
    if (!context.task) return
    
    const testId = `${context.task.file?.name || 'unknown'}:${context.task.name}`
    const testName = context.task.name
    const testFile = context.task.file?.name || 'unknown'
    
    performanceTracker.startTest(testId, testName, testFile)
  })

  afterEach((context) => {
    const status = context.task?.result?.state || 'passed'
    const error = context.task?.result?.errors?.[0]?.message
    
    performanceTracker.endTest(status as any, error)
  })
}

/**
 * Performance-aware test wrapper
 */
export function withPerformanceBudget<T extends (...args: any[]) => any>(
  testFn: T,
  budget: PerformanceBudget
): T {
  return (async (...args: Parameters<T>) => {
    const testId = `runtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    performanceTracker.setBudget(testId, budget)
    
    try {
      return await testFn(...args)
    } finally {
      // Budget checking is automatic in afterEach
    }
  }) as T
}

/**
 * Add performance marker within a test
 */
export function mark(name: string, metadata?: Record<string, any>) {
  performanceTracker.addMarker(name, metadata)
}

/**
 * Time a specific operation within a test
 */
export async function timeOperation<T>(
  name: string,
  operation: () => T | Promise<T>
): Promise<T> {
  const startMarker = `${name}_start`
  const endMarker = `${name}_end`
  
  mark(startMarker)
  try {
    const result = await operation()
    mark(endMarker)
    return result
  } catch (error) {
    mark(`${name}_error`, { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

// ============================================================================
// REPORTING AND ANALYSIS
// ============================================================================

/**
 * Generate performance statistics from collected metrics
 */
export function generatePerformanceStats(): PerformanceStats {
  return performanceTracker.generatePerformanceStats()
}

/**
 * Generate performance report in specified format
 */
export function generatePerformanceReport(config: PerformanceReportConfig): string {
  const stats = generatePerformanceStats()
  const allMetrics = performanceTracker.getAllMetrics()

  switch (config.format) {
    case 'json':
      return JSON.stringify({
        stats,
        metrics: config.includeDetails ? allMetrics : undefined
      }, null, 2)

    case 'csv':
      return generateCSVReport(allMetrics, config)

    case 'html':
      return generateHTMLReport(stats, allMetrics, config)

    case 'console':
    default:
      return generateConsoleReport(stats, allMetrics, config)
  }
}

/**
 * Generate console-friendly performance report
 */
function generateConsoleReport(
  stats: PerformanceStats,
  metrics: TestPerformanceMetrics[],
  _config: PerformanceReportConfig
): string {
  const lines: string[] = []
  
  lines.push('📊 Test Performance Report')
  lines.push('=' .repeat(50))
  lines.push('')
  
  // Summary stats
  lines.push(`Total Tests: ${stats.totalTests}`)
  lines.push(`Passing Budget: ${stats.passingTests} (${(stats.passingTests / stats.totalTests * 100).toFixed(1)}%)`)
  lines.push(`Failing Budget: ${stats.failingTests} (${(stats.failingTests / stats.totalTests * 100).toFixed(1)}%)`)
  lines.push(`Total Duration: ${formatMicroseconds(stats.totalDurationMicros)}`)
  lines.push(`Average Duration: ${formatMicroseconds(stats.avgDurationMicros)}`)
  lines.push(`Median Duration: ${formatMicroseconds(stats.medianDurationMicros)}`)
  lines.push(`95th Percentile: ${formatMicroseconds(stats.p95DurationMicros)}`)
  lines.push('')

  // Slowest tests
  const slowestTests = metrics
    .filter(m => m.durationMicros !== undefined)
    .sort((a, b) => (b.durationMicros || 0) - (a.durationMicros || 0))
    .slice(0, 10)

  if (slowestTests.length > 0) {
    lines.push('🐌 Slowest Tests:')
    for (const test of slowestTests) {
      lines.push(`  ${formatMicroseconds(test.durationMicros!)} - ${test.testName}`)
    }
    lines.push('')
  }

  // Budget violations
  const violatingTests = metrics.filter(m => m.budgetViolations.length > 0)
  if (violatingTests.length > 0) {
    lines.push('⚠️  Budget Violations:')
    for (const test of violatingTests) {
      lines.push(`  ${test.testName}:`)
      for (const violation of test.budgetViolations) {
        lines.push(`    - ${violation.message}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate CSV report
 */
function generateCSVReport(metrics: TestPerformanceMetrics[], _config: PerformanceReportConfig): string {
  const lines = [
    'TestName,TestFile,Duration(μs),Status,BudgetViolations,MemoryUsed(bytes)'
  ]

  for (const metric of metrics) {
    const duration = metric.durationMicros || 0
    const violations = metric.budgetViolations.length
    const memory = metric.memoryEndBytes || 0
    
    lines.push(
      `"${metric.testName}","${metric.testFile}",${duration},"${metric.status}",${violations},${memory}`
    )
  }

  return lines.join('\n')
}

/**
 * Generate HTML report
 */
function generateHTMLReport(
  stats: PerformanceStats,
  metrics: TestPerformanceMetrics[],
  _config: PerformanceReportConfig
): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Test Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .stats { background: #f5f5f5; padding: 20px; margin: 20px 0; }
        .violation { color: #d32f2f; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>📊 Test Performance Report</h1>
    
    <div class="stats">
        <h2>Summary</h2>
        <p>Total Tests: ${stats.totalTests}</p>
        <p>Passing Budget: ${stats.passingTests} (${(stats.passingTests / stats.totalTests * 100).toFixed(1)}%)</p>
        <p>Average Duration: ${formatMicroseconds(stats.avgDurationMicros)}</p>
        <p>95th Percentile: ${formatMicroseconds(stats.p95DurationMicros)}</p>
    </div>

    <h2>Test Details</h2>
    <table>
        <tr>
            <th>Test Name</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Violations</th>
        </tr>
        ${metrics.map(m => `
        <tr>
            <td>${m.testName}</td>
            <td>${formatMicroseconds(m.durationMicros || 0)}</td>
            <td>${m.status}</td>
            <td class="${m.budgetViolations.length > 0 ? 'violation' : ''}">${m.budgetViolations.length}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>`
}