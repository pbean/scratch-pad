/**
 * Performance Alert Management Component
 * 
 * Real-time alert system for performance monitoring with threshold management
 * and actionable notifications.
 * 
 * Week 3 Day 9 Implementation: Alert System Component
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CheckCircle,
  Bell,
  // BellOff,
  Settings,
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Filter,
  Archive
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Progress } from "../ui/progress"
// import { Separator } from "../ui/separator"
import { LoadingSpinner } from "../ui/loading"
import { useToast } from "../ui/toast"
import {
  usePerformanceAlerts,
  type PerformanceAlert
} from "../../hooks/useAdvancedPerformanceMonitor"

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  enabled: boolean
  actions: string[]
}

interface AlertConfiguration {
  globalEnabled: boolean
  soundEnabled: boolean
  popupEnabled: boolean
  emailEnabled: boolean
  retentionDays: number
  maxAlertsPerHour: number
}

interface AlertStats {
  total: number
  active: number
  resolved: number
  critical: number
  lastHour: number
  trend: 'up' | 'down' | 'stable'
}

// ============================================================================
// PERFORMANCE ALERT MANAGER COMPONENT
// ============================================================================

export function PerformanceAlertManager() {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [configuration, setConfiguration] = useState<AlertConfiguration>({
    globalEnabled: true,
    soundEnabled: true,
    popupEnabled: true,
    emailEnabled: false,
    retentionDays: 7,
    maxAlertsPerHour: 50
  })
  
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const toast = useToast()
  const { fetchAlerts } = usePerformanceAlerts()

  // ============================================================================
  // DATA FETCHING & MANAGEMENT
  // ============================================================================

  const refreshAlerts = useCallback(async () => {
    try {
      const alertsData = await fetchAlerts(selectedSeverity === 'all' ? undefined : selectedSeverity)
      setAlerts(alertsData)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
      toast.error('Failed to load alerts', 'Please try again')
    }
  }, [fetchAlerts, selectedSeverity, toast])

  // Initial load and auto-refresh
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await refreshAlerts()
      setIsLoading(false)
    }
    
    loadData()
  }, [refreshAlerts])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshAlerts, 10000) // 10 seconds
    return () => clearInterval(interval)
  }, [autoRefresh, refreshAlerts])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredAlerts = useMemo(() => {
    let filtered = alerts

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.level === selectedSeverity)
    }

    if (!showArchived) {
      filtered = filtered.filter(alert => alert.isActive)
    }

    return filtered.sort((a, b) => {
      // Sort by severity first, then by timestamp
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 }
      const severityDiff = severityOrder[a.level] - severityOrder[b.level]
      if (severityDiff !== 0) return severityDiff
      
      return b.timestamp - a.timestamp
    })
  }, [alerts, selectedSeverity, showArchived])

  const alertStats = useMemo((): AlertStats => {
    const total = alerts.length
    const active = alerts.filter(a => a.isActive).length
    const resolved = total - active
    const critical = alerts.filter(a => a.level === 'critical').length
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const lastHour = alerts.filter(a => a.timestamp > oneHourAgo).length
    
    // Simple trend calculation based on recent alerts
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)
    const previousHour = alerts.filter(a => a.timestamp > twoHoursAgo && a.timestamp <= oneHourAgo).length
    
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (lastHour > previousHour * 1.2) trend = 'up'
    else if (lastHour < previousHour * 0.8) trend = 'down'

    return { total, active, resolved, critical, lastHour, trend }
  }, [alerts])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAlertDismiss = async (alertId: string) => {
    try {
      // Update local state immediately for better UX
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, isActive: false } : alert
      ))
      
      // TODO: Implement backend call to dismiss alert
      // await invoke('dismiss_performance_alert', { alertId })
      
      toast.success('Alert dismissed', 'Alert has been marked as resolved')
    } catch (error) {
      console.error('Failed to dismiss alert:', error)
      toast.error('Failed to dismiss alert', 'Please try again')
      // Revert local state on error
      refreshAlerts()
    }
  }

  const handleBulkDismiss = async () => {
    const activeAlerts = filteredAlerts.filter(alert => alert.isActive)
    if (activeAlerts.length === 0) return

    try {
      setAlerts(prev => prev.map(alert => 
        alert.isActive ? { ...alert, isActive: false } : alert
      ))
      
      toast.success(`Dismissed ${activeAlerts.length} alerts`, 'All active alerts have been resolved')
    } catch (error) {
      console.error('Failed to dismiss alerts:', error)
      toast.error('Failed to dismiss alerts', 'Please try again')
      refreshAlerts()
    }
  }

  const handleConfigurationChange = async (key: keyof AlertConfiguration, value: any) => {
    setConfiguration(prev => ({ ...prev, [key]: value }))
    
    try {
      // TODO: Implement backend call to save configuration
      // await invoke('update_alert_configuration', { config: { ...configuration, [key]: value } })
      
      if (key === 'globalEnabled') {
        toast.info(
          value ? 'Alerts enabled' : 'Alerts disabled',
          value ? 'Performance monitoring alerts are now active' : 'Performance monitoring alerts are now disabled'
        )
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast.error('Failed to save configuration', 'Please try again')
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getAlertBadgeVariant = (level: string): "default" | "secondary" | "destructive" => {
    switch (level) {
      case 'critical':
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  }

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading alert system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full space-y-6">
      {/* Alert Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{alertStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-red-600">{alertStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{alertStats.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                {alertStats.trend === 'up' && <TrendingUp className="h-6 w-6 text-orange-600" />}
                {alertStats.trend === 'down' && <TrendingDown className="h-6 w-6 text-green-600" />}
                {alertStats.trend === 'stable' && <Clock className="h-6 w-6 text-blue-600" />}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Last Hour</p>
                <p className="text-2xl font-bold">{alertStats.lastHour}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Alert Configuration
          </CardTitle>
          <CardDescription>
            Manage alert settings and notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enable Alerts</span>
                <Switch
                  checked={configuration.globalEnabled}
                  onCheckedChange={(checked) => handleConfigurationChange('globalEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sound Notifications</span>
                <Switch
                  checked={configuration.soundEnabled}
                  onCheckedChange={(checked) => handleConfigurationChange('soundEnabled', checked)}
                  disabled={!configuration.globalEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Popup Notifications</span>
                <Switch
                  checked={configuration.popupEnabled}
                  onCheckedChange={(checked) => handleConfigurationChange('popupEnabled', checked)}
                  disabled={!configuration.globalEnabled}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Auto Refresh</span>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Show Archived</span>
                <Switch
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Max Alerts/Hour</label>
                <p className="text-sm text-muted-foreground">Current: {configuration.maxAlertsPerHour}</p>
                <Progress value={(alertStats.lastHour / configuration.maxAlertsPerHour) * 100} className="mt-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Filters and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="error">Error Only</SelectItem>
              <SelectItem value="warning">Warning Only</SelectItem>
              <SelectItem value="info">Info Only</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary">
            {filteredAlerts.length} alerts
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAlerts}
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Refresh
          </Button>

          {alertStats.active > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDismiss}
            >
              <Archive className="h-4 w-4 mr-2" />
              Dismiss All ({alertStats.active})
            </Button>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {selectedSeverity === 'all' ? 'No alerts found' : `No ${selectedSeverity} alerts`}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.level === 'error' || alert.level === 'critical' ? 'destructive' : 'default'}
              className={`relative ${!alert.isActive ? 'opacity-60' : ''}`}
            >
              {getAlertIcon(alert.level)}
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <AlertTitle className="flex items-center gap-2">
                    {alert.level.charAt(0).toUpperCase() + alert.level.slice(1)} Alert
                    <Badge variant={getAlertBadgeVariant(alert.level)}>
                      {alert.level}
                    </Badge>
                    {!alert.isActive && (
                      <Badge variant="outline">Resolved</Badge>
                    )}
                  </AlertTitle>
                  
                  {alert.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAlertDismiss(alert.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <AlertDescription className="mt-2">
                  <div className="space-y-2">
                    <p>{alert.message}</p>
                    
                    {alert.suggestedAction && (
                      <div className="p-3 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium">Suggested Action:</span>
                        </div>
                        <p className="text-sm">{alert.suggestedAction}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(alert.timestamp)}
                      </span>
                      <span>ID: {alert.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </AlertDescription>
              </div>
            </Alert>
          ))
        )}
      </div>
    </div>
  )
}

export default PerformanceAlertManager