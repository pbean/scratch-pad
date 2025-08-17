import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Note } from "../types"

export function TestApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const result = await invoke<Note[]>("get_all_notes")
        setNotes(result)
      } catch (err) {
        setError(err as string)
      } finally {
        setLoading(false)
      }
    }

    loadNotes()
  }, [])

  const createTestNote = async () => {
    try {
      const newNote = await invoke<Note>("create_note", { 
        content: "Test note created at " + new Date().toISOString() 
      })
      setNotes(prev => [newNote, ...prev])
    } catch (err) {
      setError(err as string)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Scratch Pad Test</h1>
      
      <button 
        onClick={createTestNote}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Create Test Note
      </button>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Notes ({notes.length})</h2>
        {notes.map(note => (
          <div key={note.id} className="p-3 border rounded">
            <div className="font-medium">Note #{note.id}</div>
            <div className="text-sm text-gray-600">{note.content.substring(0, 100)}</div>
            <div className="text-xs text-gray-400">
              Created: {new Date(note.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}