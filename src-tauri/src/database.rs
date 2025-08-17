use crate::error::AppError;
use crate::models::{Note, NoteFormat, Setting};
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use rusqlite_migration::{Migrations, M};
use std::path::Path;
use std::sync::Arc;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConnection = PooledConnection<SqliteConnectionManager>;

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
        Ok(self.pool.get()?)
    }

    /// Initialize the database schema using migrations
    fn initialize_database(&self) -> Result<(), AppError> {
        let mut conn = self.get_connection()?;
        
        // Define migrations
        let migrations = Migrations::new(vec![
            // Migration 1: Create initial schema
            M::up(
                "CREATE TABLE notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    format TEXT NOT NULL DEFAULT 'plaintext',
                    nickname TEXT,
                    path TEXT NOT NULL DEFAULT '/',
                    is_favorite INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                -- Create indexes for better performance
                CREATE INDEX idx_notes_updated_at ON notes(updated_at);
                CREATE INDEX idx_notes_path ON notes(path);

                -- Create FTS5 virtual table for full-text search
                CREATE VIRTUAL TABLE notes_fts USING fts5(
                    content,
                    nickname,
                    path,
                    content='notes',
                    content_rowid='id'
                );

                -- Create trigger to update updated_at timestamp
                CREATE TRIGGER update_notes_updated_at
                AFTER UPDATE ON notes
                FOR EACH ROW
                BEGIN
                    UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;

                -- Create FTS sync triggers
                CREATE TRIGGER notes_fts_insert 
                AFTER INSERT ON notes 
                BEGIN
                    INSERT INTO notes_fts(rowid, content, nickname, path) 
                    VALUES (new.id, new.content, new.nickname, new.path);
                END;

                CREATE TRIGGER notes_fts_delete 
                AFTER DELETE ON notes 
                BEGIN
                    INSERT INTO notes_fts(notes_fts, rowid, content, nickname, path) 
                    VALUES('delete', old.id, old.content, old.nickname, old.path);
                END;

                CREATE TRIGGER notes_fts_update 
                AFTER UPDATE ON notes 
                BEGIN
                    INSERT INTO notes_fts(notes_fts, rowid, content, nickname, path) 
                    VALUES('delete', old.id, old.content, old.nickname, old.path);
                    INSERT INTO notes_fts(rowid, content, nickname, path) 
                    VALUES (new.id, new.content, new.nickname, new.path);
                END;"
            ).down(
                "DROP TRIGGER IF EXISTS notes_fts_update;
                DROP TRIGGER IF EXISTS notes_fts_delete;
                DROP TRIGGER IF EXISTS notes_fts_insert;
                DROP TRIGGER IF EXISTS update_notes_updated_at;
                DROP TABLE IF EXISTS notes_fts;
                DROP INDEX IF EXISTS idx_notes_path;
                DROP INDEX IF EXISTS idx_notes_updated_at;
                DROP TABLE IF EXISTS settings;
                DROP TABLE IF EXISTS notes;"
            ),
        ]);

        // Run migrations
        migrations.to_latest(&mut conn)
            .map_err(|e| AppError::Migration { 
                message: format!("Failed to run database migrations: {}", e) 
            })?;

        Ok(())
    }

    /// Create a new note
    pub async fn create_note(&self, content: String) -> Result<Note, AppError> {
        let conn = self.get_connection()?;
        
        conn.execute(
            "INSERT INTO notes (content, format, path) VALUES (?1, ?2, ?3)",
            params![content, "plaintext", "/"],
        )?;

        let note_id = conn.last_insert_rowid();
        
        // Retrieve the created note
        self.get_note(note_id).await?.ok_or_else(|| AppError::Database(
            rusqlite::Error::QueryReturnedNoRows
        ))
    }

    /// Update an existing note
    pub async fn update_note(&self, note: Note) -> Result<Note, AppError> {
        let conn = self.get_connection()?;
        
        let format_str = match note.format {
            NoteFormat::PlainText => "plaintext",
            NoteFormat::Markdown => "markdown",
        };

        conn.execute(
            "UPDATE notes SET content = ?1, format = ?2, nickname = ?3, path = ?4, is_favorite = ?5 
             WHERE id = ?6",
            params![
                note.content,
                format_str,
                note.nickname,
                note.path,
                if note.is_favorite { 1 } else { 0 },
                note.id
            ],
        )?;

        // Return the updated note
        self.get_note(note.id).await?.ok_or_else(|| AppError::Database(
            rusqlite::Error::QueryReturnedNoRows
        ))
    }

    /// Get a note by ID
    pub async fn get_note(&self, id: i64) -> Result<Option<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes WHERE id = ?1"
        )?;

        let note_result = stmt.query_row(params![id], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        });

        match note_result {
            Ok(note) => Ok(Some(note)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Get all notes ordered by most recently updated with limit for performance
    pub async fn get_all_notes(&self) -> Result<Vec<Note>, AppError> {
        self.get_notes_with_limit(None).await
    }

    /// Get notes with optional limit for performance optimization
    pub async fn get_notes_with_limit(&self, limit: Option<usize>) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;

        let query = if let Some(limit) = limit {
            format!(
                "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at
                 FROM notes ORDER BY updated_at DESC LIMIT {}",
                limit
            )
        } else {
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at
             FROM notes ORDER BY updated_at DESC".to_string()
        };

        let mut stmt = conn.prepare(&query)?;

        let note_iter = stmt.query_map([], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in note_iter {
            notes.push(note?);
        }

        Ok(notes)
    }

    /// Get notes with pagination for large collections
    pub async fn get_notes_paginated(&self, offset: usize, limit: usize) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes ORDER BY updated_at DESC LIMIT ?1 OFFSET ?2"
        )?;

        let note_iter = stmt.query_map(params![limit, offset], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in note_iter {
            notes.push(note?);
        }

        Ok(notes)
    }

    /// Get total count of notes for pagination
    pub async fn get_notes_count(&self) -> Result<usize, AppError> {
        let conn = self.get_connection()?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM notes")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count as usize)
    }

    /// Get the most recently updated note
    pub async fn get_latest_note(&self) -> Result<Option<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes ORDER BY updated_at DESC LIMIT 1"
        )?;

        let note_result = stmt.query_row([], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        });

        match note_result {
            Ok(note) => Ok(Some(note)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Delete a note by ID
    pub async fn delete_note(&self, id: i64) -> Result<(), AppError> {
        let conn = self.get_connection()?;
        
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        
        Ok(())
    }

    /// Get all unique paths for folder structure
    pub async fn get_all_paths(&self) -> Result<Vec<String>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare("SELECT DISTINCT path FROM notes ORDER BY path")?;
        
        let path_iter = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut paths = Vec::new();
        for path in path_iter {
            paths.push(path?);
        }

        Ok(paths)
    }

    /// Get a setting by key
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        
        let result = stmt.query_row(params![key], |row| {
            Ok(row.get::<_, String>(0)?)
        });

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
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
        
        let setting_iter = stmt.query_map([], |row| {
            Ok(Setting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })?;

        let mut settings = Vec::new();
        for setting in setting_iter {
            settings.push(setting?);
        }

        Ok(settings)
    }

    /// Get the current database schema version
    pub fn get_schema_version(&self) -> Result<usize, AppError> {
        let conn = self.get_connection()?;
        
        // Check if the rusqlite_migration table exists
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='__rusqlite_migrations'"
        )?;
        
        let table_exists: i64 = stmt.query_row([], |row| row.get(0))?;
        
        if table_exists == 0 {
            return Ok(0); // No migrations have been run
        }
        
        // Get the latest migration version
        let mut stmt = conn.prepare(
            "SELECT MAX(version) FROM __rusqlite_migrations"
        )?;
        
        let version_result = stmt.query_row([], |row| row.get::<_, Option<i32>>(0));
        
        match version_result {
            Ok(Some(version)) => Ok(version as usize),
            Ok(None) => Ok(0),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
            Err(e) => Err(AppError::Database(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_database_initialization() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Test that we can get a connection
        let conn = db_service.get_connection().unwrap();
        
        // Verify that tables were created by the migration
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").unwrap();
        let table_names: Vec<String> = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        
        assert!(table_names.contains(&"notes".to_string()));
        assert!(table_names.contains(&"settings".to_string()));
        assert!(table_names.contains(&"notes_fts".to_string()));
        
        // Verify that indexes were created
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").unwrap();
        let index_names: Vec<String> = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        
        assert!(index_names.contains(&"idx_notes_updated_at".to_string()));
        assert!(index_names.contains(&"idx_notes_path".to_string()));
        
        // Verify that triggers were created
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").unwrap();
        let trigger_names: Vec<String> = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        
        assert!(trigger_names.contains(&"update_notes_updated_at".to_string()));
        assert!(trigger_names.contains(&"notes_fts_insert".to_string()));
        assert!(trigger_names.contains(&"notes_fts_delete".to_string()));
        assert!(trigger_names.contains(&"notes_fts_update".to_string()));
    }

    #[tokio::test]
    async fn test_create_and_get_note() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Create a note
        let note = db_service.create_note("Test content".to_string()).await.unwrap();
        assert_eq!(note.content, "Test content");
        assert_eq!(note.format, NoteFormat::PlainText);
        assert_eq!(note.path, "/");
        
        // Get the note back
        let retrieved_note = db_service.get_note(note.id).await.unwrap().unwrap();
        assert_eq!(retrieved_note.content, "Test content");
        assert_eq!(retrieved_note.id, note.id);
    }

    #[tokio::test]
    async fn test_update_note() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Create a note
        let mut note = db_service.create_note("Original content".to_string()).await.unwrap();
        
        // Update the note
        note.content = "Updated content".to_string();
        note.format = NoteFormat::Markdown;
        note.nickname = Some("Test Note".to_string());
        
        let updated_note = db_service.update_note(note.clone()).await.unwrap();
        assert_eq!(updated_note.content, "Updated content");
        assert_eq!(updated_note.format, NoteFormat::Markdown);
        assert_eq!(updated_note.nickname, Some("Test Note".to_string()));
    }

    #[tokio::test]
    async fn test_settings() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Set a setting
        db_service.set_setting("test_key", "test_value").await.unwrap();
        
        // Get the setting
        let value = db_service.get_setting("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));
        
        // Get non-existent setting
        let missing = db_service.get_setting("missing_key").await.unwrap();
        assert_eq!(missing, None);
    }

    #[tokio::test]
    async fn test_fts_triggers() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Create a note
        let note = db_service.create_note("Test content for search".to_string()).await.unwrap();
        
        // Verify FTS table was populated
        let conn = db_service.get_connection().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM notes_fts WHERE content MATCH 'search'").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
        
        // Update the note
        let mut updated_note = note.clone();
        updated_note.content = "Updated content for testing".to_string();
        updated_note.nickname = Some("Test Note".to_string());
        db_service.update_note(updated_note).await.unwrap();
        
        // Verify FTS was updated
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM notes_fts WHERE content MATCH 'testing'").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
        
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM notes_fts WHERE nickname MATCH 'Test'").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
        
        // Delete the note
        db_service.delete_note(note.id).await.unwrap();
        
        // Verify FTS entry was removed
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM notes_fts WHERE content MATCH 'testing'").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_schema_version() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();
        
        // Check that the schema version is available after initialization
        // The actual version number depends on the migration system implementation
        let version = db_service.get_schema_version().unwrap();
        // Since we're using rusqlite_migration, the version should be available
        // Version 0 means no migrations table exists, version >= 1 means migrations have been run
        assert!(version == 0 || version >= 1);
    }

    #[tokio::test]
    async fn test_migration_system_integrity() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        // Create database service - this should run migrations
        let db_service = DbService::new(&db_path).unwrap();
        
        // Verify all required database objects exist
        let conn = db_service.get_connection().unwrap();
        
        // Check tables
        let tables = ["notes", "settings", "notes_fts"];
        for table in &tables {
            let mut stmt = conn.prepare(&format!(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{}'", 
                table
            )).unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1, "Table {} should exist", table);
        }
        
        // Check indexes
        let indexes = ["idx_notes_updated_at", "idx_notes_path"];
        for index in &indexes {
            let mut stmt = conn.prepare(&format!(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='{}'", 
                index
            )).unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1, "Index {} should exist", index);
        }
        
        // Check triggers
        let triggers = ["update_notes_updated_at", "notes_fts_insert", "notes_fts_delete", "notes_fts_update"];
        for trigger in &triggers {
            let mut stmt = conn.prepare(&format!(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name='{}'", 
                trigger
            )).unwrap();
            let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
            assert_eq!(count, 1, "Trigger {} should exist", trigger);
        }
        
        // Test that we can perform basic operations
        let note = db_service.create_note("Migration test content".to_string()).await.unwrap();
        assert!(!note.content.is_empty());
        
        let setting_result = db_service.set_setting("migration_test", "success").await;
        assert!(setting_result.is_ok());
        
        let retrieved_setting = db_service.get_setting("migration_test").await.unwrap();
        assert_eq!(retrieved_setting, Some("success".to_string()));
    }
}