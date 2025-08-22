/**
 * Enhanced Search Slice with Performance Analytics - Week 2 Day 4
 * 
 * Extended search store slice with integrated performance monitoring,
 * analytics tracking, and optimization insights for comprehensive
 * search performance management.
 */

import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Note, ApiError, SearchResult, BooleanSearchResult } from "../../../types"
import type { PerformanceMetrics } from "../../../types/analytics"
import { performanceAnalytics } from "../../analytics/performanceAnalytics"

interface EnhancedSearchResult {
  query: string
  results: Note[]
  timestamp: number
  performanceMetrics?: PerformanceMetrics
  cacheHit: boolean
  complexityScore?: number
}

export interface EnhancedSearchSlice {
  // State
  searchQuery: string
  searchResults: Note[]
  isSearching: boolean
  selectedSearchIndex: number
  searchCache: Map<string, EnhancedSearchResult>
  recentSearches: string[]
  searchHistory: EnhancedSearchResult[]
  
  // Performance state
  lastSearchMetrics: PerformanceMetrics | null
  searchPerformanceEnabled: boolean
  averageQueryTime: number
  cacheHitRate: number
  totalSearches: number
  
  // Pagination state
  currentPage: number
  pageSize: number
  totalResults: number
  hasMoreResults: boolean
  isLoadingMore: boolean
  
  // Boolean search state
  booleanSearchEnabled: boolean
  lastQueryComplexity?: {
    termCount: number
    operatorCount: number
    nestingDepth: number
    complexityScore: number
  }
  
  // Actions
  setSearchQuery: (query: string) => void
  searchNotes: (query: string) => Promise<Note[]>
  searchNotesPaginated: (query: string, page?: number, pageSize?: number) => Promise<SearchResult>
  searchNotesBoolean: (query: string, page?: number, pageSize?: number) => Promise<BooleanSearchResult>
  performSearch: (query: string) => Promise<void>
  setSelectedSearchIndex: (index: number) => void
  clearSearch: () => void
  clearSearchCache: () => void
  addToSearchHistory: (query: string, results: Note[], metrics?: PerformanceMetrics) => void
  removeFromSearchHistory: (query: string) => void
  clearSearchHistory: () => void
  
  // Performance actions
  enablePerformanceMonitoring: (enabled: boolean) => void
  updatePerformanceStats: (metrics?: PerformanceMetrics, cacheHit?: boolean) => void
  getPerformanceInsights: () => {
    averageQueryTime: number
    cacheEfficiency: number
    slowQueries: string[]
    optimizationSuggestions: string[]
  }
  
  // Pagination actions
  loadMoreResults: () => Promise<void>
  setPageSize: (size: number) => void
  goToPage: (page: number) => Promise<void>
  
  // Boolean search actions
  enableBooleanSearch: (enabled: boolean) => void
  validateBooleanQuery: (query: string) => Promise<boolean>
  
  // Selectors
  getCachedSearch: (query: string) => EnhancedSearchResult | undefined
  getRecentSearchSuggestions: (input: string) => string[]
  isSearchCacheValid: (query: string, maxAge?: number) => boolean
  getSearchMetrics: () => {
    totalSearches: number
    averageQueryTime: number
    cacheHitRate: number
    slowestQuery: string | null
    fastestQuery: string | null
  }
}

const SEARCH_CACHE_MAX_AGE = 5 * 60 * 1000 // 5 minutes
const MAX_SEARCH_HISTORY = 50
const MAX_RECENT_SEARCHES = 10
const DEFAULT_PAGE_SIZE = 20
const SLOW_QUERY_THRESHOLD = 100 // ms

export const createEnhancedSearchSlice: StateCreator<
  EnhancedSearchSlice,
  [],
  [],
  EnhancedSearchSlice
