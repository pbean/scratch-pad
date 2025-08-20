/**
 * Type-Safe Browser API Extensions
 * Replaces (performance as any) and other browser API type assertions
 */

// Extended Performance interface for Chrome/WebKit specific features
export interface ChromePerformance extends Performance {
  memory?: {
    /** The amount of memory the JavaScript heap is currently using, in bytes */
    usedJSHeapSize: number
    /** The total amount of memory available to the JavaScript heap, in bytes */
    totalJSHeapSize: number
    /** The maximum amount of memory the JavaScript heap is allowed to use, in bytes */
    jsHeapSizeLimit: number
  }
}

// Extended Window interface for debugging and development features
export interface ExtendedWindow extends Window {
  /** Chrome DevTools memory info */
  performance: ChromePerformance
  
  /** Development debugging utilities */
  __SCRATCH_PAD_STORE__?: unknown
  __SCRATCH_PAD_HOOKS__?: Record<string, unknown>
  __PERFORMANCE_TOOLS__?: Record<string, unknown>
  
  /** DevTools event listener debugging */
  getEventListeners?: (element: EventTarget) => Record<string, EventListener[]>
  
  /** Manual garbage collection (Chrome DevTools) */
  gc?: () => void
  
  /** Legacy store access for debugging */
  useLegacyScratchPadStore?: (...args: unknown[]) => unknown
}

// Type guards for runtime feature detection
export function hasMemoryAPI(performance: Performance): performance is ChromePerformance {
  return (
    'memory' in performance && 
    typeof (performance as ChromePerformance).memory === 'object' &&
    (performance as ChromePerformance).memory !== null
  )
}

export function hasGarbageCollector(window: Window): window is ExtendedWindow & { gc: () => void } {
  return typeof (window as ExtendedWindow).gc === 'function'
}

export function hasDevToolsEventListeners(window: Window): window is ExtendedWindow & { getEventListeners: NonNullable<ExtendedWindow['getEventListeners']> } {
  return typeof (window as ExtendedWindow).getEventListeners === 'function'
}

// Memory usage information with proper typing
export interface MemoryUsage {
  used: number
  total: number
  limit: number
  percentage: number
  available: number
}

// Type-safe memory monitoring
export function getMemoryUsage(): MemoryUsage | null {
  if (!hasMemoryAPI(performance)) {
    return null
  }
  
  const { memory } = performance
  if (!memory) {
    return null
  }
  const used = memory.usedJSHeapSize
  const total = memory.totalJSHeapSize
  const limit = memory.jsHeapSizeLimit
  
  return {
    used,
    total,
    limit,
    percentage: total > 0 ? (used / total) * 100 : 0,
    available: limit - used
  }
}

// Memory monitoring with thresholds
export interface MemoryAlert {
  type: 'warning' | 'critical'
  message: string
  usage: MemoryUsage
  threshold: number
}

export function checkMemoryThresholds(thresholds: {
  warning: number  // Percentage (e.g., 80)
  critical: number // Percentage (e.g., 95)
}): MemoryAlert | null {
  const usage = getMemoryUsage()
  if (!usage) return null
  
  if (usage.percentage >= thresholds.critical) {
    return {
      type: 'critical',
      message: `Critical memory usage: ${usage.percentage.toFixed(1)}%`,
      usage,
      threshold: thresholds.critical
    }
  }
  
  if (usage.percentage >= thresholds.warning) {
    return {
      type: 'warning',
      message: `High memory usage: ${usage.percentage.toFixed(1)}%`,
      usage,
      threshold: thresholds.warning
    }
  }
  
  return null
}

// Performance observer types for modern browsers
export interface PerformanceObserverEntryTyped extends PerformanceEntry {
  /** Navigation timing specific properties */
  loadEventEnd?: number
  loadEventStart?: number
  domContentLoadedEventEnd?: number
  domContentLoadedEventStart?: number
  
  /** Resource timing specific properties */
  transferSize?: number
  encodedBodySize?: number
  decodedBodySize?: number
  
  /** Paint timing specific properties */
  startTime: number
}

