/**
 * useEnhancedSearch Hook - Week 2 Day 4
 * 
 * Provides advanced search functionality with highlighting, caching, and performance optimization.
 * Integrates with the backend search API and maintains search state.
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { 
  SearchResult, 
  BooleanSearchResult, 
  EnhancedSearchResult, 
  SearchHighlightOptions, 
  Note 
} from '../types'
import { 
  enhanceSearchResult, 
  DEFAULT_HIGHLIGHT_OPTIONS 
} from '../lib/searchHighlighting'

interface UseEnhancedSearchOptions {
  debounceMs?: number
  cacheSize?: number
  highlightOptions?: Partial<SearchHighlightOptions>
  enableCaching?: boolean
  enablePerformanceTracking?: boolean
}

interface SearchCache {
  [query: string]: {
    result: SearchResult | BooleanSearchResult
    timestamp: number
    enhanced?: EnhancedSearchResult
  }
}

interface SearchStats {
  totalQueries: number
  averageQueryTime: number
  cacheHitRate: number
  lastQueryTime: number
  slowQueries: number
}

export function useEnhancedSearch(options: UseEnhancedSearchOptions = {}) {
  const {
    debounceMs = 300,
    cacheSize = 50,
    highlightOptions = {},
    enableCaching = true,
    enablePerformanceTracking = true
  } = options

  // State
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [enhancedResult, setEnhancedResult] = useState<EnhancedSearchResult | null>(null)

  // Performance tracking
  const [searchStats, setSearchStats] = useState<SearchStats>({
    totalQueries: 0,
    averageQueryTime: 0,
    cacheHitRate: 0,
    lastQueryTime: 0,
    slowQueries: 0
  })

  // Refs for cache and timers
  const cacheRef = useRef<SearchCache>({})
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Combined highlight options
  const effectiveHighlightOptions = useMemo(() => ({
    ...DEFAULT_HIGHLIGHT_OPTIONS,
    ...highlightOptions
  }), [highlightOptions])

  // Cache management
  const getCachedResult = useCallback((query: string) => {
    if (!enableCaching) return null
    
    const cached = cacheRef.current[query]
    if (!cached) return null

    // Check if cache entry is still valid (5 minutes)
    const isValid = Date.now() - cached.timestamp < 5 * 60 * 1000
    if (!isValid) {
      delete cacheRef.current[query]
      return null
    }

    return cached
  }, [enableCaching])

  const setCachedResult = useCallback((
    query: string, 
    result: SearchResult | BooleanSearchResult,
    enhanced?: EnhancedSearchResult
  ) => {
    if (!enableCaching) return

    // Limit cache size
    const cacheKeys = Object.keys(cacheRef.current)
    if (cacheKeys.length >= cacheSize) {
      // Remove oldest entries
      const sortedKeys = cacheKeys.sort((a, b) => 
        cacheRef.current[a].timestamp - cacheRef.current[b].timestamp
      )
      const keysToRemove = sortedKeys.slice(0, Math.floor(cacheSize / 2))
      keysToRemove.forEach(key => delete cacheRef.current[key])
    }

    cacheRef.current[query] = {
      result,
      timestamp: Date.now(),
      enhanced
    }
  }, [enableCaching, cacheSize])

  // Update search statistics
  const updateStats = useCallback((queryTime: number, wasHit: boolean) => {
    if (!enablePerformanceTracking) return

    setSearchStats(prev => {
      const newTotalQueries = prev.totalQueries + 1
      const newSlowQueries = queryTime > 1000 ? prev.slowQueries + 1 : prev.slowQueries

      return {
        totalQueries: newTotalQueries,
        averageQueryTime: wasHit ? prev.averageQueryTime : 
          (prev.averageQueryTime * (newTotalQueries - 1) + queryTime) / newTotalQueries,
        cacheHitRate: (prev.cacheHitRate * (newTotalQueries - 1) + (wasHit ? 100 : 0)) / newTotalQueries,
        lastQueryTime: queryTime,
        slowQueries: newSlowQueries
      }
    })
  }, [enablePerformanceTracking])

  // Core search function
  const executeSearch = useCallback(async (
    query: string, 
    useBoolean: boolean = false,
    page: number = 0,
    pageSize: number = 50
  ): Promise<SearchResult | BooleanSearchResult> => {
    const startTime = performance.now()

    try {
      let result: SearchResult | BooleanSearchResult

      if (useBoolean) {
        result = await invoke<BooleanSearchResult>('search_notes_boolean_paginated', {
          query,
          page,
          pageSize
        })
      } else {
        result = await invoke<SearchResult>('search_notes_paginated', {
          query,
          page,
          pageSize
        })
      }

      const queryTime = performance.now() - startTime
      updateStats(queryTime, false)
      return result
    } catch (error) {
      const queryTime = performance.now() - startTime
      updateStats(queryTime, false)
      throw error
    }
  }, [updateStats])

  // Main search function with caching and enhancement
  const search = useCallback(async (
    query: string,
    options: {
      useBoolean?: boolean
      page?: number
      pageSize?: number
      forceRefresh?: boolean
    } = {}
  ) => {
    const { useBoolean = false, page = 0, pageSize = 50, forceRefresh = false } = options

    // Cancel any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchResult(null)
      setEnhancedResult(null)
      setSearchError(null)
      setCurrentQuery('')
      return
    }

    const cacheKey = `${trimmedQuery}:${useBoolean}:${page}:${pageSize}`

    setIsSearching(true)
    setSearchError(null)
    setCurrentQuery(trimmedQuery)

    try {
      const startTime = performance.now()
      let result: SearchResult | BooleanSearchResult
      let enhanced: EnhancedSearchResult | undefined
      let wasHit = false

      // Check cache first
      if (!forceRefresh) {
        const cached = getCachedResult(cacheKey)
        if (cached) {
          result = cached.result
          enhanced = cached.enhanced
          wasHit = true
        }
      }

      // Execute search if not cached
      if (!wasHit) {
        abortControllerRef.current = new AbortController()
        result = await executeSearch(trimmedQuery, useBoolean, page, pageSize)
        
        // Enhance with highlighting
        if ('complexity' in result) {
          // BooleanSearchResult - convert to SearchResult for enhancement
          const searchResult: SearchResult = {
            notes: result.notes,
            total_count: result.total_count,
            page: result.page,
            page_size: result.page_size,
            has_more: result.has_more,
            query_time_ms: result.query_time_ms
          }
          enhanced = enhanceSearchResult(searchResult, trimmedQuery, effectiveHighlightOptions)
        } else {
          enhanced = enhanceSearchResult(result, trimmedQuery, effectiveHighlightOptions)
        }

        // Cache the results
        setCachedResult(cacheKey, result, enhanced)
      }

      const queryTime = performance.now() - startTime
      updateStats(queryTime, wasHit)

      setSearchResult('complexity' in result ? {
        notes: result.notes,
        total_count: result.total_count,
        page: result.page,
        page_size: result.page_size,
        has_more: result.has_more,
        query_time_ms: result.query_time_ms
      } : result)
      
      setEnhancedResult(enhanced || null)

    } catch (error) {
      console.error('Search failed:', error)
      setSearchError(error instanceof Error ? error.message : 'Search failed')
      setSearchResult(null)
      setEnhancedResult(null)
    } finally {
      setIsSearching(false)
      abortControllerRef.current = null
    }
  }, [
    getCachedResult, 
    setCachedResult, 
    executeSearch, 
    updateStats, 
    effectiveHighlightOptions
  ])

  // Debounced search
  const debouncedSearch = useCallback((
    query: string,
    options: Parameters<typeof search>[1] = {}
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      search(query, options)
    }, debounceMs)
  }, [search, debounceMs])

  // Immediate search (no debounce)
  const searchImmediate = useCallback((
    query: string,
    options: Parameters<typeof search>[1] = {}
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    return search(query, options)
  }, [search])

  // Load more results
  const loadMore = useCallback(async () => {
    if (!searchResult || !searchResult.has_more || isSearching) return

    const nextPage = searchResult.page + 1
    return searchImmediate(currentQuery, {
      page: nextPage,
      pageSize: searchResult.page_size
    })
  }, [searchResult, isSearching, currentQuery, searchImmediate])

  // Clear search
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setSearchResult(null)
    setEnhancedResult(null)
    setSearchError(null)
    setCurrentQuery('')
    setIsSearching(false)
  }, [])

  // Clear cache
  const clearCache = useCallback(() => {
    cacheRef.current = {}
  }, [])

  // Validate Boolean query
  const validateBooleanQuery = useCallback(async (query: string) => {
    try {
      const result = await invoke<{
        term_count: number
        operator_count: number
        nesting_depth: number
        has_field_searches: boolean
        has_phrase_searches: boolean
        complexity_score: number
      }>('validate_boolean_search_query', { query })
      return { isValid: true, complexity: result, error: null }
    } catch (error) {
      return { 
        isValid: false, 
        complexity: null, 
        error: error instanceof Error ? error.message : 'Invalid query' 
      }
    }
  }, [])

  // Get search suggestions
  const getSuggestions = useCallback(async (partialQuery: string) => {
    if (!partialQuery.trim()) return []
    
    try {
      // This would need to be implemented in the backend
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      return []
    }
  }, [])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    // State
    isSearching,
    searchError,
    currentQuery,
    searchResult,
    enhancedResult,
    searchStats,

    // Actions
    search: debouncedSearch,
    searchImmediate,
    loadMore,
    clearSearch,
    clearCache,
    validateBooleanQuery,
    getSuggestions,
    cleanup,

    // Utilities
    canLoadMore: searchResult?.has_more || false,
    hasResults: (searchResult?.notes.length || 0) > 0,
    resultsCount: searchResult?.total_count || 0,
    queryTime: searchResult?.query_time_ms || 0
  }
}