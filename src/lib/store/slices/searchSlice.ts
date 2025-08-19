import { StateCreator } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import type { Note, ApiError } from "../../../types"

interface SearchResult {
  query: string
  results: Note[]
  timestamp: number
}

export interface SearchSlice {
  // State
  searchQuery: string
  searchResults: Note[]
  isSearching: boolean
  selectedSearchIndex: number
  searchCache: Map<string, SearchResult>
  recentSearches: string[]
  searchHistory: SearchResult[]
  
  // Actions
  setSearchQuery: (query: string) => void
  searchNotes: (query: string) => Promise<Note[]>
  performSearch: (query: string) => Promise<void>
  setSelectedSearchIndex: (index: number) => void
  clearSearch: () => void
  clearSearchCache: () => void
  addToSearchHistory: (query: string, results: Note[]) => void
  removeFromSearchHistory: (query: string) => void
  clearSearchHistory: () => void
  
  // Selectors
  getCachedSearch: (query: string) => SearchResult | undefined
  getRecentSearchSuggestions: (input: string) => string[]
  isSearchCacheValid: (query: string, maxAge?: number) => boolean
}

const SEARCH_CACHE_MAX_AGE = 5 * 60 * 1000 // 5 minutes
const MAX_SEARCH_HISTORY = 50
const MAX_RECENT_SEARCHES = 10

export const createSearchSlice: StateCreator<
  SearchSlice,
  [],
  [],
  SearchSlice
> = (set, get) => ({
  // Initial state
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  selectedSearchIndex: 0,
  searchCache: new Map(),
  recentSearches: [],
  searchHistory: [],

  // Actions
  setSearchQuery: (query) => set({ 
    searchQuery: query, 
    selectedSearchIndex: 0 
  }),

  searchNotes: async (query: string) => {
    if (!query.trim()) return []

    const { getCachedSearch, isSearchCacheValid } = get()
    
    // Check cache first
    const cached = getCachedSearch(query)
    if (cached && isSearchCacheValid(query)) {
      return cached.results
    }

    try {
      const results = await invoke<Note[]>("combined_search_notes", { query })
      
      // Update cache
      set(state => {
        const newCache = new Map(state.searchCache)
        newCache.set(query, {
          query,
          results,
          timestamp: Date.now()
        })
        
        // Limit cache size (keep only last 20 searches)
        if (newCache.size > 20) {
          const entries = Array.from(newCache.entries())
          entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
          const limitedEntries = entries.slice(0, 20)
          return { searchCache: new Map(limitedEntries) }
        }
        
        return { searchCache: newCache }
      })
      
      return results
    } catch (error) {
      const apiError = error as ApiError
      throw apiError
    }
  },

  performSearch: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: query, selectedSearchIndex: 0 })
      return
    }

    set({ isSearching: true, searchQuery: query, selectedSearchIndex: 0 })
    
    try {
      const results = await get().searchNotes(query)
      
      set(state => {
        // Add to search history
        get().addToSearchHistory(query, results)
        
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
    selectedSearchIndex: 0
  }),

  clearSearchCache: () => set({ searchCache: new Map() }),

  addToSearchHistory: (query: string, results: Note[]) => {
    if (!query.trim()) return

    set(state => {
      const existingIndex = state.searchHistory.findIndex(h => h.query === query)
      let newHistory = [...state.searchHistory]
      
      const searchResult: SearchResult = {
        query,
        results,
        timestamp: Date.now()
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
  }
})