/**
 * Performance Analytics Types for Week 2 Day 4
 * 
 * Comprehensive type definitions for performance monitoring and analytics
 * dashboard integration with real-time insights and optimization tracking.
 */

export interface PerformanceMetrics {
  /** Query execution time in milliseconds */
  queryTime: number
  /** Result count from the search */
  resultCount: number
  /** Whether the result came from cache */
  cacheHit: boolean
  /** Memory usage during the operation (in bytes) */
  memoryUsage?: number
  /** Timestamp when the metric was recorded */
  timestamp: number
  /** Query that was executed */
  query: string
  /** Search operation type */
  operationType: 'simple' | 'paginated' | 'boolean' | 'combined'
  /** Query complexity score for boolean searches */
  complexityScore?: number
}

export interface PerformanceTrend {
  /** Time period for the trend (in minutes) */
  period: number
  /** Average query time over the period */
  avgQueryTime: number
  /** Total number of queries */
  queryCount: number
  /** Cache hit rate as percentage */
  cacheHitRate: number
  /** Peak query time in the period */
  peakQueryTime: number
  /** Memory usage trend */
  avgMemoryUsage: number
  /** Number of performance issues detected */
  issueCount: number
}

export interface PerformanceBudget {
  /** Maximum acceptable query time (ms) */
  maxQueryTime: number
  /** Target cache hit rate (percentage) */
  targetCacheHitRate: number
  /** Maximum memory usage (bytes) */
  maxMemoryUsage: number
  /** Alert threshold for query time (ms) */
  queryTimeAlert: number
  /** Alert threshold for cache miss rate (percentage) */
  cacheMissAlert: number
}

export interface PerformanceAlert {
  /** Unique identifier for the alert */
  id: string
  /** Alert severity level */
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** Alert type */
  type: 'query_time' | 'cache_miss' | 'memory_usage' | 'regression'
  /** Alert message */
  message: string
  /** Timestamp when alert was triggered */
  timestamp: number
  /** Whether the alert is still active */
  isActive: boolean
  /** Related metric that triggered the alert */
  relatedMetric?: PerformanceMetrics
  /** Suggested optimization action */
  suggestion?: string
}

export interface SearchPattern {
  /** Search query pattern */
  query: string
  /** Number of times this pattern was searched */
  frequency: number
  /** Average query time for this pattern */
  avgQueryTime: number
  /** Cache hit rate for this pattern */
  cacheHitRate: number
  /** Last time this pattern was searched */
  lastSearched: number
  /** Performance optimization recommendation */
  optimization?: 'cache_optimize' | 'index_optimize' | 'query_simplify' | 'none'
}

export interface CacheAnalytics {
  /** Total cache size (in number of entries) */
  totalEntries: number
  /** Cache hit rate over the last hour */
  hitRate: number
  /** Average cache lookup time (ms) */
  avgLookupTime: number
  /** Most frequently accessed cache entries */
  hotEntries: Array<{
    query: string
    hitCount: number
    lastAccessed: number
  }>
  /** Cache eviction rate (entries per hour) */
  evictionRate: number
  /** Memory usage by cache (bytes) */
  memoryUsage: number
}

export interface SystemPerformance {
  /** Current memory usage (bytes) */
  currentMemoryUsage: number
  /** Peak memory usage in the session (bytes) */
  peakMemoryUsage: number
  /** CPU usage percentage (if available) */
  cpuUsage?: number
  /** Number of active database connections */
  activeConnections?: number
  /** Database performance metrics */
  databaseMetrics?: {
    connectionTime: number
    queryQueueSize: number
    avgConnectionTime: number
  }
}

export interface OptimizationRecommendation {
  /** Unique identifier for the recommendation */
  id: string
  /** Recommendation type */
  type: 'query_optimization' | 'cache_tuning' | 'index_creation' | 'memory_optimization'
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical'
  /** Recommendation title */
  title: string
  /** Detailed description */
  description: string
  /** Expected performance improvement */
  expectedImprovement: string
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high'
  /** Related search patterns or metrics */
  relatedData?: SearchPattern[] | PerformanceMetrics[]
  /** Whether the recommendation has been implemented */
  implemented: boolean
  /** Implementation timestamp */
  implementedAt?: number
}

export interface PerformanceReport {
  /** Report generation timestamp */
  timestamp: number
  /** Time period covered by the report */
  period: {
    start: number
    end: number
    duration: number
  }
  /** Overall performance summary */
  summary: {
    totalQueries: number
    avgQueryTime: number
    cacheHitRate: number
    slowQueryCount: number
    alertCount: number
    improvementOpportunities: number
  }
  /** Performance trends over time */
  trends: PerformanceTrend[]
  /** Top search patterns */
  topPatterns: SearchPattern[]
  /** Cache performance analysis */
  cacheAnalytics: CacheAnalytics
  /** System performance snapshot */
  systemPerformance: SystemPerformance
  /** Active performance alerts */
  alerts: PerformanceAlert[]
  /** Optimization recommendations */
  recommendations: OptimizationRecommendation[]
}

export interface AnalyticsDashboardConfig {
  /** Whether to show real-time metrics */
  showRealTime: boolean
  /** Update interval for real-time metrics (ms) */
  updateInterval: number
  /** Number of metrics to keep in memory */
  metricsHistoryLimit: number
  /** Performance budget settings */
  performanceBudget: PerformanceBudget
  /** Whether to enable automatic alerts */
  enableAlerts: boolean
  /** Alert configuration */
  alertConfig: {
    queryTimeThreshold: number
    cacheMissThreshold: number
    memoryThreshold: number
    enableEmailAlerts: boolean
    enableBrowserNotifications: boolean
  }
  /** Dashboard view preferences */
  viewPreferences: {
    defaultTimeRange: '1h' | '6h' | '24h' | '7d'
    showAdvancedMetrics: boolean
    enableHeatmaps: boolean
    chartType: 'line' | 'bar' | 'area'
  }
}

export interface AnalyticsEvent {
  /** Event type */
  type: 'search_start' | 'search_complete' | 'cache_hit' | 'cache_miss' | 'alert_triggered' | 'optimization_applied'
  /** Event timestamp */
  timestamp: number
  /** Event data */
  data: any
  /** Event source */
  source: 'user' | 'system' | 'automated'
}

export interface RealTimeMetrics {
  /** Current queries per second */
  queriesPerSecond: number
  /** Average query time in the last minute */
  recentAvgQueryTime: number
  /** Current cache hit rate */
  currentCacheHitRate: number
  /** Active alerts count */
  activeAlertsCount: number
  /** Memory usage trend (increasing/decreasing/stable) */
  memoryTrend: 'increasing' | 'decreasing' | 'stable'
  /** Performance status */
  status: 'excellent' | 'good' | 'warning' | 'critical'
}

/**
 * Analytics Dashboard Component Props
 */
export interface AnalyticsDashboardProps {
  /** Configuration for the analytics dashboard */
  config?: Partial<AnalyticsDashboardConfig>
  /** Custom CSS class name */
  className?: string
  /** Whether the dashboard is in compact mode */
  compact?: boolean
  /** Custom event handlers */
  onAlert?: (alert: PerformanceAlert) => void
  onRecommendation?: (recommendation: OptimizationRecommendation) => void
  onMetricUpdate?: (metrics: RealTimeMetrics) => void
}