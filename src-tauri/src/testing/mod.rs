/// Testing Framework for Service Decoupling
/// 
/// This module provides comprehensive mocking and testing utilities for the trait-based
/// service architecture. It includes mock implementations for all repository traits
/// and isolated unit tests for service business logic.
/// 
/// ## Features
/// - Mock repository implementations with call tracking
/// - State management for test scenarios  
/// - Configurable responses for success/error scenarios
/// - Isolated unit tests for service business logic
/// - Support for async testing with tokio::test
/// - Maintains all existing security validation

pub mod mocks;
pub mod unit;

// Re-export testing utilities for convenience
pub use mocks::{
    MockNoteRepository, MockSettingsRepository, MockSearchRepository,
    MockRepositoryState, MockCallTracker
};

/// Test utilities for setting up isolated test environments
pub struct TestEnvironment {
    pub note_repo: MockNoteRepository,
    pub settings_repo: MockSettingsRepository, 
    pub search_repo: MockSearchRepository,
}

impl TestEnvironment {
    /// Create a new test environment with fresh mock repositories
    pub fn new() -> Self {
        Self {
            note_repo: MockNoteRepository::new(),
            settings_repo: MockSettingsRepository::new(),
            search_repo: MockSearchRepository::new(),
        }
    }
    
    /// Create a test environment with pre-populated test data
    pub fn with_test_data() -> Self {
        let env = Self::new();
        
        // Add some default test notes using proper Note struct
        use crate::models::{Note, NoteFormat};
        env.note_repo.add_note(Note {
            id: 1,
            content: "Test note 1".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_pinned: false,
            format: NoteFormat::PlainText,
            nickname: None,
            path: "/note/1".to_string(),
        });
        env.note_repo.add_note(Note {
            id: 2,
            content: "Rust programming guide".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_pinned: true,
            format: NoteFormat::PlainText,
            nickname: None,
            path: "/note/2".to_string(),
        });
        env.note_repo.add_note(Note {
            id: 3,
            content: "JavaScript tutorial".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            is_pinned: false,
            format: NoteFormat::PlainText,
            nickname: None,
            path: "/note/3".to_string(),
        });
        
        // Add some default test settings
        env.settings_repo.add_setting("theme".to_string(), "dark".to_string());
        env.settings_repo.add_setting("auto_save".to_string(), "true".to_string());
        env.settings_repo.add_setting("font_size".to_string(), "14".to_string());
        
        env
    }
    
    /// Reset all mock repositories to clean state
    pub fn reset(&mut self) {
        self.note_repo.clear_calls();
        self.settings_repo.clear_calls();
        self.search_repo.clear_calls();
    }
    
    /// Get call counts for all repositories
    pub fn get_all_call_counts(&self) -> (usize, usize, usize) {
        (
            self.note_repo.get_calls().len(),
            self.settings_repo.get_calls().len(),
            self.search_repo.get_calls().len(),
        )
    }
}

impl Default for TestEnvironment {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_environment_creation() {
        let env = TestEnvironment::new();
        assert_eq!(env.note_repo.get_calls().len(), 0);
        assert_eq!(env.settings_repo.get_calls().len(), 0);
        assert_eq!(env.search_repo.get_calls().len(), 0);
    }
    
    #[test]
    fn test_environment_with_test_data() {
        let env = TestEnvironment::with_test_data();
        // Verify test data was added
        assert!(env.note_repo.has_note(1));
        assert!(env.note_repo.has_note(2));
        assert!(env.note_repo.has_note(3));
        assert!(env.settings_repo.has_setting("theme"));
        assert!(env.settings_repo.has_setting("auto_save"));
    }
    
    #[test]
    fn test_environment_reset() {
        let mut env = TestEnvironment::with_test_data();
        
        // Verify test data exists
        assert!(env.note_repo.has_note(1));
        assert!(env.settings_repo.has_setting("theme"));
        
        // Reset and verify clean state
        env.reset();
        assert!(!env.note_repo.has_note(1));
        assert!(!env.settings_repo.has_setting("theme"));
        assert_eq!(env.get_all_call_counts(), (0, 0, 0));
    }
}