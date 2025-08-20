/**
 * Type-Safe Analytics Events System
 * Replaces any usage in analytics with discriminated unions
 */

import { PerformanceMetrics } from './analytics'

// Base event interface with common properties
interface BaseAnalyticsEvent {
  timestamp: number
  source: 'user' | 'system' | 'automated'
  eventId: string
  sessionId?: string
  userId?: string
}

// Specific event data types with full type safety
export interface SearchStartEventData {
  query: string
  searchType: 'simple' | 'paginated' | 'boolean' | 'combined'
  filters?: {
    dateRange?: { start: number; end: number }
    favorites?: boolean
    contentType?: string[]
  }
  context?: {
    previousQuery?: string
    searchHistoryIndex?: number
    triggeredBy: 'keyboard' | 'click' | 'api'
  }
}

export interface SearchCompleteEventData {
  query: string
  resultCount: number
  queryTime: number
  cacheHit: boolean
  complexityScore?: number
  searchType: 'simple' | 'paginated' | 'boolean' | 'combined'
  filters?: SearchStartEventData['filters']
  performance: {
    memoryUsage?: number
    dbQueries?: number
    renderTime?: number
  }
}

export interface CacheEventData {
  cacheKey: string
  hitRate: number
  size: number
  operation: 'read' | 'write' | 'evict' | 'clear'
  metadata?: {
    ttl?: number
    priority?: 'low' | 'medium' | 'high'
    category?: 'search' | 'notes' | 'settings'
  }
}

export interface AlertEventData {
  alertId: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  category: 'performance' | 'security' | 'functionality' | 'usage'
  relatedMetric?: PerformanceMetrics
  context?: {
    componentName?: string
    actionName?: string
    userAgent?: string
  }
  autoResolved?: boolean
}

export interface OptimizationEventData {
  optimizationId: string
  type: 'query_optimization' | 'cache_tuning' | 'index_creation' | 'memory_optimization'
  before: PerformanceMetrics
  after: PerformanceMetrics
  improvement: {
    percentage: number
    absoluteValue: number
    metric: 'queryTime' | 'memoryUsage' | 'cacheHitRate'
  }
  implementation: {
    automated: boolean
    complexity: 'low' | 'medium' | 'high'
    rollbackPossible: boolean
  }
}

export interface UserInteractionEventData {
  action: 'click' | 'keypress' | 'scroll' | 'focus' | 'blur'
  target: {
    component: string
    element?: string
    id?: string
  }
  timing: {
    start: number
    duration?: number
  }
  context?: {
    modifierKeys?: string[]
    clickCount?: number
    scrollDirection?: 'up' | 'down' | 'left' | 'right'
  }
}

export interface SystemEventData {
  event: 'startup' | 'shutdown' | 'error' | 'resource_limit' | 'connection_lost'
  details: {
    version?: string
    platform?: string
    errorCode?: string
    resourceType?: 'memory' | 'cpu' | 'disk' | 'network'
    threshold?: number
    current?: number
  }
  recovery?: {
    automatic: boolean
    successful?: boolean
    action?: string
  }
}

// Discriminated union for all analytics events with full type safety
export type AnalyticsEvent = 
  | (BaseAnalyticsEvent & { type: 'search_start'; data: SearchStartEventData })
  | (BaseAnalyticsEvent & { type: 'search_complete'; data: SearchCompleteEventData })
  | (BaseAnalyticsEvent & { type: 'cache_hit'; data: CacheEventData })
  | (BaseAnalyticsEvent & { type: 'cache_miss'; data: CacheEventData })
  | (BaseAnalyticsEvent & { type: 'alert_triggered'; data: AlertEventData })
  | (BaseAnalyticsEvent & { type: 'optimization_applied'; data: OptimizationEventData })
  | (BaseAnalyticsEvent & { type: 'user_interaction'; data: UserInteractionEventData })
  | (BaseAnalyticsEvent & { type: 'system_event'; data: SystemEventData })

// Type guards for runtime safety and validation
export function isAnalyticsEvent(obj: unknown): obj is AnalyticsEvent {
  if (typeof obj !== 'object' || obj === null) return false
  
  const event = obj as Partial<AnalyticsEvent>
  return (
    typeof event.type === 'string' &&
    typeof event.timestamp === 'number' &&
    typeof event.source === 'string' &&
    typeof event.eventId === 'string' &&
    typeof event.data === 'object' &&
    event.data !== null
  )
}

export function isSearchStartEvent(event: AnalyticsEvent): event is AnalyticsEvent & { type: 'search_start' } {
  return event.type === 'search_start'
}

export function isSearchCompleteEvent(event: AnalyticsEvent): event is AnalyticsEvent & { type: 'search_complete' } {
  return event.type === 'search_complete'
}

export function isCacheEvent(event: AnalyticsEvent): event is AnalyticsEvent & { type: 'cache_hit' | 'cache_miss' } {
  return event.type === 'cache_hit' || event.type === 'cache_miss'
}

