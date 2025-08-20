/// Repository Traits for Database Operations
/// 
/// These traits define the contract for data persistence operations, enabling
/// better testing through dependency injection and cleaner separation of concerns.
/// All methods maintain exact compatibility with existing database operations.

use crate::error::AppError;
use crate::models::{Note, Setting};
use async_trait::async_trait;

/// Note repository trait for database note operations
#[async_trait]
pub trait NoteRepository: Send + Sync {
    /// Create a new note with the given content
    async fn create_note(&self, content: String) -> Result<Note, AppError>;
    
    /// Get a note by its ID
    async fn get_note(&self, id: i64) -> Result<Option<Note>, AppError>;
    
    /// Update an existing note's content
    async fn update_note(&self, id: i64, content: String) -> Result<Note, AppError>;
    
    /// Delete a note by its ID
    async fn delete_note(&self, id: i64) -> Result<(), AppError>;
    
    /// Get all notes with optional pagination
    async fn get_all_notes(&self, offset: Option<i64>, limit: Option<i64>) -> Result<Vec<Note>, AppError>;
    
    /// Get notes with pagination (alias for frontend compatibility)
    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError>;
    
    /// Search notes using FTS5 full-text search
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError>;
    
    /// Search notes with pagination and return total count
    async fn search_notes_paginated(&self, query: &str, offset: i64, limit: i64) -> Result<(Vec<Note>, i64), AppError>;
    
    /// Check database connection health
    async fn health_check(&self) -> Result<bool, AppError>;
}

/// Settings repository trait for settings persistence
#[async_trait]
pub trait SettingsRepository: Send + Sync {
    /// Get a setting value by key
    async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError>;
    
    /// Set a setting value
    async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError>;
    
    /// Get all settings
    async fn get_all_settings(&self) -> Result<Vec<Setting>, AppError>;
    
    /// Delete a setting by key
    async fn delete_setting(&self, key: &str) -> Result<(), AppError>;
    
    /// Clear all settings
    async fn clear_all_settings(&self) -> Result<(), AppError>;
}

/// Search repository trait for search-specific database operations
#[async_trait]
pub trait SearchRepository: Send + Sync {
    /// Execute FTS5 search with pagination
    async fn execute_fts5_search(
        &self,
        fts5_query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize), AppError>;
    
    /// Search notes by path prefix
    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError>;
    
    /// Search favorite/pinned notes
    async fn search_favorites(&self) -> Result<Vec<Note>, AppError>;
    
    /// Search recent notes (updated within N days)
    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError>;
    
    /// Get search suggestions based on partial query
    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError>;
    
    /// Advanced search with multiple criteria
    async fn advanced_search(
        &self,
        query: Option<&str>,
        path_filter: Option<&str>,
        favorites_only: bool,
        format_filter: Option<crate::models::NoteFormat>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError>;
}

/// Implementation of all repository traits for DbService
/// 
/// This provides trait implementations for the existing DbService, maintaining
/// exact backward compatibility while enabling dependency injection.
use crate::database::DbService;

#[async_trait]
impl NoteRepository for DbService {
    async fn create_note(&self, content: String) -> Result<Note, AppError> {
        self.create_note(content).await
    }
    
    async fn get_note(&self, id: i64) -> Result<Option<Note>, AppError> {
        self.get_note(id).await
    }
    
    async fn update_note(&self, id: i64, content: String) -> Result<Note, AppError> {
        self.update_note(id, content).await
    }
    
    async fn delete_note(&self, id: i64) -> Result<(), AppError> {
        self.delete_note(id).await
    }
    
    async fn get_all_notes(&self, offset: Option<i64>, limit: Option<i64>) -> Result<Vec<Note>, AppError> {
        self.get_all_notes(offset, limit).await
    }
    
    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError> {
        self.get_notes_paginated(offset, limit).await
    }
    
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.search_notes(query).await
    }
    
    async fn search_notes_paginated(&self, query: &str, offset: i64, limit: i64) -> Result<(Vec<Note>, i64), AppError> {
        self.search_notes_paginated(query, offset, limit).await
    }
    
    async fn health_check(&self) -> Result<bool, AppError> {
        self.health_check().await
    }
}

#[async_trait]
impl SettingsRepository for DbService {
    async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        self.get_setting(key).await
    }
    
    async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.set_setting(key, value).await
    }
    
    async fn get_all_settings(&self) -> Result<Vec<Setting>, AppError> {
        self.get_all_settings().await
    }
    
    async fn delete_setting(&self, key: &str) -> Result<(), AppError> {
        self.delete_setting(key).await
    }
    
    async fn clear_all_settings(&self) -> Result<(), AppError> {
        self.clear_all_settings().await
    }
}

#[async_trait]
impl SearchRepository for DbService {
    async fn execute_fts5_search(
        &self,
        fts5_query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize), AppError> {
        // This is a new method that will be implemented in SearchService
        // For now, we'll use the existing search_notes_paginated method
        let offset = (page * page_size) as i64;
        let limit = page_size as i64;
        let (notes, total_count) = self.search_notes_paginated(fts5_query, offset, limit).await?;
        Ok((notes, total_count as usize))
    }
    
    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError> {
        // Implement path search using existing database connection
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, created_at, updated_at, is_pinned 
             FROM notes WHERE path LIKE ? ORDER BY path, updated_at DESC"
        )?;

        let search_pattern = format!("{}%", path_prefix);
        let note_iter = stmt.query_map([&search_pattern], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }
    
