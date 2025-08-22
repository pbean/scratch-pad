/**
 * Performance Monitoring Hooks - Week 2 Day 4
 * 
 * React hooks for integrating performance analytics with search components.
 * Provides seamless performance tracking with minimal overhead and automatic
 * optimization insights for search operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PerformanceMetrics,
  RealTimeMetrics,
  PerformanceAlert,
  OptimizationRecommendation,
  SearchPattern
} from '../types/analytics'
import { performanceAnalytics } from '../lib/analytics/performanceAnalytics'

/**
 * Hook for tracking search operation performance
 * 
 * @param operationType - Type of search operation
 * @returns Performance tracking functions
 */
export function useSearchPerformanceTracking(
  operationType: PerformanceMetrics['operationType'] = 'simple'
) {
  const queryIdRef = useRef<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  const startTracking = useCallback((
    queryId: string,
    query: string,
    opType?: PerformanceMetrics['operationType']
  ) => {
    const actualQueryId = queryId || `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const actualOpType = opType || operationType
    
    queryIdRef.current = actualQueryId
    setIsTracking(true)
    
    performanceAnalytics.startQuery(actualQueryId, query, actualOpType)
    
    return actualQueryId
  }, [operationType])

  const completeTracking = useCallback((
    queryId: string,
    query: string,
    resultCount: number,
    cacheHit: boolean = false,
    complexityScore?: number
  ): PerformanceMetrics | null => {
    if (!queryId || !isTracking) {
      console.warn('Performance tracking not started or already completed')
      return null
    }

    try {
      const metrics = performanceAnalytics.completeQuery(
        queryId,
        query,
        operationType,
        resultCount,
        cacheHit,
        complexityScore
      )
      
      setIsTracking(false)
      queryIdRef.current = null
      
      return metrics
    } catch (error) {
      console.error('Failed to complete performance tracking:', error)
      setIsTracking(false)
      queryIdRef.current = null
      return null
    }
  }, [operationType])

  const cancelTracking = useCallback((queryId?: string) => {
    if (queryId || queryIdRef.current) {
      setIsTracking(false)
      queryIdRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queryIdRef.current && isTracking) {
        cancelTracking()
      }
    }
  }, [isTracking, cancelTracking])

  return {
    startTracking,
    completeTracking,
    cancelTracking,
    isTracking,
    queryId: queryIdRef.current
  }
}

/**
 * Hook for real-time performance metrics
 * 
 * @param updateInterval - Update interval in milliseconds (default: 1000)
 * @returns Real-time metrics and control functions
 */
export function useRealTimeMetrics(updateInterval: number = 1000) {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null)
  const [isEnabled, setIsEnabled] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateMetrics = useCallback(() => {
    if (isEnabled) {
      const newMetrics = performanceAnalytics.getRealTimeMetrics()
      setMetrics(newMetrics)
    }
  }, [isEnabled])

  const startUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    updateMetrics() // Initial update
    intervalRef.current = setInterval(updateMetrics, updateInterval)
  }, [updateMetrics, updateInterval])

  const stopUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const toggleUpdates = useCallback(() => {
    setIsEnabled(prev => {
      const newEnabled = !prev
      if (newEnabled) {
        startUpdates()
      } else {
        stopUpdates()
      }
      return newEnabled
    })
  }, [startUpdates, stopUpdates])

  // Start updates when enabled
  useEffect(() => {
    if (isEnabled) {
      startUpdates()
    } else {
      stopUpdates()
    }

    return stopUpdates
  }, [isEnabled, startUpdates, stopUpdates])

  return {
    metrics,
    isEnabled,
    toggleUpdates,
    startUpdates,
    stopUpdates,
    updateMetrics
  }
}

/**
 * Hook for performance alerts
 * 
 * @param onAlert - Callback for when alerts are triggered
 * @returns Alert management functions and state
 */
export function usePerformanceAlerts(
  onAlert?: (alert: PerformanceAlert) => void
) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  // Subscribe to alerts
  useEffect(() => {
    const unsubscribe = performanceAnalytics.onAlert((alert) => {
      setAlerts(prev => {
        // Avoid duplicates
        if (prev.some(a => a.id === alert.id)) {
          return prev
        }
        
        const newAlerts = [...prev, alert]
        
        // Limit alerts history
        if (newAlerts.length > 50) {
          return newAlerts.slice(-50)
        }
        
        return newAlerts
      })
      
      onAlert?.(alert)
    })

    return unsubscribe
  }, [onAlert])

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId))
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, isActive: false } : alert
    ))
  }, [])

  const clearDismissedAlerts = useCallback(() => {
    setDismissedAlerts(new Set())
  }, [])

  const getActiveAlerts = useCallback(() => {
    return alerts.filter(alert => alert.isActive && !dismissedAlerts.has(alert.id))
  }, [alerts, dismissedAlerts])

  const getAlertsByType = useCallback((type: PerformanceAlert['type']) => {
    return alerts.filter(alert => alert.type === type)
  }, [alerts])

  const getAlertsBySeverity = useCallback((severity: PerformanceAlert['severity']) => {
    return alerts.filter(alert => alert.severity === severity)
  }, [alerts])

  return {
    alerts,
    activeAlerts: getActiveAlerts(),
    dismissedAlerts,
    dismissAlert,
    clearDismissedAlerts,
    getAlertsByType,
    getAlertsBySeverity
  }
}

/**
 * Hook for optimization recommendations
 * 
 * @param onRecommendation - Callback for when recommendations are available
 * @returns Recommendation management functions and state
 */
export function useOptimizationRecommendations(
  onRecommendation?: (recommendation: OptimizationRecommendation) => void
) {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [implementedRecommendations, setImplementedRecommendations] = useState<Set<string>>(new Set())

  // Update recommendations periodically
  useEffect(() => {
    const updateRecommendations = () => {
      const report = performanceAnalytics.generateReport(1) // Last hour
      const newRecommendations = report.recommendations

      setRecommendations(prev => {
        // Notify about new recommendations
        newRecommendations.forEach(rec => {
          if (!prev.some(p => p.id === rec.id)) {
            onRecommendation?.(rec)
          }
        })

        return newRecommendations
      })
    }

    updateRecommendations()
    const interval = setInterval(updateRecommendations, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [onRecommendation])

  const implementRecommendation = useCallback((recommendationId: string) => {
    setImplementedRecommendations(prev => new Set(prev).add(recommendationId))
    setRecommendations(prev => prev.map(rec => 
      rec.id === recommendationId 
        ? { ...rec, implemented: true, implementedAt: Date.now() }
        : rec
    ))
  }, [])

  const getRecommendationsByPriority = useCallback((priority: OptimizationRecommendation['priority']) => {
    return recommendations.filter(rec => rec.priority === priority)
  }, [recommendations])

  const getRecommendationsByType = useCallback((type: OptimizationRecommendation['type']) => {
    return recommendations.filter(rec => rec.type === type)
  }, [recommendations])

  const getPendingRecommendations = useCallback(() => {
    return recommendations.filter(rec => !rec.implemented)
  }, [recommendations])

  return {
    recommendations,
    implementedRecommendations,
    pendingRecommendations: getPendingRecommendations(),
    implementRecommendation,
    getRecommendationsByPriority,
    getRecommendationsByType
  }
}

/**
 * Hook for search pattern analytics
 * 
 * @param minFrequency - Minimum frequency for patterns to be considered significant
 * @returns Search pattern analytics and insights
 */
export function useSearchPatternAnalytics(minFrequency: number = 2) {
  const [patterns, setPatterns] = useState<SearchPattern[]>([])
  const [insights, setInsights] = useState<{
    slowPatterns: SearchPattern[]
    popularPatterns: SearchPattern[]
    cacheMissPatterns: SearchPattern[]
    optimizationOpportunities: SearchPattern[]
  }>({
    slowPatterns: [],
    popularPatterns: [],
    cacheMissPatterns: [],
    optimizationOpportunities: []
  })

  // Update patterns periodically
  useEffect(() => {
    const updatePatterns = () => {
      const report = performanceAnalytics.generateReport(6) // Last 6 hours
      const significantPatterns = report.topPatterns.filter(p => p.frequency >= minFrequency)
      
      setPatterns(significantPatterns)
      
      // Generate insights
      const slowPatterns = significantPatterns.filter(p => p.avgQueryTime > 100)
      const popularPatterns = significantPatterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
      const cacheMissPatterns = significantPatterns.filter(p => p.cacheHitRate < 50)
      const optimizationOpportunities = significantPatterns.filter(p => 
        p.optimization && p.optimization !== 'none'
      )

      setInsights({
        slowPatterns,
        popularPatterns,
        cacheMissPatterns,
        optimizationOpportunities
      })
    }

    updatePatterns()
    const interval = setInterval(updatePatterns, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [minFrequency])

  const getPatternTrend = useCallback((query: string) => {
    const pattern = patterns.find(p => p.query === query)
    if (!pattern) return null

    // Simple trend analysis based on recent performance
    const isImproving = pattern.avgQueryTime < 100 && pattern.cacheHitRate > 70
    const isDegrading = pattern.avgQueryTime > 200 || pattern.cacheHitRate < 30
    
    return {
      query: pattern.query,
      trend: isImproving ? 'improving' : isDegrading ? 'degrading' : 'stable',
      metrics: pattern
    }
  }, [patterns])

  const getSimilarPatterns = useCallback((query: string, threshold: number = 0.7) => {
    return patterns.filter(p => {
      if (p.query === query) return false
      
      // Simple similarity check based on common words
      const words1 = query.toLowerCase().split(/\s+/)
      const words2 = p.query.toLowerCase().split(/\s+/)
      const commonWords = words1.filter(w => words2.includes(w))
      
      return commonWords.length / Math.max(words1.length, words2.length) >= threshold
    })
  }, [patterns])

  return {
    patterns,
    insights,
    getPatternTrend,
    getSimilarPatterns
  }
}

/**
 * Hook for integrated performance monitoring
 * 
 * Combines all performance monitoring hooks for comprehensive analytics
 */
export function usePerformanceMonitoring(config?: {
  enableRealTime?: boolean
  enableAlerts?: boolean
  enableRecommendations?: boolean
  enablePatternAnalytics?: boolean
  updateInterval?: number
}) {
  const {
    enableRealTime = true,
    enableAlerts = true,
    enableRecommendations = true,
    enablePatternAnalytics = true,
    updateInterval = 1000
  } = config || {}

  // Real-time metrics
  const realTimeMetrics = useRealTimeMetrics(enableRealTime ? updateInterval : 0)
  
  // Performance alerts
  const alerts = usePerformanceAlerts(
    enableAlerts ? (alert) => {
      console.log('Performance alert:', alert.message)
    } : undefined
  )
  
  // Optimization recommendations
  const recommendations = useOptimizationRecommendations(
    enableRecommendations ? (rec) => {
      console.log('New optimization recommendation:', rec.title)
    } : undefined
  )
  
  // Search pattern analytics
  const patternAnalytics = useSearchPatternAnalytics(enablePatternAnalytics ? 2 : 0)

  // Search tracking utility
  const searchTracking = useSearchPerformanceTracking()

  return {
    realTimeMetrics: enableRealTime ? realTimeMetrics : null,
    alerts: enableAlerts ? alerts : null,
    recommendations: enableRecommendations ? recommendations : null,
    patternAnalytics: enablePatternAnalytics ? patternAnalytics : null,
    searchTracking
  }
}