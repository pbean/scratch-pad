import type { ReactNode } from 'react'

// View types for navigation
export type View = 'note' | 'search-history' | 'settings'

// Layout mode for window management - updated to include all test values
export type LayoutMode = 'default' | 'compact' | 'expanded' | 'fullscreen' | 'half'

// Core note type
export interface Note {
  id: number
  nickname?: string | null  // Made properly optional
  content: string
  search_content: string
  word_count: number
  format: NoteFormat
  language: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
  path?: string  // Added for test compatibility
}

export interface SearchResult {
  notes: Note[]
  total_count: number
  page: number
  page_size: number
  has_more: boolean
  query_time_ms: number
}

// Search history entry for tracking search patterns
export interface SearchHistoryEntry {
  query: string
  results: Note[]
  timestamp: number
  resultCount?: number
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

export interface SearchSnippet {
  text: string
  startIndex: number
  endIndex: number
  highlightIndices: Array<{ start: number; end: number }>
  highlights: string[]  // Required, with default empty array
  hasMoreBefore?: boolean  // Added for compatibility
  hasMoreAfter?: boolean  // Added for compatibility
  contextStart: number  // Added for searchHighlighting.ts compatibility
  contextEnd?: number   // Added for searchHighlighting.ts compatibility
}

export interface HighlightMatch {
  text: string
  startIndex: number
  endIndex: number
  isMatch: boolean
  relevanceScore?: number
  start: number  // Required for test compatibility
  end: number    // Added missing 'end' property
  term: string   // Required for test compatibility
  type: 'exact' | 'partial' | 'fuzzy' | 'primary' | 'secondary'  // Updated to include all test values
}

// Helper type for creating HighlightMatch objects from different formats
export type HighlightMatchLike = Partial<HighlightMatch> & (
  | { start: number; end: number; type: string; term: string }
  | { startIndex: number; endIndex: number; text: string; isMatch: boolean }
)

// Utility function to normalize HighlightMatch objects
export function normalizeHighlightMatch(match: HighlightMatchLike): HighlightMatch {
  return {
    text: match.text || '',
    startIndex: match.startIndex ?? match.start ?? 0,
    endIndex: match.endIndex ?? match.end ?? 0,
    isMatch: match.isMatch ?? true,
    relevanceScore: match.relevanceScore,
    start: match.start ?? match.startIndex ?? 0,
    end: match.end ?? match.endIndex ?? 0,
    term: match.term || '',
    type: (match.type as any) || 'primary'
  }
}

export interface SearchHighlightResult {
  noteId: number
  title: string
  snippets: SearchSnippet[]
  titleMatches: HighlightMatch[]
  relevanceScore: number
  totalMatches: number
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
  icon?: ReactNode
  shortcut?: string
  category?: string
  action: () => void | Promise<void>
  disabled?: boolean  // Added for compatibility
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  autoSave: boolean
  autoSaveDelay: number
  showLineNumbers: boolean
  wordWrap: boolean
  fontSize: number
  fontFamily: string
  globalShortcut: string
  saveOnBlur: boolean
  confirmDelete: boolean
  showWordCount: boolean
  enableSpellCheck: boolean
  defaultNoteFormat: NoteFormat
  note_directory: string
  searchHighlighting: {
    enabled: boolean
    maxSnippets: number
    contextLength: number
  }
  performance: {
    enableAnalytics: boolean
    enableCaching: boolean
    cacheMaxAge: number
    maxCacheSize: number
  }
  security: {
    encryptNotes: boolean
    requirePassword: boolean
    sessionTimeout: number
  }
  accessibility: {
    highContrast: boolean
    reduceMotion: boolean
    screenReaderOptimized: boolean
  }
}

export type NoteFormat = 'plaintext' | 'markdown'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: string
}

export interface WindowState {
  isVisible: boolean
  isAlwaysOnTop: boolean
  position?: { x: number; y: number }
  size?: { width: number; height: number }
}

export interface GlobalShortcutConfig {
  shortcut: string
  enabled: boolean
  action: 'toggle_window' | 'new_note' | 'search' | 'quick_capture'
}

// Week 2 Enhanced Types

export interface DatabaseInfo {
  path: string
  size: number
  noteCount: number
  lastVacuum: string | null
  version: string
}

export interface SystemInfo {
  version: string
  platform: string
  arch: string
  isDevelopment: boolean
  memoryUsage?: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
}

export interface PerformanceMetrics {
  timestamp: number
  queryTime: number
  resultCount: number
  cacheHit: boolean
  memoryUsage?: number
}

// Search Performance Metrics interface
export interface SearchPerformanceMetrics {
  queryTime: number
  resultCount: number
  cacheHit: boolean
  timestamp: number
  query?: string
  complexity?: QueryComplexity
  suggestions?: Suggestion[]
}

