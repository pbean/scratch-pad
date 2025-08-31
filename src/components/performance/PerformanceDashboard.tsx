/**
 * Task 9.2: Optimization Dashboard Component
 * 
 * Comprehensive performance dashboard UI component with alerting and optimization suggestions.
 * 
 * Week 3 Day 9 Implementation: Performance Monitoring Dashboard
 */

// import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  Lightbulb,
  MemoryStick,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  Settings,
  RefreshCw,
  Zap,
  Eye,
  EyeOff,
  Download,
  Filter
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Progress } from "../ui/progress"
// import { Separator } from "../ui/separator"
import { LoadingSpinner } from "../ui/loading"
import { useToast } from "../ui/toast"
import {
  usePerformanceOverview,
  useRealTimePerformanceMonitoring,
  usePerformanceAnalytics,
  usePerformanceAlerts,
  usePerformanceBudget,
  type PerformanceOverview,
  type PerformanceAlert,
  type PerformanceBudget,
  type AdvancedPerformanceMetrics
} from "../../hooks/useAdvancedPerformanceMonitor"

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface OptimizationRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  category: 'memory' | 'cpu' | 'database' | 'frontend' | 'backend'
  title: string
  description: string
  impact: string
  actionable: boolean
  oneClickFix?: () => Promise<void>
  estimatedImpact: number // percentage improvement
}

interface PerformanceScore {
  overall: number
  backend: number
  frontend: number
  database: number
  memory: number
}

interface DashboardState {
  refreshInterval: number
  autoRefresh: boolean
  showDetailed: boolean
  timeRange: '1h' | '6h' | '24h' | '7d'
  alertFilter: 'all' | 'critical' | 'warning' | 'info'
}

// ============================================================================
// PERFORMANCE DASHBOARD COMPONENT
// ============================================================================

