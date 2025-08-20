import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// TYPE-SAFE FOCUS MANAGEMENT IMPLEMENTATION
// ============================================================================

/**
 * Configuration for focus management with complete type safety
 */
interface TypeSafeFocusConfig<T> {
  items: readonly T[]
  onSelect: (item: T, index: number) => void
  initialIndex?: number
  wrap?: boolean
  disabled?: boolean
  skipDisabled?: boolean
  getDisabledState?: (item: T, index: number) => boolean
  getId?: (item: T, index: number) => string
  onFocusChange?: (item: T | null, index: number) => void
}

/**
 * Return type for focus management hook
 */
interface TypeSafeFocusReturn<T> {
  focusedIndex: number
  focusedItem: T | null
  setFocusedIndex: (index: number) => void
  nextItem: () => void
  previousItem: () => void
  firstItem: () => void
  lastItem: () => void
  selectCurrentItem: () => void
  handleKeyDown: (event: React.KeyboardEvent) => void
  resetFocus: () => void
  focusItemById: (id: string) => boolean
  isFocused: (index: number) => boolean
  isSelected: (item: T, index: number) => boolean
}

/**
 * Key mapping configuration for keyboard navigation
 */
interface KeyboardConfig {
  next: string[]
  previous: string[]
  select: string[]
  first: string[]
  last: string[]
  escape: string[]
}

/**
 * Default keyboard configuration
 */
const DEFAULT_KEYBOARD_CONFIG: KeyboardConfig = {
  next: ['ArrowDown', 'Tab'],
  previous: ['ArrowUp', 'Shift+Tab'],
  select: ['Enter', ' '],
  first: ['Home'],
  last: ['End'],
  escape: ['Escape']
}

/**
 * Enhanced focus management hook with complete type safety
 */
