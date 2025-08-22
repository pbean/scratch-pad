/**
 * HighlightedSearchResult Component - Week 2 Day 4
 * 
 * Enhanced search result component with advanced highlighting and snippet display.
 * Designed for standalone use or integration with existing search interfaces.
 */

import React, { memo, useMemo, useCallback, useState } from 'react'
import { FileText, Calendar, Star, Search, ChevronDown, ChevronRight, Eye, ExternalLink } from 'lucide-react'
import type { 
  Note, 
 
  SearchSnippet, 
  SearchHighlightOptions 
} from '../../types'
import { 
  findMatches, 
  generateSnippets, 
  renderHighlightedText, 
  findTitleMatches,
  DEFAULT_HIGHLIGHT_OPTIONS 
} from '../../lib/searchHighlighting'

interface HighlightedSearchResultProps {
  note: Note
  query: string
  searchTerms?: string[]
  onNoteClick?: (note: Note) => void
  onNoteSelect?: (note: Note) => void
  isSelected?: boolean
  className?: string
  highlightOptions?: Partial<SearchHighlightOptions>
  showRelevanceScore?: boolean
  showPath?: boolean
  showSnippets?: boolean
  maxSnippets?: number
  enablePreview?: boolean
  compact?: boolean
}

// Memoized highlight segment with accessibility support
const HighlightSegment = memo<{
  text: string
  isHighlight: boolean
  type?: string
  className?: string
}>(({ text, isHighlight, type, className = '' }) => {
  if (!isHighlight) {
    return <span>{text}</span>
  }

  const highlightClass = `search-highlight-${type || 'primary'}`

  return (
    <mark 
      className={`${highlightClass} ${className} px-1 py-0.5 rounded text-xs font-medium`}
      aria-label={`Search match: ${text}`}
      style={{
        backgroundColor: type === 'primary' ? 'hsl(var(--primary) / 0.2)' :
                        type === 'secondary' ? 'hsl(var(--secondary) / 0.2)' :
                        type === 'field' ? 'hsl(var(--accent) / 0.3)' :
                        'hsl(var(--primary) / 0.2)',
        color: type === 'primary' ? 'hsl(var(--primary))' :
               type === 'secondary' ? 'hsl(var(--secondary))' :
               type === 'field' ? 'hsl(var(--accent-foreground))' :
               'hsl(var(--primary))'
      }}
    >
      {text}
    </mark>
  )
})

HighlightSegment.displayName = 'HighlightSegment'

// Rendered highlighted text component
const HighlightedText = memo<{
  text: string
  highlights: Array<{ text: string; isHighlight: boolean; type?: string }>
  className?: string
}>(({ text, highlights, className = '' }) => {
  if (highlights.length === 0) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {highlights.map((segment, index) => (
        <HighlightSegment
          key={index}
          text={segment.text}
          isHighlight={segment.isHighlight}
          type={segment.type}
        />
      ))}
    </span>
  )
})

HighlightedText.displayName = 'HighlightedText'

