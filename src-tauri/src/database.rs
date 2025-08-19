use crate::error::AppError;
use crate::models::{Note, NoteFormat, Setting};
use crate::validation::SecurityValidator;  // Add security validation import
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, OptionalExtension};  // Added OptionalExtension trait
use rusqlite_migration::{Migrations, M};
use std::path::Path;
use std::sync::Arc;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConnection = PooledConnection<SqliteConnectionManager>;

#[derive(Debug)]
pub struct DbService {
    pool: Arc<DbPool>,
}

impl DbService {
    /// Create a new DbService with optimized connection pooling
    pub fn new<P: AsRef<Path>>(database_path: P) -> Result<Self, AppError> {
        let manager = SqliteConnectionManager::file(database_path)
            .with_init(|c| {
                // Optimize SQLite settings for performance and startup speed
                c.execute_batch("
                    PRAGMA journal_mode = WAL;
                    PRAGMA synchronous = NORMAL;
                    PRAGMA cache_size = 2000;
                    PRAGMA temp_store = MEMORY;
                    PRAGMA mmap_size = 268435456;
                    PRAGMA page_size = 4096;
                    PRAGMA optimize;
                ")?;
                Ok(())
            });

        let pool = Pool::builder()
            .max_size(3) // Smaller pool for faster startup
            .min_idle(Some(1)) // Keep at least one connection ready
            .connection_timeout(std::time::Duration::from_secs(3))
            .idle_timeout(Some(std::time::Duration::from_secs(300))) // Close idle connections after 5 minutes
            .build(manager)?;

        let service = DbService {
            pool: Arc::new(pool),
        };

        // Initialize the database schema
        service.initialize_database()?;

        Ok(service)
    }

    /// Get a connection from the pool
    pub fn get_connection(&self) -> Result<DbConnection, AppError> {
        self.pool.get().map_err(AppError::from)
    }

    /// Initialize the database schema with migrations
    fn initialize_database(&self) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        let migrations = Migrations::new(vec![
            // Initial schema
            M::up(include_str!("../migrations/001_initial.sql")),
            
            // Add settings table
            M::up(include_str!("../migrations/002_settings.sql")),
            
            // Add FTS5 search
            M::up(include_str!("../migrations/003_fts.sql")),
            
            // Add note format support
            M::up(include_str!("../migrations/004_note_format.sql")),
            
            // Optimization indices
            M::up(include_str!("../migrations/005_indices.sql")),
        ]);

        migrations.to_latest(&conn)?;
        Ok(())
    }

    /// Create a new note
    pub async fn create_note(&self, content: String) -> Result<Note, AppError> {
        let conn = self.get_connection()?;
        
        // SECURITY: Validate content before insertion
        SecurityValidator::validate_note_content(&content)?;
        
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        // Insert into main notes table
        conn.execute(
            "INSERT INTO notes (content, created_at, updated_at, is_pinned) VALUES (?1, ?2, ?3, ?4)",
            params![content, now, now, false],
        )?;
        
        let id = conn.last_insert_rowid();
        
        // Insert into FTS table for search indexing
        conn.execute(
            "INSERT INTO notes_fts (rowid, content) VALUES (?1, ?2)",
            params![id, content],
        )?;
        
        Ok(Note {
            id,
            content,
            created_at: now.clone(),
            updated_at: now,
            is_pinned: false,
            format: NoteFormat::PlainText,
            nickname: None,
            path: format!("/note/{}", id),
        })
    }

