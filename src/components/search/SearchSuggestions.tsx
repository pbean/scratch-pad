import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { 
  Search,
  Clock,
  Star,
  Lightbulb,
  TrendingUp,
  BookOpen,
  ArrowRight,
  X,
  Zap,
  Code,
  FileText,
  Calendar,
  Hash
} from 'lucide-react'
import { useScratchPadStore } from '../../lib/store'
import { useSmartAutoSave } from '../../hooks/useSmartAutoSave'
import type { Note } from '../../types'

// Type definitions for search suggestions
export interface SearchSuggestion {
  id: string
  type: 'recent' | 'template' | 'autocomplete' | 'boolean' | 'typo-correction'
  text: string
  displayText: string
  description?: string
  icon?: React.ReactNode
  frequency?: number
  lastUsed?: Date
  isTemplate?: boolean
  templateParams?: string[]
  confidence?: number // For typo corrections (0-1)
  originalQuery?: string // For typo corrections
}

export interface SearchTemplate {
  id: string
  name: string
  pattern: string
  description: string
  icon: React.ReactNode
  category: 'date' | 'content' | 'format' | 'favorites' | 'length'
  examples: string[]
}

export interface SuggestionCategory {
  id: string
  label: string
  icon: React.ReactNode
  suggestions: SearchSuggestion[]
  priority: number
}

interface SearchSuggestionsProps {
  query: string
  isVisible: boolean
  onSuggestionSelect: (suggestion: SearchSuggestion) => void
  onClose: () => void
  className?: string
  maxSuggestions?: number
  enableTemplates?: boolean
  enableBooleanHelp?: boolean
  enableTypoCorrection?: boolean
  enableFrequencyRanking?: boolean
}

// Pre-defined search templates for common patterns
const SEARCH_TEMPLATES: SearchTemplate[] = [
  {
    id: 'recent-notes',
    name: 'Recent Notes',
    pattern: 'created_at:last-week',
    description: 'Find notes created in the last week',
    icon: <Calendar size={14} />,
    category: 'date',
    examples: ['created_at:today', 'created_at:yesterday', 'created_at:last-month']
  },
  {
    id: 'favorite-notes',
    name: 'Favorite Notes',
    pattern: 'is:favorite',
    description: 'Search only favorite notes',
    icon: <Star size={14} />,
    category: 'favorites',
    examples: ['is:favorite todo', 'is:favorite meeting']
  },
  {
    id: 'long-notes',
    name: 'Long Notes',
    pattern: 'length:>1000',
    description: 'Find notes longer than 1000 characters',
    icon: <FileText size={14} />,
    category: 'length',
    examples: ['length:>500', 'length:<100', 'length:100..500']
  },
  {
    id: 'markdown-notes',
    name: 'Markdown Notes',
    pattern: 'format:markdown',
    description: 'Search only markdown formatted notes',
    icon: <Code size={14} />,
    category: 'format',
    examples: ['format:plaintext', 'format:markdown']
  },
  {
    id: 'boolean-and',
    name: 'AND Search',
    pattern: '{query} AND {term}',
    description: 'Find notes containing both terms',
    icon: <Hash size={14} />,
    category: 'content',
    examples: ['meeting AND notes', 'todo AND urgent']
  },
  {
    id: 'boolean-or',
    name: 'OR Search', 
    pattern: '{query} OR {term}',
    description: 'Find notes containing either term',
    icon: <Hash size={14} />,
    category: 'content',
    examples: ['javascript OR typescript', 'meeting OR call']
  },
  {
    id: 'boolean-not',
    name: 'NOT Search',
    pattern: '{query} NOT {term}',
    description: 'Find notes containing first term but not second',
    icon: <Hash size={14} />,
    category: 'content',
    examples: ['todo NOT completed', 'meeting NOT cancelled']
  }
]

// Boolean operators and syntax help
const BOOLEAN_OPERATORS = [
  { operator: 'AND', description: 'Both terms must be present', example: 'coffee AND morning' },
  { operator: 'OR', description: 'Either term can be present', example: 'tea OR coffee' },
  { operator: 'NOT', description: 'Exclude notes with this term', example: 'meeting NOT cancelled' },
  { operator: '""', description: 'Exact phrase search', example: '"important meeting"' },
  { operator: '()', description: 'Group terms together', example: '(urgent OR important) AND todo' }
]