export function isAlertEvent(event: AnalyticsEvent): event is AnalyticsEvent & { type: 'alert_triggered' } {
  return event.type === 'alert_triggered'
}

// Event creation utilities with full type safety
export const createAnalyticsEvent = {
  searchStart: (
    query: string, 
    searchType: SearchStartEventData['searchType'],
    options?: Partial<Omit<SearchStartEventData, 'query' | 'searchType'>>
  ): AnalyticsEvent => ({
    type: 'search_start',
    timestamp: Date.now(),
    source: 'user',
    eventId: crypto.randomUUID(),
    data: {
      query,
      searchType,
      ...options
    }
  }),
  
  searchComplete: (data: SearchCompleteEventData): AnalyticsEvent => ({
    type: 'search_complete',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data
  }),
  
  cacheHit: (cacheKey: string, metadata?: Partial<CacheEventData>): AnalyticsEvent => ({
    type: 'cache_hit',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: {
      cacheKey,
      operation: 'read',
      hitRate: 0, // To be filled by cache system
      size: 0,    // To be filled by cache system
      ...metadata
    }
  }),
  
  cacheMiss: (cacheKey: string, metadata?: Partial<CacheEventData>): AnalyticsEvent => ({
    type: 'cache_miss',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: {
      cacheKey,
      operation: 'read',
      hitRate: 0, // To be filled by cache system
      size: 0,    // To be filled by cache system
      ...metadata
    }
  }),
  
  alert: (
    severity: AlertEventData['severity'],
    message: string,
    category: AlertEventData['category'],
    options?: Partial<Omit<AlertEventData, 'alertId' | 'severity' | 'message' | 'category'>>
  ): AnalyticsEvent => ({
    type: 'alert_triggered',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: {
      alertId: crypto.randomUUID(),
      severity,
      message,
      category,
      ...options
    }
  }),
  
  optimization: (data: OptimizationEventData): AnalyticsEvent => ({
    type: 'optimization_applied',
    timestamp: Date.now(),
    source: 'automated',
    eventId: crypto.randomUUID(),
    data
  }),
  
  userInteraction: (
    action: UserInteractionEventData['action'],
    component: string,
    options?: Partial<Omit<UserInteractionEventData, 'action' | 'target'>>
  ): AnalyticsEvent => ({
    type: 'user_interaction',
    timestamp: Date.now(),
    source: 'user',
    eventId: crypto.randomUUID(),
    data: {
      action,
      target: { component },
      timing: { start: Date.now() },
      ...options
    }
  }),
  
  systemEvent: (
    event: SystemEventData['event'],
    details: SystemEventData['details'],
    options?: Partial<Omit<SystemEventData, 'event' | 'details'>>
  ): AnalyticsEvent => ({
    type: 'system_event',
    timestamp: Date.now(),
    source: 'system',
    eventId: crypto.randomUUID(),
    data: {
      event,
      details,
      ...options
    }
  })
}

// Event processing utilities
export function groupEventsByType(events: AnalyticsEvent[]): Record<AnalyticsEvent['type'], AnalyticsEvent[]> {
  const grouped: Record<string, AnalyticsEvent[]> = {}
  
  for (const event of events) {
    if (!grouped[event.type]) {
      grouped[event.type] = []
    }
    grouped[event.type].push(event)
  }
  
  return grouped as Record<AnalyticsEvent['type'], AnalyticsEvent[]>
}

export function filterEventsByTimeRange(
  events: AnalyticsEvent[], 
  start: number, 
  end: number
): AnalyticsEvent[] {
  return events.filter(event => event.timestamp >= start && event.timestamp <= end)
}

export function extractEventData<T extends AnalyticsEvent['type']>(
  events: AnalyticsEvent[],
  type: T
): Array<Extract<AnalyticsEvent, { type: T }>['data']> {
  return events
    .filter((event): event is Extract<AnalyticsEvent, { type: T }> => event.type === type)
    .map(event => event.data) as Array<Extract<AnalyticsEvent, { type: T }>['data']>
}

// Analytics event validation
export function validateAnalyticsEvent(event: unknown): {
  valid: boolean
  errors: string[]
  event?: AnalyticsEvent
} {
  const errors: string[] = []
  
  if (!isAnalyticsEvent(event)) {
    errors.push('Invalid analytics event structure')
    return { valid: false, errors }
  }
  
  // Additional validation rules
  if (event.timestamp > Date.now() + 60000) { // Allow 1 minute future tolerance
    errors.push('Event timestamp is too far in the future')
  }
  
  if (event.timestamp < Date.now() - 86400000) { // Reject events older than 24 hours
    errors.push('Event timestamp is too old')
  }
  
  if (!event.eventId || event.eventId.length < 10) {
    errors.push('Invalid or missing event ID')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    event: errors.length === 0 ? event : undefined
  }
}