> = (set, get) => ({
  // Initial state
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  selectedSearchIndex: 0,
  searchCache: new Map(),
  recentSearches: [],
  searchHistory: [],
  
  // Performance state
  lastSearchMetrics: null,
  searchPerformanceEnabled: true,
  averageQueryTime: 0,
  cacheHitRate: 0,
  totalSearches: 0,
  
  // Pagination state
  currentPage: 0,
  pageSize: DEFAULT_PAGE_SIZE,
  totalResults: 0,
  hasMoreResults: false,
  isLoadingMore: false,
  
  // Boolean search state
  booleanSearchEnabled: false,
  lastQueryComplexity: undefined,

  // Actions
  setSearchQuery: (query) => set({ 
    searchQuery: query, 
    selectedSearchIndex: 0,
    currentPage: 0 // Reset pagination
  }),

  searchNotes: async (query: string) => {
    if (!query.trim()) return []

    const { getCachedSearch, isSearchCacheValid, searchPerformanceEnabled } = get()
    
    // Check cache first
    const cached = getCachedSearch(query)
    if (cached && isSearchCacheValid(query)) {
      // Track cache hit
      if (searchPerformanceEnabled) {
        const queryId = `cache_${Date.now()}`
        performanceAnalytics.startQuery(queryId, query, 'simple')
        performanceAnalytics.completeQuery(queryId, query, 'simple', cached.results.length, true)
      }
      return cached.results
    }

    let queryId: string | null = null
    
    try {
      // Start performance tracking
      if (searchPerformanceEnabled) {
        queryId = `search_${Date.now()}`
        performanceAnalytics.startQuery(queryId, query, 'simple')
      }

      const results = await invoke<Note[]>("search_notes", { query })
      
      // Complete performance tracking
      let metrics: PerformanceMetrics | undefined
      if (searchPerformanceEnabled && queryId) {
        metrics = performanceAnalytics.completeQuery(queryId, query, 'simple', results.length, false)
      }
      
      // Update cache
      set(state => {
        const newCache = new Map(state.searchCache)
        newCache.set(query, {
          query,
          results,
          timestamp: Date.now(),
          performanceMetrics: metrics,
          cacheHit: false
        })
        
        // Limit cache size (keep only last 20 searches)
        if (newCache.size > 20) {
          const entries = Array.from(newCache.entries())
          entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
          const limitedEntries = entries.slice(0, 20)
          return { 
            searchCache: new Map(limitedEntries),
            lastSearchMetrics: metrics || null
          }
        }
        
        return { 
          searchCache: newCache,
          lastSearchMetrics: metrics || null
        }
      })
      
      // Update performance stats
      get().updatePerformanceStats(metrics, false)
      
      return results
    } catch (error) {
      // Cancel tracking on error
      if (searchPerformanceEnabled && queryId) {
        // performanceAnalytics.cancelTracking(queryId) // Would need to implement this
      }
      
      const apiError = error as ApiError
      throw apiError
    }
  },

  searchNotesPaginated: async (query: string, page = 0, pageSize = DEFAULT_PAGE_SIZE) => {
    if (!query.trim()) {
      return {
        notes: [],
        total_count: 0,
        page,
        page_size: pageSize,
        has_more: false,
        query_time_ms: 0
      }
    }

    const { searchPerformanceEnabled } = get()
    let queryId: string | null = null
    
    try {
      // Start performance tracking
      if (searchPerformanceEnabled) {
        queryId = `paginated_${Date.now()}`
        performanceAnalytics.startQuery(queryId, query, 'paginated')
      }

      const result = await invoke<SearchResult>("search_notes_paginated", { 
        query, 
        page, 
        page_size: pageSize 
      })
      
      // Complete performance tracking
      let metrics: PerformanceMetrics | undefined
      if (searchPerformanceEnabled && queryId) {
        metrics = performanceAnalytics.completeQuery(
          queryId, 
          query, 
          'paginated', 
          result.notes.length, 
          false // Paginated results are rarely cached
        )
      }
      
      // Update state
      set({
        currentPage: page,
        pageSize,
        totalResults: result.total_count,
        hasMoreResults: result.has_more,
        lastSearchMetrics: metrics || null
      })
      
      // Update performance stats
      get().updatePerformanceStats(metrics, false)
      
      return result
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  searchNotesBoolean: async (query: string, page = 0, pageSize = DEFAULT_PAGE_SIZE) => {
    if (!query.trim()) {
      return {
        notes: [],
        total_count: 0,
        page,
        page_size: pageSize,
        has_more: false,
        query_time_ms: 0,
        complexity: {
          term_count: 0,
          operator_count: 0,
          nesting_depth: 0,
          has_field_searches: false,
          has_phrase_searches: false,
          complexity_score: 0
        }
      }
    }

    const { searchPerformanceEnabled } = get()
    let queryId: string | null = null
    
    try {
      // Start performance tracking
      if (searchPerformanceEnabled) {
        queryId = `boolean_${Date.now()}`
        performanceAnalytics.startQuery(queryId, query, 'boolean')
      }

      const result = await invoke<BooleanSearchResult>("search_notes_boolean_paginated", { 
        query, 
        page, 
        page_size: pageSize 
      })
      
      // Complete performance tracking
      let metrics: PerformanceMetrics | undefined
      if (searchPerformanceEnabled && queryId) {
        metrics = performanceAnalytics.completeQuery(
          queryId, 
          query, 
          'boolean', 
          result.notes.length, 
          false,
          result.complexity.complexity_score
        )
      }
      
      // Update state
      set({
        currentPage: page,
        pageSize,
        totalResults: result.total_count,
        hasMoreResults: result.has_more,
        lastSearchMetrics: metrics || null,
        lastQueryComplexity: {
          termCount: result.complexity.term_count,
          operatorCount: result.complexity.operator_count,
          nestingDepth: result.complexity.nesting_depth,
          complexityScore: result.complexity.complexity_score
        }
      })
      
      // Update performance stats
      get().updatePerformanceStats(metrics, false)
      
      return result
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  performSearch: async (query: string) => {
    if (!query.trim()) {
      set({ 
        searchResults: [], 
        searchQuery: query, 
        selectedSearchIndex: 0,
        currentPage: 0,
        totalResults: 0,
        hasMoreResults: false
      })
      return
    }

    set({ 
      isSearching: true, 
      searchQuery: query, 
      selectedSearchIndex: 0,
      currentPage: 0
    })
    
    try {
      const { booleanSearchEnabled, pageSize } = get()
      
      let results: Note[]
      
      if (booleanSearchEnabled) {
        const booleanResult = await get().searchNotesBoolean(query, 0, pageSize)
        results = booleanResult.notes
        
        set({
          totalResults: booleanResult.total_count,
          hasMoreResults: booleanResult.has_more
        })
      } else {
        const paginatedResult = await get().searchNotesPaginated(query, 0, pageSize)
        results = paginatedResult.notes
        
        set({
          totalResults: paginatedResult.total_count,
          hasMoreResults: paginatedResult.has_more
        })
      }
      
      set(state => {
        // Add to search history
        get().addToSearchHistory(query, results, state.lastSearchMetrics || undefined)
        
        // Update recent searches
        const newRecentSearches = [query, ...state.recentSearches.filter(s => s !== query)]
          .slice(0, MAX_RECENT_SEARCHES)
        
        return {
          searchResults: results,
          isSearching: false,
          recentSearches: newRecentSearches
        }
      })
    } catch (error) {
      set({ isSearching: false })
      throw error
    }
  },

  setSelectedSearchIndex: (index) => set({ selectedSearchIndex: index }),

  clearSearch: () => set({
    searchQuery: "",
    searchResults: [],
    selectedSearchIndex: 0,
    currentPage: 0,
    totalResults: 0,
    hasMoreResults: false,
    lastQueryComplexity: undefined
  }),

  clearSearchCache: () => set({ searchCache: new Map() }),

  addToSearchHistory: (query: string, results: Note[], metrics?: PerformanceMetrics) => {
    if (!query.trim()) return

    set(state => {
      const existingIndex = state.searchHistory.findIndex(h => h.query === query)
      let newHistory = [...state.searchHistory]
      
      const searchResult: EnhancedSearchResult = {
        query,
        results,
        timestamp: Date.now(),
        performanceMetrics: metrics,
        cacheHit: false
      }
      
      if (existingIndex >= 0) {
        // Update existing entry
        newHistory[existingIndex] = searchResult
      } else {
        // Add new entry at the beginning
        newHistory.unshift(searchResult)
      }
      
      // Limit history size
      if (newHistory.length > MAX_SEARCH_HISTORY) {
        newHistory = newHistory.slice(0, MAX_SEARCH_HISTORY)
      }
      
      return { searchHistory: newHistory }
    })
  },

  removeFromSearchHistory: (query: string) => {
    set(state => ({
      searchHistory: state.searchHistory.filter(h => h.query !== query),
      recentSearches: state.recentSearches.filter(s => s !== query)
    }))
  },

  clearSearchHistory: () => set({
    searchHistory: [],
    recentSearches: []
  }),

  // Performance actions
  enablePerformanceMonitoring: (enabled: boolean) => {
    set({ searchPerformanceEnabled: enabled })
  },

  getPerformanceInsights: () => {
    const { searchHistory } = get()
    
    const recentHistory = searchHistory.slice(0, 20) // Last 20 searches
    const queryTimes = recentHistory
      .map(h => h.performanceMetrics?.queryTime)
      .filter(t => t !== undefined) as number[]
    
    const averageQueryTime = queryTimes.length > 0 
      ? Math.round(queryTimes.reduce((sum, t) => sum + t, 0) / queryTimes.length)
      : 0
    
    const cacheHits = recentHistory.filter(h => h.cacheHit).length
    const cacheEfficiency = recentHistory.length > 0 
      ? Math.round((cacheHits / recentHistory.length) * 100)
      : 0
    
    const slowQueries = recentHistory
      .filter(h => h.performanceMetrics?.queryTime && h.performanceMetrics.queryTime > SLOW_QUERY_THRESHOLD)
      .map(h => h.query)
      .slice(0, 5)
    
    const optimizationSuggestions: string[] = []
    
    if (averageQueryTime > SLOW_QUERY_THRESHOLD) {
      optimizationSuggestions.push("Consider using more specific search terms")
    }
    
    if (cacheEfficiency < 50) {
      optimizationSuggestions.push("Try reusing recent search queries")
    }
    
    if (slowQueries.length > 3) {
      optimizationSuggestions.push("Break down complex queries into simpler terms")
    }

    return {
      averageQueryTime,
      cacheEfficiency,
      slowQueries,
      optimizationSuggestions
    }
  },

  // Pagination actions
  loadMoreResults: async () => {
    const { searchQuery, currentPage, pageSize, isLoadingMore, hasMoreResults, booleanSearchEnabled } = get()
    
    if (isLoadingMore || !hasMoreResults || !searchQuery.trim()) {
      return
    }

    set({ isLoadingMore: true })
    
    try {
      const nextPage = currentPage + 1
      let newResults: Note[]
      
      if (booleanSearchEnabled) {
        const result = await get().searchNotesBoolean(searchQuery, nextPage, pageSize)
        newResults = result.notes
        
        set({
          hasMoreResults: result.has_more,
          currentPage: nextPage
        })
      } else {
        const result = await get().searchNotesPaginated(searchQuery, nextPage, pageSize)
        newResults = result.notes
        
        set({
          hasMoreResults: result.has_more,
          currentPage: nextPage
        })
      }
      
      // Append new results
      set(state => ({
        searchResults: [...state.searchResults, ...newResults],
        isLoadingMore: false
      }))
    } catch (error) {
      set({ isLoadingMore: false })
      throw error
    }
  },

  setPageSize: (size: number) => {
    set({ 
      pageSize: Math.max(10, Math.min(100, size)), // Clamp between 10 and 100
      currentPage: 0 // Reset to first page
    })
  },

  goToPage: async (page: number) => {
    const { searchQuery, pageSize, booleanSearchEnabled } = get()
    
    if (!searchQuery.trim()) return

    set({ isSearching: true })
    
    try {
      let result: Note[]
      
      if (booleanSearchEnabled) {
        const booleanResult = await get().searchNotesBoolean(searchQuery, page, pageSize)
        result = booleanResult.notes
        
        set({
          hasMoreResults: booleanResult.has_more,
          totalResults: booleanResult.total_count
        })
      } else {
        const paginatedResult = await get().searchNotesPaginated(searchQuery, page, pageSize)
        result = paginatedResult.notes
        
        set({
          hasMoreResults: paginatedResult.has_more,
          totalResults: paginatedResult.total_count
        })
      }
      
      set({
        searchResults: result,
        currentPage: page,
        isSearching: false
      })
    } catch (error) {
      set({ isSearching: false })
      throw error
    }
  },

  // Boolean search actions
  enableBooleanSearch: (enabled: boolean) => {
    set({ 
      booleanSearchEnabled: enabled,
      currentPage: 0 // Reset pagination when switching modes
    })
  },

  validateBooleanQuery: async (query: string) => {
    try {
      await invoke("validate_boolean_search_query", { query })
      return true
    } catch {
      return false
    }
  },

  // Selectors
  getCachedSearch: (query: string) => {
    const { searchCache } = get()
    return searchCache.get(query)
  },

  getRecentSearchSuggestions: (input: string) => {
    const { recentSearches, searchHistory } = get()
    const lowerInput = input.toLowerCase()
    
    // Combine recent searches and history
    const allSearches = [...new Set([
      ...recentSearches,
      ...searchHistory.map(h => h.query)
    ])]
    
    return allSearches
      .filter(search => search.toLowerCase().includes(lowerInput))
      .slice(0, 5) // Limit suggestions
  },

  isSearchCacheValid: (query: string, maxAge = SEARCH_CACHE_MAX_AGE) => {
    const cached = get().getCachedSearch(query)
    if (!cached) return false
    
    return (Date.now() - cached.timestamp) < maxAge
  },

  getSearchMetrics: () => {
    const { searchHistory, totalSearches, averageQueryTime, cacheHitRate } = get()
    
    const metricsHistory = searchHistory
      .map(h => h.performanceMetrics)
      .filter(m => m !== undefined) as PerformanceMetrics[]
    
    let slowestQuery: string | null = null
    let fastestQuery: string | null = null
    let maxTime = 0
    let minTime = Infinity
    
    searchHistory.forEach(h => {
      if (h.performanceMetrics?.queryTime) {
        if (h.performanceMetrics.queryTime > maxTime) {
          maxTime = h.performanceMetrics.queryTime
          slowestQuery = h.query
        }
        if (h.performanceMetrics.queryTime < minTime) {
          minTime = h.performanceMetrics.queryTime
          fastestQuery = h.query
        }
      }
    })

    return {
      totalSearches: totalSearches || searchHistory.length,
      averageQueryTime: averageQueryTime || (metricsHistory.length > 0 
        ? Math.round(metricsHistory.reduce((sum, m) => sum + m.queryTime, 0) / metricsHistory.length)
        : 0),
      cacheHitRate: cacheHitRate || (searchHistory.length > 0 
        ? Math.round((searchHistory.filter(h => h.cacheHit).length / searchHistory.length) * 100)
        : 0),
      slowestQuery: minTime === Infinity ? null : slowestQuery,
      fastestQuery: maxTime === 0 ? null : fastestQuery
    }
  },

  // Private helper methods
  updatePerformanceStats: (metrics?: PerformanceMetrics, cacheHit: boolean = false) => {
    if (!metrics) return

    set(state => {
      const newTotalSearches = state.totalSearches + 1
      const newAverageQueryTime = ((state.averageQueryTime * state.totalSearches) + metrics.queryTime) / newTotalSearches
      
      // Calculate new cache hit rate
      const oldCacheHits = Math.round(state.cacheHitRate * state.totalSearches / 100)
      const newCacheHits = oldCacheHits + (cacheHit ? 1 : 0)
      const newCacheHitRate = (newCacheHits / newTotalSearches) * 100

      return {
        totalSearches: newTotalSearches,
        averageQueryTime: Math.round(newAverageQueryTime),
        cacheHitRate: Math.round(newCacheHitRate * 100) / 100
      }
    })
  }, // Private helper method
})