import { useCallback, useRef, useEffect } from 'react'

interface SmartAutoSaveOptions {
  onSave: (content: string) => Promise<void>
  minDelay: number // Minimum delay in ms (default: 300)
  maxDelay: number // Maximum delay in ms (default: 2000)
  idleThreshold: number // Time in ms to consider user idle (default: 1500)
  fastTypingThreshold: number // Chars per second to consider fast typing (default: 5)
}

interface SmartAutoSaveReturn {
  saveContent: (content: string) => void
  forceSave: (content: string) => Promise<void>
  isSaving: boolean
  lastSaved: Date | null
  isIdle: boolean
}

export function useSmartAutoSave({
  onSave,
  minDelay = 300,
  maxDelay = 2000,
  idleThreshold = 1500,
  fastTypingThreshold = 5
}: SmartAutoSaveOptions): SmartAutoSaveReturn {
  const saveTimeoutRef = useRef<number>()
  const lastActivityRef = useRef<number>(Date.now())
  const lastContentRef = useRef<string>('')
  const typingHistoryRef = useRef<number[]>([])
  const isSavingRef = useRef(false)
  const lastSavedRef = useRef<Date | null>(null)
  const isIdleRef = useRef(false)
  
  // Clean up typing history older than 10 seconds
  const cleanTypingHistory = useCallback(() => {
    const now = Date.now()
    typingHistoryRef.current = typingHistoryRef.current.filter(
      timestamp => now - timestamp < 10000
    )
  }, [])
  
  // Calculate adaptive delay based on user behavior
  const calculateDelay = useCallback(() => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current
    
    // If user has been idle, use minimum delay for quick saves
    if (timeSinceLastActivity > idleThreshold) {
      return minDelay
    }
    
    // Calculate typing speed from recent history
    cleanTypingHistory()
    const recentTyping = typingHistoryRef.current.filter(
      timestamp => now - timestamp < 5000 // Last 5 seconds
    )
    
    const typingSpeed = recentTyping.length / 5 // chars per second
    
    // If typing fast, use longer delay to avoid interrupting flow
    if (typingSpeed > fastTypingThreshold) {
      return maxDelay
    }
    
    // Progressive delay based on time since last activity
    if (timeSinceLastActivity < 500) {
      return maxDelay // Very recent activity, wait longer
    } else if (timeSinceLastActivity < 1000) {
      return Math.floor(maxDelay * 0.7) // Recent activity, moderate delay
    } else {
      return Math.floor(maxDelay * 0.4) // Older activity, shorter delay
    }
  }, [minDelay, maxDelay, idleThreshold, fastTypingThreshold, cleanTypingHistory])
  
  // Update idle status based on activity
  const updateIdleStatus = useCallback(() => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current
    isIdleRef.current = timeSinceLastActivity > idleThreshold
  }, [idleThreshold])
  
  // Perform the actual save
  const performSave = useCallback(async (content: string) => {
    if (isSavingRef.current || content === lastContentRef.current) return
    
    isSavingRef.current = true
    try {
      await onSave(content)
      lastSavedRef.current = new Date()
      lastContentRef.current = content
    } catch (error) {
      console.error('Smart auto-save failed:', error)
      throw error
    } finally {
      isSavingRef.current = false
    }
  }, [onSave])
  
  // Smart save with adaptive debouncing
  const saveContent = useCallback((content: string) => {
    const now = Date.now()
    lastActivityRef.current = now
    
    // Track typing activity
    typingHistoryRef.current.push(now)
    cleanTypingHistory()
    updateIdleStatus()
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    
    // Skip save if content hasn't changed
    if (content === lastContentRef.current) return
    
    // Calculate adaptive delay
    const delay = calculateDelay()
    
    // Set new timeout with calculated delay
    saveTimeoutRef.current = window.setTimeout(() => {
      performSave(content)
    }, delay)
  }, [calculateDelay, performSave, cleanTypingHistory, updateIdleStatus])
  
  // Force immediate save
  const forceSave = useCallback(async (content: string) => {
    // Clear any pending timeouts
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = undefined
    }
    
    await performSave(content)
  }, [performSave])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])
  
  // Handle page visibility changes for smart saving
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && saveTimeoutRef.current) {
        // Force save when page becomes hidden
        window.clearTimeout(saveTimeoutRef.current)
        const currentContent = lastContentRef.current
        if (currentContent) {
          performSave(currentContent)
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [performSave])
  
  // Handle beforeunload for emergency saves
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        // Attempt synchronous save on page unload
        window.clearTimeout(saveTimeoutRef.current)
        const currentContent = lastContentRef.current
        if (currentContent && navigator.sendBeacon) {
          // Use sendBeacon for reliable save on unload
          // Note: This would need a special endpoint, for now just clear timeout
          console.warn('Emergency save on page unload - content may be lost')
        }
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
  
  return {
    saveContent,
    forceSave,
    isSaving: isSavingRef.current,
    lastSaved: lastSavedRef.current,
    isIdle: isIdleRef.current
  }
}