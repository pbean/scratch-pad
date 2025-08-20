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
    
    /// Add notes to mock state for search simulation
    pub fn add_notes(&self, notes: Vec<Note>) {
        for note in notes {
            self.state.set_data(note.id.to_string(), note);
        }
    }
    
    /// Check for configured error response
    fn check_error_response(&self, method: &str) -> Result<(), AppError> {
        let errors = self.error_responses.lock().unwrap();
        if let Some(error) = errors.get(method) {
            return Err(error.mock_clone());
        }
        Ok(())
    }
    
    /// Simple mock search that filters notes by content
    fn mock_search(&self, query: &str) -> Vec<Note> {
        let all_data = self.state.get_all_data();
        
        // Simulate search by filtering notes
        all_data
            .values()
            .filter(|note| note.content.to_lowercase().contains(&query.to_lowercase()))
            .cloned()
            .collect()
    }
}

impl Default for MockSearchRepository {
    fn default() -> Self {
        Self::new()
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
        
        let all_results = self.mock_search(fts5_query);
        let total_count = all_results.len();
        
        let start = page * page_size;
        let end = std::cmp::min(start + page_size, all_results.len());
        
        let page_results = if start >= all_results.len() {
            vec![]
        } else {
            all_results[start..end].to_vec()
        };
        
        Ok((page_results, total_count))
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
            .filter(|note| note.is_pinned)
            .cloned()
            .collect();
        
        Ok(results)
    }
    
    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError> {
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
        date_from: Option<&str>,
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
            results.retain(|note| note.is_pinned);
        }
        
        // Apply format filter
        if let Some(format) = format_filter {
            results.retain(|note| note.format == format);
        }
        
        // Note: Date filtering would require parsing date strings in a real implementation
        // For mock purposes, we'll ignore date filters
        
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NoteFormat;

    fn create_test_note(id: i64, content: &str, is_pinned: bool) -> Note {
        Note {
            id,
            content: content.to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_pinned,
            format: NoteFormat::PlainText,
            nickname: None,
            path: format!("/note/{}", id),
        }
    }

    #[tokio::test]
    async fn test_execute_fts5_search() {
        let repo = MockSearchRepository::new();
        
        // Add some test notes
        let note1 = create_test_note(1, "Rust programming language", false);
        let note2 = create_test_note(2, "JavaScript development", false);
        
        repo.add_notes(vec![note1, note2]);
        
        let (results, total) = repo.execute_fts5_search("rust", 0, 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(total, 1);
        assert_eq!(results[0].id, 1);
    }

    #[tokio::test]
    async fn test_search_by_path() {
        let repo = MockSearchRepository::new();
        
        // Add notes with different paths
        let note1 = create_test_note(1, "First note", false);
        let mut note2 = create_test_note(2, "Second note", false);
        note2.path = "/documents/work/note2".to_string();
        let mut note3 = create_test_note(3, "Third note", false);
        note3.path = "/documents/personal/note3".to_string();
        
        repo.add_notes(vec![note1, note2, note3]);
        
        let results = repo.search_by_path("/documents/work").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 2);
    }

    #[tokio::test]
    async fn test_search_favorites() {
        let repo = MockSearchRepository::new();
        
        let note1 = create_test_note(1, "Regular note", false);
        let note2 = create_test_note(2, "Favorite note", true);
        let note3 = create_test_note(3, "Another favorite", true);
        
        repo.add_notes(vec![note1, note2, note3]);
        
        let results = repo.search_favorites().await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|note| note.is_pinned));
    }

    #[tokio::test]
    async fn test_search_recent() {
        let repo = MockSearchRepository::new();
        
        let note1 = create_test_note(1, "Recent note", false);
        repo.add_notes(vec![note1]);
        
        let results = repo.search_recent(7).await.unwrap();
        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_get_search_suggestions() {
        let repo = MockSearchRepository::new();
        
        let note1 = create_test_note(1, "Rust programming language tutorial", false);
        repo.add_notes(vec![note1]);
        
        let suggestions = repo.get_search_suggestions("prog").await.unwrap();
        assert!(!suggestions.is_empty());
        assert!(suggestions.iter().any(|s| s.contains("programming")));
    }

    #[tokio::test]
    async fn test_advanced_search() {
        let repo = MockSearchRepository::new();
        
        let note1 = create_test_note(1, "Rust programming", true);
        let mut note2 = create_test_note(2, "JavaScript development", false);
        note2.format = NoteFormat::Markdown;
        
        repo.add_notes(vec![note1, note2]);
        
        // Test query filter
        let results = repo.advanced_search(
            Some("rust"),
            None,
            false,
            None,
            None,
            None,
        ).await.unwrap();
        assert_eq!(results.len(), 1);
        
        // Test favorites filter
        let favorites = repo.advanced_search(
            None,
            None,
            true,
            None,
            None,
            None,
        ).await.unwrap();
        assert_eq!(favorites.len(), 1);
        assert!(favorites[0].is_pinned);
    }

    #[tokio::test]
    async fn test_error_response() {
        let repo = MockSearchRepository::new();
        let error = AppError::Search {
            message: "Search index corrupted".to_string(),
        };
        
        repo.set_error_response("execute_fts5_search", error);
        
        let result = repo.execute_fts5_search("test", 0, 10).await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_call_tracking() {
        let repo = MockSearchRepository::new();
        
        let _ = repo.execute_fts5_search("test", 0, 10).await;
        let _ = repo.search_favorites().await;
        
        let calls = repo.get_calls();
        assert!(calls.contains(&"execute_fts5_search".to_string()));
        assert!(calls.contains(&"search_favorites".to_string()));
    }
}