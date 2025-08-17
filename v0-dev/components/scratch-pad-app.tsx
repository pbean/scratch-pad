"use client"

import { NoteView } from "./note-view/note-view"
import { CommandPalette } from "./command-palette/command-palette"
import { SearchHistoryView } from "./search-history/search-history-view"
import { useScratchPadStore } from "@/lib/store"

export function ScratchPadApp() {
  const currentView = useScratchPadStore((state) => state.currentView)

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden">
      {currentView === "note" && <NoteView />}
      {currentView === "search-history" && <SearchHistoryView />}
      <CommandPalette />
    </div>
  )
}
