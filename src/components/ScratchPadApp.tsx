import { useEffect, useState, lazy, Suspense, memo } from "react"
import { NoteView } from "./note-view/NoteView"
import { CommandPalette } from "./command-palette/CommandPalette"
import { SearchHistoryView } from "./search-history/SearchHistoryView"
import { FullPageLoading, Skeleton } from "./ui/loading"
import { useToast } from "./ui/toast"
import { useScratchPadStore } from "../lib/store"
import { useMemoryCleanup, useDataCleanup } from "../hooks/useMemoryCleanup"
import { useRenderPerformance, useMemoryMonitor, useStartupPerformance } from "../hooks/usePerformanceMonitor"
import { invoke } from "@tauri-apps/api/core"

// Lazy load components for better code splitting
const SettingsView = lazy(() =>
  import("./settings/SettingsView").then(module => ({ default: module.SettingsView }))
)

// Memoized loading fallback to prevent unnecessary re-renders
const SettingsLoadingFallback = memo(() => (
  <div className="h-full p-6 fade-in">
    <div className="max-w-2xl mx-auto space-y-6 stagger-children">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton width="24px" height="24px" />
        <Skeleton width="120px" height="28px" />
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton width="200px" height="20px" />
            <Skeleton width="100%" height="40px" />
          </div>
        ))}
      </div>
    </div>
  </div>
))

export function ScratchPadApp() {
  const { currentView, loadNotes, error, isCommandPaletteOpen, initializeSettings, notes } = useScratchPadStore()
  const [isInitializing, setIsInitializing] = useState(true)
  const [isAppReady, setIsAppReady] = useState(false)
  const toast = useToast()

  // Memory management hooks
  useMemoryCleanup()
  useDataCleanup(notes, 500) // Warn if more than 500 notes loaded

  // Performance monitoring hooks (development only)
  useRenderPerformance("ScratchPadApp")
  useMemoryMonitor()
  useStartupPerformance()

  // Load notes and initialize settings on app start with optimized loading
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsInitializing(true)

        // Initialize settings first (critical for app functionality)
        await initializeSettings()

        // Load notes with a small delay to improve perceived startup performance
        setTimeout(async () => {
          await loadNotes()
          setIsInitializing(false)

          // Add a brief delay for smooth window appearance
          setTimeout(() => {
            setIsAppReady(true)
          }, 100)
        }, 150)
      } catch (error) {
        console.error("Failed to initialize app:", error)
        toast.error("Failed to initialize", "Please try restarting the application")
        setIsInitializing(false)
      }
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

  // Loading state with enhanced UI
  if (isInitializing) {
    return (
      <div className="h-screen w-screen" style={appStyle}>
        <FullPageLoading message="Initializing ScratchPad" variant="gradient" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center window-appear" style={appStyle}>
        <div className="text-center p-8 rounded-lg border border-destructive/20 bg-destructive/5 slide-up max-w-md mx-4 stagger-children">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4 scale-in">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-destructive">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 smooth-transition button-press hover-lift scale-in"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }



  return (
    <div
      className={`h-screen w-screen overflow-hidden ${isAppReady ? 'window-appear' : 'opacity-0'}`}
      style={appStyle}
    >
      <div className="h-full w-full stagger-children">
        {currentView === "note" && <NoteView />}
        {currentView === "search-history" && <SearchHistoryView />}
        {currentView === "settings" && (
          <Suspense fallback={<SettingsLoadingFallback />}>
            <SettingsView />
          </Suspense>
        )}
      </div>
      <CommandPalette />
      <toast.ToastContainer />
    </div>
  )
}