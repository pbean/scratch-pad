/**
 * EnhancedSearchHistoryView - Week 2 Day 4
 * 
 * Enhanced search and browse interface with advanced highlighting capabilities.
 * Integrates VirtualizedSearchResults for optimal performance and UX.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder, 
  FolderOpen, 
  ArrowLeft, 
  Search, 
  Grid,
  Settings
} from "lucide-react"
import { LoadingSpinner, InlineLoading, Skeleton } from "../ui/loading"
import { useScratchPadStore } from "../../lib/store"
import { VirtualList } from "../ui/virtual-list"
import { VirtualizedSearchResults } from "../search/VirtualizedSearchResults"
import { HighlightedSearchResult } from "../search/HighlightedSearchResult"
import type { Note, SearchResult } from "../../types"
import { invoke } from "@tauri-apps/api/core"

// Import search highlighting styles
import "../../styles/search-highlighting.css"

interface TreeNode {
  id: string
  name: string
  type: "folder" | "note"
  children?: TreeNode[]
  note?: Note
  expanded?: boolean
  path: string
}

type ViewMode = "tree" | "search" | "grid"
type SearchMode = "simple" | "boolean"

export function EnhancedSearchHistoryView() {
  const { 
    notes, 
    setActiveNote, 
    setCurrentView, 
    expandedFolders, 
    toggleFolder,
    searchNotes: _searchNotes,
    loadMoreNotes,
    hasMoreNotes,
    isLoadingMore
  } = useScratchPadStore()

  // State management
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("search")
  const [searchMode, setSearchMode] = useState<SearchMode>("simple")
  const [isSearching, setIsSearching] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  
  // Tree view state
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [flattenedItems, setFlattenedItems] = useState<TreeNode[]>([])
  
  // Search state
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null)
  const _listRef = useRef<HTMLDivElement>(null); void _listRef

  // Search performance tracking
  const [searchStats, setSearchStats] = useState({
    lastQueryTime: 0,
    totalResults: 0,
    averageQueryTime: 0,
    queryCount: 0
  })

  // Build tree structure from notes (for tree view)
  useEffect(() => {
    const buildTree = (): TreeNode[] => {
      const tree: TreeNode[] = []
      const folderMap = new Map<string, TreeNode>()

      // Create root folders
      const rootFolders = ["Recent", "All Notes", "Favorites"]
      rootFolders.forEach((folderName) => {
        const folderId = folderName.toLowerCase().replace(" ", "-")
        const folder: TreeNode = {
          id: folderId,
          name: folderName,
          type: "folder",
          children: [],
          expanded: expandedFolders.has(folderId),
          path: folderName,
        }
        tree.push(folder)
        folderMap.set(folder.id, folder)
      })

      // Sort notes by updated_at (most recent first)
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

      sortedNotes.forEach((note) => {
        const noteTitle = note.nickname || 
          note.content.split("\n")[0].substring(0, 50) || 
          "Untitled"
        
        const noteNode: TreeNode = {
          id: note.id.toString(),
          name: noteTitle,
          type: "note",
          note,
          path: `All Notes/${noteTitle}`,
        }

        // Add to "All Notes"
        folderMap.get("all-notes")?.children?.push(noteNode)

        // Add recent notes (last 5) to "Recent"
        if (sortedNotes.indexOf(note) < 5) {
          folderMap.get("recent")?.children?.push({ 
            ...noteNode, 
            path: `Recent/${noteNode.name}` 
          })
        }

        // Add favorites to "Favorites"
        if (note.is_favorite) {
          folderMap.get("favorites")?.children?.push({ 
            ...noteNode, 
            path: `Favorites/${noteNode.name}` 
          })
        }
      })

      return tree
    }

    setTreeData(buildTree())
  }, [notes, expandedFolders])

  // Flatten tree for navigation (tree view only)
  useEffect(() => {
    const flattenTree = (nodes: TreeNode[], level = 0): TreeNode[] => {
      const flattened: TreeNode[] = []

      nodes.forEach((node) => {
        flattened.push({ ...node, path: `${"  ".repeat(level)}${node.name}` })

        if (node.type === "folder" && node.expanded && node.children) {
          flattened.push(...flattenTree(node.children, level + 1))
        }
      })

      return flattened
    }

    setFlattenedItems(flattenTree(treeData))
  }, [treeData])

  // Enhanced search with pagination and performance tracking
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResult(null)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)
    
    const startTime = performance.now()

    try {
      let result: SearchResult

      if (searchMode === "boolean") {
        // Use Boolean search
        const booleanResult = await invoke<{
          notes: Note[]
          total_count: number
          page: number
          page_size: number
          has_more: boolean
          query_time_ms: number
          complexity: any
        }>("search_notes_boolean_paginated", {
          query: searchQuery,
          page: 0,
          pageSize: 50
        })

        result = {
          notes: booleanResult.notes,
          total_count: booleanResult.total_count,
          page: booleanResult.page,
          page_size: booleanResult.page_size,
          has_more: booleanResult.has_more,
          query_time_ms: booleanResult.query_time_ms
        }
      } else {
        // Use simple paginated search
        result = await invoke<SearchResult>("search_notes_paginated", {
          query: searchQuery,
          page: 0,
          pageSize: 50
        })
      }

      setSearchResult(result)
      
      // Update search statistics
      const queryTime = performance.now() - startTime
      setSearchStats(prev => ({
        lastQueryTime: queryTime,
        totalResults: result.total_count,
        averageQueryTime: (prev.averageQueryTime * prev.queryCount + queryTime) / (prev.queryCount + 1),
        queryCount: prev.queryCount + 1
      }))

    } catch (error) {
      console.error("Search failed:", error)
      setSearchError(error instanceof Error ? error.message : "Search failed")
      setSearchResult(null)
    } finally {
      setIsSearching(false)
    }
  }, [searchMode])

  // Debounced search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (viewMode === "search") {
        performSearch(query)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [query, viewMode, performSearch])

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Reset selection when switching modes or query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, viewMode])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode === "tree") {
        // Tree navigation logic (existing)
        const displayItems = flattenedItems
        
        switch (e.key) {
          case "Escape":
            e.preventDefault()
            if (query) {
              setQuery("")
            } else {
              setCurrentView("note")
            }
            break

          case "ArrowDown":
            e.preventDefault()
            setSelectedIndex((prev) => Math.min(prev + 1, displayItems.length - 1))
            break

          case "ArrowUp":
            e.preventDefault()
            setSelectedIndex((prev) => Math.max(prev - 1, 0))
            break

          case "Enter":
            e.preventDefault()
            const selectedItem = displayItems[selectedIndex]
            if (selectedItem) {
              if (selectedItem.type === "note" && selectedItem.note) {
                setActiveNote(selectedItem.note.id)
                setCurrentView("note")
              } else if (selectedItem.type === "folder") {
                toggleFolder(selectedItem.id)
              }
            }
            break

          case "ArrowRight":
            e.preventDefault()
            const rightSelectedItem = displayItems[selectedIndex]
            if (rightSelectedItem?.type === "folder" && !rightSelectedItem.expanded) {
              toggleFolder(rightSelectedItem.id)
            }
            break

          case "ArrowLeft":
            e.preventDefault()
            const leftSelectedItem = displayItems[selectedIndex]
            if (leftSelectedItem?.type === "folder" && leftSelectedItem.expanded) {
              toggleFolder(leftSelectedItem.id)
            }
            break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [viewMode, flattenedItems, selectedIndex, query, setCurrentView, setActiveNote, toggleFolder])

  // Event handlers
  const handleItemClick = useCallback((item: TreeNode) => {
    if (item.type === "note" && item.note) {
      setActiveNote(item.note.id)
      setCurrentView("note")
    } else if (item.type === "folder") {
      toggleFolder(item.id)
    }
  }, [setActiveNote, setCurrentView, toggleFolder])

  const handleNoteClick = useCallback((note: Note) => {
    setActiveNote(note.id)
    setCurrentView("note")
  }, [setActiveNote, setCurrentView])

  const handleLoadMore = useCallback(() => {
    if (hasMoreNotes && !isLoadingMore) {
      loadMoreNotes()
    }
  }, [hasMoreNotes, isLoadingMore, loadMoreNotes])

  // View mode switching
  const switchViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === "search" && query.trim()) {
      performSearch(query)
    }
  }, [query, performSearch])

  // Format last modified date
  const formatLastModified = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView("note")}
            className="p-1 hover:bg-muted rounded smooth-transition hover-lift"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="font-semibold">Search & Browse</h2>
        </div>

        {/* View mode toggles */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          <button
            onClick={() => switchViewMode("tree")}
            className={`p-1.5 rounded text-xs transition-colors ${
              viewMode === "tree" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Tree view"
          >
            <Folder size={14} />
          </button>
          <button
            onClick={() => switchViewMode("search")}
            className={`p-1.5 rounded text-xs transition-colors ${
              viewMode === "search" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Search view"
          >
            <Search size={14} />
          </button>
          <button
            onClick={() => switchViewMode("grid")}
            className={`p-1.5 rounded text-xs transition-colors ${
              viewMode === "grid" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search notes${searchMode === "boolean" ? " (Boolean operators: AND, OR, NOT)" : ""}...`}
            className="w-full bg-input text-foreground placeholder-muted-foreground pl-10 pr-20 py-2 rounded-md outline-none focus-ring smooth-transition text-sm"
          />
          
          {/* Search mode toggle */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            {isSearching && (
              <LoadingSpinner size="sm" variant="gradient" />
            )}
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Search options"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Advanced search options */}
        {showAdvancedOptions && (
          <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Search Mode:</label>
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="text-sm bg-background border border-border rounded px-2 py-1"
              >
                <option value="simple">Simple</option>
                <option value="boolean">Boolean (AND, OR, NOT)</option>
              </select>
            </div>
            
            {searchStats.queryCount > 0 && (
              <div className="text-xs text-muted-foreground">
                Last query: {searchStats.lastQueryTime.toFixed(1)}ms • 
                Avg: {searchStats.averageQueryTime.toFixed(1)}ms • 
                Total results: {searchStats.totalResults}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Search Results */}
        {viewMode === "search" && (
          <>
            {isSearching ? (
              <div className="p-8 text-center fade-in">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4">
                      <Skeleton width="16px" height="16px" />
                      <div className="flex-1 space-y-2">
                        <Skeleton width="60%" height="16px" />
                        <Skeleton width="80%" height="12px" />
                      </div>
                      <Skeleton width="40px" height="12px" />
                    </div>
                  ))}
                </div>
              </div>
            ) : searchError ? (
              <div className="p-8 text-center text-destructive fade-in">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <Search size={24} />
                </div>
                <h3 className="text-lg font-medium mb-2">Search Error</h3>
                <p className="text-sm">{searchError}</p>
              </div>
            ) : searchResult ? (
              <VirtualizedSearchResults
                searchResult={searchResult}
                query={query}
                onNoteClick={handleNoteClick}
                height={600}
                showRelevanceScore={searchMode === "boolean"}
                enableSnippetExpansion={true}
                className="fade-in"
              />
            ) : query ? (
              <div className="p-8 text-center text-muted-foreground fade-in">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Search size={24} />
                </div>
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-sm">Try different keywords or check your spelling.</p>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Search size={24} />
                </div>
                <h3 className="text-lg font-medium mb-2">Start searching</h3>
                <p className="text-sm">Type above to search through your notes.</p>
              </div>
            )}
          </>
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(searchResult?.notes || notes.slice(0, 12)).map((note) => (
                <HighlightedSearchResult
                  key={note.id}
                  note={note}
                  query={query}
                  onNoteClick={handleNoteClick}
                  compact={true}
                  showSnippets={!!query}
                  maxSnippets={1}
                  enablePreview={true}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        )}

        {/* Tree View */}
        {viewMode === "tree" && (
          <>
            {flattenedItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground fade-in">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText size={24} />
                </div>
                <p className="text-lg font-medium mb-2">No notes available</p>
                <p className="text-sm">Create your first note to get started</p>
              </div>
            ) : (
              <VirtualList
                items={flattenedItems}
                itemHeight={48}
                containerHeight={400}
                selectedIndex={selectedIndex}
                onItemClick={handleItemClick}
                className="h-full"
                renderItem={(item, _index, isSelected) => (
                  <div
                    className={`
                      flex items-center gap-2 px-4 py-2 cursor-pointer smooth-transition text-sm h-12 button-press
                      ${isSelected ? "bg-accent text-accent-foreground search-highlight" : "hover:bg-muted hover-lift"}
                    `}
                  >
                    {/* Tree Structure Icons */}
                    <div
                      className="flex items-center"
                      style={{ marginLeft: `${(item.path.match(/^ */)?.[0]?.length || 0) * 8}px` }}
                    >
                      {item.type === "folder" ? (
                        <>
                          {item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {item.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                        </>
                      ) : (
                        <>
                          <div className="w-[14px]" />
                          <FileText size={14} />
                        </>
                      )}
                    </div>

                    {/* Item Content */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.note && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.note.content.substring(0, 100)}
                          {item.note.content.length > 100 && "..."}
                        </div>
                      )}
                    </div>

                    {/* Last Modified */}
                    {item.note && (
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatLastModified(item.note.updated_at)}
                      </div>
                    )}
                  </div>
                )}
              />
            )}

            {/* Load More Button for Tree View */}
            {hasMoreNotes && (
              <div className="p-4 border-t border-border fade-in">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-3 px-4 text-sm bg-muted hover:bg-muted/80 rounded-md disabled:opacity-50 smooth-transition hover-lift button-press flex items-center justify-center gap-2"
                >
                  {isLoadingMore ? (
                    <InlineLoading message="Loading more notes" size="sm" />
                  ) : (
                    <>
                      <FileText size={16} />
                      Load More Notes
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {viewMode === "search" && searchResult ? (
          <span>{searchResult.total_count} results found in {searchResult.query_time_ms}ms</span>
        ) : viewMode === "tree" ? (
          <span>Use ↑↓ to navigate, Enter to open, ← → to expand/collapse</span>
        ) : (
          <span>Search and browse your notes with advanced highlighting</span>
        )}
      </div>
    </div>
  )
}