    /// Get a note by ID
    pub async fn get_note(&self, id: i64) -> Result<Option<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, content, created_at, updated_at, is_pinned FROM notes WHERE id = ?1"
        )?;
        
        let note = stmt.query_row(params![id], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        }).optional()?;  // Now optional() trait is in scope
        
        Ok(note)
    }

    /// Update a note's content
    pub async fn update_note(&self, id: i64, content: String) -> Result<Note, AppError> {
        let conn = self.get_connection()?;
        
        // SECURITY: Validate content before update
        SecurityValidator::validate_note_content(&content)?;
        
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        // Update main notes table
        let rows_affected = conn.execute(
            "UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3",
            params![content, now, id],
        )?;
        
        if rows_affected == 0 {
            return Err(AppError::NotFound { id });
        }
        
        // Update FTS table
        conn.execute(
            "UPDATE notes_fts SET content = ?1 WHERE rowid = ?2",
            params![content, id],
        )?;
        
        // Fetch and return updated note
        self.get_note(id).await?.ok_or(AppError::NotFound { id })
    }

    /// Delete a note
    pub async fn delete_note(&self, id: i64) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        // Delete from FTS table first
        conn.execute("DELETE FROM notes_fts WHERE rowid = ?1", params![id])?;
        
        // Delete from main table
        let rows_affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        
        if rows_affected == 0 {
            return Err(AppError::NotFound { id });
        }
        
        Ok(())
    }

    /// Get all notes with optional pagination
    pub async fn get_all_notes(&self, offset: Option<i64>, limit: Option<i64>) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut query = "SELECT id, content, created_at, updated_at, is_pinned FROM notes ORDER BY created_at DESC".to_string();
        let mut params = Vec::new();
        
        if let Some(limit) = limit {
            query.push_str(" LIMIT ?");
            params.push(limit);
            
            if let Some(offset) = offset {
                query.push_str(" OFFSET ?");
                params.push(offset);
            }
        }
        
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params), |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;
        
        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        
        Ok(notes)
    }

    /// Get notes with pagination (alias for frontend compatibility)
    pub async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError> {
        self.get_all_notes(Some(offset), Some(limit)).await
    }

    /// Search notes using FTS5
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;
        
        // SECURITY: Validate search query before execution
        SecurityValidator::validate_search_query(query)?;
        
        let mut stmt = conn.prepare(
            "SELECT n.id, n.content, n.created_at, n.updated_at, n.is_pinned 
             FROM notes n 
             INNER JOIN notes_fts fts ON n.id = fts.rowid 
             WHERE notes_fts MATCH ?1 
             ORDER BY rank"
        )?;
        
        let rows = stmt.query_map(params![query], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;
        
        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        
        Ok(notes)
    }

    /// Search notes with pagination
    pub async fn search_notes_paginated(&self, query: &str, offset: i64, limit: i64) -> Result<(Vec<Note>, i64), AppError> {
        let conn = self.get_connection()?;
        
        // SECURITY: Validate search query before execution
        SecurityValidator::validate_search_query(query)?;
        
        // Get total count
        let total_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params![query],
            |row| row.get(0)
        )?;
        
        // Get paginated results
        let mut stmt = conn.prepare(
            "SELECT n.id, n.content, n.created_at, n.updated_at, n.is_pinned 
             FROM notes n 
             INNER JOIN notes_fts fts ON n.id = fts.rowid 
             WHERE notes_fts MATCH ?1 
             ORDER BY rank 
             LIMIT ?2 OFFSET ?3"
        )?;
        
        let rows = stmt.query_map(params![query, limit, offset], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;
        
        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        
        Ok((notes, total_count))
    }

    /// Get a setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.get_connection()?;
        
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0)
        ).optional()?;  // Now optional() trait is in scope
        
        Ok(result)
    }

    /// Set a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        
        Ok(())
    }

    /// Get all settings
    pub async fn get_all_settings(&self) -> Result<Vec<Setting>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
        let rows = stmt.query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })?;
        
        let mut settings = Vec::new();
        for setting in rows {
            settings.push(setting?);
        }
        
        Ok(settings)
    }

    /// Delete a setting
    pub async fn delete_setting(&self, key: &str) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        Ok(())
    }

    /// Clear all settings
    pub async fn clear_all_settings(&self) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        conn.execute("DELETE FROM settings", [])?;
        Ok(())
    }

    /// Check database connection health
    pub async fn health_check(&self) -> Result<bool, AppError> {
        let conn = self.get_connection()?;
        let result: i64 = conn.query_row("SELECT 1", [], |row| row.get(0))?;
        Ok(result == 1)
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> Result<DatabaseStats, AppError> {
        let conn = self.get_connection()?;
        
        let note_count: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?;
        let setting_count: i64 = conn.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))?;
        
        // Get database file size (approximate)
        let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        let page_size: i64 = conn.query_row("PRAGMA page_size", [], |row| row.get(0))?;
        let db_size = page_count * page_size;
        
        Ok(DatabaseStats {
            note_count,
            setting_count,
            db_size_bytes: db_size,
        })
    }
}

/// Database statistics
#[derive(Debug, serde::Serialize)]
pub struct DatabaseStats {
    pub note_count: i64,
    pub setting_count: i64,
    pub db_size_bytes: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_and_get_note() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        let note = db.create_note("Test content".to_string()).await.unwrap();
        assert_eq!(note.content, "Test content");
        assert!(!note.is_pinned);
        
        let retrieved = db.get_note(note.id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, "Test content");
        assert_eq!(retrieved.id, note.id);
    }

    #[tokio::test]
    async fn test_update_note() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        let note = db.create_note("Original content".to_string()).await.unwrap();
        let updated = db.update_note(note.id, "Updated content".to_string()).await.unwrap();
        
        assert_eq!(updated.content, "Updated content");
        assert_eq!(updated.id, note.id);
    }

    #[tokio::test]
    async fn test_delete_note() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        let note = db.create_note("Test content".to_string()).await.unwrap();
        db.delete_note(note.id).await.unwrap();
        
        let retrieved = db.get_note(note.id).await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_search_notes() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        db.create_note("Rust programming is fun".to_string()).await.unwrap();
        db.create_note("JavaScript is also good".to_string()).await.unwrap();
        
        let results = db.search_notes("Rust").await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
    }

    #[tokio::test]
    async fn test_pagination() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        // Create multiple notes
        for i in 1..=5 {
            db.create_note(format!("Note {}", i)).await.unwrap();
        }
        
        let notes = db.get_notes_paginated(0, 3).await.unwrap();
        assert_eq!(notes.len(), 3);
    }

    #[tokio::test]
    async fn test_settings() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        db.set_setting("test_key", "test_value").await.unwrap();
        
        let value = db.get_setting("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));
        
        let all_settings = db.get_all_settings().await.unwrap();
        assert!(!all_settings.is_empty());
    }

    #[tokio::test]
    async fn test_health_check() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        let health = db.health_check().await.unwrap();
        assert!(health);
    }

    #[tokio::test]
    async fn test_database_stats() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = DbService::new(&db_path).unwrap();
        
        db.create_note("Test note".to_string()).await.unwrap();
        db.set_setting("test", "value").await.unwrap();
        
        let stats = db.get_stats().await.unwrap();
        assert_eq!(stats.note_count, 1);
        assert_eq!(stats.setting_count, 1);
        assert!(stats.db_size_bytes > 0);
    }
}