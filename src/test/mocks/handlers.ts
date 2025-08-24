import { http, HttpResponse } from 'msw'
import type { Note } from '../../types'

// Helper to create a mock note
const createMockNote = (id: number, content: string): Note => ({
  id,
  content,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_deleted: false,
  is_encrypted: false,
  is_favorite: false,
  is_pinned: false,
  is_protected: false,
  notebook_id: null,
  preview: content.substring(0, 100),
  title: content.split('\n')[0] || 'Untitled',
  word_count: content.split(/\s+/).length,
  char_count: content.length,
  checksum: null,
  version: 1,
  sync_status: null,
  metadata: null,
  tags: [],
  author: null,
  reminder_date: null,
  created_by: null,
  shared_with: null,
  attachments: null,
  location: null,
  weather: null,
  mood: null,
  activity: null,
  nickname: null,
})

// Mock database for tests
let mockNotes: Note[] = []
let nextId = 1

// MSW doesn't directly intercept Tauri IPC calls, so we need to mock at the invoke level
// These handlers are for reference and will be used with vi.mock
export const tauriHandlers = {
  // Note operations
  get_all_notes: async () => {
    return mockNotes.filter(n => !n.is_deleted)
  },
  
  get_notes_count: async () => {
    return mockNotes.filter(n => !n.is_deleted).length
  },
  
  create_note: async ({ content }: { content: string }) => {
    const note = createMockNote(nextId++, content)
    mockNotes.push(note)
    return note
  },
  
  update_note: async ({ id, content, note }: { id?: number; content?: string; note?: Note }) => {
    // Handle both API formats: { id, content } and { note }
    const targetId = id ?? note?.id
    const targetContent = content ?? note?.content
    
    if (!targetId || targetContent === undefined) {
      throw new Error('Invalid update_note parameters')
    }
    
    const index = mockNotes.findIndex(n => n.id === targetId)
    if (index === -1) {
      throw new Error('Note not found')
    }
    
    mockNotes[index] = {
      ...mockNotes[index],
      content: targetContent,
      updated_at: new Date().toISOString(),
      preview: targetContent.substring(0, 100),
      title: targetContent.split('\n')[0] || 'Untitled',
      word_count: targetContent.split(/\s+/).length,
      char_count: targetContent.length,
    }
    
    return mockNotes[index]
  },
  
  delete_note: async ({ id }: { id: number }) => {
    const index = mockNotes.findIndex(n => n.id === id)
    if (index === -1) {
      throw new Error('Note not found')
    }
    mockNotes[index].is_deleted = true
    return { success: true }
  },
  
  // Search operations
  search_notes: async ({ query }: { query: string }) => {
    if (!query) return []
    const lowerQuery = query.toLowerCase()
    return mockNotes.filter(n => 
      !n.is_deleted && 
      n.content.toLowerCase().includes(lowerQuery)
    )
  },
  
  combined_search_notes: async ({ query }: { query: string }) => {
    return tauriHandlers.search_notes({ query })
  },
  
  search_notes_paginated: async ({ query, page = 0, page_size = 20 }: { 
    query: string; 
    page?: number; 
    page_size?: number 
  }) => {
    const results = await tauriHandlers.search_notes({ query })
    const start = page * page_size
    const paginatedResults = results.slice(start, start + page_size)
    
    return {
      results: paginatedResults,
      total: results.length,
      page,
      page_size,
      has_more: start + page_size < results.length
    }
  },
  
  search_notes_boolean_paginated: async ({ 
    query, 
    page = 0, 
    page_size = 20 
  }: { 
    query: string; 
    page?: number; 
    page_size?: number 
  }) => {
    // Simple boolean search implementation for tests
    const results = await tauriHandlers.search_notes({ query })
    const start = page * page_size
    const paginatedResults = results.slice(start, start + page_size)
    
    return {
      results: paginatedResults,
      total: results.length,
      page,
      page_size,
      has_more: start + page_size < results.length,
      query_valid: true
    }
  },
  
  validate_boolean_search_query: async ({ query }: { query: string }) => {
    // Simple validation for tests
    return {
      valid: true,
      error: null
    }
  },
  
  // Settings operations
  get_all_settings: async () => {
    // Return mock settings
    return {
      theme: 'dark',
      font_size: 14,
      auto_save: true,
      note_directory: '/home/user/notes'
    }
  },
  
  get_setting: async ({ key }: { key: string }) => {
    // Return mock setting value
    const settings: Record<string, any> = {
      theme: 'dark',
      font_size: 14,
      auto_save: true,
      note_directory: '/home/user/notes'
    }
    return settings[key] || null
  },
  
  set_setting: async ({ key, value }: { key: string; value: any }) => {
    // Mock implementation
    return undefined
  },
  
  reset_settings_to_defaults: async () => {
    return { success: true }
  },
  
  initialize_default_settings: async () => {
    return { success: true }
  },
  
  // Window operations
  show_window: async () => {
    return undefined
  },
  
  hide_window: async () => {
    return undefined
  },
  
  toggle_window: async () => {
    return { success: true }
  },
  
  center_window: async () => {
    return { success: true }
  },
  
  set_always_on_top: async ({ alwaysOnTop }: { alwaysOnTop: boolean }) => {
    return { success: true }
  },
  
  set_layout_mode: async ({ mode }: { mode: string }) => {
    return undefined
  },
  
  get_layout_mode: async () => {
    return 'full'
  },
  
  // Shortcut operations
  get_current_global_shortcut: async () => {
    return 'Ctrl+Shift+N'
  },
  
  register_global_shortcut: async ({ shortcut }: { shortcut: string }) => {
    return undefined
  },
  
  unregister_global_shortcut: async () => {
    return undefined
  },
  
  test_global_shortcut: async ({ shortcut }: { shortcut: string }) => {
    // Return true for valid shortcuts
    return true
  },
  
  update_global_shortcut: async ({ 
    oldShortcut, 
    newShortcut 
  }: { 
    oldShortcut: string; 
    newShortcut: string 
  }) => {
    return { success: true }
  },
  
  // Plugin operations
  get_plugin_info: async () => {
    return [
      { name: 'markdown-plugin', version: '1.0.0' },
      { name: 'syntax-highlight', version: '2.0.0' }
    ]
  },
  
  get_plugin_count: async () => {
    return 2
  },
  
  get_available_note_formats: async () => {
    return ['plaintext', 'markdown', 'html']
  },
}

// Helper functions for tests
export const resetMockDatabase = () => {
  mockNotes = []
  nextId = 1
}

export const addMockNote = (content: string) => {
  const note = createMockNote(nextId++, content)
  mockNotes.push(note)
  return note
}

export const getMockNotes = () => mockNotes.filter(n => !n.is_deleted)

// HTTP handlers for MSW (if we were intercepting HTTP requests)
// Note: Tauri IPC doesn't use HTTP, so these are mainly for reference
export const handlers = [
  http.post('*/tauri/invoke', async ({ request }) => {
    const body = await request.json() as { cmd: string; args?: any }
    const handler = tauriHandlers[body.cmd as keyof typeof tauriHandlers]
    
    if (!handler) {
      return HttpResponse.json(
        { error: `Unknown command: ${body.cmd}` },
        { status: 400 }
      )
    }
    
    try {
      const result = await handler(body.args || {})
      return HttpResponse.json(result)
    } catch (error) {
      return HttpResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  }),
]