export function useTypeSafeFocusManagement<T>(
  config: TypeSafeFocusConfig<T>,
  keyboardConfig: Partial<KeyboardConfig> = {}
): TypeSafeFocusReturn<T> {
  const {
    items,
    onSelect,
    initialIndex = -1,
    wrap = true,
    disabled = false,
    skipDisabled = true,
    getDisabledState,
    getId,
    onFocusChange
  } = config

  const [focusedIndex, setFocusedIndexState] = useState<number>(initialIndex)
  const keyConfig = { ...DEFAULT_KEYBOARD_CONFIG, ...keyboardConfig }
  const previousItemsRef = useRef<readonly T[]>(items)

  // Validate and normalize index
  const normalizeIndex = useCallback((index: number): number => {
    if (items.length === 0) return -1
    if (index < 0) return wrap ? items.length - 1 : -1
    if (index >= items.length) return wrap ? 0 : items.length - 1
    return index
  }, [items.length, wrap])

  // Check if an item is disabled
  const isItemDisabled = useCallback((item: T, index: number): boolean => {
    return getDisabledState ? getDisabledState(item, index) : false
  }, [getDisabledState])

  // Find next enabled item from given index
  const findNextEnabledIndex = useCallback((
    startIndex: number, 
    direction: 1 | -1
  ): number => {
    if (items.length === 0) return -1
    if (!skipDisabled) return normalizeIndex(startIndex + direction)

    let currentIndex = startIndex
    let attempts = 0

    do {
      currentIndex = normalizeIndex(currentIndex + direction)
      attempts++

      // Prevent infinite loops
      if (attempts > items.length) {
        return -1
      }

      // If we've wrapped around and found no enabled items
      if (currentIndex === startIndex) {
        return -1
      }

      if (currentIndex >= 0 && currentIndex < items.length) {
        const item = items[currentIndex]
        if (item && !isItemDisabled(item, currentIndex)) {
          return currentIndex
        }
      }
    } while (currentIndex !== startIndex)

    return -1
  }, [items, normalizeIndex, skipDisabled, isItemDisabled])

  // Type-safe focus index setter with validation
  const setFocusedIndex = useCallback((index: number): void => {
    if (disabled) return

    const normalizedIndex = normalizeIndex(index)
    
    if (normalizedIndex !== focusedIndex) {
      setFocusedIndexState(normalizedIndex)
      
      // Call focus change callback
      if (onFocusChange) {
        const item = normalizedIndex >= 0 && normalizedIndex < items.length 
          ? items[normalizedIndex] 
          : null
        onFocusChange(item, normalizedIndex)
      }
    }
  }, [disabled, normalizeIndex, focusedIndex, onFocusChange, items])

  // Get currently focused item with type safety
  const focusedItem: T | null = focusedIndex >= 0 && focusedIndex < items.length 
    ? items[focusedIndex] 
    : null

  // Navigation functions with type safety
  const nextItem = useCallback((): void => {
    if (disabled || items.length === 0) return
    
    const nextIndex = findNextEnabledIndex(focusedIndex, 1)
    if (nextIndex >= 0) {
      setFocusedIndex(nextIndex)
    }
  }, [disabled, items.length, findNextEnabledIndex, focusedIndex, setFocusedIndex])

  const previousItem = useCallback((): void => {
    if (disabled || items.length === 0) return
    
    const prevIndex = findNextEnabledIndex(focusedIndex, -1)
    if (prevIndex >= 0) {
      setFocusedIndex(prevIndex)
    }
  }, [disabled, items.length, findNextEnabledIndex, focusedIndex, setFocusedIndex])

  const firstItem = useCallback((): void => {
    if (disabled || items.length === 0) return
    
    const firstIndex = findNextEnabledIndex(-1, 1)
    if (firstIndex >= 0) {
      setFocusedIndex(firstIndex)
    }
  }, [disabled, items.length, findNextEnabledIndex, setFocusedIndex])

  const lastItem = useCallback((): void => {
    if (disabled || items.length === 0) return
    
    const lastIndex = findNextEnabledIndex(items.length, -1)
    if (lastIndex >= 0) {
      setFocusedIndex(lastIndex)
    }
  }, [disabled, items.length, findNextEnabledIndex, setFocusedIndex])

  // Select current item with type safety
  const selectCurrentItem = useCallback((): void => {
    if (disabled || focusedIndex < 0 || focusedIndex >= items.length) return
    
    const item = items[focusedIndex]
    if (item && !isItemDisabled(item, focusedIndex)) {
      onSelect(item, focusedIndex)
    }
  }, [disabled, focusedIndex, items, isItemDisabled, onSelect])

  // Reset focus to initial state
  const resetFocus = useCallback((): void => {
    setFocusedIndex(initialIndex)
  }, [setFocusedIndex, initialIndex])

  // Focus item by ID with type safety
  const focusItemById = useCallback((id: string): boolean => {
    if (disabled || !getId) return false
    
    const index = items.findIndex((item, idx) => getId(item, idx) === id)
    if (index >= 0 && !isItemDisabled(items[index], index)) {
      setFocusedIndex(index)
      return true
    }
    return false
  }, [disabled, getId, items, isItemDisabled, setFocusedIndex])

  // Check if index is currently focused
  const isFocused = useCallback((index: number): boolean => {
    return index === focusedIndex
  }, [focusedIndex])

  // Check if item is selected (for multi-select scenarios)
  const isSelected = useCallback((item: T, index: number): boolean => {
    // This can be extended for multi-select functionality
    return isFocused(index)
  }, [isFocused])

  // Enhanced keyboard event handler with type safety
  const handleKeyDown = useCallback((event: React.KeyboardEvent): void => {
    if (disabled) return

    const key = event.shiftKey ? `Shift+${event.key}` : event.key
    let handled = false

    // Navigation keys
    if (keyConfig.next.includes(key)) {
      event.preventDefault()
      nextItem()
      handled = true
    } else if (keyConfig.previous.includes(key)) {
      event.preventDefault()
      previousItem()
      handled = true
    } else if (keyConfig.first.includes(key)) {
      event.preventDefault()
      firstItem()
      handled = true
    } else if (keyConfig.last.includes(key)) {
      event.preventDefault()
      lastItem()
      handled = true
    } else if (keyConfig.select.includes(key)) {
      event.preventDefault()
      selectCurrentItem()
      handled = true
    } else if (keyConfig.escape.includes(key)) {
      event.preventDefault()
      resetFocus()
      handled = true
    }

    // Stop propagation if we handled the key
    if (handled) {
      event.stopPropagation()
    }
  }, [
    disabled, 
    keyConfig, 
    nextItem, 
    previousItem, 
    firstItem, 
    lastItem, 
    selectCurrentItem, 
    resetFocus
  ])

  // Handle items change with type safety
  useEffect(() => {
    const prevItems = previousItemsRef.current
    const currentItems = items

    // If items array has changed, validate current focus
    if (prevItems !== currentItems) {
      if (currentItems.length === 0) {
        setFocusedIndexState(-1)
      } else if (focusedIndex >= currentItems.length) {
        // Focus was beyond new array length, move to last item
        setFocusedIndex(currentItems.length - 1)
      } else if (focusedIndex >= 0) {
        // Verify current item is still valid and enabled
        const currentItem = currentItems[focusedIndex]
        if (!currentItem || isItemDisabled(currentItem, focusedIndex)) {
          // Find next valid item
          const nextValidIndex = findNextEnabledIndex(focusedIndex - 1, 1)
          setFocusedIndex(nextValidIndex)
        }
      }

      previousItemsRef.current = currentItems
    }
  }, [items, focusedIndex, setFocusedIndex, isItemDisabled, findNextEnabledIndex])

  return {
    focusedIndex,
    focusedItem,
    setFocusedIndex,
    nextItem,
    previousItem,
    firstItem,
    lastItem,
    selectCurrentItem,
    handleKeyDown,
    resetFocus,
    focusItemById,
    isFocused,
    isSelected
  }
}

