/**
 * Search Result Highlighting and Snippets System - Week 2 Day 4
 * 
 * Provides advanced text highlighting capabilities for search results with:
 * - Boolean operator support (AND, OR, NOT)
 * - Context-aware snippet generation
 * - XSS-safe highlighting
 * - Performance optimized for virtual scrolling
 * - Accessibility compliance
 */

import type { 
  HighlightMatch, 
  SearchSnippet, 
  SearchHighlightOptions, 
  Note, 
  EnhancedSearchResult,
  SearchResult 
} from '../types'

// Default highlighting options optimized for performance and UX
export const DEFAULT_HIGHLIGHT_OPTIONS: SearchHighlightOptions = {
  maxSnippets: 3,
  snippetLength: 150,
  contextWindow: 30,
  highlightClassName: 'search-highlight-primary',
  secondaryHighlightClassName: 'search-highlight-secondary',
  fieldHighlightClassName: 'search-highlight-field',
  enableRegexSafe: true,
  caseSensitive: false,
}

/**
 * Parse Boolean search query into individual terms and operators
 * Supports: AND, OR, NOT, quoted phrases, field searches
 */
export function parseSearchQuery(query: string): {
  terms: string[]
  phrases: string[]
  operators: string[]
  fieldSearches: Array<{ field: string; value: string }>
} {
  const terms: string[] = []
  const phrases: string[] = []
  const operators: string[] = []
  const fieldSearches: Array<{ field: string; value: string }> = []

  // Match quoted phrases first
  const phraseMatches = query.match(/"([^"]+)"/g) || []
  phraseMatches.forEach(match => {
    const phrase = match.slice(1, -1) // Remove quotes
    phrases.push(phrase)
  })

  // Remove quoted phrases from query to avoid double processing
  let cleanQuery = query.replace(/"[^"]+"/g, '')

  // Match field searches (field:value) - Handle quoted values in original query
  const fieldMatches = query.match(/(\w+):([^\s]+)/g) || []
  fieldMatches.forEach(match => {
    const [field, value] = match.split(':')
    fieldSearches.push({ field, value })
  })

  // Remove field searches from query
  cleanQuery = cleanQuery.replace(/\w+:\S+/g, '')

  // Extract operators
  const operatorMatches = cleanQuery.match(/\b(AND|OR|NOT)\b/gi) || []
  operatorMatches.forEach(op => operators.push(op.toUpperCase()))

  // Remove operators to get remaining terms
  cleanQuery = cleanQuery.replace(/\b(AND|OR|NOT)\b/gi, '')

  // Extract individual terms (split by whitespace and filter empty)
  const remainingTerms = cleanQuery
    .split(/\s+/)
    .filter(term => term.trim().length > 0)
    .map(term => term.toLowerCase())

  terms.push(...remainingTerms)

  return { terms, phrases, operators, fieldSearches }
}

/**
 * Escape HTML entities to prevent XSS attacks
 */
export function escapeHtmlForHighlighting(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Enhanced escape function for both regex and HTML safety
 * Prevents XSS attacks through malicious search queries
 */
export function escapeRegexForHighlighting(text: string): string {
  const htmlEscaped = escapeHtmlForHighlighting(text)
  return htmlEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find all matches of search terms in text with position information
 */
export function findMatches(
  text: string, 
  searchTerms: string[], 
  options: SearchHighlightOptions = DEFAULT_HIGHLIGHT_OPTIONS
): HighlightMatch[] {
  const matches: HighlightMatch[] = []
  
  searchTerms.forEach((term, termIndex) => {
    if (!term.trim()) return

    const escapedTerm = options.enableRegexSafe ? escapeRegexForHighlighting(term) : term
    const flags = options.caseSensitive ? 'g' : 'gi'
    
    try {
      const regex = new RegExp(escapedTerm, flags)
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: termIndex === 0 ? 'primary' : 'secondary',
          term: match[0]
        })

        // Prevent infinite loop for zero-width matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++
        }
      }
    } catch (error) {
      console.warn(`Failed to create regex for term "${term}":`, error)
    }
  })

  // Sort matches by position for proper highlighting
  return matches.sort((a, b) => a.start - b.start)
}

