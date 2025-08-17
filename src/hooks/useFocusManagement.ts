import { useEffect, useRef } from "react"

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
 * Hook for managing keyboard navigation in lists
 */
export function useKeyboardNavigation(
  items: any[],
  selectedIndex: number,
  onSelectionChange: (index: number) => void,
  onSelect: (item: any, index: number) => void,
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