// Settings Form Data interface
export interface SettingsFormData {
  theme?: 'light' | 'dark' | 'system'
  autoSave?: boolean
  autoSaveDelay?: string  // Form field (string that gets converted to number)
  showLineNumbers?: boolean
  wordWrap?: boolean
  fontSize?: number
  fontFamily?: string
  globalShortcut: string
  saveOnBlur?: boolean
  confirmDelete?: boolean
  showWordCount?: boolean
  enableSpellCheck?: boolean
  defaultNoteFormat: NoteFormat
  note_directory?: string
  // Additional properties for the settings form
  windowWidth?: string  // Form field (string that gets converted to number)
  windowHeight?: string  // Form field (string that gets converted to number) 
  uiFont?: string
  editorFont?: string
  layoutMode?: string
  searchLimit?: string
  fuzzySearchThreshold?: string
  searchHighlighting?: {
    enabled: boolean
    maxSnippets: number
    contextLength: number
  }
  performance?: {
    enableAnalytics: boolean
    enableCaching: boolean
    cacheMaxAge: number
    maxCacheSize: number
  }
  security?: {
    encryptNotes: boolean
    requirePassword: boolean
    sessionTimeout: number
  }
  accessibility?: {
    highContrast: boolean
    reduceMotion: boolean
    screenReaderOptimized: boolean
  }
}

// Performance Analytics interface (placeholder for missing implementation)
export interface PerformanceAnalytics {
  track(event: string, data?: any): void
  updateConfig(config: any): void
  onAlert(callback: (alert: any) => void): () => void
  onMetricsUpdate(callback: (metrics: any) => void): () => void
  getRealTimeMetrics(): any
  start(): void
  stop(): void
  reset(): void
  getMetrics(): PerformanceMetrics
}

export interface BackupInfo {
  id: string
  timestamp: number
  size: number
  noteCount: number
  path?: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  error?: string
}

export interface ExportOptions {
  format: 'json' | 'markdown' | 'txt' | 'html'
  includeMetadata: boolean
  sortBy: 'created_at' | 'updated_at' | 'title'
  sortOrder: 'asc' | 'desc'
  filterFavorites?: boolean
  dateRange?: {
    start: string
    end: string
  }
}

export interface ImportOptions {
  format: 'json' | 'markdown' | 'txt'
  overwriteExisting: boolean
  preserveTimestamps: boolean
  importFavorites: boolean
  defaultFormat: NoteFormat
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  stats: {
    totalNotes: number
    validNotes: number
    invalidNotes: number
    duplicates: number
  }
}

export interface ValidationIssue {
  noteId?: number
  severity: 'error' | 'warning' | 'info'
  type: 'missing_content' | 'invalid_format' | 'duplicate' | 'corrupted_metadata'
  message: string
  suggestion?: string
}

export interface Suggestion {
  id: string
  text: string
  type: 'recent' | 'popular' | 'completion'
  priority: number
  metadata?: Record<string, unknown>
}

export interface SearchSuggestionSource {
  getSuggestions(input: string, context?: Record<string, unknown>): Promise<Suggestion[]>
  priority: number
  enabled: boolean
}

// Analytics and optimization types
export interface OptimizationSuggestion {
  id: string
  type: 'performance' | 'storage' | 'workflow'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  implemented: boolean
  action?: () => Promise<void>
}

export interface UsageStatistics {
  totalNotes: number
  notesCreatedThisWeek: number
  searchesPerformed: number
  favoriteNotes: number
  avgNoteLength: number
  mostUsedFormat: NoteFormat
  mostActiveDay: string
  timeSpentWriting: number // in minutes
}

// Advanced TypeScript utility types for type safety
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type StrictPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type NonNullable<T> = T extends null | undefined ? never : T

// Event system types
export interface AppEvent<T = unknown> {
  type: string
  payload: T
  timestamp: number
  id: string
}

export type EventHandler<T = unknown> = (event: AppEvent<T>) => void | Promise<void>

export interface EventEmitter {
  on<T>(eventType: string, handler: EventHandler<T>): void
  off<T>(eventType: string, handler: EventHandler<T>): void
  emit<T>(eventType: string, payload: T): void
}

// Type guards for runtime type checking
export const isNote = (obj: unknown): obj is Note => {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'content' in obj &&
         typeof (obj as Note).id === 'number' &&
         typeof (obj as Note).content === 'string'
}

export const isSearchResult = (obj: unknown): obj is SearchResult => {
  return typeof obj === 'object' && 
         obj !== null && 
         'notes' in obj && 
         Array.isArray((obj as SearchResult).notes)
}

export const isSearchHistoryEntry = (obj: unknown): obj is SearchHistoryEntry => {
  return typeof obj === 'object' && 
         obj !== null && 
         'query' in obj && 
         'results' in obj &&
         'timestamp' in obj &&
         typeof (obj as SearchHistoryEntry).query === 'string' &&
         Array.isArray((obj as SearchHistoryEntry).results) &&
         typeof (obj as SearchHistoryEntry).timestamp === 'number'
}

export const isSettings = (obj: unknown): obj is Settings => {
  return typeof obj === 'object' && 
         obj !== null && 
         'theme' in obj && 
         'autoSave' in obj
}