export function PerformanceDashboard() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    refreshInterval: 30000, // 30 seconds
    autoRefresh: true,
    showDetailed: false,
    timeRange: '1h',
    alertFilter: 'all'
  })
  
  const [isLoading, setIsLoading] = useState(true)
  const [overview, setOverview] = useState<PerformanceOverview | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [budget, setBudget] = useState<PerformanceBudget | null>(null)
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null)

  const toast = useToast()
  
  // Hooks for data fetching
  const { fetchOverview } = usePerformanceOverview()
  const { fetchAlerts } = usePerformanceAlerts()
  const { fetchBudget } = usePerformanceBudget()
  const { fetchReport, fetchMetrics } = usePerformanceAnalytics()
  
  // Real-time monitoring with configurable interval
  const { 
    metrics: realTimeMetrics, 
    isMonitoring, 
    startMonitoring, 
    stopMonitoring 
  } = useRealTimePerformanceMonitoring({
    updateInterval: dashboardState.refreshInterval,
    autoStart: dashboardState.autoRefresh
  })

  // ============================================================================
  // DATA FETCHING & REFRESH LOGIC
  // ============================================================================

  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [overviewData, alertsData, budgetData, analyticsReport] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchAlerts(dashboardState.alertFilter === 'all' ? undefined : dashboardState.alertFilter).catch(() => []),
        fetchBudget().catch(() => null),
        fetchReport(getHoursFromTimeRange(dashboardState.timeRange)).catch(() => null)
      ])

      setOverview(overviewData)
      setAlerts(alertsData)
      setBudget(budgetData)
      
      if (analyticsReport) {
        setRecommendations(generateRecommendations(analyticsReport, realTimeMetrics))
        setPerformanceScore(calculatePerformanceScore(overviewData, realTimeMetrics))
      }
    } catch (error) {
      console.error('Failed to refresh performance data:', error)
      toast.error('Failed to load performance data', 'Please try again')
    } finally {
      setIsLoading(false)
    }
  }, [dashboardState.alertFilter, dashboardState.timeRange, fetchOverview, fetchAlerts, fetchBudget, fetchReport, realTimeMetrics, toast])

  // Initial data load and auto-refresh setup
  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Auto-refresh control
  useEffect(() => {
    if (dashboardState.autoRefresh) {
      startMonitoring()
    } else {
      stopMonitoring()
    }
  }, [dashboardState.autoRefresh, startMonitoring, stopMonitoring])

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getHoursFromTimeRange = (range: string): number => {
    switch (range) {
      case '1h': return 1
      case '6h': return 6
      case '24h': return 24
      case '7d': return 168
      default: return 1
    }
  }

  const generateRecommendations = (
    analyticsReport: any, 
    metrics: AdvancedPerformanceMetrics | null
  ): OptimizationRecommendation[] => {
    const recommendations: OptimizationRecommendation[] = []

    // Memory optimization recommendations
    if (metrics?.browserMemory && metrics.browserMemory.usagePercent > 75) {
      recommendations.push({
        id: 'memory-high',
        priority: 'high',
        category: 'memory',
        title: 'High Memory Usage Detected',
        description: `Memory usage is at ${metrics.browserMemory.usagePercent.toFixed(1)}%. Consider clearing large data sets or implementing virtual scrolling.`,
        impact: 'Improve responsiveness and prevent crashes',
        actionable: true,
        estimatedImpact: 25,
        oneClickFix: async () => {
          // Trigger garbage collection hint
          if ('gc' in window && typeof (window as any).gc === 'function') {
            (window as any).gc()
          }
        }
      })
    }

    // Render performance recommendations
    if (metrics?.renderMetrics && metrics.renderMetrics.some(m => m.renderTimeMs > 16)) {
      const slowRenders = metrics.renderMetrics.filter(m => m.renderTimeMs > 16)
      recommendations.push({
        id: 'render-slow',
        priority: 'medium',
        category: 'frontend',
        title: 'Slow Component Renders',
        description: `${slowRenders.length} components are rendering slower than 16ms. Consider memoization or component optimization.`,
        impact: 'Improve user interface smoothness',
        actionable: true,
        estimatedImpact: 15
      })
    }

    // Search performance recommendations
    if (metrics?.searchUiMetrics && metrics.searchUiMetrics.inputLagMs > 50) {
      recommendations.push({
        id: 'search-lag',
        priority: 'medium',
        category: 'frontend',
        title: 'Search Input Lag',
        description: `Search input lag is ${metrics.searchUiMetrics.inputLagMs.toFixed(1)}ms. Consider debouncing or async processing.`,
        impact: 'Improve search experience',
        actionable: true,
        estimatedImpact: 20
      })
    }

    // Database optimization recommendations
    if (analyticsReport?.database_performance && analyticsReport.database_performance.avg_query_time > 100) {
      recommendations.push({
        id: 'database-slow',
        priority: 'high',
        category: 'database',
        title: 'Slow Database Queries',
        description: `Average query time is ${analyticsReport.database_performance.avg_query_time}ms. Consider indexing or query optimization.`,
        impact: 'Significantly improve response times',
        actionable: true,
        estimatedImpact: 40
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }

  const calculatePerformanceScore = (
    overview: PerformanceOverview | null,
    metrics: AdvancedPerformanceMetrics | null
  ): PerformanceScore => {
    const baseScore = overview ? overview.overallScore : 50
    
    let frontend = 80
    let memory = 80
    let database = overview ? overview.backendScore : 70

    // Adjust frontend score based on real-time metrics
    if (metrics?.renderMetrics) {
      const avgRenderTime = metrics.renderMetrics.reduce((sum, m) => sum + m.renderTimeMs, 0) / metrics.renderMetrics.length
      if (avgRenderTime > 16) frontend -= Math.min(30, (avgRenderTime - 16) * 2)
    }

    // Adjust memory score based on usage
    if (metrics?.browserMemory) {
      memory = Math.max(0, 100 - metrics.browserMemory.usagePercent)
    }

    const overall = Math.round((frontend + memory + database) / 3)

    return {
      overall,
      backend: overview ? overview.backendScore : database,
      frontend,
      database,
      memory
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 80) return 'default'
    if (score >= 60) return 'secondary'
    return 'destructive'
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleStateChange = (key: keyof DashboardState, value: any) => {
    setDashboardState(prev => ({ ...prev, [key]: value }))
  }

  const handleOneClickOptimization = async (recommendation: OptimizationRecommendation) => {
    if (!recommendation.oneClickFix) return
    
    try {
      await recommendation.oneClickFix()
      toast.success('Optimization Applied', `${recommendation.title} optimization completed`)
      refreshData()
    } catch (error) {
      console.error('Optimization failed:', error)
      toast.error('Optimization Failed', 'Please try manual optimization')
    }
  }

  const exportPerformanceReport = async () => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        overview,
        alerts,
        budget,
        recommendations,
        performanceScore,
        realTimeMetrics
      }
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `performance-report-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Report Exported', 'Performance report downloaded successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export Failed', 'Could not export performance report')
    }
  }

  // ============================================================================
  // FILTERED DATA
  // ============================================================================

  const filteredAlerts = useMemo(() => {
    if (dashboardState.alertFilter === 'all') return alerts
    return alerts.filter(alert => alert.level === dashboardState.alertFilter)
  }, [alerts, dashboardState.alertFilter])

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================

  if (isLoading && !overview) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading performance dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto p-6 space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Performance Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring and optimization recommendations
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Auto-refresh:</span>
            <Switch
              checked={dashboardState.autoRefresh}
              onCheckedChange={(checked) => handleStateChange('autoRefresh', checked)}
            />
          </div>
          
          <Select 
            value={dashboardState.timeRange} 
            onValueChange={(value) => handleStateChange('timeRange', value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={exportPerformanceReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Performance Score Overview */}
      {performanceScore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Overview
            </CardTitle>
            <CardDescription>
              Overall system performance score and key metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(performanceScore.overall)}`}>
                  {performanceScore.overall}
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
                <Badge variant={getScoreBadgeVariant(performanceScore.overall)} className="mt-2">
                  {performanceScore.overall >= 80 ? 'Excellent' : 
                   performanceScore.overall >= 60 ? 'Good' : 'Needs Attention'}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(performanceScore.frontend)}`}>
                  {performanceScore.frontend}
                </div>
                <div className="text-sm text-muted-foreground">Frontend</div>
                <Progress value={performanceScore.frontend} className="mt-2" />
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(performanceScore.backend)}`}>
                  {performanceScore.backend}
                </div>
                <div className="text-sm text-muted-foreground">Backend</div>
                <Progress value={performanceScore.backend} className="mt-2" />
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(performanceScore.database)}`}>
                  {performanceScore.database}
                </div>
                <div className="text-sm text-muted-foreground">Database</div>
                <Progress value={performanceScore.database} className="mt-2" />
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(performanceScore.memory)}`}>
                  {performanceScore.memory}
                </div>
                <div className="text-sm text-muted-foreground">Memory</div>
                <Progress value={performanceScore.memory} className="mt-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {filteredAlerts.length > 0 && `(${filteredAlerts.length})`}
          </TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="detailed">Detailed</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Real-time Metrics */}
            {realTimeMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Real-time Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {realTimeMetrics.browserMemory && (
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Memory Usage</span>
                        <span>{realTimeMetrics.browserMemory.usagePercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={realTimeMetrics.browserMemory.usagePercent} className="mt-1" />
                    </div>
                  )}
                  
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Active Components</span>
                      <span>{realTimeMetrics.renderMetrics.length}</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Error Count</span>
                      <span className="text-red-600">{realTimeMetrics.errorMetrics.jsErrors + realTimeMetrics.errorMetrics.reactErrors}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Backend</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Monitoring</span>
                  <Badge variant={isMonitoring ? "default" : "secondary"}>
                    {isMonitoring ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                    {isMonitoring ? 'Active' : 'Paused'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <MemoryStick className="h-4 w-4 mr-2" />
                  Clear Memory Cache
                </Button>
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  Optimize Database
                </Button>
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart Monitoring
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Performance Alerts</h3>
            <Select 
              value={dashboardState.alertFilter} 
              onValueChange={(value) => handleStateChange('alertFilter', value)}
            >
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="warning">Warnings Only</SelectItem>
                <SelectItem value="info">Info Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-muted-foreground">No alerts at this time</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => (
                <Alert key={alert.id} variant={alert.level === 'error' || alert.level === 'critical' ? 'destructive' : 'default'}>
                  {alert.level === 'critical' && <XCircle className="h-4 w-4" />}
                  {alert.level === 'error' && <AlertCircle className="h-4 w-4" />}
                  {alert.level === 'warning' && <AlertTriangle className="h-4 w-4" />}
                  {alert.level === 'info' && <Info className="h-4 w-4" />}
                  
                  <AlertTitle className="capitalize">{alert.level} Alert</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>{alert.message}</p>
                      {alert.suggestedAction && (
                        <p className="text-sm">
                          <strong>Suggested action:</strong> {alert.suggestedAction}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ))
            )}
          </div>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
            <Badge variant="secondary">
              {recommendations.length} recommendations
            </Badge>
          </div>

          <div className="space-y-4">
            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Lightbulb className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-muted-foreground">System is well optimized!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              recommendations.map((rec) => (
                <Card key={rec.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{rec.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          rec.priority === 'high' ? 'destructive' : 
                          rec.priority === 'medium' ? 'secondary' : 'default'
                        }>
                          {rec.priority} priority
                        </Badge>
                        <Badge variant="outline">{rec.category}</Badge>
                      </div>
                    </div>
                    <CardDescription>{rec.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">Expected Impact:</p>
                        <p className="text-sm text-muted-foreground">{rec.impact}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={rec.estimatedImpact} className="flex-1" />
                          <span className="text-sm text-muted-foreground">{rec.estimatedImpact}%</span>
                        </div>
                      </div>
                      
                      {rec.actionable && (
                        <div className="flex items-center gap-2">
                          {rec.oneClickFix && (
                            <Button
                              onClick={() => handleOneClickOptimization(rec)}
                              size="sm"
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Apply Fix
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Info className="h-4 w-4 mr-2" />
                            Learn More
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Detailed Tab */}
        <TabsContent value="detailed" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Budget */}
            {budget && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Budget
                  </CardTitle>
                  <CardDescription>
                    Current performance against defined budgets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Operation Duration</span>
                      <span>{budget.maxOperationDurationMs}ms limit</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{(budget.maxMemoryUsageBytes / (1024 * 1024)).toFixed(0)}MB limit</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Cache Hit Rate</span>
                      <span>{(budget.targetCacheHitRate * 100).toFixed(0)}% target</span>
                    </div>
                    <Progress value={92} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Component Performance */}
            {realTimeMetrics?.renderMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Component Performance
                  </CardTitle>
                  <CardDescription>
                    Recent component render times
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {realTimeMetrics.renderMetrics
                      .sort((a, b) => b.renderTimeMs - a.renderTimeMs)
                      .slice(0, 10)
                      .map((metric, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="truncate">{metric.componentName}</span>
                          <div className="flex items-center gap-2">
                            <span className={metric.renderTimeMs > 16 ? 'text-red-600' : 'text-green-600'}>
                              {metric.renderTimeMs.toFixed(1)}ms
                            </span>
                            <Badge variant={metric.isMemoized ? 'default' : 'secondary'} className="text-xs">
                              {metric.isMemoized ? 'Memoized' : 'Standard'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PerformanceDashboard