// Type-safe performance observer utility
export function createPerformanceObserver(
  entryTypes: string[],
  callback: (entries: PerformanceObserverEntryTyped[]) => void
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') {
    return null
  }
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceObserverEntryTyped[]
      callback(entries)
    })
    
    observer.observe({ entryTypes })
    return observer
  } catch (error) {
    console.warn('PerformanceObserver not supported:', error)
    return null
  }
}

// Intersection Observer with proper typing
export interface IntersectionObserverConfig {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
}

export function createTypedIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  config: IntersectionObserverConfig = {}
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') {
    return null
  }
  
  try {
    return new IntersectionObserver(callback, config)
  } catch (error) {
    console.warn('IntersectionObserver not supported:', error)
    return null
  }
}

// Resize Observer with proper typing
export function createTypedResizeObserver(
  callback: (entries: ResizeObserverEntry[]) => void
): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') {
    return null
  }
  
  try {
    return new ResizeObserver(callback)
  } catch (error) {
    console.warn('ResizeObserver not supported:', error)
    return null
  }
}

// User Agent parsing with proper typing
export interface UserAgentInfo {
  browser: string
  version: string
  os: string
  platform: string
  mobile: boolean
  features: {
    webGL: boolean
    webWorkers: boolean
    serviceWorkers: boolean
    indexedDB: boolean
    localStorage: boolean
    webSockets: boolean
  }
}

export function parseUserAgent(userAgent: string = navigator.userAgent): UserAgentInfo {
  // Simple user agent parsing - could be enhanced with a proper library
  const mobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  
  let browser = 'Unknown'
  let version = '0'
  
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome'
    const match = userAgent.match(/Chrome\/(\d+)/)
    version = match ? match[1] : '0'
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
    const match = userAgent.match(/Firefox\/(\d+)/)
    version = match ? match[1] : '0'
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari'
    const match = userAgent.match(/Version\/(\d+)/)
    version = match ? match[1] : '0'
  }
  
  let os = 'Unknown'
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iOS')) os = 'iOS'
  
  return {
    browser,
    version,
    os,
    platform: navigator.platform,
    mobile,
    features: {
      webGL: typeof WebGLRenderingContext !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: typeof ServiceWorker !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      localStorage: typeof localStorage !== 'undefined',
      webSockets: typeof WebSocket !== 'undefined'
    }
  }
}

// Network information with proper typing (experimental API)
export interface NetworkInformation {
  downlink?: number
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g'
  rtt?: number
  saveData?: boolean
}

export function getNetworkInformation(): NetworkInformation | null {
  // Check for the experimental Network Information API
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection
  
  if (!connection) return null
  
  return {
    downlink: connection.downlink,
    effectiveType: connection.effectiveType,
    rtt: connection.rtt,
    saveData: connection.saveData
  }
}

// Device memory information (experimental API)
export function getDeviceMemory(): number | null {
  return (navigator as any).deviceMemory || null
}

// Hardware concurrency (number of CPU cores)
export function getHardwareConcurrency(): number {
  return navigator.hardwareConcurrency || 1
}

// Complete system information gathering
export interface SystemInformation {
  userAgent: UserAgentInfo
  memory: MemoryUsage | null
  network: NetworkInformation | null
  deviceMemory: number | null
  hardwareConcurrency: number
  screen: {
    width: number
    height: number
    colorDepth: number
    pixelRatio: number
  }
  viewport: {
    width: number
    height: number
  }
  features: {
    touchSupport: boolean
    cookieEnabled: boolean
    onlineStatus: boolean
  }
}

export function getSystemInformation(): SystemInformation {
  return {
    userAgent: parseUserAgent(),
    memory: getMemoryUsage(),
    network: getNetworkInformation(),
    deviceMemory: getDeviceMemory(),
    hardwareConcurrency: getHardwareConcurrency(),
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    features: {
      touchSupport: 'ontouchstart' in window,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine
    }
  }
}

// Debug utilities for development
export function enableDebugMode() {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Debug mode is only available in development')
    return
  }
  
  const extendedWindow = window as ExtendedWindow
  
  extendedWindow.__PERFORMANCE_TOOLS__ = {
    getMemoryUsage,
    checkMemoryThresholds,
    getSystemInformation,
    getNetworkInformation,
    parseUserAgent
  }
  
  console.log('Debug mode enabled. Access tools via window.__PERFORMANCE_TOOLS__')
}