/**
 * Performance Analytics System - Week 2 Day 4
 * 
 * Real-time performance monitoring and analytics with type-safe event tracking.
 * Provides comprehensive insights into search performance, caching efficiency,
 * and system health metrics.
 */

import type { 
  PerformanceMetrics, 
  PerformanceTrend,
  PerformanceAlert,
  PerformanceBudget,
  SearchPattern,
  CacheAnalytics,
  SystemPerformance,
  PerformanceReport,
  OptimizationRecommendation,
  AnalyticsEvent,
  RealTimeMetrics
} from '../../types/analytics'

/**
 * Main performance analytics class for tracking and analyzing performance metrics
 */
export class PerformanceAnalytics {
  private metrics: PerformanceMetrics[] = []
  private trends: PerformanceTrend[] = []
  private alerts: PerformanceAlert[] = []
  private recommendations: OptimizationRecommendation[] = []
  private searchPatterns: Map<string, SearchPattern> = new Map()
  private cacheAnalytics: CacheAnalytics = {
    totalEntries: 0,
    hitRate: 0,
    avgLookupTime: 0,
    hotEntries: [],
    evictionRate: 0,
    memoryUsage: 0
  }
  
  // Performance budgets and thresholds
  private budget: PerformanceBudget = {
    maxQueryTime: 100,
    targetCacheHitRate: 80,
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    queryTimeAlert: 150,
    cacheMissAlert: 70
  }
  
  // Internal tracking
  private queryStartTimes: Map<string, number> = new Map()
  private eventListeners: Array<(event: AnalyticsEvent) => void> = []
  private lastCleanup: number = Date.now()
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_METRICS_HISTORY = 1000
  