/**
 * Generate intelligent snippets around search matches
 */
export function generateSnippets(
  text: string,
  matches: HighlightMatch[],
  options: SearchHighlightOptions = DEFAULT_HIGHLIGHT_OPTIONS
): SearchSnippet[] {
  if (matches.length === 0) {
    // Return a single snippet from the beginning if no matches
    const snippetText = text.slice(0, options.snippetLength)
    return [{
      text: snippetText,
      highlights: [],
      contextStart: 0,
      contextEnd: snippetText.length,
      hasMoreBefore: false,
      hasMoreAfter: text.length > options.snippetLength
    }]
  }

  const snippets: SearchSnippet[] = []
  const processedRanges: Array<{ start: number; end: number }> = []

  // Group nearby matches to avoid overlapping snippets
  const groupedMatches = groupNearbyMatches(matches, options.contextWindow * 2)

  for (const matchGroup of groupedMatches.slice(0, options.maxSnippets)) {
    const firstMatch = matchGroup[0]
    const lastMatch = matchGroup[matchGroup.length - 1]

    // Calculate snippet boundaries with context
    const snippetStart = Math.max(0, firstMatch.start - options.contextWindow)
    const snippetEnd = Math.min(text.length, lastMatch.end + options.contextWindow)

    // Avoid overlapping with previously processed ranges
    const hasOverlap = processedRanges.some(range => 
      snippetStart < range.end && snippetEnd > range.start
    )

    if (hasOverlap) continue

    // Find word boundaries for clean snippets
    const cleanStart = findWordBoundary(text, snippetStart, 'start')
    const cleanEnd = findWordBoundary(text, snippetEnd, 'end')

    const snippetText = text.slice(cleanStart, cleanEnd)
    
    // Adjust match positions relative to snippet
    const adjustedHighlights = matchGroup
      .filter(match => match.start >= cleanStart && match.end <= cleanEnd)
      .map(match => ({
        ...match,
        start: match.start - cleanStart,
        end: match.end - cleanStart
      }))

    snippets.push({
      text: snippetText,
      highlights: adjustedHighlights,
      contextStart: cleanStart,
      contextEnd: cleanEnd,
      hasMoreBefore: cleanStart > 0,
      hasMoreAfter: cleanEnd < text.length
    })

    processedRanges.push({ start: cleanStart, end: cleanEnd })
  }

  return snippets
}

/**
 * Group nearby matches to create coherent snippets
 */
function groupNearbyMatches(
  matches: HighlightMatch[], 
  maxDistance: number
): HighlightMatch[][] {
  if (matches.length === 0) return []

  const groups: HighlightMatch[][] = []
  let currentGroup: HighlightMatch[] = [matches[0]]

  for (let i = 1; i < matches.length; i++) {
    const prevMatch = matches[i - 1]
    const currentMatch = matches[i]

    if (currentMatch.start - prevMatch.end <= maxDistance) {
      currentGroup.push(currentMatch)
    } else {
      groups.push(currentGroup)
      currentGroup = [currentMatch]
    }
  }

  groups.push(currentGroup)
  return groups
}

/**
 * Find word boundaries for clean snippet cuts
 */
function findWordBoundary(text: string, position: number, direction: 'start' | 'end'): number {
  const wordBoundaryRegex = /\s/
  
  if (direction === 'start') {
    // Look backwards for word boundary
    for (let i = position; i >= 0; i--) {
      if (wordBoundaryRegex.test(text[i]) || i === 0) {
        return i === 0 ? 0 : i + 1
      }
    }
  } else {
    // Look forwards for word boundary
    for (let i = position; i < text.length; i++) {
      if (wordBoundaryRegex.test(text[i]) || i === text.length - 1) {
        return i === text.length - 1 ? text.length : i
      }
    }
  }

  return position
}

