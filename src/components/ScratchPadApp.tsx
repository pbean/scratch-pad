import { useEffect } from "react"
import { NoteView } from "./note-view/NoteView"
import { CommandPalette } from "./command-palette/CommandPalette"
import { SearchHistoryView } from "./search-history/SearchHistoryView"
import { SettingsView } from "./settings/SettingsView"
import { useScratchPadStore } from "../lib/store"
import { invoke } from "@tauri-apps/api/core"

export function ScratchPadApp() {
  const { currentView, loadNotes, error, isCommandPaletteOpen, initializeSettings } = useScratchPadStore()

  // Load notes and initialize settings on app start
  useEffect(() => {
    const initializeApp = async () => {
      await initializeSettings()
      await loadNotes()
    }
    initializeApp()
  }, [loadNotes, initializeSettings])

  // Global Esc key handler for window dismissal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only hide window if no modal/palette is open
        if (!isCommandPaletteOpen && currentView !== "search-history" && currentView !== "settings") {
          e.preventDefault()
          invoke("hide_window").catch((error) => {
            console.error("Failed to hide window:", error)
          })
        }
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [isCommandPaletteOpen, currentView])

  const appStyle = {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))'
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={appStyle}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden" style={appStyle}>
      {currentView === "note" && <NoteView />}
      {currentView === "search-history" && <SearchHistoryView />}
      {currentView === "settings" && <SettingsView />}
      <CommandPalette />
    </div>
  )
}