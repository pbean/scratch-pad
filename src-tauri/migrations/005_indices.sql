-- Additional optimization indices for performance
CREATE INDEX IF NOT EXISTS idx_notes_content_length ON notes(length(content));
CREATE INDEX IF NOT EXISTS idx_notes_composite_date_pin ON notes(created_at DESC, is_pinned);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, content, nickname) 
    VALUES (new.id, new.content, COALESCE(new.nickname, ''));
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    UPDATE notes_fts SET content = new.content, nickname = COALESCE(new.nickname, '') 
    WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE rowid = old.id;
END;