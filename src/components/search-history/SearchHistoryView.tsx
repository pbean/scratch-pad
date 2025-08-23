import { useState, useEffect, useRef } from "react"
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, ArrowLeft, Search } from "lucide-react"
import { LoadingSpinner, InlineLoading, Skeleton } from "../ui/loading"
import { useScratchPadStore } from "../../lib/store"
import { VirtualList } from "../ui/virtual-list"
import type { Note } from "../../types"

interface TreeNode {
  id: string
  name: string
  type: "folder" | "note"
  children?: TreeNode[]
  note?: Note
  expanded?: boolean
  path: string
}

export function SearchHistoryView() {
  const { 
    notes, 
    setActiveNote, 
    setCurrentView, 
    expandedFolders, 
    toggleFolder,
    searchNotes,
    loadMoreNotes,
    hasMoreNotes,
    isLoadingMore
  } = useScratchPadStore()

  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [flattenedItems, setFlattenedItems] = useState<TreeNode[]>([])
  const [searchResults, setSearchResults] = useState<Note[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>()

  // Build tree structure from notes
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

  // Flatten tree for navigation
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

  // CRITICAL FIX #3: SearchHistoryView Timer Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Handle search with debouncing
  useEffect(() => {
    const performSearch = async () => {
      if (query.trim()) {
        setIsSearching(true)
        try {
          const results = await searchNotes(query)
          setSearchResults(results)
        } catch (error) {
          console.error("Search failed:", error)
          setSearchResults([])
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
        setIsSearching(false)
      }
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(performSearch, 300)
  }, [query, searchNotes])

  // Load more notes when scrolling near bottom
  const handleLoadMore = () => {
    if (hasMoreNotes && !isLoadingMore) {
      loadMoreNotes()
    }
  }

  // Convert search results to tree nodes
  const searchResultNodes: TreeNode[] = searchResults.map((note) => ({
    id: note.id.toString(),
    name: note.nickname || 
      note.content.split("\n")[0].substring(0, 50) || 
      "Untitled",
    type: "note",
    note,
    path: note.nickname || "Untitled",
  }))

  const displayItems = query ? searchResultNodes : flattenedItems
  const isSearchMode = query.length > 0

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Reset selection when switching modes or query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, isSearchMode])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            } else if (selectedItem.type === "folder" && !isSearchMode) {
              toggleFolder(selectedItem.id)
            }
          }
          break

        case "ArrowRight":
          if (!isSearchMode) {
            e.preventDefault()
            const selectedItem = displayItems[selectedIndex]
            if (selectedItem?.type === "folder" && !selectedItem.expanded) {
              toggleFolder(selectedItem.id)
            }
          }
          break

        case "ArrowLeft":
          if (!isSearchMode) {
            e.preventDefault()
            const selectedItem = displayItems[selectedIndex]
            if (selectedItem?.type === "folder" && selectedItem.expanded) {
              toggleFolder(selectedItem.id)
            }
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [displayItems, selectedIndex, query, isSearchMode, setCurrentView, setActiveNote, toggleFolder])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }
  }, [selectedIndex])

  const handleItemClick = (item: TreeNode) => {
    if (item.type === "note" && item.note) {
      setActiveNote(item.note.id)
      setCurrentView("note")
    } else if (item.type === "folder" && !isSearchMode) {
      toggleFolder(item.id)
    }
  }

  const formatLastModified = (dateString: string) => {
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
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <button
          onClick={() => setCurrentView("note")}
          className="p-1 hover:bg-muted rounded smooth-transition hover-lift"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="font-semibold">Search & Browse</h2>
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
            placeholder="Search notes..."
            className="w-full bg-input text-foreground placeholder-muted-foreground pl-10 pr-10 py-2 rounded-md outline-none focus-ring smooth-transition text-sm"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <LoadingSpinner size="sm" variant="gradient" />
            </div>
          )}
        </div>
      </div>

      {/* Results/Browser */}
      <div className="flex-1 overflow-hidden">
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
        ) : displayItems.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground fade-in">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              {isSearchMode ? <Search size={24} /> : <FileText size={24} />}
            </div>
            <p className="text-lg font-medium mb-2">
              {isSearchMode ? "No notes found" : "No notes available"}
            </p>
            <p className="text-sm">
              {isSearchMode ? "Try a different search term" : "Create your first note to get started"}
            </p>
          </div>
        ) : (
          <VirtualList
            items={displayItems}
            itemHeight={48}
            containerHeight={400} // Adjust based on your layout
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
                {!isSearchMode && (
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
                )}

                {/* Search Mode Icons */}
                {isSearchMode && (
                  <div className="flex items-center">
                    <FileText size={14} />
                  </div>
                )}

                {/* Item Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  {item.note && isSearchMode && (
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

        {/* Load More Button */}
        {!isSearchMode && hasMoreNotes && (
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
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {isSearchMode ? (
          <span>{searchResults.length} results found</span>
        ) : (
          <span>Use ↑↓ to navigate, Enter to open, ← → to expand/collapse</span>
        )}
      </div>
    </div>
  )
}