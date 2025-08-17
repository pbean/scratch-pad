"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from "lucide-react"
import { useScratchPadStore } from "@/lib/store"

interface TreeNode {
  id: string
  name: string
  type: "folder" | "note"
  children?: TreeNode[]
  note?: any
  expanded?: boolean
  path: string
}

export function SearchHistoryView() {
  const { notes, selectNote, setCurrentView, expandedFolders, toggleFolder } = useScratchPadStore()

  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [flattenedItems, setFlattenedItems] = useState<TreeNode[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build tree structure from notes
  useEffect(() => {
    const buildTree = (): TreeNode[] => {
      const tree: TreeNode[] = []
      const folderMap = new Map<string, TreeNode>()

      // Create root folders
      const rootFolders = ["Recent", "All Notes", "Drafts"]
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

      // Add notes to appropriate folders
      const sortedNotes = [...notes].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())

      sortedNotes.forEach((note) => {
        const noteNode: TreeNode = {
          id: note.id,
          name: note.title || note.content.split("\n")[0].substring(0, 50) || "Untitled",
          type: "note",
          note,
          path: `All Notes/${note.title || "Untitled"}`,
        }

        // Add to "All Notes"
        folderMap.get("all-notes")?.children?.push(noteNode)

        // Add recent notes (last 5) to "Recent"
        if (sortedNotes.indexOf(note) < 5) {
          folderMap.get("recent")?.children?.push({ ...noteNode, path: `Recent/${noteNode.name}` })
        }

        // Add drafts (notes with little content) to "Drafts"
        if (note.content.length < 100) {
          folderMap.get("drafts")?.children?.push({ ...noteNode, path: `Drafts/${noteNode.name}` })
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

  // Filter notes for search mode
  const searchResults = query
    ? notes
        .filter(
          (note) =>
            note.title?.toLowerCase().includes(query.toLowerCase()) ||
            note.content.toLowerCase().includes(query.toLowerCase()),
        )
        .map((note) => ({
          id: note.id,
          name: note.title || note.content.split("\n")[0].substring(0, 50) || "Untitled",
          type: "note" as const,
          note,
          path: note.title || "Untitled",
        }))
    : []

  const displayItems = query ? searchResults : flattenedItems
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
              const newTab = e.ctrlKey || e.metaKey
              selectNote(selectedItem.note.id, newTab)
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
  }, [displayItems, selectedIndex, query, isSearchMode, setCurrentView, selectNote, toggleFolder])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" })
      }
    }
  }, [selectedIndex])

  const handleItemClick = (item: TreeNode, newTab = false) => {
    if (item.type === "note" && item.note) {
      selectNote(item.note.id, newTab)
    } else if (item.type === "folder" && !isSearchMode) {
      toggleFolder(item.id)
    }
  }

  const formatLastModified = (date: Date) => {
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
      {/* Search Input */}
      <div className="p-4 border-b border-border">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes... (Esc to go back)"
          className="w-full bg-input text-foreground placeholder-muted-foreground px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>

      {/* Results/Browser */}
      <div className="flex-1 overflow-hidden">
        <div ref={listRef} className="h-full overflow-y-auto">
          {displayItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {isSearchMode ? "No notes found" : "No notes available"}
            </div>
          ) : (
            displayItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`
                  flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors text-sm
                  ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}
                `}
                onClick={() => handleItemClick(item)}
                onDoubleClick={() => handleItemClick(item, true)}
              >
                {/* Tree Structure Icons */}
                {!isSearchMode && (
                  <div
                    className="flex items-center"
                    style={{ marginLeft: `${item.path.match(/^ */)?.[0].length * 8}px` }}
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
                  {item.note && (
                    <div className="text-xs text-muted-foreground truncate">
                      {isSearchMode && (
                        <>
                          {item.note.content.substring(0, 100)}
                          {item.note.content.length > 100 && "..."}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Last Modified */}
                {item.note && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatLastModified(item.note.lastModified)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {isSearchMode ? (
          <span>{searchResults.length} results found</span>
        ) : (
          <span>Use ↑↓ to navigate, Enter to open, Ctrl+Enter for new tab</span>
        )}
      </div>
    </div>
  )
}
