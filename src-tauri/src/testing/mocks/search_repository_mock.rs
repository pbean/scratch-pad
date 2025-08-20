/// Mock Search Repository Implementation
/// 
/// Provides a mock implementation of the SearchRepository trait for isolated testing.
/// Includes call tracking, state management, and configurable responses for 
/// comprehensive testing scenarios.

use crate::error::AppError;
use crate::models::{Note, NoteFormat};
use crate::traits::repository::SearchRepository;
use crate::testing::mocks::MockRepositoryState;
use async_trait::async_trait;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// Mock implementation of SearchRepository for testing
#[derive(Debug, Clone)]
pub struct MockSearchRepository {
    state: MockRepositoryState<Note>,
    error_responses: Arc<Mutex<HashMap<String, AppError>>>,
    search_suggestions: Arc<Mutex<Vec<String>>>,
}

impl MockSearchRepository {
    /// Create new mock search repository
    pub fn new() -> Self {
        Self {
            state: MockRepositoryState::new(),
            error_responses: Arc::new(Mutex::new(HashMap::new())),
            search_suggestions: Arc::new(Mutex::new(Vec::new())),
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
    
    /// Set mock search suggestions to return
    pub fn set_search_suggestions(&self, suggestions: Vec<String>) {
        let mut search_suggestions = self.search_suggestions.lock().unwrap();
        *search_suggestions = suggestions;
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
    
    /// Clear all data and calls
    pub fn clear_all(&self) {
        self.state.clear();
    }
    
    /// Check if a method would return an error
    fn check_error_response(&self, method: &str) -> Result<(), AppError> {
        let errors = self.error_responses.lock().unwrap();
        if let Some(error) = errors.get(method) {
            return Err(error.mock_clone());
        }
        Ok(())
    }
}

#[async_trait]
impl SearchRepository for MockSearchRepository {
    async fn execute_fts5_search(
        &self,
        fts5_query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize), AppError> {
        self.state.record_call("execute_fts5_search".to_string());
        self.check_error_response("execute_fts5_search")?;
        
        let all_data = self.state.get_all_data();
        let mut matching_notes: Vec<Note> = all_data.values()
            .filter(|note| note.content.to_lowercase().contains(&fts5_query.to_lowercase()))
            .cloned()
            .collect();
        
        matching_notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        
        let total_count = matching_notes.len();
        let start = page * page_size;
        let end = (start + page_size).min(matching_notes.len());
        
        let paginated_notes = if start >= matching_notes.len() {
            Vec::new()
        } else {
            matching_notes[start..end].to_vec()
        };
        
        Ok((paginated_notes, total_count))
    }
    
    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError> {
        self.state.record_call("search_by_path".to_string());
        self.check_error_response("search_by_path")?;
        
        let all_data = self.state.get_all_data();
        let results: Vec<Note> = all_data.values()
            .filter(|note| note.path.starts_with(path_prefix))
            .cloned()
            .collect();
        
        Ok(results)
    }
    
    async fn search_favorites(&self) -> Result<Vec<Note>, AppError> {
        self.state.record_call("search_favorites".to_string());
        self.check_error_response("search_favorites")?;
        
        let all_data = self.state.get_all_data();
        let results: Vec<Note> = all_data.values()
            .filter(|note| note.is_favorite)  // Fixed: Use is_favorite instead of is_pinned
            .cloned()
            .collect();
        
        Ok(results)
    }
    
    async fn search_recent(&self, _days: u32) -> Result<Vec<Note>, AppError> {
        self.state.record_call("search_recent".to_string());
        self.check_error_response("search_recent")?;
        
        // For mock purposes, return all notes
        // In a real implementation, this would filter by update time
        let all_data = self.state.get_all_data();
        let results: Vec<Note> = all_data.values().cloned().collect();
        
        Ok(results)
    }
    
    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError> {
        self.state.record_call("get_search_suggestions".to_string());
        self.check_error_response("get_search_suggestions")?;
        
        let suggestions = self.search_suggestions.lock().unwrap();
        
        // If mock suggestions are configured, filter them
        if !suggestions.is_empty() {
            let filtered: Vec<String> = suggestions.iter()
                .filter(|s| s.to_lowercase().contains(&partial_query.to_lowercase()))
                .cloned()
                .collect();
            return Ok(filtered);
        }
        
        // Otherwise, generate mock suggestions from note content
        let all_data = self.state.get_all_data();
        let mut suggestions = Vec::new();
        
        for note in all_data.values() {
            for word in note.content.split_whitespace() {
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
        _date_from: Option<&str>,
        _date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError> {
        self.state.record_call("advanced_search".to_string());
        self.check_error_response("advanced_search")?;
        
        let all_data = self.state.get_all_data();
        let mut results: Vec<Note> = all_data.values().cloned().collect();
        
        // Apply text query filter
        if let Some(q) = query {
            if !q.trim().is_empty() {
                results.retain(|note| note.content.to_lowercase().contains(&q.to_lowercase()));
            }
        }
        
        // Apply path filter
        if let Some(path) = path_filter {
            results.retain(|note| note.path.starts_with(path));
        }
        
        // Apply favorites filter
        if favorites_only {
            results.retain(|note| note.is_favorite);  // Fixed: Use is_favorite instead of is_pinned
        }
        
        // Apply format filter
        if let Some(format) = format_filter {
            results.retain(|note| note.format == format);
        }
        
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_note(id: i64, content: &str, is_favorite: bool) -> Note {
        Note {
            id,
            content: content.to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_favorite,  // Fixed: Use is_favorite instead of is_pinned
            format: NoteFormat::PlainText,
            nickname: None,
            path: format!("/note/{}", id),
        }
    }

    #[tokio::test]
    async fn test_mock_search_repository() {
        let repo = MockSearchRepository::new();
        
        // Add test notes
        repo.add_note(create_test_note(1, "rust programming", false));
        repo.add_note(create_test_note(2, "javascript tutorial", true));
        repo.add_note(create_test_note(3, "python guide", false));
        
        // Test FTS5 search
        let (results, count) = repo.execute_fts5_search("rust", 0, 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(count, 1);
        assert_eq!(results[0].content, "rust programming");
        
        // Test search by path
        let path_results = repo.search_by_path("/note").await.unwrap();
        assert_eq!(path_results.len(), 3);
        
        // Test search favorites
        let favorites = repo.search_favorites().await.unwrap();
        assert_eq!(favorites.len(), 1);
        assert!(favorites[0].is_favorite);  // Fixed: Use is_favorite instead of is_pinned
        
        // Test search suggestions
        let suggestions = repo.get_search_suggestions("rust").await.unwrap();
        assert!(suggestions.contains(&"rust".to_string()));
        
        // Test advanced search with favorites filter
        let advanced_results = repo.advanced_search(
            None,
            None,
            true,
            None,
            None,
            None,
        ).await.unwrap();
        assert_eq!(advanced_results.len(), 1);
        assert!(advanced_results[0].is_favorite);  // Fixed: Use is_favorite instead of is_pinned
    }

    #[tokio::test]
    async fn test_mock_search_suggestions() {
        let repo = MockSearchRepository::new();
        
        // Set custom suggestions
        repo.set_search_suggestions(vec![
            "rust".to_string(),
            "javascript".to_string(),
            "python".to_string(),
        ]);
        
        let suggestions = repo.get_search_suggestions("ru").await.unwrap();
        assert!(suggestions.contains(&"rust".to_string()));
        assert!(!suggestions.contains(&"javascript".to_string()));
    }

    #[tokio::test]
    async fn test_error_responses() {
        let repo = MockSearchRepository::new();
        
        // Configure error response
        repo.set_error_response("search_favorites", AppError::General("Mock error".to_string()));
        
        // Test that error is returned
        let result = repo.search_favorites().await;
        assert!(result.is_err());
        
        // Clear error and test normal operation
        repo.clear_error_responses();
        let result = repo.search_favorites().await;
        assert!(result.is_ok());
    }
}