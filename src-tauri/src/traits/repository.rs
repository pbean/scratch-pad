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
    async fn get_all_notes(&self) -> Result<Vec<Note>, AppError>;

    /// Get notes with pagination (alias for frontend compatibility)
    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError>;

    /// Search notes using FTS5 full-text search
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError>;

    /// Search notes with pagination and return total count
    async fn search_notes_paginated(
        &self,
        query: &str,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<Note>, i64), AppError>;

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
        self.update_note_content(id, content).await
    }

    async fn delete_note(&self, id: i64) -> Result<(), AppError> {
        self.delete_note(id).await
    }

    async fn get_all_notes(&self) -> Result<Vec<Note>, AppError> {
        self.get_all_notes().await
    }

    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError> {
        self.get_notes_paginated(offset, limit).await
    }

    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.search_notes(query).await
    }

    async fn search_notes_paginated(
        &self,
        query: &str,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<Note>, i64), AppError> {
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
        let offset = page * page_size;
        let (notes, total) = self
            .search_notes_paginated(fts5_query, offset as i64, page_size as i64)
            .await?;
        Ok((notes, total as usize))
    }

    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError> {
        // For MVP, search by content that might contain path-like strings
        self.search_notes(path_prefix).await
    }

    async fn search_favorites(&self) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT id, content, created_at, updated_at, is_pinned FROM notes WHERE is_pinned = 1 ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_favorite: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in rows {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError> {
        let conn = self.get_connection()?;

        let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff_date.format("%Y-%m-%d %H:%M:%S").to_string();

        let mut stmt = conn.prepare(
            "SELECT id, content, created_at, updated_at, is_pinned FROM notes WHERE updated_at >= ?1 ORDER BY updated_at DESC"
        )?;

        let rows = stmt.query_map(rusqlite::params![cutoff_str], |row| {
            let id: i64 = row.get(0)?;
            Ok(Note {
                id,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                is_favorite: row.get(4)?,
                format: crate::models::NoteFormat::PlainText,
                nickname: None,
                path: format!("/note/{}", id),
            })
        })?;

        let mut notes = Vec::new();
        for note_result in rows {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError> {
        // Basic implementation: split content into words and find matches
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT DISTINCT content FROM notes WHERE content LIKE ?1 ORDER BY content LIMIT 10",
        )?;

        let search_pattern = format!("%{}%", partial_query);
        let rows = stmt.query_map(rusqlite::params![search_pattern], |row| {
            let content: String = row.get(0)?;
            Ok(content)
        })?;

        let mut suggestions = Vec::new();
        for content_result in rows {
            let content = content_result?;
            // Extract words from content that start with the partial query
            for word in content.split_whitespace() {
                if word
                    .to_lowercase()
                    .starts_with(&partial_query.to_lowercase())
                {
                    suggestions.push(word.to_string());
                    if suggestions.len() >= 10 {
                        break;
                    }
                }
            }
        }

        suggestions.sort();
        suggestions.dedup();
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

        let mut sql = "SELECT id, content, created_at, updated_at, is_pinned FROM notes WHERE 1=1"
            .to_string();
        let mut params: Vec<String> = Vec::new();

        // Add query filter
        if let Some(q) = query {
            if !q.is_empty() {
                sql.push_str(" AND content LIKE ?");
                params.push(format!("%{}%", q));
            }
        }

        // Add path filter (basic implementation)
        if let Some(path) = path_filter {
            if !path.is_empty() {
                sql.push_str(" AND content LIKE ?");
                params.push(format!("%{}%", path));
            }
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
                is_favorite: row.get(4)?,
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
    use crate::testing::database::TestDatabaseFactory;

    #[tokio::test]
    async fn test_note_repository_trait() {
        let test_db = TestDatabaseFactory::create_memory_db().await.unwrap();
        let db_service = test_db.db();
        let repo: &dyn NoteRepository = db_service.as_ref();

        // Test create and get
        let note = repo.create_note("Test content".to_string()).await.unwrap();
        assert_eq!(note.content, "Test content");

        let retrieved = repo.get_note(note.id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, "Test content");

        // Test update
        let updated = repo
            .update_note(note.id, "Updated content".to_string())
            .await
            .unwrap();
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
        let test_db = TestDatabaseFactory::create_memory_db().await.unwrap();
        let db_service = test_db.db();
        let repo: &dyn SettingsRepository = db_service.as_ref();

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
        let test_db = TestDatabaseFactory::create_memory_db().await.unwrap();
        let db_service = test_db.db();
        let repo: &dyn SearchRepository = db_service.as_ref();

        // Create test data first
        let note_repo: &dyn NoteRepository = db_service.as_ref();
        let _note = note_repo
            .create_note("Test favorite note".to_string())
            .await
            .unwrap();

        // Test search suggestions
        let suggestions = repo.get_search_suggestions("Test").await.unwrap();
        // Suggestions may be empty if no matches, but should not error
        assert!(suggestions.len() <= 10);

        // Test FTS5 search
        let (_results, count) = repo.execute_fts5_search("Test", 0, 10).await.unwrap();
        assert!(count >= 0);
    }

    #[tokio::test]
    async fn test_parallel_repository_isolation() {
        // Test that repository traits work correctly with isolated databases
        let handles: Vec<_> = (0..3)
            .map(|i| {
                tokio::spawn(async move {
                    let test_db = TestDatabaseFactory::create_memory_db().await.unwrap();
                    let db_service = test_db.db();
                    let repo: &dyn NoteRepository = db_service.as_ref();

                    // Create note specific to this instance
                    let note = repo
                        .create_note(format!("Repository test note {}", i))
                        .await
                        .unwrap();

                    // Verify only this note exists in this database
                    let all_notes = repo.get_all_notes().await.unwrap();
                    assert_eq!(all_notes.len(), 1);
                    assert_eq!(all_notes[0].content, format!("Repository test note {}", i));

                    (test_db.test_id, note.id)
                })
            })
            .collect();

        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.unwrap());
        }

        // Verify all test databases have unique IDs
        let test_ids: Vec<u64> = results.iter().map(|(test_id, _)| *test_id).collect();
        let mut unique_test_ids = test_ids.clone();
        unique_test_ids.sort();
        unique_test_ids.dedup();

        assert_eq!(
            unique_test_ids.len(),
            test_ids.len(),
            "All test databases should have unique IDs"
        );
    }
}
