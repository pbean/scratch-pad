/// Mock Note Repository Implementation
/// 
/// Provides a mock implementation of the NoteRepository trait for isolated testing.
/// Includes call tracking, state management, and configurable responses for 
/// comprehensive testing scenarios.

use crate::error::AppError;
use crate::models::{Note, NoteFormat};
use crate::traits::repository::NoteRepository;
use crate::testing::mocks::MockRepositoryState;
use async_trait::async_trait;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// Mock implementation of NoteRepository for testing
#[derive(Debug, Clone)]
pub struct MockNoteRepository {
    state: MockRepositoryState<Note>,
    error_responses: Arc<Mutex<HashMap<String, AppError>>>,
    next_id: Arc<Mutex<i64>>,
}

impl MockNoteRepository {
    /// Create new mock repository
    pub fn new() -> Self {
        Self {
            state: MockRepositoryState::new(),
            error_responses: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
        }
    }
    
    /// Configure error response for a specific method
    pub fn set_error_response(&self, method: &str, error: AppError) {
        let mut errors = self.error_responses.lock().unwrap();
        errors.insert(method.to_string(), error);
    }
    
    /// Clear all error responses
    pub fn clear_error_responses(&self) {
        let mut errors = self.error_responses.lock().unwrap();
        errors.clear();
    }
    
    /// Get all method calls made to this repository
    pub fn get_calls(&self) -> Vec<String> {
        self.state.get_calls()
    }
    
    /// Clear all recorded calls
    pub fn clear_calls(&self) {
        self.state.clear_calls();
    }
    
    /// Get current state of all notes (helper method)
    pub fn get_all_notes_helper(&self) -> Vec<Note> {
        let data = self.state.get_all_data();
        data.values().cloned().collect()
    }
    
    /// Check if a note exists by ID
    pub fn has_note(&self, id: i64) -> bool {
        self.state.get(&id.to_string()).is_some()
    }
    
    /// Manually add a note to the mock state
    pub fn add_note(&self, note: Note) {
        self.state.set_data(note.id.to_string(), note);
    }
    
    /// Check if error response is configured for method
    fn check_error_response(&self, method: &str) -> Result<(), AppError> {
        let errors = self.error_responses.lock().unwrap();
        if let Some(error) = errors.get(method) {
            return Err(error.mock_clone());
        }
        Ok(())
    }
    
    /// Generate next ID for new notes
    fn get_next_id(&self) -> i64 {
        let mut next_id = self.next_id.lock().unwrap();
        let id = *next_id;
        *next_id += 1;
        id
    }
}

impl Default for MockNoteRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl NoteRepository for MockNoteRepository {
    async fn create_note(&self, content: String) -> Result<Note, AppError> {
        self.state.record_call("create_note".to_string());
        self.check_error_response("create_note")?;
        
        let id = self.get_next_id();
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let note = Note {
            id,
            content,
            created_at: now.clone(),
            updated_at: now,
            is_pinned: false,
            format: NoteFormat::PlainText,
            nickname: None,
            path: format!("/note/{}", id),
        };
        
        self.state.insert(id.to_string(), note.clone());
        Ok(note)
    }
    
    async fn get_note(&self, id: i64) -> Result<Option<Note>, AppError> {
        self.state.record_call("get_note".to_string());
        self.check_error_response("get_note")?;
        
        Ok(self.state.get(&id.to_string()))
    }
    
    async fn update_note(&self, id: i64, content: String) -> Result<Note, AppError> {
        self.state.record_call("update_note".to_string());
        self.check_error_response("update_note")?;
        
        let key = id.to_string();
        if let Some(mut note) = self.state.get(&key) {
            note.content = content;
            note.updated_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
            self.state.insert(key, note.clone());
            Ok(note)
        } else {
            Err(AppError::NotFound { id })
        }
    }
    
