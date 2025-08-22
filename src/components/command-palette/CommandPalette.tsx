import { useState, useEffect, useRef } from "react"
import { Search, Settings, Plus, FolderOpen, FileText } from "lucide-react"
import { LoadingSpinner } from "../ui/loading"
import { useToast } from "../ui/toast"
import { useScratchPadStore } from "../../lib/store"
import { invoke } from "@tauri-apps/api/core"
import type { Command } from "../../types"

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setCurrentView,
    createNote,
    getActiveNote
  } = useScratchPadStore()

  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  // FE-FIX-005: Add ref for component-scoped event handling
  const componentRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const handleExportNote = async () => {
    const activeNote = getActiveNote()
    if (!activeNote || isExporting) return

    try {
      setIsExporting(true)
      // In a real implementation, you'd use Tauri's dialog API to show a save dialog
      // For now, we'll just export to a default location
      const fileName = `note_${activeNote.id}.txt`
      await invoke("export_note", {
        note: activeNote,
        filePath: fileName
      })
      toast.success("Note exported", `Saved as ${fileName}`)
    } catch (error) {
      console.error("Failed to export note:", error)
      toast.error("Export failed", "Could not export the note")
    } finally {
      setIsExporting(false)
    }
  }

  const handleOpenSettings = () => {
    setCurrentView("settings")
  }

  const commands: Command[] = [
    {
      id: "search-history",
      label: "Search History",
      description: "Search and browse your notes",
      icon: <Search size={16} />,
      shortcut: "Ctrl+Shift+F",
      action: () => setCurrentView("search-history"),
    },
    {
      id: "new-note",
      label: "New Note",
      description: "Create a new note",
      icon: <Plus size={16} />,
      shortcut: "Ctrl+N",
      action: () => createNote(),
    },
    {
      id: "export-note",
      label: isExporting ? "Exporting..." : "Export Note",
      description: "Export current note to file",
      icon: isExporting ? <LoadingSpinner size="sm" variant="gradient" /> : <FileText size={16} />,
      action: handleExportNote,
      disabled: isExporting,
    },
    {
      id: "open-folder",
      label: "Open Folder",
      description: "Open notes folder in file explorer",
      icon: <FolderOpen size={16} />,
      action: () => toast.info("Feature coming soon", "Folder opening will be available in a future update"),
    },
    {
      id: "settings",
      label: "Open Settings",
      description: "Configure application settings",
      icon: <Settings size={16} />,
      action: handleOpenSettings,
    },
  ]

  const filteredCommands = commands.filter(
    (command) =>
      command.label.toLowerCase().includes(query.toLowerCase()) ||
      command.description?.toLowerCase().includes(query.toLowerCase()),
  )

  // FE-FIX-006: Enhanced focus effect with React 19 scheduling compatibility
  useEffect(() => {
    if (isCommandPaletteOpen && inputRef.current) {
      // Use microtask scheduling for React 19 compatibility
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus()
          setQuery("")
          setSelectedIndex(0)
        }
      }

      // Schedule focus using requestIdleCallback for better CI performance
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(focusInput, { timeout: 100 })
      } else {
        // Fallback for environments without requestIdleCallback
        setTimeout(focusInput, 0)
      }
    }
  }, [isCommandPaletteOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // FE-FIX-007: Component-scoped keyboard handling instead of document-level
  useEffect(() => {
    if (!isCommandPaletteOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle events if the component is actually visible and focused
      if (!componentRef.current || !componentRef.current.contains(document.activeElement)) {
        return
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          setCommandPaletteOpen(false)
          break
        case "ArrowDown":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
          break
        case "ArrowUp":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          break
        case "Enter":
          e.preventDefault()
          e.stopPropagation()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            setCommandPaletteOpen(false)
          }
          break
      }
    }

    // FE-FIX-008: Add event listener to the component instead of document
    if (componentRef.current) {
      const element = componentRef.current
      element.addEventListener("keydown", handleKeyDown, { capture: true })
      
      // Also add to document as fallback, but with a check
      const documentHandler = (e: KeyboardEvent) => {
        // Only handle if the component is open and no other element is handling
        if (isCommandPaletteOpen && componentRef.current?.contains(document.activeElement)) {
          handleKeyDown(e)
        }
      }
      document.addEventListener("keydown", documentHandler)
      
      return () => {
        element.removeEventListener("keydown", handleKeyDown, { capture: true })
        document.removeEventListener("keydown", documentHandler)
      }
    }

    return () => {}
  }, [isCommandPaletteOpen, selectedIndex, filteredCommands, setCommandPaletteOpen])

  if (!isCommandPaletteOpen) return null

  return (
    <div 
      ref={componentRef}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50 palette-backdrop"
      // FE-FIX-009: Make component focusable for keyboard event handling
      tabIndex={-1}
    >
      <div className="bg-popover border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4 palette-content">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              aria-label="Command search input"
              className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm focus-ring pl-10 pr-4 py-2"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm scale-in">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 scale-in">
                <Search size={20} />
              </div>
              <p>No commands found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="stagger-children">
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  className={`
                    command-item flex items-center gap-3 p-3 cursor-pointer smooth-transition button-press
                    ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}
                    ${command.disabled ? "opacity-50 cursor-not-allowed" : "hover-lift"}
                  `}
                  onClick={() => {
                    if (!command.disabled) {
                      command.action()
                      setCommandPaletteOpen(false)
                    }
                  }}
                >
                  {command.icon && (
                    <div className={`text-muted-foreground ${command.disabled ? '' : 'smooth-transition scale-in'}`}>
                      {command.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{command.label}</div>
                    {command.description && (
                      <div className="text-xs text-muted-foreground truncate">{command.description}</div>
                    )}
                  </div>
                  {command.shortcut && (
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono border scale-in">
                      {command.shortcut}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with helpful tips */}
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center justify-between">
            <span>↑↓ to navigate</span>
            <span>Enter to select</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}