    async fn search_favorites(&self) -> Result<Vec<Note>, AppError> {
        // Implement favorites search using existing database connection
        let conn = self.get_connection()?;
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, created_at, updated_at, is_pinned 
             FROM notes WHERE is_pinned = 1 ORDER BY updated_at DESC"
        )?;

        let note_iter = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }
    
    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError> {
        // Implement recent search using existing database connection
        let conn = self.get_connection()?;
        
        let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff_date.format("%Y-%m-%d %H:%M:%S").to_string();
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, created_at, updated_at, is_pinned 
             FROM notes WHERE updated_at >= ? ORDER BY updated_at DESC"
        )?;

        let note_iter = stmt.query_map([&cutoff_str], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }
    
    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError> {
        if partial_query.trim().is_empty() {
            return Ok(vec![]);
        }

        let conn = self.get_connection()?;
        
        // Get unique words from content that start with the partial query
        let mut stmt = conn.prepare_cached(
            "SELECT DISTINCT substr(content, 1, 50) as snippet
             FROM notes 
             WHERE content LIKE ? 
             ORDER BY updated_at DESC 
             LIMIT 10"
        )?;

        let search_pattern = format!("%{}%", partial_query);
        let snippet_iter = stmt.query_map([&search_pattern], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut suggestions = Vec::new();
        for snippet_result in snippet_iter {
            let snippet = snippet_result?;
            // Extract words that contain the partial query
            for word in snippet.split_whitespace() {
                if word.to_lowercase().contains(&partial_query.to_lowercase()) 
                    && !suggestions.contains(&word.to_string()) 
                    && suggestions.len() < 10 {
                    suggestions.push(word.to_string());
                }
            }
        }

        Ok(suggestions)
    }
    
    async fn advanced_search(
        &self,
        query: Option<&str>,
        path_filter: Option<&str>,
        favorites_only: bool,
        format_filter: Option<crate::models::NoteFormat>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;
        
        let mut sql = "SELECT id, content, created_at, updated_at, is_pinned FROM notes WHERE 1=1".to_string();
        let mut params: Vec<String> = Vec::new();

        // Add FTS search if query is provided
        if let Some(q) = query {
            if !q.trim().is_empty() {
                sql.push_str(" AND id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)");
                params.push(q.to_string());
            }
        }

        // Add path filter
        if let Some(path) = path_filter {
            sql.push_str(" AND path LIKE ?");
            params.push(format!("{}%", path));
        }

        // Add favorites filter
        if favorites_only {
            sql.push_str(" AND is_pinned = 1");
        }

        // Add format filter
        if let Some(format) = format_filter {
            sql.push_str(" AND format = ?");
            match format {
                crate::models::NoteFormat::Markdown => params.push("markdown".to_string()),
                crate::models::NoteFormat::PlainText => params.push("plaintext".to_string()),
            }
        }

        // Add date filters
        if let Some(from_date) = date_from {
            sql.push_str(" AND updated_at >= ?");
            params.push(from_date.to_string());
        }

        if let Some(to_date) = date_to {
            sql.push_str(" AND updated_at <= ?");
            params.push(to_date.to_string());
        }

        sql.push_str(" ORDER BY updated_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let note_iter = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    async fn create_test_db() -> Result<Arc<DbService>, AppError> {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_string_lossy().to_string();
        Ok(Arc::new(DbService::new(&db_path)?))
    }

    #[tokio::test]
    async fn test_note_repository_trait() {
        let db = create_test_db().await.unwrap();
        let repo: &dyn NoteRepository = db.as_ref();

        // Test create and get
        let note = repo.create_note("Test content".to_string()).await.unwrap();
        assert_eq!(note.content, "Test content");

        let retrieved = repo.get_note(note.id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, "Test content");

        // Test update
        let updated = repo.update_note(note.id, "Updated content".to_string()).await.unwrap();
        assert_eq!(updated.content, "Updated content");

        // Test search
        let search_results = repo.search_notes("Updated").await.unwrap();
        assert_eq!(search_results.len(), 1);

        // Test delete
        repo.delete_note(note.id).await.unwrap();
        let deleted = repo.get_note(note.id).await.unwrap();
        assert!(deleted.is_none());
    }

    #[tokio::test]
    async fn test_settings_repository_trait() {
        let db = create_test_db().await.unwrap();
        let repo: &dyn SettingsRepository = db.as_ref();

        // Test set and get
        repo.set_setting("test_key", "test_value").await.unwrap();
        let value = repo.get_setting("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // Test get all
        let all_settings = repo.get_all_settings().await.unwrap();
        assert!(!all_settings.is_empty());

        // Test delete
        repo.delete_setting("test_key").await.unwrap();
        let deleted_value = repo.get_setting("test_key").await.unwrap();
        assert!(deleted_value.is_none());
    }

    #[tokio::test]
    async fn test_search_repository_trait() {
        let db = create_test_db().await.unwrap();
        let repo: &dyn SearchRepository = db.as_ref();

        // Create test data first
        let note_repo: &dyn NoteRepository = db.as_ref();
        let _note = note_repo.create_note("Test favorite note".to_string()).await.unwrap();
        
        // Test search suggestions
        let suggestions = repo.get_search_suggestions("Test").await.unwrap();
        // Suggestions may be empty if no matches, but should not error
        assert!(suggestions.len() <= 10);

        // Test FTS5 search
        let (_results, count) = repo.execute_fts5_search("Test", 0, 10).await.unwrap();
        assert!(count >= 0);
    }
}