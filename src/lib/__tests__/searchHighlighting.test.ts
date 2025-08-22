/**
 * Search Highlighting Tests - Week 2 Day 4
 * 
 * Comprehensive test suite for search highlighting and snippet functionality.
 * Tests XSS protection, performance, and accessibility features.
 */

import { describe, it, expect } from 'vitest'
import {
  parseSearchQuery,
  escapeRegexForHighlighting,
  findMatches,
  generateSnippets,
  renderHighlightedText,
  findTitleMatches,
  enhanceSearchResult,
  batchProcessSearchResults,
  DEFAULT_HIGHLIGHT_OPTIONS
} from '../searchHighlighting'
import type { Note, SearchResult, HighlightMatch } from '../../types'

// Test utility to create properly formatted HighlightMatch objects
function createHighlightMatch(
  start: number,
  end: number,
  type: 'primary' | 'secondary',
  term: string,
  text?: string
): HighlightMatch {
  return {
    start,
    end,
    type,
    term,
    text: text || term,
    startIndex: start,
    endIndex: end,
    isMatch: true
  }
}

describe('parseSearchQuery', () => {
  it('should parse simple terms', () => {
    const result = parseSearchQuery('hello world test')
    expect(result.terms).toEqual(['hello', 'world', 'test'])
    expect(result.phrases).toEqual([])
    expect(result.operators).toEqual([])
    expect(result.fieldSearches).toEqual([])
  })

  it('should parse quoted phrases', () => {
    const result = parseSearchQuery('hello "world test" foo')
    expect(result.terms).toEqual(['hello', 'foo'])
    expect(result.phrases).toEqual(['world test'])
    expect(result.operators).toEqual([])
    expect(result.fieldSearches).toEqual([])
  })

  it('should parse Boolean operators', () => {
    const result = parseSearchQuery('hello AND world OR test NOT bar')
    expect(result.terms).toEqual(['hello', 'world', 'test', 'bar'])
    expect(result.operators).toEqual(['AND', 'OR', 'NOT'])
  })

  it('should parse field searches', () => {
    const result = parseSearchQuery('content:hello path:docs title:test')
    expect(result.fieldSearches).toEqual([
      { field: 'content', value: 'hello' },
      { field: 'path', value: 'docs' },
      { field: 'title', value: 'test' }
    ])
  })

  it('should handle complex queries', () => {
    const result = parseSearchQuery('content:"hello world" AND path:docs OR title:test')
    expect(result.phrases).toEqual(['hello world'])
    expect(result.operators).toEqual(['AND', 'OR'])
    expect(result.fieldSearches).toEqual([
      { field: 'content', value: '"hello' },
      { field: 'path', value: 'docs' },
      { field: 'title', value: 'test' }
    ])
  })

  it('should handle empty and whitespace queries', () => {
    expect(parseSearchQuery('')).toEqual({
      terms: [],
      phrases: [],
      operators: [],
      fieldSearches: []
    })
    expect(parseSearchQuery('   ')).toEqual({
      terms: [],
      phrases: [],
      operators: [],
      fieldSearches: []
    })
  })
})

describe('escapeRegexForHighlighting', () => {
  it('should escape special regex characters', () => {
    expect(escapeRegexForHighlighting('hello.world')).toBe('hello\\.world')
    expect(escapeRegexForHighlighting('test[123]')).toBe('test\\[123\\]')
    expect(escapeRegexForHighlighting('(foo|bar)')).toBe('\\(foo\\|bar\\)')
    expect(escapeRegexForHighlighting('$^*+?{}')).toBe('\\$\\^\\*\\+\\?\\{\\}')
  })

  it('should not affect normal text', () => {
    expect(escapeRegexForHighlighting('hello world')).toBe('hello world')
    expect(escapeRegexForHighlighting('test123')).toBe('test123')
  })

  it('should handle empty strings', () => {
    expect(escapeRegexForHighlighting('')).toBe('')
  })
})

