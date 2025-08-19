-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    content,
    content=notes,
    content_rowid=id
);

-- Populate FTS table with existing notes
INSERT INTO notes_fts(rowid, content) 
SELECT id, content FROM notes;