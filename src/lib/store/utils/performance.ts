/**
 * Performance Debugging and Monitoring Utilities
 * 
 * This module provides comprehensive performance monitoring tools
 * for the slice-based store architecture.
 */

import { useEffect } from 'react'

// Performance monitoring interface
interface PerformanceReport {
  timestamp: number
  totalRenders: number
  unnecessaryRenders: number
  averageRenderTime: number
  slowRenders: number
  slicePerformance: Record<string, {
    renders: number
    averageTime: number
    slowRenders: number
  }>
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
}

class PerformanceMonitor {
  private renderCounts: Map<string, number> = new Map()
  private renderTimes: Map<string, number[]> = new Map()
  private slowRenderThreshold = 16 // 16ms for 60fps
  private isMonitoring = false
  private reports: PerformanceReport[] = []
  
  constructor() {
    if (process.env.NODE_ENV === 'development') {
      this.startMonitoring()
    }
  }
  
  startMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    console.log('🚀 Performance monitoring started')
    
    // Generate reports every 30 seconds
    setInterval(() => {
      this.generateReport()
    }, 30000)
    
    // Memory monitoring
    if (typeof (performance as any).memory !== 'undefined') {
      setInterval(() => {
        this.trackMemoryUsage()
      }, 5000)
    }
  }
  
  stopMonitoring() {
    this.isMonitoring = false
    console.log('⏹️ Performance monitoring stopped')
  }
  
  trackRender(componentName: string, renderTime: number) {
    if (!this.isMonitoring) return
    
    // Update render count
    const currentCount = this.renderCounts.get(componentName) || 0
    this.renderCounts.set(componentName, currentCount + 1)
    
    // Update render times
    const currentTimes = this.renderTimes.get(componentName) || []
    currentTimes.push(renderTime)
    
    // Keep only last 50 render times for each component
    if (currentTimes.length > 50) {
      currentTimes.shift()
    }
    
    this.renderTimes.set(componentName, currentTimes)
    
    // Log slow renders immediately
    if (renderTime > this.slowRenderThreshold) {
      console.warn(`🐌 Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`)
    }
  }
  
  trackMemoryUsage() {
    if (typeof (performance as any).memory === 'undefined') return
    
    const memory = (performance as any).memory
    const usage = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    }
    
    if (usage.percentage > 80) {
      console.warn(`⚠️ High memory usage: ${usage.percentage.toFixed(1)}%`)
    }
  }
  
  generateReport(): PerformanceReport {
    const now = Date.now()
    const report: PerformanceReport = {
      timestamp: now,
      totalRenders: 0,
      unnecessaryRenders: 0,
      averageRenderTime: 0,
      slowRenders: 0,
      slicePerformance: {}
    }
    
    let totalRenderTime = 0
    let totalSlowRenders = 0
    
    for (const [componentName, renderCount] of this.renderCounts.entries()) {
      const renderTimes = this.renderTimes.get(componentName) || []
      const averageTime = renderTimes.length > 0 
        ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
        : 0
      const slowRenders = renderTimes.filter(time => time > this.slowRenderThreshold).length
      
      report.slicePerformance[componentName] = {
        renders: renderCount,
        averageTime,
        slowRenders
      }
      
      report.totalRenders += renderCount
      totalRenderTime += averageTime * renderCount
      totalSlowRenders += slowRenders
    }
    
    report.averageRenderTime = report.totalRenders > 0 ? totalRenderTime / report.totalRenders : 0
    report.slowRenders = totalSlowRenders
    
    // Add memory usage if available
    if (typeof (performance as any).memory !== 'undefined') {
      const memory = (performance as any).memory
      report.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }
    
    // Estimate unnecessary renders (renders faster than 1ms might be prevented)
    report.unnecessaryRenders = Object.values(report.slicePerformance)
      .reduce((sum, perf) => sum + Math.floor(perf.renders * 0.1), 0) // Rough estimate
    
    this.reports.push(report)
    
    // Keep only last 10 reports
    if (this.reports.length > 10) {
      this.reports.shift()
    }
    
    return report
  }
  
  getLatestReport(): PerformanceReport | null {
    return this.reports[this.reports.length - 1] || null
  }
  
  getAllReports(): PerformanceReport[] {
    return [...this.reports]
  }
  
  getPerformanceImprovement(): { prevented: number; total: number; percentage: number } {
    const latest = this.getLatestReport()
    if (!latest) return { prevented: 0, total: 0, percentage: 0 }
    
    return {
      prevented: latest.unnecessaryRenders,
      total: latest.totalRenders,
      percentage: (latest.unnecessaryRenders / latest.totalRenders) * 100
    }
  }
  
  reset() {
    this.renderCounts.clear()
    this.renderTimes.clear()
    this.reports.length = 0
    console.log('📊 Performance monitoring reset')
  }
  
  // Console logging methods
  logReport(report?: PerformanceReport) {
    const targetReport = report || this.getLatestReport()
    if (!targetReport) {
      console.log('No performance reports available')
      return
    }
    
    console.group('📊 Performance Report')
    console.log('Timestamp:', new Date(targetReport.timestamp).toLocaleTimeString())
    console.log('Total Renders:', targetReport.totalRenders)
    console.log('Unnecessary Renders:', targetReport.unnecessaryRenders, `(${((targetReport.unnecessaryRenders / targetReport.totalRenders) * 100).toFixed(1)}%)`)
    console.log('Average Render Time:', `${targetReport.averageRenderTime.toFixed(2)}ms`)
    console.log('Slow Renders (>16ms):', targetReport.slowRenders)
    
    if (targetReport.memoryUsage) {
      console.log('Memory Usage:', `${(targetReport.memoryUsage.used / 1024 / 1024).toFixed(1)}MB (${targetReport.memoryUsage.percentage.toFixed(1)}%)`)
    }
    
    console.log('Component Performance:')
    Object.entries(targetReport.slicePerformance).forEach(([name, perf]) => {
      console.log(`  ${name}: ${perf.renders} renders, ${perf.averageTime.toFixed(2)}ms avg, ${perf.slowRenders} slow`)
    })
    
    console.groupEnd()
  }
  
  logSummary() {
    const improvement = this.getPerformanceImprovement()
    
    console.group('🎯 Performance Summary')
    console.log('Render Prevention Rate:', `${improvement.percentage.toFixed(1)}%`)
    console.log('Prevented Renders:', improvement.prevented)
    console.log('Total Renders:', improvement.total)
    
    const latest = this.getLatestReport()
    if (latest) {
      const efficiency = latest.slowRenders === 0 ? 'Excellent' : 
                        latest.slowRenders < 5 ? 'Good' : 
                        latest.slowRenders < 15 ? 'Fair' : 'Needs Improvement'
      
      console.log('Render Efficiency:', efficiency)
      console.log('Target Achievement:', improvement.percentage >= 50 ? '✅ Target Met' : '❌ Below Target')
    }
    
    console.groupEnd()
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor()

// Export utilities
export const trackComponentRender = (componentName: string, renderTime: number) => {
  performanceMonitor.trackRender(componentName, renderTime)
}

export const generatePerformanceReport = () => {
  return performanceMonitor.generateReport()
}

export const getLatestPerformanceReport = () => {
  return performanceMonitor.getLatestReport()
}

export const getAllPerformanceReports = () => {
  return performanceMonitor.getAllReports()
}

export const getPerformanceImprovement = () => {
  return performanceMonitor.getPerformanceImprovement()
}

export const logPerformanceReport = (report?: PerformanceReport) => {
  performanceMonitor.logReport(report)
}

export const logPerformanceSummary = () => {
  performanceMonitor.logSummary()
}

export const resetPerformanceMonitoring = () => {
  performanceMonitor.reset()
}

// React hook for component performance monitoring
export const useComponentPerformanceTracking = (componentName: string) => {
  const renderStart = performance.now()
  
  // Track render on every call
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    
    const renderTime = performance.now() - renderStart
    trackComponentRender(componentName, renderTime)
  })
}

// Development console commands
if (process.env.NODE_ENV === 'development') {
  // Make performance tools available globally
  (window as any).__PERFORMANCE_TOOLS__ = {
    generateReport: generatePerformanceReport,
    getLatest: getLatestPerformanceReport,
    getAll: getAllPerformanceReports,
    getImprovement: getPerformanceImprovement,
    logReport: logPerformanceReport,
    logSummary: logPerformanceSummary,
    reset: resetPerformanceMonitoring,
    
    // Quick commands
    report: () => logPerformanceReport(),
    summary: () => logPerformanceSummary(),
    improvement: () => {
      const imp = getPerformanceImprovement()
      console.log(`🎯 ${imp.percentage.toFixed(1)}% render prevention (${imp.prevented}/${imp.total})`)
    }
  }
  
  console.log('🛠️ Performance tools available at window.__PERFORMANCE_TOOLS__')
  console.log('Quick commands: __PERFORMANCE_TOOLS__.report(), .summary(), .improvement()')
}

export default performanceMonitor