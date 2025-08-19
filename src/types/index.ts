export type View = "note" | "search-history" | "settings"

export type NoteFormat = "plaintext" | "markdown"

export type LayoutMode = "default" | "half" | "full"

export interface Note {
  id: number
  content: string
  format: NoteFormat
  nickname?: string
  path: string
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface SearchResult {
  notes: Note[]
  total_count: number
  page: number
  page_size: number
  has_more: boolean
  query_time_ms: number
}

// Advanced search interfaces for Day 4 Week 2 implementation
export interface SearchCriteria {
  query: string
  contentSearch: boolean
  dateSearch: boolean
  favoriteSearch: boolean
  booleanOperators: boolean
}

export interface SearchFilters {
  dateRange?: {
    startDate: string | null
    endDate: string | null
  }
  favorites?: boolean
  format?: NoteFormat[]
  minLength?: number
  maxLength?: number
}

export interface AdvancedSearchParams {
  criteria: SearchCriteria
  filters: SearchFilters
  sortBy?: 'relevance' | 'date' | 'length'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchPerformanceMetrics {
  queryTime: number
  resultCount: number
  cacheHit: boolean
  suggestions?: string[]
}

// Day 4 Week 2: Search Highlighting and Snippets Interfaces
export interface HighlightMatch {
  start: number
  end: number
  type: 'primary' | 'secondary' | 'field'
  term: string
}

export interface SearchSnippet {
  text: string
  highlights: HighlightMatch[]
  contextStart: number
  contextEnd: number
  hasMoreBefore: boolean
  hasMoreAfter: boolean
}

export interface EnhancedSearchResult extends SearchResult {
  snippets: Record<number, SearchSnippet[]> // noteId -> snippets
  highlightedTitles: Record<number, HighlightMatch[]> // noteId -> title highlights
  totalMatches: number
  query: string
  queryTerms: string[]
  booleanOperators: string[]
}

export interface SearchHighlightOptions {
  maxSnippets: number
  snippetLength: number
  contextWindow: number
  highlightClassName: string
  secondaryHighlightClassName: string
  fieldHighlightClassName: string
  enableRegexSafe: boolean
  caseSensitive: boolean
}

export interface BooleanSearchResult {
  notes: Note[]
  total_count: number
  page: number
  page_size: number
  has_more: boolean
  query_time_ms: number
  complexity: QueryComplexity
}

export interface QueryComplexity {
  term_count: number
  operator_count: number
  nesting_depth: number
  has_field_searches: boolean
  has_phrase_searches: boolean
  complexity_score: number
}

export interface ApiError {
  code: string
  message: string
}

export interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
  disabled?: boolean
}

export interface GlobalShortcutInfo {
  current: string | null
  suggestions: string[]
  isRegistered: (shortcut: string) => Promise<boolean>
  canRegister: (shortcut: string) => Promise<boolean>
}

export interface Settings {
  global_shortcut: string
  ui_font: string
  editor_font: string
  default_note_format: NoteFormat
  layout_mode: LayoutMode
  window_width: number
  window_height: number
  auto_save_delay_ms: number
  search_limit: number
  fuzzy_search_threshold: number
}

export interface SettingsFormData {
  globalShortcut: string
  uiFont: string
  editorFont: string
  defaultNoteFormat: NoteFormat
  layoutMode: LayoutMode
  windowWidth: string
  windowHeight: string
  autoSaveDelay: string
  searchLimit: string
  fuzzySearchThreshold: string
}

// Re-export analytics types for convenience
export type {
  PerformanceMetrics,
  PerformanceTrend,
  PerformanceBudget,
  PerformanceAlert,
  SearchPattern,
  CacheAnalytics,
  SystemPerformance,
  OptimizationRecommendation,
  PerformanceReport,
  AnalyticsDashboardConfig,
  AnalyticsEvent,
  RealTimeMetrics,
  AnalyticsDashboardProps
} from './analytics'