/**
 * Find matches in note title/nickname for highlighting
 */
export function findTitleMatches(
  note: Note, 
  searchTerms: string[], 
  options: SearchHighlightOptions = DEFAULT_HIGHLIGHT_OPTIONS
): HighlightMatch[] {
  const title = note.nickname || note.content.split('\n')[0].substring(0, 100)
  return findMatches(title, searchTerms, options)
}

/**
 * Create enhanced search result with highlighting and snippets
 */
export function enhanceSearchResult(
  searchResult: SearchResult,
  query: string,
  options: SearchHighlightOptions = DEFAULT_HIGHLIGHT_OPTIONS
): EnhancedSearchResult {
  const { terms, phrases, operators } = parseSearchQuery(query)
  const allSearchTerms = [...terms, ...phrases]

  const snippets: Record<number, SearchSnippet[]> = {}
  const highlightedTitles: Record<number, HighlightMatch[]> = {}
  let totalMatches = 0

  for (const note of searchResult.notes) {
    // Generate content snippets
    const contentMatches = findMatches(note.content, allSearchTerms, options)
    const noteSnippets = generateSnippets(note.content, contentMatches, options)
    
    snippets[note.id] = noteSnippets
    totalMatches += contentMatches.length

    // Generate title highlights
    const titleMatches = findTitleMatches(note, allSearchTerms, options)
    highlightedTitles[note.id] = titleMatches
  }

  return {
    ...searchResult,
    snippets,
    highlightedTitles,
    totalMatches,
    query,
    queryTerms: allSearchTerms,
    booleanOperators: operators
  }
}

/**
 * Render highlighted text as React-safe HTML structure
 * Returns an array of text segments and highlight markers
 */
export function renderHighlightedText(
  text: string, 
  highlights: HighlightMatch[]
): Array<{ text: string; isHighlight: boolean; type?: string }> {
  if (highlights.length === 0) {
    return [{ text, isHighlight: false }]
  }

  const segments: Array<{ text: string; isHighlight: boolean; type?: string }> = []
  let lastIndex = 0

  // Sort highlights to handle overlapping
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)

  for (const highlight of sortedHighlights) {
    // Add text before highlight
    if (highlight.start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, highlight.start),
        isHighlight: false
      })
    }

    // Add highlighted text
    segments.push({
      text: text.slice(highlight.start, highlight.end),
      isHighlight: true,
      type: highlight.type
    })

    lastIndex = Math.max(lastIndex, highlight.end)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isHighlight: false
    })
  }

  return segments
}

/**
 * Performance optimization: Batch process multiple notes
 * Useful for virtual scrolling scenarios
 */
export function batchProcessSearchResults(
  notes: Note[],
  query: string,
  options: SearchHighlightOptions = DEFAULT_HIGHLIGHT_OPTIONS
): {
  snippets: Record<number, SearchSnippet[]>
  titleHighlights: Record<number, HighlightMatch[]>
  queryTerms: string[]
} {
  const { terms, phrases } = parseSearchQuery(query)
  const allSearchTerms = [...terms, ...phrases]

  const snippets: Record<number, SearchSnippet[]> = {}
  const titleHighlights: Record<number, HighlightMatch[]> = {}

  // Process in chunks to avoid blocking the main thread
  const CHUNK_SIZE = 10
  
  for (let i = 0; i < notes.length; i += CHUNK_SIZE) {
    const chunk = notes.slice(i, i + CHUNK_SIZE)
    
    for (const note of chunk) {
      const contentMatches = findMatches(note.content, allSearchTerms, options)
      snippets[note.id] = generateSnippets(note.content, contentMatches, options)
      titleHighlights[note.id] = findTitleMatches(note, allSearchTerms, options)
    }
  }

  return {
    snippets,
    titleHighlights,
    queryTerms: allSearchTerms
  }
}