// Typo correction using simple fuzzy matching
const calculateLevenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
  
  for (let i = 0; i <= str1.length; i += 1) {
    matrix[0][i] = i
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    matrix[j][0] = j
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Generate autocomplete suggestions from note content
const generateAutocompleteSuggestions = (query: string, notes: Note[]): SearchSuggestion[] => {
  if (!query.trim() || query.length < 2) return []
  
  const words = new Set<string>()
  const queryLower = query.toLowerCase()
  
  notes.forEach(note => {
    // Extract words from note content and title/nickname
    const content = `${note.nickname || ''} ${note.content}`.toLowerCase()
    const noteWords = content.match(/\b\w{3,}\b/g) || []
    
    noteWords.forEach(word => {
      if (word.startsWith(queryLower) && word !== queryLower) {
        words.add(word)
      }
    })
  })
  
  return Array.from(words)
    .slice(0, 5)
    .map(word => ({
      id: `autocomplete-${word}`,
      type: 'autocomplete' as const,
      text: word,
      displayText: word,
      description: `Complete "${query}" to "${word}"`,
      icon: <BookOpen size={14} />
    }))
}

// Generate typo correction suggestions
const generateTypoCorrections = (query: string, recentSearches: string[]): SearchSuggestion[] => {
  if (!query.trim() || query.length < 3) return []
  
  const corrections: Array<{ text: string; confidence: number }> = []
  
  recentSearches.forEach(recentQuery => {
    if (recentQuery.length > 0 && Math.abs(recentQuery.length - query.length) <= 2) {
      const distance = calculateLevenshteinDistance(query.toLowerCase(), recentQuery.toLowerCase())
      const maxLength = Math.max(query.length, recentQuery.length)
      const confidence = 1 - (distance / maxLength)
      
      if (confidence > 0.6 && distance > 0 && distance <= 2) {
        corrections.push({ text: recentQuery, confidence })
      }
    }
  })
  
  return corrections
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2)
    .map(correction => ({
      id: `typo-${correction.text}`,
      type: 'typo-correction' as const,
      text: correction.text,
      displayText: correction.text,
      description: `Did you mean "${correction.text}"?`,
      icon: <Lightbulb size={14} />,
      confidence: correction.confidence,
      originalQuery: query
    }))
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  isVisible,
  onSuggestionSelect,
  onClose,
  className = '',
  maxSuggestions = 12,
  enableTemplates = true,
  enableBooleanHelp = true,
  enableTypoCorrection = true,
  enableFrequencyRanking = true
}) => {
  const {
    notes,
    recentSearches,
    searchHistory,
    getRecentSearchSuggestions
  } = useScratchPadStore()
  
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [suggestionCategories, setSuggestionCategories] = useState<SuggestionCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState<{ generationTime: number; totalSuggestions: number } | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const suggestionRefs = useRef<Array<HTMLDivElement | null>>([])
  
  // Debounced suggestion generation
  const { saveContent: debouncedGenerateSuggestions } = useSmartAutoSave({
    onSave: async (content: string) => {
      await generateSuggestions(content)
    },
    minDelay: 200,
    maxDelay: 500,
    idleThreshold: 300,
    fastTypingThreshold: 4
  })
  
  // Generate all suggestion categories
  const generateSuggestions = useCallback(async (searchQuery: string) => {
    const startTime = performance.now()
    setIsLoading(true)
    
    try {
      const categories: SuggestionCategory[] = []
      
      // 1. Recent searches (highest priority)
      if (searchQuery.trim() === '') {
        const recentSuggestions: SearchSuggestion[] = recentSearches
          .slice(0, 5)
          .map((search, index) => ({
            id: `recent-${index}`,
            type: 'recent' as const,
            text: search,
            displayText: search,
            description: 'Recent search',
            icon: <Clock size={14} />,
            frequency: searchHistory.find(h => h.query === search)?.results.length || 0,
            lastUsed: new Date(searchHistory.find(h => h.query === search)?.timestamp || Date.now())
          }))
        
        if (recentSuggestions.length > 0) {
          categories.push({
            id: 'recent',
            label: 'Recent Searches',
            icon: <Clock size={16} />,
            suggestions: recentSuggestions,
            priority: 1
          })
        }
      }
      
      // 2. Query-based suggestions
      if (searchQuery.trim() !== '') {
        // Get recent search suggestions from store
        const matchingRecent = getRecentSearchSuggestions(searchQuery)
          .slice(0, 3)
          .map((search, index) => ({
            id: `recent-match-${index}`,
            type: 'recent' as const,
            text: search,
            displayText: search,
            description: 'Recent search',
            icon: <Clock size={14} />,
            frequency: searchHistory.find(h => h.query === search)?.results.length || 0
          }))
        
        if (matchingRecent.length > 0) {
          categories.push({
            id: 'recent-matches',
            label: 'Recent Searches',
            icon: <Clock size={16} />,
            suggestions: matchingRecent,
            priority: 2
          })
        }
        
        // Autocomplete suggestions
        const autocompleteSuggestions = generateAutocompleteSuggestions(searchQuery, notes)
        if (autocompleteSuggestions.length > 0) {
          categories.push({
            id: 'autocomplete',
            label: 'Autocomplete',
            icon: <BookOpen size={16} />,
            suggestions: autocompleteSuggestions,
            priority: 3
          })
        }
        
        // Typo corrections
        if (enableTypoCorrection) {
          const typoCorrections = generateTypoCorrections(searchQuery, recentSearches)
          if (typoCorrections.length > 0) {
            categories.push({
              id: 'typo-correction',
              label: 'Did you mean?',
              icon: <Lightbulb size={16} />,
              suggestions: typoCorrections,
              priority: 1.5
            })
          }
        }
      }
      
      // 3. Boolean operator suggestions (when query contains partial operators)
      if (enableBooleanHelp && searchQuery.trim() !== '') {
        const queryUpper = searchQuery.toUpperCase()
        const booleanSuggestions: SearchSuggestion[] = []
        
        BOOLEAN_OPERATORS.forEach(op => {
          if (op.operator === '""' && !searchQuery.includes('"')) {
            booleanSuggestions.push({
              id: `boolean-quote`,
              type: 'boolean' as const,
              text: `"${searchQuery}"`,
              displayText: `"${searchQuery}"`,
              description: `Exact phrase search: ${op.description}`,
              icon: <Hash size={14} />
            })
          } else if (op.operator === 'AND' && !queryUpper.includes(' AND ') && searchQuery.includes(' ')) {
            booleanSuggestions.push({
              id: `boolean-and`,
              type: 'boolean' as const,
              text: searchQuery.replace(/ /g, ' AND '),
              displayText: searchQuery.replace(/ /g, ' AND '),
              description: `${op.description}: ${op.example}`,
              icon: <Hash size={14} />
            })
          } else if (op.operator === 'OR' && !queryUpper.includes(' OR ') && searchQuery.includes(' ')) {
            booleanSuggestions.push({
              id: `boolean-or`,
              type: 'boolean' as const,
              text: searchQuery.replace(/ /g, ' OR '),
              displayText: searchQuery.replace(/ /g, ' OR '),
              description: `${op.description}: ${op.example}`,
              icon: <Hash size={14} />
            })
          }
        })
        
        if (booleanSuggestions.length > 0) {
          categories.push({
            id: 'boolean',
            label: 'Boolean Operators',
            icon: <Hash size={16} />,
            suggestions: booleanSuggestions.slice(0, 2),
            priority: 4
          })
        }
      }
      
      // 4. Search templates (when query is empty or matches template triggers)
      if (enableTemplates) {
        const templateSuggestions: SearchSuggestion[] = []
        
        if (searchQuery.trim() === '') {
          // Show popular templates when no query
          templateSuggestions.push(...SEARCH_TEMPLATES.slice(0, 3).map(template => ({
            id: `template-${template.id}`,
            type: 'template' as const,
            text: template.pattern,
            displayText: template.name,
            description: template.description,
            icon: template.icon,
            isTemplate: true,
            templateParams: template.pattern.match(/\{(\w+)\}/g) || []
          })))
        } else {
          // Show relevant templates based on query
          const relevantTemplates = SEARCH_TEMPLATES.filter(template =>
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.examples.some(example => example.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          
          templateSuggestions.push(...relevantTemplates.slice(0, 2).map(template => ({
            id: `template-${template.id}`,
            type: 'template' as const,
            text: template.pattern.replace(/\{query\}/g, searchQuery),
            displayText: template.name,
            description: template.description,
            icon: template.icon,
            isTemplate: true,
            templateParams: template.pattern.match(/\{(\w+)\}/g) || []
          })))
        }
        
        if (templateSuggestions.length > 0) {
          categories.push({
            id: 'templates',
            label: 'Search Templates',
            icon: <TrendingUp size={16} />,
            suggestions: templateSuggestions,
            priority: 5
          })
        }
      }
      
      // Sort categories by priority and limit total suggestions
      const sortedCategories = categories
        .sort((a, b) => a.priority - b.priority)
        .map(category => ({
          ...category,
          suggestions: category.suggestions.slice(0, Math.floor(maxSuggestions / categories.length) + 1)
        }))
      
      setSuggestionCategories(sortedCategories)
      setSelectedIndex(0)
      
      const endTime = performance.now()
      const totalSuggestions = sortedCategories.reduce((sum, cat) => sum + cat.suggestions.length, 0)
      
      setPerformanceMetrics({
        generationTime: endTime - startTime,
        totalSuggestions
      })
      
    } catch (error) {
      console.error('Failed to generate search suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [
    notes,
    recentSearches,
    searchHistory,
    getRecentSearchSuggestions,
    maxSuggestions,
    enableTemplates,
    enableBooleanHelp,
    enableTypoCorrection
  ])
  
  // Generate suggestions when query changes
  useEffect(() => {
    if (isVisible) {
      debouncedGenerateSuggestions(query)
    }
  }, [query, isVisible, debouncedGenerateSuggestions])
  
  // Flatten suggestions for keyboard navigation
  const flatSuggestions = useMemo(() => {
    return suggestionCategories.flatMap(category => category.suggestions)
  }, [suggestionCategories])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || flatSuggestions.length === 0) return
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, flatSuggestions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (flatSuggestions[selectedIndex]) {
            onSuggestionSelect(flatSuggestions[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, flatSuggestions, selectedIndex, onSuggestionSelect, onClose])
  
  // Scroll selected suggestion into view
  useEffect(() => {
    if (suggestionRefs.current[selectedIndex]) {
      suggestionRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex])
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, onClose])
  
  if (!isVisible || (!isLoading && suggestionCategories.length === 0)) {
    return null
  }
  
  return (
    <div
      ref={containerRef}
      className={`search-suggestions absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden ${className}`}
      role="listbox"
      aria-label="Search suggestions"
    >
      {/* Performance indicator */}
      {performanceMetrics && process.env.NODE_ENV === 'development' && (
        <div className="px-3 py-1 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center">
            <Zap size={10} className="mr-1" />
            Generated {performanceMetrics.totalSuggestions} suggestions in {performanceMetrics.generationTime.toFixed(1)}ms
          </span>
        </div>
      )}
      
      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-4 text-center text-gray-500">
          <div className="flex items-center justify-center">
            <Search size={16} className="mr-2 animate-pulse" />
            Generating suggestions...
          </div>
        </div>
      )}
      
      {/* Suggestion categories */}
      {!isLoading && (
        <div className="max-h-80 overflow-y-auto">
          {suggestionCategories.map(category => (
            <div key={category.id} className="border-b border-gray-100 last:border-b-0">
              {/* Category header */}
              <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center">
                {category.icon}
                <span className="ml-2">{category.label}</span>
                <span className="ml-auto text-gray-400">
                  {category.suggestions.length}
                </span>
              </div>
              
              {/* Category suggestions */}
              {category.suggestions.map((suggestion, categoryIndex) => {
                const globalIndex = flatSuggestions.indexOf(suggestion)
                const isSelected = globalIndex === selectedIndex
                
                return (
                  <div
                    key={suggestion.id}
                    ref={el => suggestionRefs.current[globalIndex] = el}
                    className={`px-3 py-2 cursor-pointer transition-colors duration-150 ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onSuggestionSelect(suggestion)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1 min-w-0">
                        <div className={`flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                          {suggestion.icon}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {suggestion.displayText}
                          </div>
                          {suggestion.description && (
                            <div className="text-xs text-gray-500 truncate">
                              {suggestion.description}
                            </div>
                          )}
                          {suggestion.confidence && (
                            <div className="text-xs text-blue-600">
                              Confidence: {(suggestion.confidence * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Suggestion metadata */}
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        {suggestion.frequency !== undefined && suggestion.frequency > 0 && (
                          <span title={`${suggestion.frequency} results`}>
                            {suggestion.frequency}
                          </span>
                        )}
                        {suggestion.lastUsed && (
                          <span title={`Last used: ${suggestion.lastUsed.toLocaleDateString()}`}>
                            <Clock size={10} />
                          </span>
                        )}
                        {suggestion.isTemplate && (
                          <span title="Search template">
                            <TrendingUp size={10} />
                          </span>
                        )}
                        <ArrowRight size={10} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
      
      {/* Footer with keyboard shortcuts */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
        {flatSuggestions.length > 0 && (
          <span>
            {selectedIndex + 1} of {flatSuggestions.length}
          </span>
        )}
      </div>
    </div>
  )
}

export default SearchSuggestions