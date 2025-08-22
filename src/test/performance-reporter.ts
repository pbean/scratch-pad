/**
 * Custom Vitest Reporter for High-Resolution Performance Tracking
 * 
 * Integrates with the performance tracking utilities to provide
 * detailed timing information and performance budget monitoring.
 */

import { BaseReporter } from 'vitest/reporters'
import type { File, Reporter, Task, TaskResult, TaskResultPack, TaskEventPack, Vitest, Awaitable } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  performanceTracker,
  generatePerformanceStats,
  generatePerformanceReport,
  formatMicroseconds,
  type PerformanceReportConfig,
  type TestPerformanceMetrics
} from './performance-tracking'

// ============================================================================
// REPORTER CONFIGURATION
// ============================================================================

export interface PerformanceReporterConfig {
  /** Enable detailed timing output */
  enableDetailedTiming: boolean
  /** Enable performance budget warnings */
  enableBudgetWarnings: boolean
  /** Export performance data to file */
  exportPath?: string
  /** Export format */
  exportFormat: 'json' | 'csv' | 'html'
  /** Minimum duration to highlight (microseconds) */
  slowTestThreshold: number
  /** Show memory usage information */
  showMemoryUsage: boolean
  /** Group tests by file in output */
  groupByFile: boolean
  /** Include performance trends */
  includeTrends: boolean
  /** Custom performance budget rules */
  customBudgetRules?: Array<{
    pattern: string
    budget: number
    message: string
  }>
}

const DEFAULT_CONFIG: PerformanceReporterConfig = {
  enableDetailedTiming: true,
  enableBudgetWarnings: true,
  exportFormat: 'json',
  slowTestThreshold: 1_000_000, // 1 second
  showMemoryUsage: true,
  groupByFile: true,
  includeTrends: false
}

// ============================================================================
// PERFORMANCE REPORTER CLASS
// ============================================================================

export class PerformanceReporter extends BaseReporter implements Reporter {
  private config: PerformanceReporterConfig
  private testStartTimes: Map<string, number> = new Map()
  private suiteStartTime: number = 0
  private totalTests: number = 0
  private passedTests: number = 0
  private failedTests: number = 0
  private slowTests: Array<{ name: string; duration: number; file: string }> = []

