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
  /** Database performance metrics */
  database_performance?: {
    avg_query_time: number
    slow_query_count: number
    connection_count: number
    cache_hit_rate: number
  }
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

// ============================================================================
// TYPE-SAFE ANALYTICS EVENT SYSTEM - Phase 1 Implementation
// ============================================================================

// Base event interface
interface BaseAnalyticsEvent {
  timestamp: number
  source: 'user' | 'system' | 'automated'
  eventId: string
}

// Specific event data types with strict typing
export interface SearchStartEventData {
  query: string
  searchType: 'simple' | 'paginated' | 'boolean'
  userId?: string
  filters?: Record<string, unknown>
}

export interface SearchCompleteEventData {
  query: string
  resultCount: number
  queryTime: number
  cacheHit: boolean
  complexityScore?: number
  searchType: 'simple' | 'paginated' | 'boolean'
  errorOccurred?: boolean
  errorMessage?: string
}

export interface CacheEventData {
  cacheKey: string
  hitRate: number
  size: number
  operation: 'hit' | 'miss' | 'eviction' | 'clear'
  entryAge?: number
}

export interface AlertEventData {
  alertId: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  relatedMetric?: PerformanceMetrics
  actionRequired?: boolean
  autoResolved?: boolean
}

export interface OptimizationEventData {
  optimizationType: 'query_optimization' | 'cache_tuning' | 'index_creation' | 'memory_optimization'
  before: PerformanceMetrics
  after: PerformanceMetrics
  improvement: number
  automaticallyApplied: boolean
  userApproved?: boolean
}

// Discriminated union for type-safe events
export type AnalyticsEvent = 
  | (BaseAnalyticsEvent & { type: 'search_start'; data: SearchStartEventData })
  | (BaseAnalyticsEvent & { type: 'search_complete'; data: SearchCompleteEventData })
  | (BaseAnalyticsEvent & { type: 'cache_hit'; data: CacheEventData })
  | (BaseAnalyticsEvent & { type: 'cache_miss'; data: CacheEventData })
  | (BaseAnalyticsEvent & { type: 'alert_triggered'; data: AlertEventData })
  | (BaseAnalyticsEvent & { type: 'optimization_applied'; data: OptimizationEventData })

// Type guard for runtime safety
export function isAnalyticsEvent(obj: unknown): obj is AnalyticsEvent {
  return typeof obj === 'object' && 
         obj !== null && 
         'type' in obj && 
         'timestamp' in obj && 
         'source' in obj && 
         'data' in obj &&
         'eventId' in obj
}

// Validate specific event data based on type
export function validateEventData(type: AnalyticsEvent['type'], data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  
  switch (type) {
    case 'search_start':
      return typeof (data as SearchStartEventData).query === 'string' &&
             typeof (data as SearchStartEventData).searchType === 'string'
    case 'search_complete':
      return typeof (data as SearchCompleteEventData).query === 'string' &&
             typeof (data as SearchCompleteEventData).resultCount === 'number' &&
             typeof (data as SearchCompleteEventData).queryTime === 'number'
    case 'cache_hit':
    case 'cache_miss':
      return typeof (data as CacheEventData).cacheKey === 'string' &&
             typeof (data as CacheEventData).hitRate === 'number'
    case 'alert_triggered':
      return typeof (data as AlertEventData).alertId === 'string' &&
             typeof (data as AlertEventData).severity === 'string'
    case 'optimization_applied':
      return typeof (data as OptimizationEventData).optimizationType === 'string' &&
             typeof (data as OptimizationEventData).improvement === 'number'
    default:
      return false
  }
}

// Event creation utilities with type safety
export const createAnalyticsEvent = {
  searchStart: (query: string, searchType: SearchStartEventData['searchType'], filters?: Record<string, unknown>): AnalyticsEvent => ({
    type: 'search_start',
    timestamp: Date.now(),
    source: 'user',
    eventId: crypto.randomUUID(),
    data: { query, searchType, filters }
  }),
  
  searchComplete: (data: SearchCompleteEventData): AnalyticsEvent => ({
    type: 'search_complete',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data
  }),

  cacheHit: (cacheKey: string, hitRate: number, size: number, entryAge?: number): AnalyticsEvent => ({
    type: 'cache_hit',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: { cacheKey, hitRate, size, operation: 'hit', entryAge }
  }),

  cacheMiss: (cacheKey: string, hitRate: number, size: number): AnalyticsEvent => ({
    type: 'cache_miss',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: { cacheKey, hitRate, size, operation: 'miss' }
  }),

  alertTriggered: (alertId: string, severity: AlertEventData['severity'], message: string, relatedMetric?: PerformanceMetrics): AnalyticsEvent => ({
    type: 'alert_triggered',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: { alertId, severity, message, relatedMetric }
  }),

  optimizationApplied: (data: OptimizationEventData): AnalyticsEvent => ({
    type: 'optimization_applied',
    timestamp: Date.now(),
    source: 'automated',
    eventId: crypto.randomUUID(),
    data
  })
}

// Helper function to get event data with proper typing
export function getEventData<T extends AnalyticsEvent['type']>(
  event: AnalyticsEvent & { type: T }
): T extends 'search_start' ? SearchStartEventData :
    T extends 'search_complete' ? SearchCompleteEventData :
    T extends 'cache_hit' | 'cache_miss' ? CacheEventData :
    T extends 'alert_triggered' ? AlertEventData :
    T extends 'optimization_applied' ? OptimizationEventData :
    never {
  return event.data as any
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