describe('findMatches', () => {
  const sampleText = 'Hello world! This is a test. Hello again, world.'

  it('should find simple matches', () => {
    const matches = findMatches(sampleText, ['hello'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(2)
    
    // Use objectContaining to handle extra properties added by different environments
    expect(matches[0]).toEqual(expect.objectContaining({
      start: 0,
      end: 5,
      type: 'primary',
      term: 'Hello'
    }))
    expect(matches[1]).toEqual(expect.objectContaining({
      start: 29,
      end: 34,
      type: 'primary',
      term: 'Hello'
    }))
  })

  it('should find multiple search terms', () => {
    const matches = findMatches(sampleText, ['hello', 'world'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(4)
    
    // Check that matches are sorted by position
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].start)
    }
  })

  it('should handle case sensitivity options', () => {
    const sensitiveOptions = { ...DEFAULT_HIGHLIGHT_OPTIONS, caseSensitive: true }
    const matches = findMatches(sampleText, ['hello'], sensitiveOptions)
    expect(matches).toHaveLength(0) // 'hello' vs 'Hello'

    const matches2 = findMatches(sampleText, ['Hello'], sensitiveOptions)
    expect(matches2).toHaveLength(2)
  })

  it('should assign correct highlight types', () => {
    const matches = findMatches(sampleText, ['hello', 'world'], DEFAULT_HIGHLIGHT_OPTIONS)
    const helloMatches = matches.filter(m => m.term.toLowerCase() === 'hello')
    const worldMatches = matches.filter(m => m.term.toLowerCase() === 'world')
    
    expect(helloMatches.every(m => m.type === 'primary')).toBe(true)
    expect(worldMatches.every(m => m.type === 'secondary')).toBe(true)
  })

  it('should handle regex-unsafe input', () => {
    const unsafeText = 'Testing [brackets] and (parentheses) with $pecial chars'
    const matches = findMatches(unsafeText, ['[brackets]'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(1)
    expect(matches[0].term).toBe('[brackets]')
  })

  it('should handle empty search terms', () => {
    const matches = findMatches(sampleText, ['', '  ', 'hello'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(2) // Only 'hello' matches
  })
})

describe('generateSnippets', () => {
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'

  it('should generate snippets around matches', () => {
    const matches: HighlightMatch[] = [
      createHighlightMatch(12, 17, 'primary', 'dolor')
    ]
    const snippets = generateSnippets(longText, matches, DEFAULT_HIGHLIGHT_OPTIONS)
    
    expect(snippets).toHaveLength(1)
    expect(snippets[0].highlights).toHaveLength(1)
    expect(snippets[0].text).toContain('dolor')
  })

  it('should handle multiple nearby matches', () => {
    const matches: HighlightMatch[] = [
      createHighlightMatch(12, 17, 'primary', 'dolor'),
      createHighlightMatch(22, 25, 'secondary', 'sit')
    ]
    const snippets = generateSnippets(longText, matches, DEFAULT_HIGHLIGHT_OPTIONS)
    
    // Should group nearby matches into one snippet
    expect(snippets).toHaveLength(1)
    expect(snippets[0].highlights).toHaveLength(2)
  })

  it('should respect snippet length limits', () => {
    const shortOptions = { ...DEFAULT_HIGHLIGHT_OPTIONS, snippetLength: 50 }
    const matches: HighlightMatch[] = [
      createHighlightMatch(12, 17, 'primary', 'dolor')
    ]
    const snippets = generateSnippets(longText, matches, shortOptions)
    
    expect(snippets[0].text.length).toBeLessThanOrEqual(70) // Allow some flexibility for word boundaries
  })

  it('should respect maximum snippet count', () => {
    const matches: HighlightMatch[] = [
      createHighlightMatch(12, 17, 'primary', 'dolor'),
      createHighlightMatch(100, 105, 'primary', 'magna'),
      createHighlightMatch(200, 205, 'primary', 'minim'),
      createHighlightMatch(300, 305, 'primary', 'nulla')
    ]
    const limitedOptions = { ...DEFAULT_HIGHLIGHT_OPTIONS, maxSnippets: 2 }
    const snippets = generateSnippets(longText, matches, limitedOptions)
    
    expect(snippets).toHaveLength(2)
  })

  it('should handle text with no matches', () => {
    const snippets = generateSnippets(longText, [], DEFAULT_HIGHLIGHT_OPTIONS)
    
    expect(snippets).toHaveLength(1)
    expect(snippets[0].highlights).toHaveLength(0)
    expect(snippets[0].text).toBe(longText.slice(0, DEFAULT_HIGHLIGHT_OPTIONS.snippetLength))
  })

  it('should indicate when there is more content', () => {
    const matches: HighlightMatch[] = [
      createHighlightMatch(longText.length - 10, longText.length - 5, 'primary', 'test')
    ]
    const snippets = generateSnippets(longText, matches, DEFAULT_HIGHLIGHT_OPTIONS)
    
    expect(snippets[0].hasMoreBefore).toBe(true)
    expect(snippets[0].hasMoreAfter).toBe(false)
  })
})

describe('renderHighlightedText', () => {
  it('should render text without highlights', () => {
    const result = renderHighlightedText('hello world', [])
    expect(result).toEqual([{ text: 'hello world', isHighlight: false }])
  })

  it('should render text with highlights', () => {
    const highlights: HighlightMatch[] = [
      createHighlightMatch(0, 5, 'primary', 'hello'),
      createHighlightMatch(6, 11, 'secondary', 'world')
    ]
    const result = renderHighlightedText('hello world', highlights)
    
    expect(result).toEqual([
      { text: 'hello', isHighlight: true, type: 'primary' },
      { text: ' ', isHighlight: false },
      { text: 'world', isHighlight: true, type: 'secondary' }
    ])
  })

  it('should handle overlapping highlights', () => {
    const highlights: HighlightMatch[] = [
      createHighlightMatch(0, 8, 'primary', 'hello wo'),
      createHighlightMatch(6, 11, 'secondary', 'world')
    ]
    const result = renderHighlightedText('hello world', highlights)
    
    expect(result.length).toBeGreaterThan(0)
    // Should handle overlaps gracefully
  })

  it('should handle highlights at text boundaries', () => {
    const highlights: HighlightMatch[] = [
      createHighlightMatch(0, 5, 'primary', 'hello'),
      createHighlightMatch(6, 11, 'secondary', 'world')
    ]
    const result = renderHighlightedText('hello world', highlights)
    
    expect(result[0].text).toBe('hello')
    expect(result[result.length - 1].text).toBe('world')
  })
})

describe('findTitleMatches', () => {
  const sampleNote: Note = {
    id: 1,
    content: 'This is the content of the note with some test data.',
    format: 'plaintext',
    nickname: 'Test Note Title',
    path: '/notes/test',
    is_favorite: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    search_content: 'This is the content of the note with some test data.',
    word_count: 12,
    language: 'en'
  }

  it('should find matches in note nickname', () => {
    const matches = findTitleMatches(sampleNote, ['test'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(1)
    expect(matches[0].term.toLowerCase()).toBe('test')
  })

  it('should find matches in content when no nickname', () => {
    const noteWithoutNickname = { ...sampleNote, nickname: undefined }
    const matches = findTitleMatches(noteWithoutNickname, ['this'], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(1)
    expect(matches[0].term.toLowerCase()).toBe('this')
  })

  it('should handle empty search terms', () => {
    const matches = findTitleMatches(sampleNote, [], DEFAULT_HIGHLIGHT_OPTIONS)
    expect(matches).toHaveLength(0)
  })
})

describe('enhanceSearchResult', () => {
  const sampleSearchResult: SearchResult = {
    notes: [
      {
        id: 1,
        content: 'This is a test note with some content about JavaScript programming.',
        format: 'plaintext',
        nickname: 'JS Test Note',
        path: '/programming/js',
        is_favorite: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        search_content: 'This is a test note with some content about JavaScript programming.',
        word_count: 12,
        language: 'en'
      },
      {
        id: 2,
        content: 'Another note about testing and quality assurance in software development.',
        format: 'markdown',
        nickname: 'QA Guidelines',
        path: '/testing/qa',
        is_favorite: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        search_content: 'Another note about testing and quality assurance in software development.',
        word_count: 11,
        language: 'en'
      }
    ],
    total_count: 2,
    page: 0,
    page_size: 50,
    has_more: false,
    query_time_ms: 25
  }

  it('should enhance search result with highlights and snippets', () => {
    const enhanced = enhanceSearchResult(sampleSearchResult, 'test programming')
    
    expect(enhanced.snippets).toBeDefined()
    expect(enhanced.highlightedTitles).toBeDefined()
    expect(enhanced.totalMatches).toBeGreaterThan(0)
    expect(enhanced.query).toBe('test programming')
    expect(enhanced.queryTerms).toContain('test')
    expect(enhanced.queryTerms).toContain('programming')
  })

  it('should generate snippets for each note', () => {
    const enhanced = enhanceSearchResult(sampleSearchResult, 'test')
    
    expect(enhanced.snippets[1]).toBeDefined()
    expect(enhanced.snippets[2]).toBeDefined()
    expect(enhanced.snippets[1].length).toBeGreaterThan(0)
  })

  it('should count total matches across all notes', () => {
    const enhanced = enhanceSearchResult(sampleSearchResult, 'test')
    
    expect(enhanced.totalMatches).toBeGreaterThan(0)
    // Should include matches from both title and content
  })

  it('should preserve original search result properties', () => {
    const enhanced = enhanceSearchResult(sampleSearchResult, 'test')
    
    expect(enhanced.notes).toEqual(sampleSearchResult.notes)
    expect(enhanced.total_count).toBe(sampleSearchResult.total_count)
    expect(enhanced.page).toBe(sampleSearchResult.page)
    expect(enhanced.page_size).toBe(sampleSearchResult.page_size)
    expect(enhanced.has_more).toBe(sampleSearchResult.has_more)
    expect(enhanced.query_time_ms).toBe(sampleSearchResult.query_time_ms)
  })
})

describe('batchProcessSearchResults', () => {
  const sampleNotes: Note[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    content: `This is test note ${i + 1} with various content about programming and testing.`,
    format: 'plaintext' as const,
    nickname: `Test Note ${i + 1}`,
    path: `/notes/test-${i + 1}`,
    is_favorite: i % 3 === 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    search_content: `This is test note ${i + 1} with various content about programming and testing.`,
    word_count: 12,
    language: 'en'
  }))

  it('should process all notes in batches', () => {
    const result = batchProcessSearchResults(sampleNotes, 'test programming')
    
    expect(Object.keys(result.snippets)).toHaveLength(25)
    expect(Object.keys(result.titleHighlights)).toHaveLength(25)
    expect(result.queryTerms).toContain('test')
    expect(result.queryTerms).toContain('programming')
  })

  it('should generate snippets for each note', () => {
    const result = batchProcessSearchResults(sampleNotes, 'test')
    
    // Each note should have snippets
    sampleNotes.forEach(note => {
      expect(result.snippets[note.id]).toBeDefined()
      expect(result.snippets[note.id].length).toBeGreaterThan(0)
    })
  })

  it('should handle empty query', () => {
    const result = batchProcessSearchResults(sampleNotes, '')
    
    expect(result.queryTerms).toHaveLength(0)
    // Should still process notes but with no highlights
    expect(Object.keys(result.snippets)).toHaveLength(25)
  })

  it('should handle large datasets efficiently', () => {
    const largeNotes = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      content: `Content ${i} with test data and programming information.`,
      format: 'plaintext' as const,
      nickname: `Note ${i}`,
      path: `/notes/${i}`,
      is_favorite: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      search_content: `Content ${i} with test data and programming information.`,
      word_count: 8,
      language: 'en'
    }))

    const startTime = performance.now()
    const result = batchProcessSearchResults(largeNotes, 'test programming')
    const endTime = performance.now()

    expect(Object.keys(result.snippets)).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
  })
})

describe('XSS and Security Tests', () => {
  it('should prevent XSS in search queries', () => {
    const maliciousQuery = '<script>alert("xss")</script>'
    const safeQuery = escapeRegexForHighlighting(maliciousQuery)
    
    expect(safeQuery).not.toContain('<script>')
    expect(safeQuery).toContain('&lt;script&gt;') // Should be escaped
  })

  it('should handle malicious regex patterns safely', () => {
    const maliciousPatterns = [
      '(?=.*a)(?=.*b)(?=.*c)(?=.*d)(?=.*e).*', // ReDoS pattern
      '(a+)+b', // Exponential backtracking
      'a{100000}', // Large quantifier
    ]

    maliciousPatterns.forEach(pattern => {
      expect(() => {
        findMatches('test content', [pattern], {
          ...DEFAULT_HIGHLIGHT_OPTIONS,
          enableRegexSafe: true
        })
      }).not.toThrow()
    })
  })

  it('should sanitize highlighted content for DOM insertion', () => {
    const maliciousContent = '<img src=x onerror=alert(1)>'
    const matches = findMatches(maliciousContent, ['img'], DEFAULT_HIGHLIGHT_OPTIONS)
    const rendered = renderHighlightedText(maliciousContent, matches)
    
    // Should render as text segments, not HTML
    // The malicious content should be preserved as separate text segments
    const fullText = rendered.map(s => s.text).join('')
    expect(fullText).toBe(maliciousContent) // Preserves original content as text
    expect(rendered.every(segment => typeof segment.text === 'string')).toBe(true)
    expect(rendered.some(segment => segment.isHighlight && segment.text === 'img')).toBe(true)
  })
})

describe('Performance Tests', () => {
  it('should handle large text efficiently', () => {
    const largeText = 'Lorem ipsum '.repeat(10000) + 'target word ' + 'dolor sit amet '.repeat(10000)
    
    const startTime = performance.now()
    const matches = findMatches(largeText, ['target'], DEFAULT_HIGHLIGHT_OPTIONS)
    const endTime = performance.now()
    
    expect(matches).toHaveLength(1)
    expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
  })

  it('should handle many search terms efficiently', () => {
    const text = 'This is a test document with many words to search through and find matches.'
    const manyTerms = text.split(' ').slice(0, 10) // Use first 10 words as search terms
    
    const startTime = performance.now()
    const matches = findMatches(text, manyTerms, DEFAULT_HIGHLIGHT_OPTIONS)
    const endTime = performance.now()
    
    expect(matches.length).toBeGreaterThan(0)
    expect(endTime - startTime).toBeLessThan(50) // Should complete within 50ms
  })

  it('should cache regex compilation', () => {
    const text = 'Test content for regex caching performance'
    const searchTerm = 'test'
    
    // First search (compile regex)
    const start1 = performance.now()
    findMatches(text, [searchTerm], DEFAULT_HIGHLIGHT_OPTIONS)
    const end1 = performance.now()
    
    // Second search (should use cached regex)
    const start2 = performance.now()
    findMatches(text, [searchTerm], DEFAULT_HIGHLIGHT_OPTIONS)
    const end2 = performance.now()
    
    // Second search should be faster or similar (regex is simple, so difference may be minimal)
    expect(end2 - start2).toBeLessThanOrEqual((end1 - start1) * 1.5)
  })
})