// ============================================================================
// SPECIALIZED HOOKS FOR COMMON USE CASES
// ============================================================================

/**
 * Hook for managing focus in a list of strings
 */
export function useStringListFocus(
  items: readonly string[],
  onSelect: (item: string, index: number) => void,
  options?: Partial<Omit<TypeSafeFocusConfig<string>, 'items' | 'onSelect'>>
): TypeSafeFocusReturn<string> {
  return useTypeSafeFocusManagement({
    items,
    onSelect,
    ...options
  })
}

/**
 * Hook for managing focus in a list of objects with ID
 */
export function useObjectListFocus<T extends { id: string }>(
  items: readonly T[],
  onSelect: (item: T, index: number) => void,
  options?: Partial<Omit<TypeSafeFocusConfig<T>, 'items' | 'onSelect' | 'getId'>>
): TypeSafeFocusReturn<T> {
  return useTypeSafeFocusManagement({
    items,
    onSelect,
    getId: (item) => item.id,
    ...options
  })
}

/**
 * Hook for managing focus in command palette items
 */
interface CommandItem {
  id: string
  label: string
  disabled?: boolean
}

export function useCommandFocus(
  commands: readonly CommandItem[],
  onExecute: (command: CommandItem, index: number) => void,
  options?: Partial<Omit<TypeSafeFocusConfig<CommandItem>, 'items' | 'onSelect' | 'getId' | 'getDisabledState'>>
): TypeSafeFocusReturn<CommandItem> {
  return useTypeSafeFocusManagement({
    items: commands,
    onSelect: onExecute,
    getId: (command) => command.id,
    getDisabledState: (command) => command.disabled || false,
    ...options
  })
}

/**
 * Hook for managing focus in search results
 */
interface SearchResultItem {
  id: string
  title: string
  score?: number
  disabled?: boolean
}

export function useSearchResultsFocus(
  results: readonly SearchResultItem[],
  onSelectResult: (result: SearchResultItem, index: number) => void,
  options?: Partial<Omit<TypeSafeFocusConfig<SearchResultItem>, 'items' | 'onSelect' | 'getId' | 'getDisabledState'>>
): TypeSafeFocusReturn<SearchResultItem> {
  return useTypeSafeFocusManagement({
    items: results,
    onSelect: onSelectResult,
    getId: (result) => result.id,
    getDisabledState: (result) => result.disabled || false,
    ...options
  })
}

// ============================================================================
// LEGACY HOOKS FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Hook for managing focus restoration when components unmount
 */
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    return () => {
      // Restore focus when component unmounts
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        try {
          previousActiveElement.current.focus()
        } catch (error) {
          // Ignore focus errors (element might be removed from DOM)
        }
      }
    }
  }, [])
}

/**
 * Hook for auto-focusing an element when component mounts
 */
export function useAutoFocus<T extends HTMLElement>() {
  const elementRef = useRef<T>(null)

  useEffect(() => {
    if (elementRef.current) {
      // Small delay to ensure element is fully rendered
      const timer = setTimeout(() => {
        elementRef.current?.focus()
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [])

  return elementRef
}

/**
 * Legacy hook for keyboard navigation - now type-safe
 */
export function useKeyboardNavigation<T>(
  items: readonly T[],
  selectedIndex: number,
  onSelectionChange: (index: number) => void,
  onSelect: (item: T, index: number) => void,
  onEscape?: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          onSelectionChange(Math.min(selectedIndex + 1, items.length - 1))
          break

        case "ArrowUp":
          e.preventDefault()
          onSelectionChange(Math.max(selectedIndex - 1, 0))
          break

        case "Enter":
          e.preventDefault()
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex], selectedIndex)
          }
          break

        case "Escape":
          e.preventDefault()
          onEscape?.()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [items, selectedIndex, onSelectionChange, onSelect, onEscape])
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create ARIA attributes for focused items
 */
export function createFocusAriaAttributes<T>(
  item: T,
  index: number,
  focusReturn: TypeSafeFocusReturn<T>
): {
  'aria-selected': boolean
  'aria-current': boolean | 'true' | 'false'
  tabIndex: number
  role: string
} {
  return {
    'aria-selected': focusReturn.isFocused(index),
    'aria-current': focusReturn.isFocused(index) ? 'true' : 'false',
    tabIndex: focusReturn.isFocused(index) ? 0 : -1,
    role: 'option'
  }
}

/**
 * Get CSS classes for focused items
 */
export function getFocusClasses(
  isFocused: boolean,
  baseClasses: string = '',
  focusClasses: string = 'bg-accent text-accent-foreground'
): string {
  return [baseClasses, isFocused ? focusClasses : ''].filter(Boolean).join(' ')
}

// Main export for new type-safe usage
export const useFocusManagement = useTypeSafeFocusManagement

// Export types for external use
export type {
  TypeSafeFocusConfig,
  TypeSafeFocusReturn,
  KeyboardConfig,
  CommandItem,
  SearchResultItem
}