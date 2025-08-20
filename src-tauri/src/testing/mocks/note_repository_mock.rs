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
    
    /// Add a note to the mock storage (for test setup)
    pub fn add_note(&self, note: Note) {
        self.state.insert(note.id.to_string(), note);
    }
    
    /// Count of notes in storage
    pub fn count_notes(&self) -> usize {
        self.state.len()
    }
    
    /// Check if a method would return an error
    fn check_error_response(&self, method: &str) -> Result<(), AppError> {
        let errors = self.error_responses.lock().unwrap();
        if let Some(error) = errors.get(method) {
            return Err(error.mock_clone());
        }
        Ok(())
    }
    
    /// Check if a note exists by ID
    pub fn has_note(&self, id: i64) -> bool {
        self.state.get(&id.to_string()).is_some()
    }
    
    /// Clear all data and calls
    pub fn clear_all(&self) {
        self.state.clear();
    }
    
    /// Get next ID for created notes
    fn get_next_id(&self) -> i64 {
        let mut id = self.next_id.lock().unwrap();
        let current = *id;
        *id += 1;
        current
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
            is_favorite: false,  // Fixed: Use is_favorite instead of is_pinned
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
    
    async fn get_all_notes(&self) -> Result<Vec<Note>, AppError> {
        self.state.record_call("get_all_notes".to_string());
        self.check_error_response("get_all_notes")?;
        
        let mut notes: Vec<Note> = self.state.get_all_data().into_values().collect();
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(notes)
    }
    
    async fn get_notes_paginated(&self, offset: i64, limit: i64) -> Result<Vec<Note>, AppError> {
        self.state.record_call("get_notes_paginated".to_string());
        self.check_error_response("get_notes_paginated")?;
        
        let mut notes: Vec<Note> = self.state.get_all_data().into_values().collect();
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        
        let start = offset.max(0) as usize;
        let end = (offset + limit).max(0) as usize;
        
        if start >= notes.len() {
            Ok(Vec::new())
        } else {
            Ok(notes[start..end.min(notes.len())].to_vec())
        }
    }
    
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.state.record_call("search_notes".to_string());
        self.check_error_response("search_notes")?;
        
        let notes: Vec<Note> = self.state.get_all_data()
            .into_values()
            .filter(|note| note.content.to_lowercase().contains(&query.to_lowercase()))
            .collect();
        
        Ok(notes)
    }
    
    async fn search_notes_paginated(&self, query: &str, offset: i64, limit: i64) -> Result<(Vec<Note>, i64), AppError> {
        self.state.record_call("search_notes_paginated".to_string());
        self.check_error_response("search_notes_paginated")?;
        
        let mut matching_notes: Vec<Note> = self.state.get_all_data()
            .into_values()
            .filter(|note| note.content.to_lowercase().contains(&query.to_lowercase()))
            .collect();
        
        matching_notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        
        let total_count = matching_notes.len() as i64;
        let start = offset.max(0) as usize;
        let end = (offset + limit).max(0) as usize;
        
        let paginated_notes = if start >= matching_notes.len() {
            Vec::new()
        } else {
            matching_notes[start..end.min(matching_notes.len())].to_vec()
        };
        
        Ok((paginated_notes, total_count))
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
    async fn test_mock_note_repository() {
        let repo = MockNoteRepository::new();
        
        // Test create note
        let note = repo.create_note("Test content".to_string()).await.unwrap();
        assert_eq!(note.content, "Test content");
        assert!(!note.is_favorite);  // Fixed: Use is_favorite instead of is_pinned
        
        // Test get note
        let retrieved = repo.get_note(note.id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, "Test content");
        
        // Test update note
        let updated = repo.update_note(note.id, "Updated content".to_string()).await.unwrap();
        assert_eq!(updated.content, "Updated content");
        
        // Test search
        let search_results = repo.search_notes("Updated").await.unwrap();
        assert_eq!(search_results.len(), 1);
        
        // Test delete
        repo.delete_note(note.id).await.unwrap();
        let deleted = repo.get_note(note.id).await.unwrap();
        assert!(deleted.is_none());
        
        // Verify calls were recorded
        let calls = repo.get_calls();
        assert!(calls.contains(&"create_note".to_string()));
        assert!(calls.contains(&"get_note".to_string()));
        assert!(calls.contains(&"update_note".to_string()));
        assert!(calls.contains(&"search_notes".to_string()));
        assert!(calls.contains(&"delete_note".to_string()));
    }

    #[tokio::test]
    async fn test_error_responses() {
        let repo = MockNoteRepository::new();
        
        // Configure error response
        repo.set_error_response("create_note", AppError::General("Mock error".to_string()));
        
        // Test that error is returned
        let result = repo.create_note("Test".to_string()).await;
        assert!(result.is_err());
        
        // Clear error and test normal operation
        repo.clear_error_responses();
        let result = repo.create_note("Test".to_string()).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_pagination() {
        let repo = MockNoteRepository::new();
        
        // Create multiple notes
        for i in 1..=5 {
            repo.create_note(format!("Note {}", i)).await.unwrap();
        }
        
        // Test pagination
        let page1 = repo.get_notes_paginated(0, 2).await.unwrap();
        assert_eq!(page1.len(), 2);
        
        let page2 = repo.get_notes_paginated(2, 2).await.unwrap();
        assert_eq!(page2.len(), 2);
        
        let page3 = repo.get_notes_paginated(4, 2).await.unwrap();
        assert_eq!(page3.len(), 1);
    }
}