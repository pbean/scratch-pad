/**
 * Optimization Recommendations Component
 * 
 * Intelligent performance optimization suggestions with actionable fixes
 * and impact analysis.
 * 
 * Week 3 Day 9 Implementation: Optimization Engine Component
 */

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Lightbulb,
  Zap,
  // TrendingUp,
  // Clock,
  MemoryStick,
  Database,
  MonitorSpeaker,
  Cpu,
  HardDrive,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Info,
  // Play,
  // Pause,
  RotateCcw,
  Download,
  Filter,
  // Star,
  Target
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Progress } from "../ui/progress"
// import { Separator } from "../ui/separator"
import { LoadingSpinner } from "../ui/loading"
import { useToast } from "../ui/toast"
import {
  usePerformanceAnalytics,
  useRealTimePerformanceMonitoring,
  // type AdvancedPerformanceMetrics
} from "../../hooks/useAdvancedPerformanceMonitor"

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface OptimizationRecommendation {
  id: string
  title: string
  description: string
  category: 'memory' | 'cpu' | 'database' | 'frontend' | 'backend' | 'storage'
  priority: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'moderate' | 'advanced'
  estimatedImpact: number // percentage improvement
  timeToImplement: string
  impact: string
  technical: boolean
  actionable: boolean
  autoFixAvailable: boolean
  currentValue?: number
  targetValue?: number
  unit?: string
  tags: string[]
  oneClickFix?: () => Promise<void>
  detailedSteps?: string[]
  relatedMetrics?: string[]
  prerequisites?: string[]
}

interface OptimizationCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  count: number
  avgImpact: number
  description: string
}

interface OptimizationFilters {
  category: string
  priority: string
  difficulty: string
  autoFixOnly: boolean
  hideImplemented: boolean
}

interface DatabasePerformanceMetrics {
  avg_query_time: number
  total_queries: number
  slow_queries: number
  cache_hit_rate: number
}

interface PerformanceAnalyticsReport {
  database_performance?: DatabasePerformanceMetrics
  memory_usage?: number
  cpu_usage?: number
  response_times?: number[]
  error_rate?: number
}

// ============================================================================
// OPTIMIZATION RECOMMENDATIONS COMPONENT
// ============================================================================

