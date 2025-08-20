/**
 * Performance Analytics Dashboard - Week 2 Day 4
 * 
 * Comprehensive real-time performance monitoring dashboard providing insights
 * into search performance, cache efficiency, and system optimization opportunities.
 * Built for minimal performance overhead (<1ms per operation).
 */

import { memo, useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  Lightbulb,
  MemoryStick,
  // Search,
  // Settings,
  TrendingUp,
  // Zap,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle
} from 'lucide-react'
import type {
  AnalyticsDashboardProps,
  PerformanceReport,
  RealTimeMetrics,
  PerformanceAlert,
  OptimizationRecommendation,
  PerformanceTrend
} from '../../types/analytics'
import { performanceAnalytics } from '../../lib/analytics/performanceAnalytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Progress } from '../ui/progress'

// Sub-components
const RealTimeMetricsPanel = memo<{
  metrics: RealTimeMetrics
  className?: string
}>(({ metrics, className = '' }) => {
  const getStatusColor = (status: RealTimeMetrics['status']) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: RealTimeMetrics['status']) => {
    switch (status) {
      case 'excellent': return <CheckCircle size={16} />
      case 'good': return <Info size={16} />
      case 'warning': return <AlertTriangle size={16} />
      case 'critical': return <XCircle size={16} />
      default: return <Activity size={16} />
    }
  }

  const formatTrend = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈'
      case 'decreasing': return '📉'
      case 'stable': return '➡️'
      default: return '➡️'
    }
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.status)}`}>
            {getStatusIcon(metrics.status)}
            {metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.recentAvgQueryTime}ms</div>
          <p className="text-xs text-muted-foreground">Last minute average</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.currentCacheHitRate}%</div>
          <Progress value={metrics.currentCacheHitRate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Trend</CardTitle>
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTrend(metrics.memoryTrend)}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.activeAlertsCount} active alert{metrics.activeAlertsCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
})

RealTimeMetricsPanel.displayName = 'RealTimeMetricsPanel'

const PerformanceTrendsChart = memo<{
  trends: PerformanceTrend[]
  className?: string
}>(({ trends, className = '' }) => {
  const maxQueryTime = Math.max(...trends.map(t => t.avgQueryTime), 100)
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={16} />
          Performance Trends
        </CardTitle>
        <CardDescription>Query time and cache performance over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {trends.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No trend data available yet. Search some notes to see performance trends.
            </div>
          ) : (
            <div className="space-y-2">
              {trends.map((trend, index) => (
                <div key={index} className="flex items-center gap-4 p-2 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground w-16">
                    -{trend.period * (trends.length - index)}m
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{trend.avgQueryTime}ms avg</span>
                      <span className="text-xs text-muted-foreground">
                        {trend.queryCount} queries
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Progress 
                        value={(trend.avgQueryTime / maxQueryTime) * 100} 
                        className="flex-1 h-2"
                      />
                      <div className="text-xs text-muted-foreground w-12">
                        {trend.cacheHitRate}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

PerformanceTrendsChart.displayName = 'PerformanceTrendsChart'

const AlertsPanel = memo<{
  alerts: PerformanceAlert[]
  onDismiss?: (alertId: string) => void
  className?: string
}>(({ alerts, onDismiss, className = '' }) => {
  const getAlertVariant = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'error': return 'destructive'
      case 'warning': return 'default'
      case 'info': return 'default'
      default: return 'default'
    }
  }

  const getAlertIcon = (severity: PerformanceAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle size={16} />
      case 'error': return <AlertCircle size={16} />
      case 'warning': return <AlertTriangle size={16} />
      case 'info': return <Info size={16} />
      default: return <Info size={16} />
    }
  }

  const activeAlerts = alerts.filter(a => a.isActive)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={16} />
          Performance Alerts
          {activeAlerts.length > 0 && (
            <Badge variant="destructive">{activeAlerts.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>Real-time performance issue notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
              No active performance alerts
            </div>
          ) : (
            activeAlerts.map((alert) => (
              <Alert key={alert.id} variant={getAlertVariant(alert.severity)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getAlertIcon(alert.severity)}
                    <div>
                      <AlertTitle className="text-sm">
                        {alert.type.replace(/_/g, ' ').toUpperCase()}
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1">
                        {alert.message}
                        {alert.suggestion && (
                          <div className="mt-2 text-xs opacity-80">
                            💡 {alert.suggestion}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(alert.id)}
                      className="text-xs"
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </Alert>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
})

AlertsPanel.displayName = 'AlertsPanel'

const OptimizationRecommendations = memo<{
  recommendations: OptimizationRecommendation[]
  onImplement?: (recommendationId: string) => void
  className?: string
}>(({ recommendations, onImplement, className = '' }) => {
  const getPriorityColor = (priority: OptimizationRecommendation['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getComplexityIcon = (complexity: OptimizationRecommendation['complexity']) => {
    switch (complexity) {
      case 'low': return '🟢'
      case 'medium': return '🟡'
      case 'high': return '🔴'
      default: return '⚪'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb size={16} />
          Optimization Recommendations
          {recommendations.length > 0 && (
            <Badge variant="secondary">{recommendations.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>Actionable performance improvement suggestions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
              No optimization recommendations at this time
            </div>
          ) : (
            recommendations.map((rec) => (
              <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{rec.title}</h4>
                      <Badge className={`text-xs ${getPriorityColor(rec.priority)}`}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {rec.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>📈 {rec.expectedImprovement}</span>
                      <span>{getComplexityIcon(rec.complexity)} {rec.complexity} complexity</span>
                    </div>
                  </div>
                  {onImplement && !rec.implemented && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onImplement(rec.id)}
                      className="text-xs"
                    >
                      Implement
                    </Button>
                  )}
                </div>
                {rec.implemented && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle size={12} />
                    Implemented on {new Date(rec.implementedAt!).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
})

OptimizationRecommendations.displayName = 'OptimizationRecommendations'

// Main Dashboard Component
export const PerformanceAnalyticsDashboard = memo<AnalyticsDashboardProps>(({
  config = {},
  className = '',
  compact = false,
  onAlert,
  onRecommendation,
  onMetricUpdate
}) => {
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  // Initialize performance analytics with config
  useEffect(() => {
    performanceAnalytics.updateConfig(config)
  }, [config])

  // Subscribe to alerts and metrics
  useEffect(() => {
    const unsubscribeAlerts = performanceAnalytics.onAlert((alert) => {
      onAlert?.(alert)
    })

    const unsubscribeMetrics = performanceAnalytics.onMetricsUpdate((metrics) => {
      setRealTimeMetrics(metrics)
      onMetricUpdate?.(metrics)
    })

    return () => {
      unsubscribeAlerts()
      unsubscribeMetrics()
    }
  }, [onAlert, onMetricUpdate])

  // Load performance data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168
      const newReport = performanceAnalytics.generateReport(hours)
      const newMetrics = performanceAnalytics.getRealTimeMetrics()
      
      setReport(newReport)
      setRealTimeMetrics(newMetrics)
    } catch (error) {
      console.error('Failed to load performance data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [timeRange])

  // Initial load and auto-refresh
  useEffect(() => {
    loadData()
    
    if (autoRefresh) {
      const interval = setInterval(loadData, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [loadData, autoRefresh])

  // Handle alert dismissal
  const handleDismissAlert = useCallback((alertId: string) => {
    // In a real implementation, you would mark the alert as dismissed
    console.log('Dismissing alert:', alertId)
  }, [])

  // Handle recommendation implementation
  const handleImplementRecommendation = useCallback((recommendationId: string) => {
    onRecommendation?.(report?.recommendations.find(r => r.id === recommendationId)!)
    console.log('Implementing recommendation:', recommendationId)
  }, [onRecommendation, report])

  // Memoized summary stats
  const summaryStats = useMemo(() => {
    if (!report) return null

    return {
      totalQueries: report.summary.totalQueries,
      avgResponseTime: report.summary.avgQueryTime,
      cacheEfficiency: report.summary.cacheHitRate,
      activeIssues: report.alerts.length,
      improvementOpportunities: report.recommendations.length
    }
  }, [report])

  if (isLoading && !report) {
    return (
      <div className={`performance-analytics-dashboard ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="animate-spin" size={20} />
            Loading performance analytics...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`performance-analytics-dashboard ${compact ? 'space-y-3' : 'space-y-6'} ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 size={24} />
            Performance Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time search performance monitoring and optimization insights
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="6h">6h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <label htmlFor="auto-refresh" className="text-sm">Auto-refresh</label>
          </div>
          
          <Button variant="outline" size="sm" onClick={loadData}>
            <Activity size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Real-time metrics */}
      {realTimeMetrics && (
        <RealTimeMetricsPanel metrics={realTimeMetrics} />
      )}

      {/* Summary stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summaryStats.totalQueries}</div>
              <div className="text-xs text-muted-foreground">Total Queries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summaryStats.avgResponseTime}ms</div>
              <div className="text-xs text-muted-foreground">Avg Response Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summaryStats.cacheEfficiency}%</div>
              <div className="text-xs text-muted-foreground">Cache Efficiency</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summaryStats.activeIssues}</div>
              <div className="text-xs text-muted-foreground">Active Issues</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summaryStats.improvementOpportunities}</div>
              <div className="text-xs text-muted-foreground">Opportunities</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed analytics tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report && (
              <>
                <PerformanceTrendsChart trends={report.trends} />
                <AlertsPanel 
                  alerts={report.alerts} 
                  onDismiss={handleDismissAlert}
                />
              </>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="trends" className="space-y-4">
          {report && (
            <PerformanceTrendsChart trends={report.trends} />
          )}
        </TabsContent>
        
        <TabsContent value="alerts" className="space-y-4">
          {report && (
            <AlertsPanel 
              alerts={report.alerts} 
              onDismiss={handleDismissAlert}
            />
          )}
        </TabsContent>
        
        <TabsContent value="optimization" className="space-y-4">
          {report && (
            <OptimizationRecommendations 
              recommendations={report.recommendations}
              onImplement={handleImplementRecommendation}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
})

PerformanceAnalyticsDashboard.displayName = 'PerformanceAnalyticsDashboard'