  constructor(config: Partial<PerformanceReporterConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ============================================================================
  // VITEST REPORTER LIFECYCLE
  // ============================================================================

  async onInit(ctx: Vitest) {
    this.ctx = ctx
    this.suiteStartTime = performance.now()
    
    console.log('🚀 Performance Reporter Initialized')
    console.log(`📊 Slow test threshold: ${formatMicroseconds(this.config.slowTestThreshold)}`)
    if (this.config.exportPath) {
      console.log(`📁 Export path: ${this.config.exportPath}`)
    }
  }

  onTaskUpdate(packs: TaskResultPack[], events?: TaskEventPack[]): Awaitable<void> {
    // Track individual test updates for real-time monitoring
    for (const pack of packs) {
      const [_id, results] = pack
      if (!results) continue
      
      for (const result of results) {
        this.processTaskResult(result)
      }
    }
  }

  onFinished(files?: File[], errors?: unknown[]) {
    this.generatePerformanceReport(files || [], errors || [])
  }

  // ============================================================================
  // TEST PROCESSING
  // ============================================================================

  private processTaskResult(task: any) {
    if (task.type !== 'test') return

    const testId = `${task.file?.name || 'unknown'}:${task.name}`
    
    // Track test timing
    if (task.result?.state === 'pass' || task.result?.state === 'fail') {
      const startTime = this.testStartTimes.get(testId)
      if (startTime) {
        const duration = (performance.now() - startTime) * 1000 // Convert to microseconds
        
        // Check if test is slow
        if (duration > this.config.slowTestThreshold) {
          this.slowTests.push({
            name: task.name,
            duration,
            file: task.file?.name || 'unknown'
          })
        }

        // Update counters
        if (task.result.state === 'pass') {
          this.passedTests++
        } else {
          this.failedTests++
        }
        this.totalTests++
      }
    }
  }

  // ============================================================================
  // PERFORMANCE REPORT GENERATION
  // ============================================================================

  private async generatePerformanceReport(_files: File[], _errors: unknown[]) {
    const suiteEndTime = performance.now()
    const totalSuiteDuration = (suiteEndTime - this.suiteStartTime) * 1000 // microseconds
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 PERFORMANCE REPORT')
    console.log('='.repeat(60))

    // Overall suite statistics
    this.printSuiteStatistics(totalSuiteDuration)

    // Detailed test performance
    if (this.config.enableDetailedTiming) {
      this.printDetailedTiming()
    }

    // Slow tests warning
    if (this.slowTests.length > 0) {
      this.printSlowTestsWarning()
    }

    // Performance budget violations
    if (this.config.enableBudgetWarnings) {
      this.printBudgetViolations()
    }

    // Memory usage report
    if (this.config.showMemoryUsage) {
      this.printMemoryUsage()
    }

    // Export data if configured
    if (this.config.exportPath) {
      await this.exportPerformanceData()
    }

    console.log('='.repeat(60))
  }

  private printSuiteStatistics(totalDuration: number) {
    console.log('\n📈 Suite Statistics:')
    console.log(`   Total Duration: ${formatMicroseconds(totalDuration)}`)
    console.log(`   Total Tests: ${this.totalTests}`)
    console.log(`   Passed: ${this.passedTests} (${((this.passedTests / this.totalTests) * 100).toFixed(1)}%)`)
    console.log(`   Failed: ${this.failedTests} (${((this.failedTests / this.totalTests) * 100).toFixed(1)}%)`)
    
    if (this.totalTests > 0) {
      const avgDuration = totalDuration / this.totalTests
      console.log(`   Average Test Duration: ${formatMicroseconds(avgDuration)}`)
    }
  }

  private printDetailedTiming() {
    const stats = generatePerformanceStats()
    
    console.log('\n⏱️  Detailed Timing:')
    console.log(`   Fastest Test: ${formatMicroseconds(stats.minDurationMicros)}`)
    console.log(`   Slowest Test: ${formatMicroseconds(stats.maxDurationMicros)}`)
    console.log(`   Median Duration: ${formatMicroseconds(stats.medianDurationMicros)}`)
    console.log(`   95th Percentile: ${formatMicroseconds(stats.p95DurationMicros)}`)

    // Performance distribution
    const allMetrics = performanceTracker.getAllMetrics()
    if (allMetrics.length > 0) {
      const durationBuckets = this.createDurationBuckets(allMetrics)
      console.log('\n📊 Duration Distribution:')
      for (const [range, count] of durationBuckets) {
        const percentage = ((count / allMetrics.length) * 100).toFixed(1)
        console.log(`   ${range}: ${count} tests (${percentage}%)`)
      }
    }
  }

  private printSlowTestsWarning() {
    console.log(`\n🐌 Slow Tests (>${formatMicroseconds(this.config.slowTestThreshold)}):`)
    
    // Sort by duration descending
    this.slowTests.sort((a, b) => b.duration - a.duration)
    
    for (const test of this.slowTests.slice(0, 10)) { // Show top 10
      console.log(`   ⚠️  ${formatMicroseconds(test.duration)} - ${test.name} (${test.file})`)
    }
    
    if (this.slowTests.length > 10) {
      console.log(`   ... and ${this.slowTests.length - 10} more slow tests`)
    }
  }

  private printBudgetViolations() {
    const allMetrics = performanceTracker.getAllMetrics()
    const violations = allMetrics.filter(m => m.budgetViolations.length > 0)
    
    if (violations.length === 0) {
      console.log('\n✅ No Performance Budget Violations')
      return
    }

    console.log(`\n💰 Performance Budget Violations (${violations.length} tests):`)
    
    for (const test of violations) {
      console.log(`   ❌ ${test.testName}:`)
      for (const violation of test.budgetViolations) {
        const icon = violation.severity === 'error' ? '🔴' : '🟡'
        console.log(`      ${icon} ${violation.message}`)
      }
    }
  }

  private printMemoryUsage() {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      console.log('\n🧠 Memory Usage: Not available in this environment')
      return
    }

    const memory = (performance as any).memory
    console.log('\n🧠 Memory Usage:')
    console.log(`   Used JS Heap: ${this.formatBytes(memory.usedJSHeapSize)}`)
    console.log(`   Total JS Heap: ${this.formatBytes(memory.totalJSHeapSize)}`)
    console.log(`   JS Heap Limit: ${this.formatBytes(memory.jsHeapSizeLimit)}`)
    
    const usagePercentage = ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)
    console.log(`   Heap Usage: ${usagePercentage}%`)
  }

  private async exportPerformanceData() {
    try {
      const stats = generatePerformanceStats()
      const allMetrics = performanceTracker.getAllMetrics()
      
      const reportConfig: PerformanceReportConfig = {
        format: this.config.exportFormat,
        includeDetails: true,
        includeTrends: this.config.includeTrends,
        groupByFile: this.config.groupByFile
      }

      const report = generatePerformanceReport(reportConfig)
      
      // Ensure directory exists
      const exportDir = path.dirname(this.config.exportPath!)
      await fs.mkdir(exportDir, { recursive: true })
      
      // Write report
      await fs.writeFile(this.config.exportPath!, report)
      
      console.log(`\n📄 Performance data exported to: ${this.config.exportPath}`)
      
      // Also export raw JSON for programmatic analysis
      if (this.config.exportFormat !== 'json') {
        const jsonPath = this.config.exportPath!.replace(/\.[^.]+$/, '.json')
        const jsonData = JSON.stringify({
          timestamp: new Date().toISOString(),
          stats,
          metrics: allMetrics,
          config: this.config
        }, null, 2)
        
        await fs.writeFile(jsonPath, jsonData)
        console.log(`📄 Raw data exported to: ${jsonPath}`)
      }
      
    } catch (error) {
      console.error(`❌ Failed to export performance data: ${error}`)
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private createDurationBuckets(metrics: TestPerformanceMetrics[]): Map<string, number> {
    const buckets = new Map([
      ['< 1ms', 0],
      ['1-10ms', 0],
      ['10-100ms', 0],
      ['100ms-1s', 0],
      ['> 1s', 0]
    ])

    for (const metric of metrics) {
      if (!metric.durationMicros) continue
      
      const durationMs = metric.durationMicros / 1000
      
      if (durationMs < 1) {
        buckets.set('< 1ms', buckets.get('< 1ms')! + 1)
      } else if (durationMs < 10) {
        buckets.set('1-10ms', buckets.get('1-10ms')! + 1)
      } else if (durationMs < 100) {
        buckets.set('10-100ms', buckets.get('10-100ms')! + 1)
      } else if (durationMs < 1000) {
        buckets.set('100ms-1s', buckets.get('100ms-1s')! + 1)
      } else {
        buckets.set('> 1s', buckets.get('> 1s')! + 1)
      }
    }

    return buckets
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(2)}${units[unitIndex]}`
  }
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Create performance reporter with sensible defaults for development
 */
export function createDevelopmentPerformanceReporter(): PerformanceReporter {
  return new PerformanceReporter({
    enableDetailedTiming: true,
    enableBudgetWarnings: true,
    slowTestThreshold: 500_000, // 500ms
    showMemoryUsage: true,
    groupByFile: true
  })
}

/**
 * Create performance reporter optimized for CI/CD environments
 */
export function createCIPerformanceReporter(exportPath: string): PerformanceReporter {
  return new PerformanceReporter({
    enableDetailedTiming: false,
    enableBudgetWarnings: true,
    exportPath,
    exportFormat: 'json',
    slowTestThreshold: 1_000_000, // 1s
    showMemoryUsage: false,
    groupByFile: true,
    includeTrends: true
  })
}

/**
 * Create performance reporter for local optimization work
 */
export function createOptimizationPerformanceReporter(exportPath: string): PerformanceReporter {
  return new PerformanceReporter({
    enableDetailedTiming: true,
    enableBudgetWarnings: true,
    exportPath,
    exportFormat: 'html',
    slowTestThreshold: 100_000, // 100ms
    showMemoryUsage: true,
    groupByFile: true,
    includeTrends: true
  })
}

// ============================================================================
// TASK RESULT TYPE (for TypeScript compatibility)
// ============================================================================

interface TaskResult {
  type: string
  name: string
  file?: { name: string }
  result?: {
    state: 'pass' | 'fail' | 'skip' | 'todo'
    errors?: Array<{ message: string }>
  }
}

export { PerformanceReporter as default }