    async fn delete_note(&self, id: i64) -> Result<(), AppError> {
        self.state.record_call("delete_note".to_string());
        self.check_error_response("delete_note")?;
        
        if self.state.get(&id.to_string()).is_some() {
            self.state.remove(&id.to_string());
            Ok(())
        } else {
            Err(AppError::NotFound { id })
        }
    }
    
    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError> {
        self.state.record_call("get_notes_paginated".to_string());
        self.check_error_response("get_notes_paginated")?;
        
        let all_notes = self.get_all_notes_helper();
        let start = offset as usize;
        let end = std::cmp::min(start + limit as usize, all_notes.len());
        
        if start >= all_notes.len() {
            Ok(vec![])
        } else {
            Ok(all_notes[start..end].to_vec())
        }
    }
    
    async fn get_all_notes(&self, offset: Option<i64>, limit: Option<i64>) -> Result<Vec<Note>, AppError> {
        self.state.record_call("get_all_notes".to_string());
        self.check_error_response("get_all_notes")?;
        
        let data = self.state.get_all_data();
        let mut all_notes: Vec<Note> = data.values().cloned().collect();
        // Sort by ID for consistent ordering
        all_notes.sort_by_key(|note| note.id);
        
        match (offset, limit) {
            (Some(off), Some(lim)) => {
                let start = off as usize;
                let end = std::cmp::min(start + lim as usize, all_notes.len());
                if start >= all_notes.len() {
                    Ok(vec![])
                } else {
                    Ok(all_notes[start..end].to_vec())
                }
            },
            _ => Ok(all_notes)
        }
    }
    
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.state.record_call("search_notes".to_string());
        self.check_error_response("search_notes")?;
        
        let data = self.state.get_all_data();
        let results: Vec<Note> = data.values()
            .filter(|note| note.content.to_lowercase().contains(&query.to_lowercase()))
            .cloned()
            .collect();
        Ok(results)
    }
    
    async fn search_notes_paginated(&self, query: &str, offset: i64, limit: i64) -> Result<(Vec<Note>, i64), AppError> {
        self.state.record_call("search_notes_paginated".to_string());
        self.check_error_response("search_notes_paginated")?;
        
        let all_results = self.search_notes(query).await?;
        let total_count = all_results.len() as i64;
        
        let start = offset as usize;
        let end = std::cmp::min(start + limit as usize, all_results.len());
        
        let page_results = if start >= all_results.len() {
            vec![]
        } else {
            all_results[start..end].to_vec()
        };
        
        Ok((page_results, total_count))
    }
    
    async fn health_check(&self) -> Result<bool, AppError> {
        self.state.record_call("health_check".to_string());
        self.check_error_response("health_check")?;
        
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_note() {
        let repo = MockNoteRepository::new();
        let content = "Test note content".to_string();
        
        let note = repo.create_note(content.clone()).await.unwrap();
        assert_eq!(note.content, content);
        assert_eq!(note.id, 1);
        assert!(!note.is_pinned);
    }

    #[tokio::test]
    async fn test_get_note() {
        let repo = MockNoteRepository::new();
        let note = repo.create_note("Test content".to_string()).await.unwrap();
        
        let retrieved = repo.get_note(note.id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, note.id);
    }

    #[tokio::test]
    async fn test_update_note() {
        let repo = MockNoteRepository::new();
        let mut note = repo.create_note("Original content".to_string()).await.unwrap();
        
        let updated = repo.update_note(note.id, "Updated content".to_string()).await.unwrap();
        assert_eq!(updated.content, "Updated content");
    }

    #[tokio::test]
    async fn test_delete_note() {
        let repo = MockNoteRepository::new();
        let note = repo.create_note("Test content".to_string()).await.unwrap();
        
        repo.delete_note(note.id).await.unwrap();
        let retrieved = repo.get_note(note.id).await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_error_response() {
        let repo = MockNoteRepository::new();
        let error = AppError::Database(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            Some("Test error".to_string())
        ));
        
        repo.set_error_response("create_note", error);
        
        let result = repo.create_note("Test content".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_call_tracking() {
        let repo = MockNoteRepository::new();
        
        let _ = repo.create_note("Test content".to_string()).await;
        let _ = repo.health_check().await;
        
        let calls = repo.get_calls();
        assert!(calls.contains(&"create_note".to_string()));
        assert!(calls.contains(&"health_check".to_string()));
    }
}