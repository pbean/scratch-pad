/**
 * Advanced Search Bar with Analytics Integration - Week 2 Day 4
 * 
 * Enhanced search component with integrated performance analytics,
 * real-time monitoring, and optimization insights. Builds on the
 * existing AdvancedSearchBar with comprehensive performance tracking.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  Settings, 
  Calendar, 
  Star, 
  ChevronDown, 
  ChevronUp,
  Clock,
  X,
  Filter,
  Zap,
  BarChart3,
  AlertTriangle
} from 'lucide-react'
import { VirtualizedSearchResults } from './VirtualizedSearchResults'
import { PerformanceWidget } from '../analytics/PerformanceWidget'
import { useSmartAutoSave } from '../../hooks/useSmartAutoSave'
import { useSearchPerformanceTracking, usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring'
import { useScratchPadStore } from '../../lib/store'
import { invoke } from '@tauri-apps/api/core'
import type { 
  Note, 
  SearchCriteria, 
  SearchFilters, 
  AdvancedSearchParams,
  NoteFormat,
  SearchResult,
  BooleanSearchResult
} from '../../types'
import type { PerformanceMetrics } from '../../types/analytics'

interface AdvancedSearchBarWithAnalyticsProps {
  onNoteSelect: (note: Note) => void
  initialQuery?: string
  className?: string
  autoFocus?: boolean
  showPerformanceWidget?: boolean
  onAnalyticsDashboard?: () => void
}

interface EnhancedSearchState {
  isAdvanced: boolean
  query: string
  criteria: SearchCriteria
  filters: SearchFilters
  performanceMetrics: PerformanceMetrics | null
  suggestions: string[]
  recentQueries: string[]
  searchResults: Note[]
  isSearching: boolean
  currentPage: number
  totalResults: number
  hasMoreResults: boolean
  usesPagination: boolean
  usesBoolean: boolean
  lastQueryComplexity?: {
    termCount: number
    operatorCount: number
    complexityScore: number
  }
}

const defaultCriteria: SearchCriteria = {
  query: '',
  contentSearch: true,
  dateSearch: false,
  favoriteSearch: false,
  booleanOperators: false
}

const defaultFilters: SearchFilters = {
  dateRange: {
    startDate: null,
    endDate: null
  },
  favorites: undefined,
  format: [],
  minLength: undefined,
  maxLength: undefined
}

export const AdvancedSearchBarWithAnalytics: React.FC<AdvancedSearchBarWithAnalyticsProps> = ({
  onNoteSelect,
  initialQuery = '',
  className = '',
  autoFocus = true,
  showPerformanceWidget = true,
  onAnalyticsDashboard
}) => {
  const { 
    getRecentSearchSuggestions,
    recentSearches
  } = useScratchPadStore()

  // Performance monitoring hooks
  const searchTracking = useSearchPerformanceTracking('combined')
  const performanceMonitoring = usePerformanceMonitoring({
    enableRealTime: true,
    enableAlerts: true,
    enableRecommendations: true,
    updateInterval: 2000
  })

  const [searchState, setSearchState] = useState<EnhancedSearchState>({
    isAdvanced: false,
    query: initialQuery,
    criteria: { ...defaultCriteria, query: initialQuery },
    filters: { ...defaultFilters },
    performanceMetrics: null,
    suggestions: [],
    recentQueries: recentSearches,
    searchResults: [],
    isSearching: false,
    currentPage: 0,
    totalResults: 0,
    hasMoreResults: false,
    usesPagination: false,
    usesBoolean: false
  })

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedSuggestion, setFocusedSuggestion] = useState(0)
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const advancedPanelRef = useRef<HTMLDivElement>(null)
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [autoFocus])

  // Smart auto-save for query debouncing
  const { saveContent: debouncedSearch } = useSmartAutoSave({
    onSave: async (content: string) => {
      if (content.trim()) {
        await performSearch(content)
      }
    },
    minDelay: 300,
    maxDelay: 1000,
    idleThreshold: 500,
    fastTypingThreshold: 3
  })

  // Memoized suggestions based on input
  const suggestions = useMemo(() => {
    if (!searchState.query.trim()) return searchState.recentQueries.slice(0, 5)
    
    const recentSuggestions = getRecentSearchSuggestions(searchState.query)
    const booleanSuggestions = searchState.criteria.booleanOperators ? [
      `${searchState.query} AND `,
      `${searchState.query} OR `,
      `NOT ${searchState.query}`
    ] : []
    
    return [...recentSuggestions, ...booleanSuggestions].slice(0, 8)
  }, [searchState.query, searchState.recentQueries, searchState.criteria.booleanOperators, getRecentSearchSuggestions])

  // Advanced search parameter builder
  const buildSearchParams = useCallback((): AdvancedSearchParams => {
    return {
      criteria: searchState.criteria,
      filters: searchState.filters,
      sortBy: 'relevance',
      sortOrder: 'desc'
    }
  }, [searchState.criteria, searchState.filters])

  // Boolean operator query processor
  const processQueryWithOperators = useCallback((query: string): string => {
    if (!searchState.criteria.booleanOperators) return query

    // Convert user-friendly operators to FTS5 compatible format
    return query
      .replace(/\bAND\b/gi, '')
      .replace(/\bOR\b/gi, 'OR')
      .replace(/\bNOT\b/gi, 'NOT')
      .replace(/\s+/g, ' ')
      .trim()
  }, [searchState.criteria.booleanOperators])

  // Filter results based on advanced criteria
  const applyAdvancedFilters = useCallback((results: Note[]): Note[] => {
    let filteredResults = results

    // Date range filtering
    if (searchState.filters.dateRange?.startDate || searchState.filters.dateRange?.endDate) {
      filteredResults = filteredResults.filter(note => {
        const noteDate = new Date(note.updated_at)
        const startDate = searchState.filters.dateRange?.startDate ? new Date(searchState.filters.dateRange.startDate) : null
        const endDate = searchState.filters.dateRange?.endDate ? new Date(searchState.filters.dateRange.endDate) : null
        
        if (startDate && noteDate < startDate) return false
        if (endDate && noteDate > endDate) return false
        return true
      })
    }

    // Favorites filtering
    if (searchState.filters.favorites !== undefined) {
      filteredResults = filteredResults.filter(note => note.is_favorite === searchState.filters.favorites)
    }

    // Length filtering
    if (searchState.filters.minLength !== undefined) {
      filteredResults = filteredResults.filter(note => note.content.length >= searchState.filters.minLength!)
    }
    
    if (searchState.filters.maxLength !== undefined) {
      filteredResults = filteredResults.filter(note => note.content.length <= searchState.filters.maxLength!)
    }

    // Format filtering
    if (searchState.filters.format && searchState.filters.format.length > 0) {
      filteredResults = filteredResults.filter(note => searchState.filters.format!.includes(note.format))
    }

    return filteredResults
  }, [searchState.filters])

  // Main search function with performance tracking
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchState(prev => ({
        ...prev,
        searchResults: [],
        totalResults: 0,
        hasMoreResults: false,
        performanceMetrics: null
      }))
      return
    }

    setSearchState(prev => ({ ...prev, isSearching: true }))
    
    // Start performance tracking
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    searchTracking.startTracking(queryId, query, searchState.criteria.booleanOperators ? 'boolean' : 'combined')
    
    try {
      const processedQuery = processQueryWithOperators(query)
      let results: Note[]
      let totalCount = 0
      let queryComplexity: any = undefined

      // Choose search method based on criteria
      if (searchState.criteria.booleanOperators) {
        // Use Boolean search
        const booleanResult = await invoke<BooleanSearchResult>("search_notes_boolean_paginated", {
          query: processedQuery,
          page: 0,
          page_size: 50
        })
        
        results = booleanResult.notes
        totalCount = booleanResult.total_count
        queryComplexity = booleanResult.complexity
        
        setSearchState(prev => ({
          ...prev,
          usesBoolean: true,
          usesPagination: true,
          totalResults: totalCount,
          hasMoreResults: booleanResult.has_more,
          lastQueryComplexity: {
            termCount: booleanResult.complexity.term_count,
            operatorCount: booleanResult.complexity.operator_count,
            complexityScore: booleanResult.complexity.complexity_score
          }
        }))
      } else if (searchState.isAdvanced) {
        // Use paginated search for advanced mode
        const paginatedResult = await invoke<SearchResult>("search_notes_paginated", {
          query: processedQuery,
          page: 0,
          page_size: 50
        })
        
        results = paginatedResult.notes
        totalCount = paginatedResult.total_count
        
        setSearchState(prev => ({
          ...prev,
          usesBoolean: false,
          usesPagination: true,
          totalResults: totalCount,
          hasMoreResults: paginatedResult.has_more
        }))
      } else {
        // Use simple search
        results = await invoke<Note[]>("search_notes", { query: processedQuery })
        totalCount = results.length
        
        setSearchState(prev => ({
          ...prev,
          usesBoolean: false,
          usesPagination: false,
          totalResults: totalCount,
          hasMoreResults: false
        }))
      }

      // Apply advanced filters
      const filteredResults = applyAdvancedFilters(results)

      // Complete performance tracking
      const metrics = searchTracking.completeTracking(
        queryId,
        query,
        filteredResults.length,
        false, // Cache hit detection could be enhanced
        queryComplexity?.complexity_score
      )

      setSearchState(prev => ({
        ...prev,
        searchResults: filteredResults,
        performanceMetrics: metrics,
        isSearching: false,
        currentPage: 0
      }))

    } catch (error) {
      console.error('Advanced search with analytics failed:', error)
      searchTracking.cancelTracking(queryId)
      setSearchState(prev => ({ ...prev, isSearching: false }))
    }
  }, [searchTracking, processQueryWithOperators, searchState.criteria.booleanOperators, searchState.isAdvanced, applyAdvancedFilters])

  // Handle query input changes
  const handleQueryChange = useCallback((value: string) => {
    setSearchState(prev => ({
      ...prev,
      query: value,
      criteria: { ...prev.criteria, query: value }
    }))
    
    debouncedSearch(value)
    setShowSuggestions(value.length > 0)
    setFocusedSuggestion(0)
  }, [debouncedSearch])

  // Toggle advanced mode
  const toggleAdvanced = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      isAdvanced: !prev.isAdvanced
    }))
  }, [])

  // Update search criteria
  const updateCriteria = useCallback((updates: Partial<SearchCriteria>) => {
    setSearchState(prev => ({
      ...prev,
      criteria: { ...prev.criteria, ...updates }
    }))
    
    // Re-search if query exists and boolean operators changed
    if (searchState.query.trim() && updates.booleanOperators !== undefined) {
      performSearch(searchState.query)
    }
  }, [searchState.query, performSearch])

  // Update search filters
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...updates }
    }))
    
    // Re-apply filters to existing results if query exists
    if (searchState.query.trim()) {
      performSearch(searchState.query)
    }
  }, [searchState.query, performSearch])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      criteria: { ...defaultCriteria, query: prev.query },
      filters: { ...defaultFilters }
    }))
  }, [])

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: string) => {
    handleQueryChange(suggestion)
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }, [handleQueryChange])

  // Load more results for pagination
  const loadMoreResults = useCallback(async () => {
    if (!searchState.hasMoreResults || searchState.isSearching || !searchState.usesPagination) {
      return
    }

    setSearchState(prev => ({ ...prev, isSearching: true }))

    try {
      const nextPage = searchState.currentPage + 1
      const processedQuery = processQueryWithOperators(searchState.query)

      let newResults: Note[]

      if (searchState.usesBoolean) {
        const booleanResult = await invoke<BooleanSearchResult>("search_notes_boolean_paginated", {
          query: processedQuery,
          page: nextPage,
          page_size: 50
        })
        newResults = booleanResult.notes
        
        setSearchState(prev => ({
          ...prev,
          hasMoreResults: booleanResult.has_more,
          currentPage: nextPage
        }))
      } else {
        const paginatedResult = await invoke<SearchResult>("search_notes_paginated", {
          query: processedQuery,
          page: nextPage,
          page_size: 50
        })
        newResults = paginatedResult.notes
        
        setSearchState(prev => ({
          ...prev,
          hasMoreResults: paginatedResult.has_more,
          currentPage: nextPage
        }))
      }

      // Apply advanced filters to new results
      const filteredNewResults = applyAdvancedFilters(newResults)

      setSearchState(prev => ({
        ...prev,
        searchResults: [...prev.searchResults, ...filteredNewResults],
        isSearching: false
      }))

    } catch (error) {
      console.error('Failed to load more results:', error)
      setSearchState(prev => ({ ...prev, isSearching: false }))
    }
  }, [
    searchState.hasMoreResults,
    searchState.isSearching,
    searchState.usesPagination,
    searchState.currentPage,
    searchState.query,
    searchState.usesBoolean,
    processQueryWithOperators,
    applyAdvancedFilters
  ])

  // Keyboard navigation for suggestions
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedSuggestion(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (suggestions[focusedSuggestion]) {
          selectSuggestion(suggestions[focusedSuggestion])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        break
    }
  }, [showSuggestions, suggestions, focusedSuggestion, selectSuggestion])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      
      // Ctrl+F for simple search focus
      if (isCtrl && e.key === 'f' && !e.shiftKey && !searchState.isAdvanced) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
      
      // Ctrl+Shift+F for advanced search mode
      if (isCtrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        if (!searchState.isAdvanced) {
          toggleAdvanced()
        }
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
      
      // Ctrl+Shift+A for analytics dashboard
      if (isCtrl && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        if (onAnalyticsDashboard) {
          onAnalyticsDashboard()
        } else {
          setShowAnalytics(!showAnalytics)
        }
      }
      
      // Handle suggestion navigation
      if (showSuggestions) {
        handleKeyDown(e)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [searchState.isAdvanced, showSuggestions, showAnalytics, toggleAdvanced, handleKeyDown, onAnalyticsDashboard])

  // Click outside to hide suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Performance status indicator
  const getPerformanceStatus = () => {
    if (!searchState.performanceMetrics) return null
    
    const { queryTime } = searchState.performanceMetrics
    if (queryTime < 50) return { color: 'text-green-600', icon: '🟢', label: 'Excellent' }
    if (queryTime < 100) return { color: 'text-blue-600', icon: '🔵', label: 'Good' }
    if (queryTime < 200) return { color: 'text-yellow-600', icon: '🟡', label: 'Slow' }
    return { color: 'text-red-600', icon: '🔴', label: 'Critical' }
  }

  const performanceStatus = getPerformanceStatus()

  return (
    <div className={`advanced-search-container-with-analytics ${className}`}>
      {/* Performance Widget */}
      {showPerformanceWidget && (
        <div className="mb-4">
          <PerformanceWidget
            compact={!showAnalytics}
            showDetails={showAnalytics}
            onClick={onAnalyticsDashboard || (() => setShowAnalytics(!showAnalytics))}
            showAlerts={true}
            className="w-full"
          />
        </div>
      )}

      {/* Main Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3 pointer-events-none">
            <Search 
              size={16} 
              className={`transition-colors ${searchState.isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} 
            />
          </div>
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchState.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={searchState.isAdvanced ? "Advanced search with filters..." : "Search notes... (Ctrl+F)"}
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-32 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            aria-label="Search notes"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            role="combobox"
            autoComplete="off"
          />
          
          <div className="absolute right-3 flex items-center space-x-2">
            {/* Performance indicator */}
            {performanceStatus && (
              <div className={`flex items-center text-xs ${performanceStatus.color} cursor-help`} 
                   title={`Performance: ${performanceStatus.label} (${searchState.performanceMetrics?.queryTime.toFixed(0)}ms)`}>
                <span className="mr-1">{performanceStatus.icon}</span>
                <Zap size={12} className="mr-1" />
                {searchState.performanceMetrics?.queryTime.toFixed(0)}ms
              </div>
            )}

            {/* Query complexity indicator */}
            {searchState.lastQueryComplexity && (
              <div className="flex items-center text-xs text-purple-600 cursor-help"
                   title={`Query complexity: ${searchState.lastQueryComplexity.complexityScore} (${searchState.lastQueryComplexity.termCount} terms, ${searchState.lastQueryComplexity.operatorCount} operators)`}>
                <span className="mr-1">🧠</span>
                {searchState.lastQueryComplexity.complexityScore}
              </div>
            )}

            {/* Analytics toggle */}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`p-1 rounded-md transition-colors ${
                showAnalytics 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Toggle performance analytics (Ctrl+Shift+A)"
              aria-label="Toggle performance analytics"
            >
              <BarChart3 size={14} />
            </button>
            
            {/* Advanced toggle */}
            <button
              onClick={toggleAdvanced}
              className={`p-1 rounded-md transition-colors ${
                searchState.isAdvanced 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Toggle advanced search (Ctrl+Shift+F)"
              aria-label="Toggle advanced search"
            >
              <Settings size={14} />
            </button>
            
            {/* Clear query */}
            {searchState.query && (
              <button
                onClick={() => handleQueryChange('')}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                ref={(el) => {
                  suggestionRefs.current[index] = el
                }}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  index === focusedSuggestion 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => selectSuggestion(suggestion)}
                role="option"
                aria-selected={index === focusedSuggestion}
              >
                <div className="flex items-center">
                  <Clock size={12} className="mr-2 text-gray-400" />
                  {suggestion}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Search Panel */}
      {searchState.isAdvanced && (
        <div 
          ref={advancedPanelRef}
          className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4 animate-in slide-in-from-top-2"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Filter size={14} className="mr-2" />
              Advanced Search Options
            </h3>
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear all filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Criteria */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Search Criteria</h4>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={searchState.criteria.contentSearch}
                  onChange={(e) => updateCriteria({ contentSearch: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Search content</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={searchState.criteria.booleanOperators}
                  onChange={(e) => updateCriteria({ booleanOperators: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Boolean operators (AND, OR, NOT)</span>
              </label>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Filters</h4>
              
              {/* Favorites filter */}
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={searchState.filters.favorites === true}
                  onChange={(e) => updateFilters({ 
                    favorites: e.target.checked ? true : undefined 
                  })}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <Star size={14} className="text-yellow-500" />
                <span className="text-sm">Favorites only</span>
              </label>

              {/* Date range */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calendar size={14} className="text-gray-500" />
                  <span className="text-sm">Date range</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={searchState.filters.dateRange?.startDate || ''}
                    onChange={(e) => updateFilters({
                      dateRange: {
                        ...searchState.filters.dateRange,
                        startDate: e.target.value || null
                      }
                    })}
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={searchState.filters.dateRange?.endDate || ''}
                    onChange={(e) => updateFilters({
                      dateRange: {
                        ...searchState.filters.dateRange,
                        endDate: e.target.value || null
                      }
                    })}
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Content length */}
              <div className="space-y-2">
                <span className="text-sm">Content length</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={searchState.filters.minLength || ''}
                    onChange={(e) => updateFilters({
                      minLength: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    placeholder="Min chars"
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    min="0"
                  />
                  <input
                    type="number"
                    value={searchState.filters.maxLength || ''}
                    onChange={(e) => updateFilters({
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                    placeholder="Max chars"
                    className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics Display */}
          {searchState.performanceMetrics && (
            <div className="mt-4 p-3 bg-white rounded-md border">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center space-x-4">
                  <span>
                    <strong>{searchState.totalResults}</strong> total results
                  </span>
                  <span>
                    <strong>{searchState.searchResults.length}</strong> filtered
                  </span>
                  <span>
                    <strong>{searchState.performanceMetrics.queryTime.toFixed(0)}ms</strong> query time
                  </span>
                  {searchState.performanceMetrics.cacheHit && (
                    <span className="text-green-600">⚡ Cache hit</span>
                  )}
                  {searchState.lastQueryComplexity && (
                    <span className="text-purple-600">
                      🧠 Complexity: {searchState.lastQueryComplexity.complexityScore}
                    </span>
                  )}
                </div>
                {searchState.hasMoreResults && (
                  <span className="text-blue-600">+ More available</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchState.query.trim() && (
        <div className="mt-4">
          <VirtualizedSearchResults
            searchResult={{
              notes: searchState.searchResults,
              total_count: searchState.totalResults,
              page: searchState.currentPage,
              page_size: 50,
              has_more: searchState.hasMoreResults,
              query_time_ms: searchState.performanceMetrics?.queryTime || 0
            }}
            query={searchState.query}
            onNoteClick={onNoteSelect}
            className="border border-gray-200 rounded-lg overflow-hidden"
            showRelevanceScore={true}
            enableSnippetExpansion={true}
          />
          
          {/* Load More Button */}
          {searchState.hasMoreResults && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMoreResults}
                disabled={searchState.isSearching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {searchState.isSearching ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdvancedSearchBarWithAnalytics