import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { 
  Filter, 
  X, 
  Calendar, 
  Star, 
  FileText, 
  Hash, 
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Sliders,
  Check
} from 'lucide-react'
import type { SearchFilters, SearchCriteria, NoteFormat } from '../../types'

interface SearchFilterPanelProps {
  filters: SearchFilters
  criteria: SearchCriteria
  onFiltersChange: (filters: Partial<SearchFilters>) => void
  onCriteriaChange: (criteria: Partial<SearchCriteria>) => void
  onClearAll: () => void
  className?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface DatePreset {
  label: string
  value: { startDate: string | null; endDate: string | null }
  icon: React.ReactNode
}

interface FilterChip {
  id: string
  label: string
  value: string
  onRemove: () => void
}

interface FilterPreset {
  id: string
  name: string
  filters: SearchFilters
  criteria: SearchCriteria
}

const SearchFilterPanel: React.FC<SearchFilterPanelProps> = React.memo(({
  filters,
  criteria,
  onFiltersChange,
  onCriteriaChange,
  onClearAll,
  className = '',
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [expandedSections, setExpandedSections] = useState({
    dateRange: true,
    favorites: true,
    content: true,
    format: true,
    presets: false
  })
  
  const [customDateRange, setCustomDateRange] = useState({
    start: filters.dateRange?.startDate || '',
    end: filters.dateRange?.endDate || ''
  })

  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([])
  const [presetName, setPresetName] = useState('')

  // Date presets with performance optimization
  const datePresets = useMemo<DatePreset[]>(() => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)
    
    const lastMonth = new Date(today)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    
    const lastYear = new Date(today)
    lastYear.setFullYear(lastYear.getFullYear() - 1)

    return [
      {
        label: 'Today',
        value: { 
          startDate: today.toISOString().split('T')[0], 
          endDate: today.toISOString().split('T')[0] 
        },
        icon: <Calendar size={12} />
      },
      {
        label: 'Yesterday',
        value: { 
          startDate: yesterday.toISOString().split('T')[0], 
          endDate: yesterday.toISOString().split('T')[0] 
        },
        icon: <Clock size={12} />
      },
      {
        label: 'Last Week',
        value: { 
          startDate: lastWeek.toISOString().split('T')[0], 
          endDate: today.toISOString().split('T')[0] 
        },
        icon: <Calendar size={12} />
      },
      {
        label: 'Last Month',
        value: { 
          startDate: lastMonth.toISOString().split('T')[0], 
          endDate: today.toISOString().split('T')[0] 
        },
        icon: <Calendar size={12} />
      },
      {
        label: 'Last Year',
        value: { 
          startDate: lastYear.toISOString().split('T')[0], 
          endDate: today.toISOString().split('T')[0] 
        },
        icon: <Calendar size={12} />
      }
    ]
  }, [])

  // Available note formats
  const noteFormats: Array<{ value: NoteFormat; label: string; icon: React.ReactNode }> = [
    { value: 'plaintext', label: 'Plain Text', icon: <FileText size={12} /> },
    { value: 'markdown', label: 'Markdown', icon: <Hash size={12} /> }
  ]

  // Generate active filter chips for visual feedback
  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []

    // Date range chip
    if (filters.dateRange?.startDate || filters.dateRange?.endDate) {
      const start = filters.dateRange.startDate ? new Date(filters.dateRange.startDate).toLocaleDateString() : 'Any'
      const end = filters.dateRange.endDate ? new Date(filters.dateRange.endDate).toLocaleDateString() : 'Any'
      chips.push({
        id: 'dateRange',
        label: 'Date Range',
        value: `${start} - ${end}`,
        onRemove: () => onFiltersChange({ dateRange: { startDate: null, endDate: null } })
      })
    }

    // Favorites chip
    if (filters.favorites !== undefined) {
      chips.push({
        id: 'favorites',
        label: 'Favorites',
        value: filters.favorites ? 'Favorites Only' : 'Non-Favorites Only',
        onRemove: () => onFiltersChange({ favorites: undefined })
      })
    }

    // Content length chips
    if (filters.minLength !== undefined || filters.maxLength !== undefined) {
      const min = filters.minLength ?? 'Any'
      const max = filters.maxLength ?? 'Any'
      chips.push({
        id: 'contentLength',
        label: 'Content Length',
        value: `${min} - ${max} chars`,
        onRemove: () => onFiltersChange({ minLength: undefined, maxLength: undefined })
      })
    }

    // Format chip
    if (filters.format && filters.format.length > 0) {
      chips.push({
        id: 'format',
        label: 'Format',
        value: filters.format.map(f => f === 'plaintext' ? 'Plain Text' : 'Markdown').join(', '),
        onRemove: () => onFiltersChange({ format: [] })
      })
    }

    return chips
  }, [filters, onFiltersChange])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.dateRange?.startDate ||
      filters.dateRange?.endDate ||
      filters.favorites !== undefined ||
      filters.minLength !== undefined ||
      filters.maxLength !== undefined ||
      (filters.format && filters.format.length > 0) ||
      !criteria.contentSearch ||
      criteria.booleanOperators
    )
  }, [filters, criteria])

  // Section toggle handler with performance optimization
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }, [])

  // Date preset selection handler
  const handleDatePreset = useCallback((preset: DatePreset) => {
    onFiltersChange({
      dateRange: preset.value
    })
    setCustomDateRange({
      start: preset.value.startDate || '',
      end: preset.value.endDate || ''
    })
  }, [onFiltersChange])

  // Custom date range handlers
  const handleCustomDateChange = useCallback((type: 'start' | 'end', value: string) => {
    const newRange = { ...customDateRange, [type]: value }
    setCustomDateRange(newRange)
    
    onFiltersChange({
      dateRange: {
        startDate: newRange.start || null,
        endDate: newRange.end || null
      }
    })
  }, [customDateRange, onFiltersChange])

  // Format selection handler
  const handleFormatToggle = useCallback((format: NoteFormat) => {
    const currentFormats = filters.format || []
    const newFormats = currentFormats.includes(format)
      ? currentFormats.filter(f => f !== format)
      : [...currentFormats, format]
    
    onFiltersChange({ format: newFormats })
  }, [filters.format, onFiltersChange])

  // Content length handlers with debouncing
  const handleLengthChange = useCallback((type: 'min' | 'max', value: string) => {
    const numValue = value ? parseInt(value) : undefined
    onFiltersChange({
      [type === 'min' ? 'minLength' : 'maxLength']: numValue
    })
  }, [onFiltersChange])

  // Preset management
  const saveCurrentAsPreset = useCallback(() => {
    if (!presetName.trim()) return

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: { ...filters },
      criteria: { ...criteria }
    }

    setSavedPresets(prev => [...prev, newPreset])
    setPresetName('')
  }, [presetName, filters, criteria])

  const loadPreset = useCallback((preset: FilterPreset) => {
    onFiltersChange(preset.filters)
    onCriteriaChange(preset.criteria)
  }, [onFiltersChange, onCriteriaChange])

  const deletePreset = useCallback((presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId))
  }, [])

  // Keyboard navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onToggleCollapse?.()
    }
  }, [onToggleCollapse])

  // Load saved presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('search-filter-presets')
      if (saved) {
        setSavedPresets(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error)
    }
  }, [])

  // Save presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('search-filter-presets', JSON.stringify(savedPresets))
    } catch (error) {
      console.error('Failed to save filter presets:', error)
    }
  }, [savedPresets])

  if (isCollapsed) {
    return (
      <div className={`filter-panel-collapsed ${className}`}>
        <button
          onClick={onToggleCollapse}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          aria-label="Expand filter panel"
        >
          <Filter size={14} />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
              {activeFilterChips.length}
            </span>
          )}
          <ChevronDown size={14} />
        </button>
      </div>
    )
  }

  return (
    <div 
      className={`search-filter-panel bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Search filters"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">Search Filters</h3>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-0.5">
              {activeFilterChips.length} active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center space-x-1"
              title="Clear all filters"
            >
              <RotateCcw size={12} />
              <span>Clear All</span>
            </button>
          )}
          
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Collapse filter panel"
          >
            <ChevronUp size={16} />
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterChips.length > 0 && (
        <div className="p-3 bg-gray-50 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map(chip => (
              <div
                key={chip.id}
                className="flex items-center space-x-2 bg-blue-100 text-blue-800 text-xs rounded-full px-3 py-1"
              >
                <span className="font-medium">{chip.label}:</span>
                <span>{chip.value}</span>
                <button
                  onClick={chip.onRemove}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Date Range Filter */}
        <div className="filter-section">
          <button
            onClick={() => toggleSection('dateRange')}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expandedSections.dateRange}
          >
            <div className="flex items-center space-x-2">
              <Calendar size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Date Range</span>
            </div>
            {expandedSections.dateRange ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandedSections.dateRange && (
            <div className="mt-3 space-y-3">
              {/* Date Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {datePresets.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => handleDatePreset(preset)}
                    className="flex items-center space-x-2 px-3 py-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {preset.icon}
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Custom Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="start-date" className="sr-only">Start date</label>
                    <input
                      id="start-date"
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Start date"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="sr-only">End date</label>
                    <input
                      id="end-date"
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="End date"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Favorites Filter */}
        <div className="filter-section">
          <button
            onClick={() => toggleSection('favorites')}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expandedSections.favorites}
          >
            <div className="flex items-center space-x-2">
              <Star size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Favorites</span>
            </div>
            {expandedSections.favorites ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandedSections.favorites && (
            <div className="mt-3 space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="favorites"
                  checked={filters.favorites === undefined}
                  onChange={() => onFiltersChange({ favorites: undefined })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">All notes</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="favorites"
                  checked={filters.favorites === true}
                  onChange={() => onFiltersChange({ favorites: true })}
                  className="text-yellow-600 focus:ring-yellow-500"
                />
                <Star size={14} className="text-yellow-500" />
                <span className="text-sm">Favorites only</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="favorites"
                  checked={filters.favorites === false}
                  onChange={() => onFiltersChange({ favorites: false })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Non-favorites only</span>
              </label>
            </div>
          )}
        </div>

        {/* Content Filter */}
        <div className="filter-section">
          <button
            onClick={() => toggleSection('content')}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expandedSections.content}
          >
            <div className="flex items-center space-x-2">
              <Sliders size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Content</span>
            </div>
            {expandedSections.content ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandedSections.content && (
            <div className="mt-3 space-y-3">
              {/* Search Criteria */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.contentSearch}
                    onChange={(e) => onCriteriaChange({ contentSearch: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Search in content</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={criteria.booleanOperators}
                    onChange={(e) => onCriteriaChange({ booleanOperators: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Boolean operators (AND, OR, NOT)</span>
                </label>
              </div>

              {/* Content Length */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Content Length (characters)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="min-length" className="sr-only">Minimum length</label>
                    <input
                      id="min-length"
                      type="number"
                      value={filters.minLength || ''}
                      onChange={(e) => handleLengthChange('min', e.target.value)}
                      placeholder="Min"
                      min="0"
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="max-length" className="sr-only">Maximum length</label>
                    <input
                      id="max-length"
                      type="number"
                      value={filters.maxLength || ''}
                      onChange={(e) => handleLengthChange('max', e.target.value)}
                      placeholder="Max"
                      min="0"
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Format Filter */}
        <div className="filter-section">
          <button
            onClick={() => toggleSection('format')}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expandedSections.format}
          >
            <div className="flex items-center space-x-2">
              <FileText size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Note Format</span>
            </div>
            {expandedSections.format ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandedSections.format && (
            <div className="mt-3 space-y-2">
              {noteFormats.map(format => (
                <label key={format.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(filters.format || []).includes(format.value)}
                    onChange={() => handleFormatToggle(format.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {format.icon}
                  <span className="text-sm">{format.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Filter Presets */}
        <div className="filter-section">
          <button
            onClick={() => toggleSection('presets')}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expandedSections.presets}
          >
            <div className="flex items-center space-x-2">
              <Save size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter Presets</span>
            </div>
            {expandedSections.presets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandedSections.presets && (
            <div className="mt-3 space-y-3">
              {/* Save Current Preset */}
              {hasActiveFilters && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    maxLength={30}
                  />
                  <button
                    onClick={saveCurrentAsPreset}
                    disabled={!presetName.trim()}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Saved Presets */}
              {savedPresets.length > 0 ? (
                <div className="space-y-2">
                  {savedPresets.map(preset => (
                    <div key={preset.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <button
                        onClick={() => loadPreset(preset)}
                        className="flex-1 text-left text-sm hover:text-blue-600 transition-colors"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        aria-label={`Delete preset ${preset.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">No saved presets</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

SearchFilterPanel.displayName = 'SearchFilterPanel'

export default SearchFilterPanel