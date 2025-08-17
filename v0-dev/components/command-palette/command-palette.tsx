"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Search, Settings, Save, Plus, FolderOpen } from "lucide-react"
import { useScratchPadStore } from "@/lib/store"

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
}

export function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setCurrentView, createNote } = useScratchPadStore()

  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
      action: createNote,
    },
    {
      id: "save-as",
      label: "Save As...",
      description: "Save current note with a new name",
      icon: <Save size={16} />,
      shortcut: "Ctrl+S",
      action: () => console.log("Save as"),
    },
    {
      id: "open-folder",
      label: "Open Folder",
      description: "Open notes folder in file explorer",
      icon: <FolderOpen size={16} />,
      action: () => console.log("Open folder"),
    },
    {
      id: "settings",
      label: "Open Settings",
      description: "Configure application settings",
      icon: <Settings size={16} />,
      action: () => console.log("Settings"),
    },
  ]

  const filteredCommands = commands.filter(
    (command) =>
      command.label.toLowerCase().includes(query.toLowerCase()) ||
      command.description?.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    if (isCommandPaletteOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery("")
      setSelectedIndex(0)
    }
  }, [isCommandPaletteOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return

      switch (e.key) {
        case "Escape":
          e.preventDefault()
          setCommandPaletteOpen(false)
          break
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            setCommandPaletteOpen(false)
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isCommandPaletteOpen, selectedIndex, filteredCommands, setCommandPaletteOpen])

  if (!isCommandPaletteOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50">
      <div className="bg-popover border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4">
        <div className="p-4 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none text-sm"
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No commands found</div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`
                  flex items-center gap-3 p-3 cursor-pointer transition-colors
                  ${index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}
                `}
                onClick={() => {
                  command.action()
                  setCommandPaletteOpen(false)
                }}
              >
                {command.icon && <div className="text-muted-foreground">{command.icon}</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{command.label}</div>
                  {command.description && (
                    <div className="text-xs text-muted-foreground truncate">{command.description}</div>
                  )}
                </div>
                {command.shortcut && (
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                    {command.shortcut}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
