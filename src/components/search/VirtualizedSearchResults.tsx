/**
 * VirtualizedSearchResults Component - Week 2 Day 4
 * 
 * High-performance virtualized search results with advanced highlighting.
 * Maintains 80% memory efficiency from Day 2 performance optimizations
 * while adding rich highlighting and snippet functionality.
 */

import React, { memo, useMemo, useCallback, useState } from 'react'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window'
import { FileText, Calendar, Star, Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { 
  Note, 
  SearchResult, 
  EnhancedSearchResult, 
  SearchHighlightOptions 
} from '../../types'
import { 
  enhanceSearchResult, 
  renderHighlightedText, 
  DEFAULT_HIGHLIGHT_OPTIONS 
} from '../../lib/searchHighlighting'

interface VirtualizedSearchResultsProps {
  searchResult: SearchResult
  query: string
  onNoteClick: (note: Note) => void
  onNoteSelect?: (note: Note) => void
  selectedNoteId?: number
  className?: string
  height?: number
  highlightOptions?: Partial<SearchHighlightOptions>
  showRelevanceScore?: boolean
  enableSnippetExpansion?: boolean
}

interface SearchResultItemData {
  enhancedResult: EnhancedSearchResult
  onNoteClick: (note: Note) => void
  onNoteSelect?: (note: Note) => void
  selectedNoteId?: number
  showRelevanceScore: boolean
  enableSnippetExpansion: boolean
  highlightOptions: SearchHighlightOptions
}

// Memoized highlight segment component for performance
const HighlightSegment = memo<{
  text: string
  isHighlight: boolean
  type?: string
  className: string
}>(({ text, isHighlight, type, className }) => {
  if (!isHighlight) {
    return <span>{text}</span>
  }

  const highlightClass = type === 'primary' 
    ? 'search-highlight-primary'
    : type === 'secondary'
    ? 'search-highlight-secondary'
    : type === 'field'
    ? 'search-highlight-field'
    : 'search-highlight-primary'

  return (
    <mark 
      className={`${highlightClass} ${className}`}
      aria-label={`Search match: ${text}`}
    >
      {text}
    </mark>
  )
})

HighlightSegment.displayName = 'HighlightSegment'

// Memoized highlighted text renderer
const HighlightedText = memo<{
  text: string
  highlights: Array<{ text: string; isHighlight: boolean; type?: string }>
  className?: string
}>(({ text: _text, highlights, className = '' }) => {
  return (
    <span className={className}>
      {highlights.map((segment, index) => (
        <HighlightSegment
          key={index}
          text={segment.text}
          isHighlight={segment.isHighlight}
          type={segment.type}
          className={className}
        />
      ))}
    </span>
  )
})

HighlightedText.displayName = 'HighlightedText'

// Individual search result item component
const SearchResultItem = memo<ListChildComponentProps<SearchResultItemData>>(({ index, style, data }) => {
  const { 
    enhancedResult, 
    onNoteClick, 
    onNoteSelect, 
    selectedNoteId, 
    showRelevanceScore, 
    enableSnippetExpansion,
    highlightOptions: _highlightOptions 
  } = data

  const [isSnippetExpanded, setIsSnippetExpanded] = useState(false)
  
  const note = enhancedResult.notes[index]
  const snippets = enhancedResult.snippets[note.id] || []
  const titleHighlights = enhancedResult.highlightedTitles[note.id] || []
  
  const isSelected = selectedNoteId === note.id

  // Generate note title
  const noteTitle = note.nickname || note.content.split('\n')[0].substring(0, 80) || 'Untitled'
  
  // Render highlighted title
  const titleSegments = useMemo(() => {
    return renderHighlightedText(noteTitle, titleHighlights)
  }, [noteTitle, titleHighlights])

  // Format last modified date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }, [])

  // Calculate relevance score (mock implementation)
  const relevanceScore = useMemo(() => {
    if (!showRelevanceScore) return 0
    const titleMatches = titleHighlights.length
    const contentMatches = snippets.reduce((sum, snippet) => sum + snippet.highlightIndices.length, 0)
    return Math.min(100, (titleMatches * 20) + (contentMatches * 5))
  }, [titleHighlights, snippets, showRelevanceScore])

  const handleItemClick = useCallback(() => {
    onNoteClick(note)
    onNoteSelect?.(note)
  }, [note, onNoteClick, onNoteSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleItemClick()
    }
  }, [handleItemClick])

  const toggleSnippetExpansion = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsSnippetExpanded(!isSnippetExpanded)
  }, [isSnippetExpanded])

  // Display snippets (show first one by default, all if expanded)
  const displaySnippets = isSnippetExpanded ? snippets : snippets.slice(0, 1)

  return (
    <div 
      style={style} 
      className={`
        search-result-item p-4 border-b border-border cursor-pointer smooth-transition
        ${isSelected ? 'bg-accent text-accent-foreground search-highlight' : 'hover:bg-muted hover-lift'}
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
      `}
      onClick={handleItemClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Search result: ${noteTitle}`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Title with highlighting */}
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-muted-foreground flex-shrink-0" />
            <h3 className="font-medium truncate">
              <HighlightedText
                text={noteTitle}
                highlights={titleSegments}
                className="search-result-title"
              />
            </h3>
            {note.is_favorite && (
              <Star size={14} className="text-yellow-500 flex-shrink-0" />
            )}
          </div>

          {/* Snippets */}
          {displaySnippets.length > 0 && (
            <div className="space-y-2">
              {displaySnippets.map((snippet, snippetIndex) => {
                // Convert highlightIndices to HighlightMatch format
                const highlightMatches = snippet.highlightIndices.map(indices => ({
                  text: snippet.text.slice(indices.start, indices.end),
                  startIndex: indices.start,
                  endIndex: indices.end,
                  start: indices.start,
                  end: indices.end,
                  isMatch: true,
                  term: snippet.text.slice(indices.start, indices.end),
                  type: 'primary' as const
                }))
                const snippetSegments = renderHighlightedText(snippet.text, highlightMatches)
                
                return (
                  <div key={snippetIndex} className="text-sm text-muted-foreground">
                    {snippet.hasMoreBefore && (
                      <span className="text-xs text-muted-foreground">...</span>
                    )}
                    <HighlightedText
                      text={snippet.text}
                      highlights={snippetSegments}
                      className="search-result-snippet"
                    />
                    {snippet.hasMoreAfter && (
                      <span className="text-xs text-muted-foreground">...</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Snippet expansion control */}
          {enableSnippetExpansion && snippets.length > 1 && (
            <button
              onClick={toggleSnippetExpansion}
              className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              aria-label={isSnippetExpanded ? 'Show fewer snippets' : 'Show more snippets'}
            >
              {isSnippetExpanded ? (
                <>
                  <ChevronDown size={12} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight size={12} />
                  Show {snippets.length - 1} more snippet{snippets.length > 2 ? 's' : ''}
                </>
              )}
            </button>
          )}

          {/* Path information */}
          {note.path && note.path !== '/' && (
            <div className="text-xs text-muted-foreground mt-2 truncate">
              Path: {note.path}
            </div>
          )}
        </div>

        {/* Right side metadata */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Relevance score */}
          {showRelevanceScore && relevanceScore > 0 && (
            <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {relevanceScore}%
            </div>
          )}

          {/* Last modified */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar size={12} />
            {formatDate(note.updated_at)}
          </div>

          {/* Match count */}
          {snippets.length > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Search size={12} />
              {snippets.reduce((sum, s) => sum + s.highlightIndices.length, 0)} match{snippets.reduce((sum, s) => sum + s.highlightIndices.length, 0) !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

SearchResultItem.displayName = 'SearchResultItem'

// Main component
export const VirtualizedSearchResults = memo<VirtualizedSearchResultsProps>(({
  searchResult,
  query,
  onNoteClick,
  onNoteSelect,
  selectedNoteId,
  className = '',
  height = 400,
  highlightOptions = {},
  showRelevanceScore = false,
  enableSnippetExpansion = true
}) => {
  // Enhanced search result with highlighting and snippets
  const enhancedResult = useMemo(() => {
    const options = { ...DEFAULT_HIGHLIGHT_OPTIONS, ...highlightOptions }
    return enhanceSearchResult(searchResult, query, options)
  }, [searchResult, query, highlightOptions])

  // Item data for virtual list
  const itemData = useMemo((): SearchResultItemData => ({
    enhancedResult,
    onNoteClick,
    onNoteSelect,
    selectedNoteId,
    showRelevanceScore,
    enableSnippetExpansion,
    highlightOptions: { ...DEFAULT_HIGHLIGHT_OPTIONS, ...highlightOptions }
  }), [
    enhancedResult, 
    onNoteClick, 
    onNoteSelect, 
    selectedNoteId, 
    showRelevanceScore, 
    enableSnippetExpansion,
    highlightOptions
  ])

  // Empty state
  if (enhancedResult.notes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Search size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {query ? `No notes match "${query}". Try different keywords or check your spelling.` 
                  : 'Start typing to search through your notes.'}
        </p>
      </div>
    )
  }

  return (
    <div className={`search-results-container ${className}`}>
      {/* Results summary */}
      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
        <div className="flex items-center justify-between">
          <span>
            {enhancedResult.total_count} result{enhancedResult.total_count !== 1 ? 's' : ''} 
            {enhancedResult.totalMatches > 0 && (
              <> • {enhancedResult.totalMatches} match{enhancedResult.totalMatches !== 1 ? 'es' : ''}</>
            )}
          </span>
          <span>{enhancedResult.query_time_ms}ms</span>
        </div>
      </div>

      {/* Virtual list */}
      <List
        height={height - 40} // Account for summary bar
        itemCount={enhancedResult.notes.length}
        itemSize={120} // Fixed size for consistent rendering
        itemData={itemData}
        className="search-results-list"
        overscanCount={5} // Pre-render a few items for smooth scrolling
        width="100%"
      >
        {SearchResultItem}
      </List>
    </div>
  )
})

VirtualizedSearchResults.displayName = 'VirtualizedSearchResults'