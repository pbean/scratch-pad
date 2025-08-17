export type View = "note" | "search-history" | "settings"

export type NoteFormat = "plaintext" | "markdown"

export type LayoutMode = "default" | "half" | "full"

export interface Note {
  id: number
  content: string
  format: NoteFormat
  nickname?: string
  path: string
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface ApiError {
  code: string
  message: string
}

export interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string
  action: () => void
  disabled?: boolean
}

export interface GlobalShortcutInfo {
  current: string | null
  suggestions: string[]
  isRegistered: (shortcut: string) => Promise<boolean>
  canRegister: (shortcut: string) => Promise<boolean>
}

export interface Settings {
  global_shortcut: string
  ui_font: string
  editor_font: string
  default_note_format: NoteFormat
  layout_mode: LayoutMode
  window_width: number
  window_height: number
  auto_save_delay_ms: number
  search_limit: number
  fuzzy_search_threshold: number
}

export interface SettingsFormData {
  globalShortcut: string
  uiFont: string
  editorFont: string
  defaultNoteFormat: NoteFormat
  layoutMode: LayoutMode
  windowWidth: string
  windowHeight: string
  autoSaveDelay: string
  searchLimit: string
  fuzzySearchThreshold: string
}