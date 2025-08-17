import { useState, useEffect, useRef, useMemo } from "react"

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode
  selectedIndex?: number
  onItemClick?: (item: T, index: number) => void
  className?: string
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  selectedIndex = -1,
  onItemClick,
  className = ""
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // Calculate visible range
  const { startIndex, endIndex: _endIndex, visibleItems } = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(start + visibleCount + 1, items.length)
    
    return {
      startIndex: start,
      endIndex: end,
      visibleItems: items.slice(start, end)
    }
  }, [items, itemHeight, containerHeight, scrollTop])

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && scrollElementRef.current) {
      const selectedTop = selectedIndex * itemHeight
      const selectedBottom = selectedTop + itemHeight
      const viewportTop = scrollTop
      const viewportBottom = scrollTop + containerHeight

      if (selectedTop < viewportTop) {
        scrollElementRef.current.scrollTop = selectedTop
      } else if (selectedBottom > viewportBottom) {
        scrollElementRef.current.scrollTop = selectedBottom - containerHeight
      }
    }
  }, [selectedIndex, itemHeight, containerHeight, scrollTop])

  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index
            const isSelected = actualIndex === selectedIndex
            
            return (
              <div
                key={actualIndex}
                style={{ height: itemHeight }}
                onClick={() => onItemClick?.(item, actualIndex)}
              >
                {renderItem(item, actualIndex, isSelected)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}