  constructor() {
    // Initialize cleanup interval
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL)
  }

  /**
   * Record the start of a search operation
   */
  startQuery(queryId: string, query: string, operationType: PerformanceMetrics['operationType']): void {
    const startTime = performance.now()
    this.queryStartTimes.set(queryId, startTime)
    
    // Map operationType to searchType for analytics
    const searchType: 'simple' | 'paginated' | 'boolean' = 
      operationType === 'combined' ? 'boolean' : operationType
    
    this.recordEvent({
      type: 'search_start',
      timestamp: Date.now(),
      data: { 
        queryId, 
        query, 
        operationType, 
        searchType 
      },
      source: 'user',
      eventId: crypto.randomUUID()
    })
  }

  /**
   * Record the completion of a search operation
   */
  completeQuery(
    queryId: string,
    query: string,
    operationType: PerformanceMetrics['operationType'],
    resultCount: number,
    cacheHit: boolean,
    complexityScore?: number
  ): PerformanceMetrics {
    const endTime = performance.now()
    const startTime = this.queryStartTimes.get(queryId)
    
    if (!startTime) {
      throw new Error(`No start time found for query ${queryId}`)
    }

    const queryTime = Math.round(endTime - startTime)
    const currentMemory = this.getCurrentMemoryUsage()
    
    const metrics: PerformanceMetrics = {
      queryTime,
      resultCount,
      cacheHit,
      memoryUsage: currentMemory,
      timestamp: Date.now(),
      query,
      operationType,
      complexityScore
    }
    
    // Store metrics
    this.metrics.push(metrics)
    this.queryStartTimes.delete(queryId)
    
    // Update search patterns
    this.updateSearchPattern(query, queryTime, cacheHit)
    
    // Check for performance issues
    this.checkPerformanceIssues(metrics)
    
    // Map operationType to searchType for analytics
    const searchType: 'simple' | 'paginated' | 'boolean' = 
      operationType === 'combined' ? 'boolean' : operationType
    
    // Record completion event
    this.recordEvent({
      type: 'search_complete',
      timestamp: Date.now(),
      data: { 
        queryId, 
        query, 
        resultCount, 
        queryTime, 
        cacheHit, 
        complexityScore,
        searchType,
        operationType
      },
      source: 'system',
      eventId: crypto.randomUUID()
    })

    // Record cache events
    if (cacheHit) {
      this.recordEvent({
        type: 'cache_hit',
        timestamp: Date.now(),
        data: { 
          cacheKey: query, 
          hitRate: this.calculateCacheHitRate(), 
          size: this.metrics.length 
        },
        source: 'system',
        eventId: crypto.randomUUID()
      })
    } else {
      this.recordEvent({
        type: 'cache_miss',
        timestamp: Date.now(),
        data: { 
          cacheKey: query, 
          hitRate: this.calculateCacheHitRate(), 
          size: this.metrics.length 
        },
        source: 'system',
        eventId: crypto.randomUUID()
      })
    }

    return metrics
  }

  /**
   * Get current performance metrics for dashboard
   */
  getCurrentMetrics(): RealTimeMetrics {
    const recentMetrics = this.getRecentMetrics(60000) // Last minute
    const totalMetrics = this.metrics.length
    
    if (recentMetrics.length === 0) {
      return {
        queriesPerSecond: 0,
        recentAvgQueryTime: 0,
        currentCacheHitRate: 0,
        activeAlertsCount: this.alerts.filter(a => a.isActive).length,
        memoryTrend: 'stable',
        status: 'excellent'
      }
    }

    const queriesPerSecond = recentMetrics.length / 60
    const avgQueryTime = recentMetrics.reduce((sum, m) => sum + m.queryTime, 0) / recentMetrics.length
    const cacheHitRate = this.calculateCacheHitRate()
    const activeAlertsCount = this.alerts.filter(a => a.isActive).length
    
    // Determine memory trend
    const memoryTrend = this.calculateMemoryTrend()
    
    // Determine overall status
    let status: RealTimeMetrics['status'] = 'excellent'
    if (avgQueryTime > this.budget.queryTimeAlert || cacheHitRate < this.budget.cacheMissAlert) {
      status = 'critical'
    } else if (avgQueryTime > this.budget.maxQueryTime || cacheHitRate < this.budget.targetCacheHitRate) {
      status = 'warning'
    } else if (avgQueryTime > this.budget.maxQueryTime * 0.8) {
      status = 'good'
    }

    return {
      queriesPerSecond,
      recentAvgQueryTime: avgQueryTime,
      currentCacheHitRate: cacheHitRate,
      activeAlertsCount,
      memoryTrend,
      status
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(startTime?: number, endTime?: number): PerformanceReport {
    const now = Date.now()
    const start = startTime || now - (24 * 60 * 60 * 1000) // Last 24 hours
    const end = endTime || now
    
    const periodMetrics = this.metrics.filter(m => m.timestamp >= start && m.timestamp <= end)
    
    return {
      timestamp: now,
      period: { start, end, duration: end - start },
      summary: {
        totalQueries: periodMetrics.length,
        avgQueryTime: periodMetrics.length > 0 ? 
          periodMetrics.reduce((sum, m) => sum + m.queryTime, 0) / periodMetrics.length : 0,
        cacheHitRate: this.calculateCacheHitRate(periodMetrics),
        slowQueryCount: periodMetrics.filter(m => m.queryTime > this.budget.maxQueryTime).length,
        alertCount: this.alerts.filter(a => a.timestamp >= start && a.timestamp <= end).length,
        improvementOpportunities: this.recommendations.filter(r => !r.implemented).length
      },
      trends: this.trends.filter(t => t.period >= start && t.period <= end),
      topPatterns: Array.from(this.searchPatterns.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
      cacheAnalytics: this.cacheAnalytics,
      systemPerformance: this.getSystemPerformance(),
      alerts: this.alerts.filter(a => a.timestamp >= start && a.timestamp <= end),
      recommendations: this.recommendations
    }
  }

  /**
   * Add event listener for real-time updates
   */
  addEventListener(listener: (event: AnalyticsEvent) => void): void {
    this.eventListeners.push(listener)
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: AnalyticsEvent) => void): void {
    const index = this.eventListeners.indexOf(listener)
    if (index > -1) {
      this.eventListeners.splice(index, 1)
    }
  }

  /**
   * Set performance budget
   */
  setPerformanceBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget }
  }

  /**
   * Get performance budget
   */
  getPerformanceBudget(): PerformanceBudget {
    return { ...this.budget }
  }

  // Private helper methods

  private recordEvent(event: AnalyticsEvent): void {
    // Notify listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in analytics event listener:', error)
      }
    })
  }

  private updateSearchPattern(query: string, queryTime: number, cacheHit: boolean): void {
    const existing = this.searchPatterns.get(query)
    
    if (existing) {
      const totalQueries = existing.frequency + 1
      const newAvgTime = (existing.avgQueryTime * existing.frequency + queryTime) / totalQueries
      const newCacheHitRate = existing.cacheHitRate + (cacheHit ? 1 : 0)
      
      this.searchPatterns.set(query, {
        ...existing,
        frequency: totalQueries,
        avgQueryTime: newAvgTime,
        cacheHitRate: newCacheHitRate / totalQueries * 100,
        lastSearched: Date.now()
      })
    } else {
      this.searchPatterns.set(query, {
        query,
        frequency: 1,
        avgQueryTime: queryTime,
        cacheHitRate: cacheHit ? 100 : 0,
        lastSearched: Date.now(),
        optimization: this.determineOptimization(queryTime, cacheHit)
      })
    }
  }

  private checkPerformanceIssues(metrics: PerformanceMetrics): void {
    // Check query time threshold
    if (metrics.queryTime > this.budget.queryTimeAlert) {
      this.createAlert('query_time', 'warning', 
        `Slow query detected: ${metrics.queryTime}ms (threshold: ${this.budget.queryTimeAlert}ms)`,
        metrics)
    }
    
    // Check cache miss rate
    const cacheHitRate = this.calculateCacheHitRate()
    if (cacheHitRate < this.budget.cacheMissAlert) {
      this.createAlert('cache_miss', 'warning',
        `Low cache hit rate: ${cacheHitRate.toFixed(1)}% (threshold: ${this.budget.cacheMissAlert}%)`)
    }
    
    // Check memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > this.budget.maxMemoryUsage) {
      this.createAlert('memory_usage', 'error',
        `High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
    }
  }

  private createAlert(
    type: PerformanceAlert['type'], 
    severity: PerformanceAlert['severity'],
    message: string,
    relatedMetric?: PerformanceMetrics
  ): void {
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      severity,
      type,
      message,
      timestamp: Date.now(),
      isActive: true,
      relatedMetric,
      suggestion: this.generateSuggestion(type, relatedMetric)
    }
    
    this.alerts.push(alert)
    
    this.recordEvent({
      type: 'alert_triggered',
      timestamp: Date.now(),
      data: {
        alertId: alert.id,
        severity,
        message,
        relatedMetric
      },
      source: 'system',
      eventId: crypto.randomUUID()
    })
  }

  private generateSuggestion(type: PerformanceAlert['type'], metrics?: PerformanceMetrics): string {
    switch (type) {
      case 'query_time':
        return 'Consider optimizing query complexity or adding appropriate indexes'
      case 'cache_miss':
        return 'Review cache strategy and consider preloading frequently accessed data'
      case 'memory_usage':
        return 'Check for memory leaks and consider implementing memory cleanup'
      case 'regression':
        return 'Compare recent changes and consider rolling back problematic updates'
      default:
        return 'Review system performance and consider optimization strategies'
    }
  }

  private calculateCacheHitRate(metricsSubset?: PerformanceMetrics[]): number {
    const metrics = metricsSubset || this.metrics
    if (metrics.length === 0) return 0
    
    const hits = metrics.filter(m => m.cacheHit).length
    return (hits / metrics.length) * 100
  }

  private calculateMemoryTrend(): RealTimeMetrics['memoryTrend'] {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000) // Last 5 minutes
    if (recentMetrics.length < 3) return 'stable'
    
    const firstHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2))
    const secondHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2))
    
    const firstAvg = firstHalf.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / secondHalf.length
    
    const threshold = firstAvg * 0.1 // 10% change threshold
    
    if (secondAvg > firstAvg + threshold) return 'increasing'
    if (secondAvg < firstAvg - threshold) return 'decreasing'
    return 'stable'
  }

  private getRecentMetrics(timeWindow: number): PerformanceMetrics[] {
    const cutoff = Date.now() - timeWindow
    return this.metrics.filter(m => m.timestamp >= cutoff)
  }

  private getCurrentMemoryUsage(): number {
    // In a browser environment, we can approximate memory usage
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      return (window.performance as any).memory.usedJSHeapSize || 0
    }
    return 0
  }

  private getSystemPerformance(): SystemPerformance {
    return {
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      peakMemoryUsage: Math.max(...this.metrics.map(m => m.memoryUsage || 0)),
      cpuUsage: undefined, // Not available in browser
      activeConnections: 1, // Simplified for browser environment
      databaseMetrics: {
        connectionTime: 5, // Simplified
        queryQueueSize: 0,
        avgConnectionTime: 5
      }
    }
  }

  private determineOptimization(queryTime: number, cacheHit: boolean): SearchPattern['optimization'] {
    if (queryTime > this.budget.maxQueryTime * 2) return 'query_simplify'
    if (!cacheHit && queryTime > this.budget.maxQueryTime) return 'cache_optimize'
    if (queryTime > this.budget.maxQueryTime) return 'index_optimize'
    return 'none'
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - (24 * 60 * 60 * 1000) // Keep 24 hours of data
    
    // Clean old metrics
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff)
    
    // Clean old alerts (keep active ones regardless of age)
    this.alerts = this.alerts.filter(a => a.isActive || a.timestamp >= cutoff)
    
    // Limit metrics history size
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY)
    }
    
    this.lastCleanup = now
  }
}

// Export singleton instance
export const performanceAnalytics = new PerformanceAnalytics()