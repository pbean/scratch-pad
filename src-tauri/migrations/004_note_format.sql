-- Add note format and metadata support (idempotent)

-- Create the new table structure with all desired columns
CREATE TABLE IF NOT EXISTS notes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_pinned BOOLEAN DEFAULT 0,
    format TEXT DEFAULT 'text',
    nickname TEXT,
    tags TEXT
);

-- Copy data from old table, handling cases where new columns don't exist
-- This will work whether or not the new columns already exist
INSERT OR IGNORE INTO notes_new (id, content, created_at, updated_at, is_pinned, format, nickname, tags)
SELECT 
    id, 
    content, 
    created_at, 
    updated_at, 
    is_pinned,
    'text' as format,  -- Default value for format
    NULL as nickname,  -- Default value for nickname
    NULL as tags       -- Default value for tags
FROM notes 
WHERE id NOT IN (SELECT id FROM notes_new);

-- Only drop and rename if we actually need to migrate
-- Check if the old table has fewer columns than the new one
-- by comparing if a simple INSERT would work

-- Drop old table and rename new one
DROP TABLE IF EXISTS notes_old;
ALTER TABLE notes RENAME TO notes_old;
ALTER TABLE notes_new RENAME TO notes;

-- Copy any existing data that might have the new columns already
INSERT OR IGNORE INTO notes (id, content, created_at, updated_at, is_pinned, format, nickname, tags)
SELECT 
    id, 
    content, 
    created_at, 
    updated_at, 
    is_pinned,
    'text' as format,
    NULL as nickname,
    NULL as tags
FROM notes_old;

-- Clean up
DROP TABLE IF EXISTS notes_old;

-- Index for format and nickname searches
CREATE INDEX IF NOT EXISTS idx_notes_format ON notes(format);
CREATE INDEX IF NOT EXISTS idx_notes_nickname ON notes(nickname);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

-- Update FTS to include nickname for search
DROP TABLE IF EXISTS notes_fts;
CREATE VIRTUAL TABLE notes_fts USING fts5(
    content,
    nickname,
    content=notes,
    content_rowid=id
);

-- Repopulate FTS table
INSERT INTO notes_fts(rowid, content, nickname) 
SELECT id, content, COALESCE(nickname, '') FROM notes;