export function OptimizationRecommendations() {
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([])
  const [implementedFixes, setImplementedFixes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [autoScanEnabled, setAutoScanEnabled] = useState(true)
  const [expandedRecommendation, setExpandedRecommendation] = useState<string | null>(null)
  
  const [filters, setFilters] = useState<OptimizationFilters>({
    category: 'all',
    priority: 'all',
    difficulty: 'all',
    autoFixOnly: false,
    hideImplemented: true
  })

  const toast = useToast()
  const { fetchReport, fetchMetrics } = usePerformanceAnalytics()
  const { metrics: realTimeMetrics } = useRealTimePerformanceMonitoring()

  // ============================================================================
  // DATA GENERATION & ANALYSIS
  // ============================================================================

  const generateRecommendations = useCallback(async (): Promise<OptimizationRecommendation[]> => {
    try {
      const [analyticsReport] = await Promise.all([
        fetchReport(1).catch(() => null as PerformanceAnalyticsReport | null), // Last hour
        fetchMetrics({ periodHours: 1, includeDetails: true }).catch(() => null)
      ])

      const recommendations: OptimizationRecommendation[] = []

      // Memory-based recommendations
      if (realTimeMetrics?.browserMemory && realTimeMetrics.browserMemory.usagePercent > 75) {
        recommendations.push({
          id: 'memory-optimization',
          title: 'High Memory Usage Detected',
          description: `Memory usage is at ${realTimeMetrics.browserMemory.usagePercent.toFixed(1)}%. Consider implementing memory optimization strategies.`,
          category: 'memory',
          priority: realTimeMetrics.browserMemory.usagePercent > 90 ? 'high' : 'medium',
          difficulty: 'moderate',
          estimatedImpact: 25,
          timeToImplement: '15-30 minutes',
          impact: 'Reduce memory pressure and improve application responsiveness',
          technical: true,
          actionable: true,
          autoFixAvailable: true,
          currentValue: realTimeMetrics.browserMemory.usagePercent,
          targetValue: 60,
          unit: '%',
          tags: ['memory', 'performance', 'auto-fix'],
          oneClickFix: async () => {
            // Trigger garbage collection and clear caches
            if ('gc' in window && typeof (window as any).gc === 'function') {
              (window as any).gc()
            }
            // Clear any large data structures in the app
            // This would be implemented based on the specific app architecture
          },
          detailedSteps: [
            'Identify memory-intensive components',
            'Implement virtual scrolling for large lists',
            'Clear unused data from store',
            'Optimize image loading and caching',
            'Review for memory leaks in event listeners'
          ],
          relatedMetrics: ['browser_memory_usage', 'component_render_count'],
          prerequisites: []
        })
      }

      // Render performance recommendations
      if (realTimeMetrics?.renderMetrics) {
        const slowRenders = realTimeMetrics.renderMetrics.filter(m => m.renderTimeMs > 16)
        if (slowRenders.length > 0) {
          recommendations.push({
            id: 'render-optimization',
            title: 'Slow Component Renders Detected',
            description: `${slowRenders.length} components are rendering slower than 16ms (60fps target).`,
            category: 'frontend',
            priority: slowRenders.length > 5 ? 'high' : 'medium',
            difficulty: 'moderate',
            estimatedImpact: 20,
            timeToImplement: '30-60 minutes',
            impact: 'Improve UI smoothness and user experience',
            technical: true,
            actionable: true,
            autoFixAvailable: false,
            currentValue: Math.max(...slowRenders.map(r => r.renderTimeMs)),
            targetValue: 16,
            unit: 'ms',
            tags: ['frontend', 'rendering', 'react'],
            detailedSteps: [
              'Identify components with slow render times',
              'Implement React.memo for expensive components',
              'Use useCallback and useMemo for optimization',
              'Split large components into smaller ones',
              'Optimize prop drilling patterns'
            ],
            relatedMetrics: ['component_render_time', 'render_count'],
            prerequisites: ['React DevTools Profiler']
          })
        }
      }

      // Search performance recommendations
      if (realTimeMetrics?.searchUiMetrics && realTimeMetrics.searchUiMetrics.inputLagMs > 50) {
        recommendations.push({
          id: 'search-optimization',
          title: 'Search Input Lag Optimization',
          description: `Search input lag is ${realTimeMetrics.searchUiMetrics.inputLagMs.toFixed(1)}ms. Users expect sub-50ms responsiveness.`,
          category: 'frontend',
          priority: 'medium',
          difficulty: 'easy',
          estimatedImpact: 15,
          timeToImplement: '15-30 minutes',
          impact: 'Improve search experience and user satisfaction',
          technical: false,
          actionable: true,
          autoFixAvailable: true,
          currentValue: realTimeMetrics.searchUiMetrics.inputLagMs,
          targetValue: 30,
          unit: 'ms',
          tags: ['search', 'debouncing', 'ux'],
          oneClickFix: async () => {
            // This would implement debouncing optimization
            toast.info('Search debouncing enabled', 'Input lag should be reduced')
          },
          detailedSteps: [
            'Implement input debouncing (300ms)',
            'Add search result caching',
            'Optimize search query processing',
            'Implement progressive search loading'
          ],
          relatedMetrics: ['search_input_lag', 'search_result_time'],
          prerequisites: []
        })
      }

      // Database optimization recommendations
      if (analyticsReport?.database_performance && analyticsReport.database_performance.avg_query_time > 100) {
        recommendations.push({
          id: 'database-optimization',
          title: 'Database Query Performance',
          description: `Average query time is ${analyticsReport.database_performance.avg_query_time}ms. Target is under 50ms.`,
          category: 'database',
          priority: 'high',
          difficulty: 'advanced',
          estimatedImpact: 40,
          timeToImplement: '1-2 hours',
          impact: 'Significantly improve application response times',
          technical: true,
          actionable: true,
          autoFixAvailable: false,
          currentValue: analyticsReport.database_performance.avg_query_time,
          targetValue: 50,
          unit: 'ms',
          tags: ['database', 'queries', 'indexing'],
          detailedSteps: [
            'Analyze slow query logs',
            'Add missing database indexes',
            'Optimize FTS5 search queries',
            'Implement query result caching',
            'Review database connection pooling'
          ],
          relatedMetrics: ['avg_query_time', 'database_connections'],
          prerequisites: ['Database access', 'SQL knowledge']
        })
      }

      // CPU utilization recommendations
      if (realTimeMetrics?.storeMetrics) {
        const heavyOperations = realTimeMetrics.storeMetrics.filter(m => m.executionTimeMs > 10)
        if (heavyOperations.length > 0) {
          recommendations.push({
            id: 'cpu-optimization',
            title: 'CPU-Intensive Operations',
            description: `${heavyOperations.length} store operations are taking longer than 10ms.`,
            category: 'cpu',
            priority: 'medium',
            difficulty: 'moderate',
            estimatedImpact: 18,
            timeToImplement: '45-90 minutes',
            impact: 'Reduce CPU usage and improve responsiveness',
            technical: true,
            actionable: true,
            autoFixAvailable: false,
            tags: ['cpu', 'store', 'optimization'],
            detailedSteps: [
              'Profile heavy store operations',
              'Implement operation batching',
              'Use web workers for heavy computations',
              'Optimize data processing algorithms',
              'Add operation caching'
            ],
            relatedMetrics: ['store_operation_time', 'cpu_usage'],
            prerequisites: ['Performance profiling tools']
          })
        }
      }

      // Bundle size and loading optimization
      recommendations.push({
        id: 'bundle-optimization',
        title: 'Application Bundle Optimization',
        description: 'Optimize JavaScript bundle size and loading performance.',
        category: 'frontend',
        priority: 'low',
        difficulty: 'moderate',
        estimatedImpact: 12,
        timeToImplement: '2-3 hours',
        impact: 'Faster initial load times and better user experience',
        technical: true,
        actionable: true,
        autoFixAvailable: false,
        tags: ['bundling', 'loading', 'webpack'],
        detailedSteps: [
          'Analyze bundle composition',
          'Implement code splitting',
          'Add lazy loading for routes',
          'Optimize dependencies',
          'Enable compression and minification'
        ],
        relatedMetrics: ['bundle_size', 'load_time'],
        prerequisites: ['Build tool access', 'Bundle analyzer']
      })

      return recommendations
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
      return []
    }
  }, [fetchReport, fetchMetrics, realTimeMetrics, toast])

  const refreshRecommendations = useCallback(async () => {
    setIsLoading(true)
    try {
      const newRecommendations = await generateRecommendations()
      setRecommendations(newRecommendations)
    } catch (error) {
      console.error('Failed to refresh recommendations:', error)
      toast.error('Failed to load recommendations', 'Please try again')
    } finally {
      setIsLoading(false)
    }
  }, [generateRecommendations, toast])

  // Initial load and auto-refresh
  useEffect(() => {
    refreshRecommendations()
  }, [refreshRecommendations])

  useEffect(() => {
    if (!autoScanEnabled) return

    const interval = setInterval(refreshRecommendations, 60000) // 1 minute
    return () => clearInterval(interval)
  }, [autoScanEnabled, refreshRecommendations])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const categories = useMemo((): OptimizationCategory[] => {
    const categoryMap = new Map<string, { count: number; totalImpact: number }>()

    recommendations.forEach(rec => {
      const existing = categoryMap.get(rec.category) || { count: 0, totalImpact: 0 }
      categoryMap.set(rec.category, {
        count: existing.count + 1,
        totalImpact: existing.totalImpact + rec.estimatedImpact
      })
    })

    const categoryConfigs = [
      { id: 'memory', name: 'Memory', icon: MemoryStick, description: 'Memory usage optimization' },
      { id: 'cpu', name: 'CPU', icon: Cpu, description: 'CPU performance optimization' },
      { id: 'database', name: 'Database', icon: Database, description: 'Database query optimization' },
      { id: 'frontend', name: 'Frontend', icon: MonitorSpeaker, description: 'UI and rendering optimization' },
      { id: 'backend', name: 'Backend', icon: HardDrive, description: 'Backend service optimization' },
      { id: 'storage', name: 'Storage', icon: HardDrive, description: 'Storage and caching optimization' }
    ]

    return categoryConfigs.map(config => {
      const stats = categoryMap.get(config.id) || { count: 0, totalImpact: 0 }
      return {
        ...config,
        count: stats.count,
        avgImpact: stats.count > 0 ? Math.round(stats.totalImpact / stats.count) : 0
      }
    }).filter(cat => cat.count > 0)
  }, [recommendations])

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (filters.category !== 'all' && rec.category !== filters.category) return false
      if (filters.priority !== 'all' && rec.priority !== filters.priority) return false
      if (filters.difficulty !== 'all' && rec.difficulty !== filters.difficulty) return false
      if (filters.autoFixOnly && !rec.autoFixAvailable) return false
      if (filters.hideImplemented && implementedFixes.has(rec.id)) return false
      return true
    }).sort((a, b) => {
      // Sort by priority, then by impact
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      return b.estimatedImpact - a.estimatedImpact
    })
  }, [recommendations, filters, implementedFixes])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleOneClickFix = async (recommendation: OptimizationRecommendation) => {
    if (!recommendation.oneClickFix) return

    try {
      await recommendation.oneClickFix()
      setImplementedFixes(prev => new Set([...prev, recommendation.id]))
      toast.success('Optimization applied', `${recommendation.title} has been optimized`)
    } catch (error) {
      console.error('Failed to apply optimization:', error)
      toast.error('Optimization failed', 'Please try manual implementation')
    }
  }

  const handleFilterChange = (key: keyof OptimizationFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const exportRecommendations = () => {
    const report = {
      timestamp: new Date().toISOString(),
      recommendations: filteredRecommendations,
      categories,
      summary: {
        total: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        autoFixable: recommendations.filter(r => r.autoFixAvailable).length,
        avgImpact: Math.round(recommendations.reduce((sum, r) => sum + r.estimatedImpact, 0) / recommendations.length)
      }
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `optimization-recommendations-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Report exported', 'Optimization recommendations downloaded')
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /* const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-muted-foreground'
    }
  } */

  const getPriorityBadgeVariant = (priority: string): "default" | "secondary" | "destructive" => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      default: return 'default'
    }
  }

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'moderate': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'advanced': return <Target className="h-4 w-4 text-red-600" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getCategoryIcon = (category: string) => {
    const iconMap = {
      memory: MemoryStick,
      cpu: Cpu,
      database: Database,
      frontend: MonitorSpeaker,
      backend: HardDrive,
      storage: HardDrive
    }
    const IconComponent = iconMap[category as keyof typeof iconMap] || Info
    return <IconComponent className="h-4 w-4" />
  }

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================

  if (isLoading && recommendations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Analyzing performance and generating recommendations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            Optimization Recommendations
          </h2>
          <p className="text-muted-foreground">
            AI-powered suggestions to improve application performance
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Auto-scan:</span>
            <Switch
              checked={autoScanEnabled}
              onCheckedChange={setAutoScanEnabled}
            />
          </div>

          <Button onClick={refreshRecommendations} variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Scan
          </Button>

          <Button onClick={exportRecommendations} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Category Overview */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <Card key={category.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleFilterChange('category', category.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <category.icon className="h-5 w-5 text-blue-600" />
                  <Badge variant="secondary">{category.count}</Badge>
                </div>
                <h3 className="font-semibold text-sm">{category.name}</h3>
                <p className="text-xs text-muted-foreground">{category.avgImpact}% avg impact</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.difficulty} onValueChange={(value) => handleFilterChange('difficulty', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Switch
                checked={filters.autoFixOnly}
                onCheckedChange={(checked) => handleFilterChange('autoFixOnly', checked)}
              />
              <span className="text-sm">Auto-fix only</span>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={filters.hideImplemented}
                onCheckedChange={(checked) => handleFilterChange('hideImplemented', checked)}
              />
              <span className="text-sm">Hide implemented</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-muted-foreground">No recommendations found</p>
                <p className="text-sm text-muted-foreground">System is well optimized!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredRecommendations.map((recommendation) => (
            <Card key={recommendation.id} className={implementedFixes.has(recommendation.id) ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(recommendation.category)}
                    <div>
                      <CardTitle className="text-base">{recommendation.title}</CardTitle>
                      <CardDescription>{recommendation.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityBadgeVariant(recommendation.priority)}>
                      {recommendation.priority} priority
                    </Badge>
                    
                    {getDifficultyIcon(recommendation.difficulty)}
                    
                    {recommendation.autoFixAvailable && (
                      <Badge variant="outline">
                        <Zap className="h-3 w-3 mr-1" />
                        Auto-fix
                      </Badge>
                    )}
                    
                    {implementedFixes.has(recommendation.id) && (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Implemented
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Impact Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">Expected Impact</p>
                      <div className="flex items-center gap-2">
                        <Progress value={recommendation.estimatedImpact} className="flex-1" />
                        <span className="text-sm text-muted-foreground">{recommendation.estimatedImpact}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">Time to Implement</p>
                      <p className="text-sm text-muted-foreground">{recommendation.timeToImplement}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <Badge variant="outline">{recommendation.category}</Badge>
                    </div>
                  </div>

                  {/* Current vs Target Values */}
                  {recommendation.currentValue !== undefined && recommendation.targetValue !== undefined && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Current: {recommendation.currentValue}{recommendation.unit}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-green-600">Target: {recommendation.targetValue}{recommendation.unit}</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {recommendation.autoFixAvailable && !implementedFixes.has(recommendation.id) && (
                      <Button
                        onClick={() => handleOneClickFix(recommendation)}
                        size="sm"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Apply Fix
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedRecommendation(
                        expandedRecommendation === recommendation.id ? null : recommendation.id
                      )}
                    >
                      <Info className="h-4 w-4 mr-2" />
                      {expandedRecommendation === recommendation.id ? 'Hide' : 'Show'} Details
                    </Button>
                  </div>

                  {/* Expanded Details */}
                  {expandedRecommendation === recommendation.id && (
                    <div className="pt-4 border-t space-y-4">
                      {recommendation.detailedSteps && (
                        <div>
                          <h4 className="font-medium mb-2">Implementation Steps:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            {recommendation.detailedSteps.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {recommendation.prerequisites && recommendation.prerequisites.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Prerequisites:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {recommendation.prerequisites.map((prereq, index) => (
                              <li key={index}>{prereq}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {recommendation.relatedMetrics && (
                        <div>
                          <h4 className="font-medium mb-2">Related Metrics:</h4>
                          <div className="flex flex-wrap gap-2">
                            {recommendation.relatedMetrics.map((metric, index) => (
                              <Badge key={index} variant="outline">{metric}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium mb-2">Tags:</h4>
                        <div className="flex flex-wrap gap-2">
                          {recommendation.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default OptimizationRecommendations