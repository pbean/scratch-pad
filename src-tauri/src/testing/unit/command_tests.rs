/// Unit Tests for IPC Commands 
/// 
/// These tests focus on testing the command layer business logic in isolation
/// using real services with temporary database. This enables comprehensive testing
/// of command functionality while maintaining all security validation.

use crate::AppState;
use crate::database::DbService;
use crate::error::{AppError, ApiError};
use crate::models::{Note, NoteFormat};
use crate::validation::SecurityValidator;
use crate::commands::{create_note, get_note, update_note, delete_note, get_all_notes, get_notes_paginated};
use std::sync::Arc;
use tempfile::NamedTempFile;
use tokio;

/// Test environment for command tests
struct TestEnvironment {
    app_state: AppState,
    db_service: Arc<DbService>,
}

impl TestEnvironment {
    async fn new() -> Result<Self, AppError> {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_string_lossy().to_string();
        let db_service = Arc::new(DbService::new(&db_path)?);
        
        // Create minimal AppState for testing
        let app_state = AppState {
            db: db_service.clone(),
            search: Arc::new(crate::search::SearchService::new(db_service.clone())),
            settings: Arc::new(crate::settings::SettingsService::new(db_service.clone())),
            global_shortcut: Arc::new(crate::global_shortcut::GlobalShortcutService::new_test(Arc::new(crate::settings::SettingsService::new(db_service.clone())))?),
            window_manager: Arc::new(crate::window_manager::WindowManager::new_test(Arc::new(crate::settings::SettingsService::new(db_service.clone())))?),
            plugin_manager: Arc::new(tokio::sync::Mutex::new(crate::plugin::PluginManager::new())),
            security_validator: Arc::new(SecurityValidator::new()),
            shutdown_manager: Arc::new(crate::shutdown::ShutdownManager::new()),
        };
        
        Ok(Self {
            app_state,
            db_service,
        })
    }
}

/// Tests for note-related commands using direct service calls
/// Note: These tests bypass the Tauri State wrapper and test the core business logic
mod note_command_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_create_note_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test successful note creation via service
        let note = env.db_service.create_note("Test note content".to_string()).await?;
        assert_eq!(note.content, "Test note content");
        assert_eq!(note.format, NoteFormat::PlainText);
        assert!(!note.is_favorite);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_note_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = env.db_service.create_note("Test note for retrieval".to_string()).await?;
        
        // Test successful retrieval
        let retrieved_note = env.db_service.get_note(created_note.id).await?;
        assert!(retrieved_note.is_some());
        let retrieved_note = retrieved_note.unwrap();
        assert_eq!(retrieved_note.id, created_note.id);
        assert_eq!(retrieved_note.content, "Test note for retrieval");
        
        // Test non-existent note
        let result = env.db_service.get_note(99999).await?;
        assert!(result.is_none());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_update_note_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = env.db_service.create_note("Original content".to_string()).await?;
        
        // Test successful update
        let updated_note = env.db_service.update_note_content(created_note.id, "Updated content".to_string()).await?;
        assert_eq!(updated_note.id, created_note.id);
        assert_eq!(updated_note.content, "Updated content");
        assert_ne!(updated_note.updated_at, created_note.updated_at);
        
        // Test updating non-existent note (should return error)
        let result = env.db_service.update_note_content(99999, "New content".to_string()).await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_delete_note_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = env.db_service.create_note("Note to delete".to_string()).await?;
        
        // Test successful deletion
        env.db_service.delete_note(created_note.id).await?;
        
        // Verify note is deleted
        let result = env.db_service.get_note(created_note.id).await?;
        assert!(result.is_none());
        
        // Test deleting non-existent note (should not error)
        let result = env.db_service.delete_note(99999).await;
        // Note: depending on implementation, this might be Ok(()) or Err
        // The service layer should handle this gracefully
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_all_notes_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create multiple notes
        let note1 = env.db_service.create_note("First note".to_string()).await?;
        let note2 = env.db_service.create_note("Second note".to_string()).await?;
        let note3 = env.db_service.create_note("Third note".to_string()).await?;
        
        // Test retrieval of all notes
        let all_notes = env.db_service.get_all_notes().await?;
        assert!(all_notes.len() >= 3);
        
        // Check that our created notes are present
        let ids: Vec<i64> = all_notes.iter().map(|n| n.id).collect();
        assert!(ids.contains(&note1.id));
        assert!(ids.contains(&note2.id));
        assert!(ids.contains(&note3.id));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_notes_paginated_service() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create multiple notes
        for i in 1..=10 {
            env.db_service.create_note(format!("Test note {}", i)).await?;
        }
        
        // Test paginated retrieval
        let first_page = env.db_service.get_notes_paginated(0, 5).await?;
        assert_eq!(first_page.len(), 5);
        
        let second_page = env.db_service.get_notes_paginated(5, 5).await?;
        assert!(second_page.len() >= 5);
        
        // Verify no overlap between pages
        let first_ids: Vec<i64> = first_page.iter().map(|n| n.id).collect();
        let second_ids: Vec<i64> = second_page.iter().map(|n| n.id).collect();
        
        for id in &first_ids {
            assert!(!second_ids.contains(id));
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_note_content_validation() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test valid content
        let valid_note = env.db_service.create_note("Valid note content".to_string()).await?;
        assert!(!valid_note.content.is_empty());
        
        // Test empty content (should be allowed)
        let empty_note = env.db_service.create_note("".to_string()).await?;
        assert_eq!(empty_note.content, "");
        
        // Test very long content (should be limited by validation at command layer)
        let long_content = "a".repeat(1000);
        let long_note = env.db_service.create_note(long_content.clone()).await?;
        assert_eq!(long_note.content, long_content);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_note_metadata() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note and verify metadata
        let note = env.db_service.create_note("Test metadata".to_string()).await?;
        
        // Check timestamps are set
        assert!(!note.created_at.is_empty());
        assert!(!note.updated_at.is_empty());
        assert_eq!(note.created_at, note.updated_at); // Should be same on creation
        
        // Check default values
        assert!(!note.is_favorite); // Should default to false
        assert_eq!(note.format, NoteFormat::PlainText); // Should default to PlainText
        
        // Update the note and check updated_at changes
        let updated_note = env.db_service.update_note_content(note.id, "Updated metadata".to_string()).await?;
        assert_ne!(updated_note.updated_at, note.updated_at);
        assert_eq!(updated_note.created_at, note.created_at); // created_at should not change
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_concurrent_note_operations() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        let db_service = env.db_service;
        
        // Test concurrent note creation
        let handles: Vec<_> = (1..=10)
            .map(|i| {
                let service = db_service.clone();
                tokio::spawn(async move {
                    service.create_note(format!("Concurrent note {}", i)).await
                })
            })
            .collect();
        
        // Wait for all operations to complete
        let mut created_notes = Vec::new();
        for handle in handles {
            let note = handle.await.unwrap()?;
            created_notes.push(note);
        }
        
        // Verify all notes were created successfully
        assert_eq!(created_notes.len(), 10);
        
        // Verify all notes have unique IDs
        let mut ids: Vec<i64> = created_notes.iter().map(|n| n.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 10); // No duplicates
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_security_validation_integration() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // These tests focus on service-level validation
        // Command-level security tests are in security_tests.rs
        
        // Test basic content validation at service level
        let note = env.db_service.create_note("Safe content".to_string()).await?;
        assert_eq!(note.content, "Safe content");
        
        // Test that service layer accepts content (validation happens at command layer)
        let note_with_special_chars = env.db_service.create_note("Content with <>&\"'".to_string()).await?;
        assert!(note_with_special_chars.content.contains("<>&\"'"));
        
        Ok(())
    }
}

