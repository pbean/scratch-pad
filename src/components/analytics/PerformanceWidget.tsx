/**
 * Performance Widget - Week 2 Day 4
 * 
 * Compact performance analytics widget for integration into search components.
 * Provides real-time performance insights with minimal visual footprint
 * and <1ms overhead per operation.
 */

import React, { memo, useState, useEffect } from 'react'
import { Activity, AlertTriangle, BarChart3, Clock, Database, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import type { RealTimeMetrics, PerformanceAlert } from '../../types/analytics'
import { useRealTimeMetrics, usePerformanceAlerts } from '../../hooks/usePerformanceMonitoring'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

interface PerformanceWidgetProps {
  /** Whether to show in compact mode */
  compact?: boolean
  /** CSS class name */
  className?: string
  /** Whether to show detailed metrics */
  showDetails?: boolean
  /** Update interval in milliseconds */
  updateInterval?: number
  /** Callback when widget is clicked */
  onClick?: () => void
  /** Whether to show alerts */
  showAlerts?: boolean
}

// Status indicator component
const StatusIndicator = memo<{
  status: RealTimeMetrics['status']
  size?: 'sm' | 'md' | 'lg'
}>(({ status, size = 'sm' }) => {
  const getStatusColor = (status: RealTimeMetrics['status']) => {
    switch (status) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-blue-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const sizeClass = size === 'lg' ? 'w-3 h-3' : size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`rounded-full ${getStatusColor(status)} ${sizeClass} animate-pulse`} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="capitalize">Performance: {status}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

StatusIndicator.displayName = 'StatusIndicator'

// Compact metric display
const MetricDisplay = memo<{
  icon: React.ReactNode
  value: string | number
  label: string
  trend?: 'up' | 'down' | 'stable'
  critical?: boolean
}>(({ icon, value, label, trend, critical }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️'
      case 'down': return '↘️'
      case 'stable': return '➡️'
      default: return null
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
            critical ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'
          }`}>
            {icon}
            <span className="font-mono">{value}</span>
            {trend && <span className="text-xs">{getTrendIcon()}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

MetricDisplay.displayName = 'MetricDisplay'

// Alert indicator
const AlertIndicator = memo<{
  alerts: PerformanceAlert[]
  onClick?: () => void
}>(({ alerts, onClick }) => {
  const activeAlerts = alerts.filter(a => a.isActive)
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'error')
  const warningAlerts = activeAlerts.filter(a => a.severity === 'warning')

  if (activeAlerts.length === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${
              criticalAlerts.length > 0 
                ? 'text-red-600 hover:text-red-700' 
                : 'text-yellow-600 hover:text-yellow-700'
            }`}
            onClick={onClick}
          >
            <AlertTriangle size={12} className="mr-1" />
            {activeAlerts.length}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}</p>
            {criticalAlerts.length > 0 && (
              <p className="text-red-600 text-xs">{criticalAlerts.length} critical</p>
            )}
            {warningAlerts.length > 0 && (
              <p className="text-yellow-600 text-xs">{warningAlerts.length} warning</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

AlertIndicator.displayName = 'AlertIndicator'

// Main widget component
export const PerformanceWidget = memo<PerformanceWidgetProps>(({
  compact = false,
  className = '',
  showDetails = false,
  updateInterval = 2000,
  onClick,
  showAlerts = true
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Use performance monitoring hooks
  const realTimeMetrics = useRealTimeMetrics(updateInterval)
  const alerts = usePerformanceAlerts()

  // Update timestamp when metrics change
  useEffect(() => {
    if (realTimeMetrics.metrics) {
      setLastUpdate(new Date())
    }
  }, [realTimeMetrics.metrics])

  const metrics = realTimeMetrics.metrics
  
  if (!metrics) {
    return (
      <div className={`performance-widget flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <Activity size={12} className="animate-spin" />
        <span>Loading analytics...</span>
      </div>
    )
  }

  // Determine critical metrics
  const isCritical = metrics.status === 'critical' || metrics.activeAlertsCount > 0
  const isSlowQuery = metrics.recentAvgQueryTime > 100
  const isLowCacheHit = metrics.currentCacheHitRate < 50

  if (compact && !isExpanded) {
    return (
      <div className={`performance-widget flex items-center gap-2 ${className}`}>
        <StatusIndicator status={metrics.status} />
        
        <MetricDisplay
          icon={<Clock size={10} />}
          value={`${metrics.recentAvgQueryTime}ms`}
          label="Average query time (last minute)"
          critical={isSlowQuery}
        />
        
        <MetricDisplay
          icon={<Database size={10} />}
          value={`${metrics.currentCacheHitRate}%`}
          label="Cache hit rate"
          critical={isLowCacheHit}
        />

        {showAlerts && alerts && (
          <AlertIndicator alerts={alerts.alerts} onClick={onClick} />
        )}

        {onClick && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-xs"
            onClick={() => setIsExpanded(true)}
          >
            <ChevronDown size={12} />
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className={`performance-widget ${className}`}>
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} />
              <span className="text-sm font-medium">Performance</span>
              <StatusIndicator status={metrics.status} size="md" />
            </div>
            
            <div className="flex items-center gap-2">
              {showAlerts && alerts && (
                <AlertIndicator alerts={alerts.alerts} onClick={onClick} />
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </Button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Query Time</span>
                <span className={`font-mono ${isSlowQuery ? 'text-red-600' : ''}`}>
                  {metrics.recentAvgQueryTime}ms
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cache Hit</span>
                <span className={`font-mono ${isLowCacheHit ? 'text-yellow-600' : 'text-green-600'}`}>
                  {metrics.currentCacheHitRate}%
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">QPS</span>
                <span className="font-mono">{metrics.queriesPerSecond.toFixed(1)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-mono flex items-center gap-1">
                  {metrics.memoryTrend === 'increasing' ? '📈' : 
                   metrics.memoryTrend === 'decreasing' ? '📉' : '➡️'}
                  {metrics.memoryTrend}
                </span>
              </div>
            </div>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={
                  metrics.status === 'excellent' ? 'default' :
                  metrics.status === 'good' ? 'secondary' :
                  metrics.status === 'warning' ? 'outline' : 'destructive'
                }>
                  {metrics.status}
                </Badge>
              </div>
              
              {metrics.activeAlertsCount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Active Alerts</span>
                  <span className="text-red-600 font-medium">
                    {metrics.activeAlertsCount}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last Update</span>
                <span>{lastUpdate.toLocaleTimeString()}</span>
              </div>
              
              {onClick && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onClick}
                >
                  <BarChart3 size={12} className="mr-1" />
                  View Dashboard
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

PerformanceWidget.displayName = 'PerformanceWidget'

// Minimal status bar component
export const PerformanceStatusBar = memo<{
  className?: string
  onClick?: () => void
}>(({ className = '', onClick }) => {
  const realTimeMetrics = useRealTimeMetrics(5000) // Update every 5 seconds
  const alerts = usePerformanceAlerts()

  const metrics = realTimeMetrics.metrics
  
  if (!metrics) return null

  const hasIssues = metrics.status === 'critical' || metrics.status === 'warning' || metrics.activeAlertsCount > 0

  return (
    <div className={`performance-status-bar flex items-center gap-2 text-xs ${className}`}>
      <StatusIndicator status={metrics.status} />
      
      <span className="text-muted-foreground">
        {metrics.recentAvgQueryTime}ms
      </span>
      
      {hasIssues && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-xs text-yellow-600 hover:text-yellow-700"
          onClick={onClick}
        >
          <AlertTriangle size={10} className="mr-1" />
          {metrics.activeAlertsCount || 'Issue'}
        </Button>
      )}
    </div>
  )
})

PerformanceStatusBar.displayName = 'PerformanceStatusBar'