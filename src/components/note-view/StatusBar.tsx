interface StatusBarProps {
  lastSaved: Date | null
  isAutoSaving: boolean
  wordCount: number
  charCount: number
  lineCount: number
  noteTitle: string
}

export function StatusBar({ 
  lastSaved, 
  isAutoSaving, 
  wordCount, 
  charCount, 
  lineCount,
  noteTitle 
}: StatusBarProps) {
  const formatLastSaved = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return "Just now"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m ago`
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="font-medium truncate max-w-48">{noteTitle}</span>
        <span>
          {isAutoSaving ? "Saving..." : lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : "Not saved"}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <span>{wordCount} words</span>
        <span>{charCount} chars</span>
        <span>{lineCount} lines</span>
      </div>
    </div>
  )
}