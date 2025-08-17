"use client"

import { formatDistanceToNow } from "date-fns"

interface StatusBarProps {
  lastSaved: Date | null
  isAutoSaving: boolean
  wordCount: number
  charCount: number
  lineCount: number
}

export function StatusBar({ lastSaved, isAutoSaving, wordCount, charCount, lineCount }: StatusBarProps) {
  const getSaveStatus = () => {
    if (isAutoSaving) {
      return "Saving..."
    }
    if (lastSaved) {
      return `Auto-saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`
    }
    return "Not saved"
  }

  return (
    <div className="flex items-center justify-between bg-card border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className={isAutoSaving ? "text-primary" : ""}>{getSaveStatus()}</span>
        <span>Markdown</span>
        <span>LF</span>
        <span>UTF-8</span>
        <span>2 Spaces</span>
      </div>

      <div className="flex items-center gap-4">
        <span>{lineCount} lines</span>
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
      </div>
    </div>
  )
}
