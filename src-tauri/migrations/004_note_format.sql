-- Add note format and metadata support
ALTER TABLE notes ADD COLUMN format TEXT DEFAULT 'text';
ALTER TABLE notes ADD COLUMN nickname TEXT;
ALTER TABLE notes ADD COLUMN tags TEXT; -- JSON array of tags

-- Index for format and nickname searches
CREATE INDEX IF NOT EXISTS idx_notes_format ON notes(format);
CREATE INDEX IF NOT EXISTS idx_notes_nickname ON notes(nickname);

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