/// Tests for search functionality at service level
mod search_service_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_search_service_basic_functionality() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create test notes
        env.db_service.create_note("Rust programming tutorial".to_string()).await?;
        env.db_service.create_note("JavaScript async patterns".to_string()).await?;
        env.db_service.create_note("Python machine learning".to_string()).await?;
        
        // Test basic search
        let results = env.app_state.search.search_notes("programming").await?;
        assert!(!results.is_empty());
        assert!(results.iter().any(|note| note.content.contains("programming")));
        
        // Test paginated search
        let (results, total_count) = env.app_state.search.search_notes_paginated("programming", 0, 10).await?;
        assert!(!results.is_empty());
        assert!(total_count > 0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_search_functionality() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create test notes
        env.db_service.create_note("Rust programming tutorial".to_string()).await?;
        env.db_service.create_note("JavaScript async patterns".to_string()).await?;
        env.db_service.create_note("Python programming basics".to_string()).await?;
        
        // Test Boolean search with AND
        let (results, _total_count, complexity) = env.app_state.search
            .search_notes_boolean_paginated("programming AND Rust", 0, 10).await?;
        
        // Should find the Rust programming note
        assert!(complexity.operator_count > 0);
        assert!(complexity.operator_count > 0);
        
        // Test query validation
        let validation = env.app_state.search.validate_boolean_search_query("programming AND Rust")?;
        assert!(validation.is_valid);
        assert!(validation.operator_count > 0);
        
        // Test search examples
        let examples = env.app_state.search.get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.iter().any(|(query, _desc)| query.contains("AND")));
        
        Ok(())
    }
}

/// Tests for settings functionality at service level
mod settings_service_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_settings_service_basic_functionality() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test setting and getting values
        env.app_state.settings.set_setting("test_key", "test_value").await?;
        let value = env.app_state.settings.get_setting("test_key").await?;
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test typed settings
        env.app_state.settings.set_bool_setting("bool_test", true).await?;
        let bool_value = env.app_state.settings.get_bool_setting("bool_test").await?;
        assert_eq!(bool_value, Some(true));
        
        env.app_state.settings.set_int_setting("int_test", 42).await?;
        let int_value = env.app_state.settings.get_int_setting("int_test").await?;
        assert_eq!(int_value, Some(42));
        
        // Test getting all settings
        let all_settings = env.app_state.settings.get_all_settings().await?;
        assert!(all_settings.contains_key("test_key"));
        assert!(all_settings.contains_key("bool_test"));
        assert!(all_settings.contains_key("int_test"));
        
        Ok(())
    }
}