// Snippet component with expansion support
const SnippetDisplay = memo<{
  snippets: SearchSnippet[]
  maxSnippets: number
  enableExpansion: boolean
}>(({ snippets, maxSnippets, enableExpansion }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const displaySnippets = isExpanded ? snippets : snippets.slice(0, maxSnippets)
  
  const toggleExpansion = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  if (snippets.length === 0) return null

  return (
    <div className="space-y-2">
      {displaySnippets.map((snippet, index) => {
        const segments = renderHighlightedText(snippet.text, snippet.highlights)
        
        return (
          <div key={index} className="text-sm text-muted-foreground leading-relaxed">
            {snippet.hasMoreBefore && (
              <span className="text-xs text-muted-foreground/70">...</span>
            )}
            <HighlightedText
              text={snippet.text}
              highlights={segments}
              className="search-snippet"
            />
            {snippet.hasMoreAfter && (
              <span className="text-xs text-muted-foreground/70">...</span>
            )}
          </div>
        )
      })}

      {enableExpansion && snippets.length > maxSnippets && (
        <button
          onClick={toggleExpansion}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-2 transition-colors"
          aria-label={isExpanded ? 'Show fewer snippets' : 'Show more snippets'}
        >
          {isExpanded ? (
            <>
              <ChevronDown size={12} />
              Show less
            </>
          ) : (
            <>
              <ChevronRight size={12} />
              Show {snippets.length - maxSnippets} more snippet{snippets.length - maxSnippets > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  )
})

SnippetDisplay.displayName = 'SnippetDisplay'

export const HighlightedSearchResult = memo<HighlightedSearchResultProps>(({
  note,
  query,
  searchTerms,
  onNoteClick,
  onNoteSelect,
  isSelected = false,
  className = '',
  highlightOptions = {},
  showRelevanceScore = false,
  showPath = true,
  showSnippets = true,
  maxSnippets = 2,
  enablePreview = false,
  compact = false
}) => {
  const options = useMemo(() => ({ 
    ...DEFAULT_HIGHLIGHT_OPTIONS, 
    ...highlightOptions 
  }), [highlightOptions])

  // Generate search terms from query if not provided
  const effectiveSearchTerms = useMemo(() => {
    if (searchTerms) return searchTerms
    
    // Simple term extraction (basic implementation)
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0)
  }, [query, searchTerms])

  // Generate highlights and snippets
  const { titleHighlights, contentSnippets, matchCount, relevanceScore } = useMemo(() => {
    const titleMatches = findTitleMatches(note, effectiveSearchTerms, options)
    const contentMatches = findMatches(note.content, effectiveSearchTerms, options)
    const snippets = generateSnippets(note.content, contentMatches, options)
    
    const totalMatches = titleMatches.length + contentMatches.length
    const score = Math.min(100, (titleMatches.length * 20) + (contentMatches.length * 5))
    
    return {
      titleHighlights: titleMatches,
      contentSnippets: snippets,
      matchCount: totalMatches,
      relevanceScore: score
    }
  }, [note, effectiveSearchTerms, options])

  // Generate note title
  const noteTitle = note.nickname || note.content.split('\n')[0].substring(0, 80) || 'Untitled'
  
  // Render highlighted title
  const titleSegments = useMemo(() => {
    return renderHighlightedText(noteTitle, titleHighlights)
  }, [noteTitle, titleHighlights])

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }, [])

  // Event handlers
  const handleClick = useCallback(() => {
    onNoteClick?.(note)
    onNoteSelect?.(note)
  }, [note, onNoteClick, onNoteSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: Implement preview functionality
    console.log('Preview note:', note.id)
  }, [note.id])

  return (
    <div 
      className={`
        highlighted-search-result group p-4 border rounded-lg cursor-pointer smooth-transition
        ${isSelected 
          ? 'bg-accent text-accent-foreground border-primary shadow-sm' 
          : 'border-border hover:bg-muted hover:border-muted-foreground/50'
        }
        ${compact ? 'p-3' : 'p-4'}
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${className}
      `}
      onClick={handleClick}
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
            <FileText size={compact ? 14 : 16} className="text-muted-foreground flex-shrink-0" />
            <h3 className={`font-medium truncate ${compact ? 'text-sm' : ''}`}>
              <HighlightedText
                text={noteTitle}
                highlights={titleSegments}
                className="search-result-title"
              />
            </h3>
            {note.is_favorite && (
              <Star size={compact ? 12 : 14} className="text-yellow-500 flex-shrink-0" />
            )}
          </div>

          {/* Snippets */}
          {showSnippets && contentSnippets.length > 0 && (
            <div className="mb-3">
              <SnippetDisplay
                snippets={contentSnippets}
                maxSnippets={maxSnippets}
                enableExpansion={!compact}
              />
            </div>
          )}

          {/* Path information */}
          {showPath && note.path && note.path !== '/' && (
            <div className={`text-muted-foreground mt-2 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              <span className="opacity-70">Path:</span> {note.path}
            </div>
          )}
        </div>

        {/* Right side metadata and actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Actions */}
          <div className="flex items-center gap-1">
            {enablePreview && (
              <button
                onClick={handlePreview}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
                aria-label="Preview note"
                title="Preview note"
              >
                <Eye size={14} />
              </button>
            )}
            <div className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
              <ExternalLink size={14} />
            </div>
          </div>

          {/* Relevance score */}
          {showRelevanceScore && relevanceScore > 0 && (
            <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {relevanceScore}%
            </div>
          )}

          {/* Match count */}
          {matchCount > 0 && (
            <div className={`text-muted-foreground flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'}`}>
              <Search size={compact ? 10 : 12} />
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </div>
          )}

          {/* Last modified */}
          <div className={`flex items-center gap-1 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
            <Calendar size={compact ? 10 : 12} />
            {formatDate(note.updated_at)}
          </div>
        </div>
      </div>
    </div>
  )
})

HighlightedSearchResult.displayName = 'HighlightedSearchResult'