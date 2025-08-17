import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMemoryCleanup, useDataCleanup } from '../useMemoryCleanup'

describe('useMemoryCleanup', () => {
  it('should provide timeout and interval helpers', () => {
    const { result } = renderHook(() => useMemoryCleanup())
    
    expect(result.current.setTimeout).toBeDefined()
    expect(result.current.setInterval).toBeDefined()
    expect(typeof result.current.setTimeout).toBe('function')
    expect(typeof result.current.setInterval).toBe('function')
  })

  it('should clean up timeouts on unmount', () => {
    const { result, unmount } = renderHook(() => useMemoryCleanup())
    
    let callbackExecuted = false
    result.current.setTimeout(() => {
      callbackExecuted = true
    }, 100)
    
    // Unmount before timeout executes
    unmount()
    
    // Wait longer than timeout
    setTimeout(() => {
      expect(callbackExecuted).toBe(false)
    }, 200)
  })
})

describe('useDataCleanup', () => {
  it('should warn about large data structures', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const largeArray = new Array(1001).fill('item')
    renderHook(() => useDataCleanup(largeArray, 1000))
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Large data structure detected: 1001 items')
    )
    
    consoleSpy.mockRestore()
  })

  it('should not warn about small data structures', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const smallArray = new Array(100).fill('item')
    renderHook(() => useDataCleanup(smallArray, 1000))
    
    expect(consoleSpy).not.toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })
})