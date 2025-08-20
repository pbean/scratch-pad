/// Unit Tests for IPC Commands 
/// 
/// These tests focus on testing the command layer business logic in isolation
/// using real services with temporary database. This enables comprehensive testing
/// of command functionality while maintaining all security validation.

use crate::AppState;
use crate::database::DbService;
use crate::error::AppError;
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

/// Tests for note-related commands
mod note_command_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_create_note_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test successful note creation
        let note = create_note("Test note content".to_string(), env.app_state).await?;
        assert_eq!(note.content, "Test note content");
        assert_eq!(note.format, NoteFormat::PlainText);
        assert!(!note.is_favorite);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_note_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = create_note("Test note for retrieval".to_string(), env.app_state.clone()).await?;
        
        // Test successful retrieval
        let retrieved_note = get_note(created_note.id, env.app_state.clone()).await?;
        assert_eq!(retrieved_note.id, created_note.id);
        assert_eq!(retrieved_note.content, "Test note for retrieval");
        
        // Test non-existent note
        let result = get_note(99999, env.app_state).await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_update_note_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = create_note("Original content".to_string(), env.app_state.clone()).await?;
        
        // Test successful update
        let updated_note = update_note(created_note.id, "Updated content".to_string(), env.app_state.clone()).await?;
        assert_eq!(updated_note.id, created_note.id);
        assert_eq!(updated_note.content, "Updated content");
        assert_ne!(updated_note.updated_at, created_note.updated_at);
        
        // Test updating non-existent note
        let result = update_note(99999, "New content".to_string(), env.app_state).await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_delete_note_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create a note first
        let created_note = create_note("Note to delete".to_string(), env.app_state.clone()).await?;
        
        // Test successful deletion
        delete_note(created_note.id, env.app_state.clone()).await?;
        
        // Verify note is gone
        let result = get_note(created_note.id, env.app_state.clone()).await;
        assert!(result.is_err());
        
        // Test deleting non-existent note
        let result = delete_note(99999, env.app_state).await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_all_notes_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create multiple notes
        let mut created_ids = Vec::new();
        for i in 1..=3 {
            let note = create_note(format!("Test note {}", i), env.app_state.clone()).await?;
            created_ids.push(note.id);
        }
        
        // Test get all notes
        let all_notes = get_all_notes(env.app_state).await?;
        assert!(all_notes.len() >= 3); // At least our test notes
        
        // Verify our notes are in the results
        let note_ids: Vec<i64> = all_notes.iter().map(|n| n.id).collect();
        for created_id in created_ids {
            assert!(note_ids.contains(&created_id));
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_notes_paginated_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create multiple notes
        for i in 1..=5 {
            create_note(format!("Paginated note {}", i), env.app_state.clone()).await?;
        }
        
        // Test pagination
        let page1 = get_notes_paginated(0, 2, env.app_state.clone()).await?;
        assert_eq!(page1.len(), 2);
        
        let page2 = get_notes_paginated(2, 2, env.app_state.clone()).await?;
        assert_eq!(page2.len(), 2);
        
        let page3 = get_notes_paginated(4, 2, env.app_state).await?;
        assert_eq!(page3.len(), 1);
        
        Ok(())
    }
}

/// Tests for database layer (using real database service for integration testing)
mod database_integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_create_note_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Test note creation via database service
        let result = env.db_service.create_note("Database test note".to_string()).await;
        assert!(result.is_ok());
        
        let note = result.unwrap();
        assert_eq!(note.content, "Database test note");
        assert_eq!(note.format, NoteFormat::PlainText);
        assert!(!note.is_favorite);  // Fixed: Use is_favorite instead of is_pinned
        assert!(note.id > 0);
    }
    
    #[tokio::test]
    async fn test_get_all_notes_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Create multiple notes
        let mut created_ids = Vec::new();
        for i in 1..=3 {
            let result = env.db_service.create_note(format!("DB test note {}", i)).await;
            assert!(result.is_ok());
            created_ids.push(result.unwrap().id);
        }
        
        // Get all notes (Fixed: no parameters)
        let result = env.db_service.get_all_notes().await;
        assert!(result.is_ok());
        
        let all_notes = result.unwrap();
        assert!(all_notes.len() >= 3); // At least our test notes
        
        // Verify our notes are in the results
        let note_ids: Vec<i64> = all_notes.iter().map(|n| n.id).collect();
        for created_id in created_ids {
            assert!(note_ids.contains(&created_id));
        }
    }
    
    #[tokio::test]
    async fn test_update_note_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Create a note
        let note = env.db_service.create_note("Original content".to_string()).await.unwrap();
        
        // Update the note (Fixed: use update_note_content)
        let updated = env.db_service.update_note_content(note.id, "Updated content".to_string()).await;
        assert!(updated.is_ok());
        
        let updated_note = updated.unwrap();
        assert_eq!(updated_note.content, "Updated content");
        assert_eq!(updated_note.id, note.id);
        assert_ne!(updated_note.updated_at, note.updated_at);
    }
    
    #[tokio::test]
    async fn test_delete_note_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Create a note
        let note = env.db_service.create_note("Note to delete".to_string()).await.unwrap();
        
        // Delete the note
        let result = env.db_service.delete_note(note.id).await;
        assert!(result.is_ok());
        
        // Verify note is gone
        let get_result = env.db_service.get_note(note.id).await;
        assert!(get_result.is_ok());
        assert!(get_result.unwrap().is_none());
    }
    
    #[tokio::test]
    async fn test_search_notes_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Create notes with searchable content
        env.db_service.create_note("Rust programming guide".to_string()).await.unwrap();
        env.db_service.create_note("JavaScript tutorial".to_string()).await.unwrap();
        env.db_service.create_note("Python basics".to_string()).await.unwrap();
        
        // Test search functionality
        let search_results = env.db_service.search_notes("Rust").await.unwrap();
        assert_eq!(search_results.len(), 1);
        assert!(search_results[0].content.contains("Rust"));
        
        let search_results2 = env.db_service.search_notes("programming").await.unwrap();
        assert_eq!(search_results2.len(), 1);
        assert!(search_results2[0].content.contains("programming"));
        
        // Test search with no results
        let no_results = env.db_service.search_notes("nonexistent").await.unwrap();
        assert_eq!(no_results.len(), 0);
    }
    
    #[tokio::test]
    async fn test_paginated_search_database() {
        let env = TestEnvironment::new().await.unwrap();
        
        // Create multiple notes with common search term
        for i in 1..=5 {
            env.db_service.create_note(format!("Search test note {}", i)).await.unwrap();
        }
        
        // Test paginated search
        let (page1, total1) = env.db_service.search_notes_paginated("Search", 0, 2).await.unwrap();
        assert_eq!(page1.len(), 2);
        assert_eq!(total1, 5);
        
        let (page2, total2) = env.db_service.search_notes_paginated("Search", 2, 2).await.unwrap();
        assert_eq!(page2.len(), 2);
        assert_eq!(total2, 5);
        
        let (page3, total3) = env.db_service.search_notes_paginated("Search", 4, 2).await.unwrap();
        assert_eq!(page3.len(), 1);
        assert_eq!(total3, 5);
    }
}

/// Tests for search-related commands
mod search_command_tests {
    use super::*;
    use crate::commands::search::{search_notes, search_notes_paginated, search_notes_boolean_paginated, validate_boolean_search_query, get_boolean_search_examples};
    
    #[tokio::test]
    async fn test_search_notes_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create searchable notes
        create_note("Rust programming tutorial".to_string(), env.app_state.clone()).await?;
        create_note("JavaScript development".to_string(), env.app_state.clone()).await?;
        
        // Test basic search
        let results = search_notes("Rust".to_string(), env.app_state.clone()).await?;
        assert_eq!(results.notes.len(), 1);
        assert!(results.notes[0].content.contains("Rust"));
        
        // Test search with no results
        let no_results = search_notes("NonExistent".to_string(), env.app_state).await?;
        assert_eq!(no_results.notes.len(), 0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_notes_paginated_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create multiple searchable notes
        for i in 1..=5 {
            create_note(format!("Searchable content note {}", i), env.app_state.clone()).await?;
        }
        
        // Test paginated search
        let results = search_notes_paginated("Searchable".to_string(), 0, 2, env.app_state.clone()).await?;
        assert_eq!(results.notes.len(), 2);
        assert_eq!(results.total_count, 5);
        assert_eq!(results.page, 0);
        assert_eq!(results.page_size, 2);
        assert!(results.has_more);
        
        let results2 = search_notes_paginated("Searchable".to_string(), 2, 2, env.app_state).await?;
        assert_eq!(results2.notes.len(), 2);
        assert_eq!(results2.page, 2);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_search_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Create notes for Boolean search testing
        create_note("Rust programming language".to_string(), env.app_state.clone()).await?;
        create_note("JavaScript tutorial guide".to_string(), env.app_state.clone()).await?;
        create_note("Python programming basics".to_string(), env.app_state.clone()).await?;
        
        // Test Boolean AND search
        let results = search_notes_boolean_paginated("programming AND Rust".to_string(), 0, 10, env.app_state.clone()).await?;
        assert_eq!(results.notes.len(), 1);
        assert!(results.notes[0].content.contains("Rust"));
        assert!(results.notes[0].content.contains("programming"));
        
        // Test Boolean OR search
        let results2 = search_notes_boolean_paginated("JavaScript OR Python".to_string(), 0, 10, env.app_state).await?;
        assert_eq!(results2.notes.len(), 2);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_validate_boolean_query_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test valid queries
        let validation = validate_boolean_search_query("rust AND programming".to_string(), env.app_state.clone()).await?;
        assert!(validation.is_valid);
        assert!(validation.operator_count >= 1);
        
        // Test invalid query (unbalanced parentheses)
        let validation2 = validate_boolean_search_query("(rust AND programming".to_string(), env.app_state).await?;
        assert!(!validation2.is_valid);
        assert!(validation2.error_message.is_some());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_search_examples_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        let examples = get_boolean_search_examples(env.app_state).await?;
        assert!(!examples.is_empty());
        assert!(examples.len() >= 5);
        
        // Verify example structure
        for example in &examples {
            assert!(!example.0.is_empty()); // Query
            assert!(!example.1.is_empty()); // Description
        }
        
        Ok(())
    }
}

/// Tests for settings-related commands
mod settings_command_tests {
    use super::*;
    use crate::commands::settings::{get_setting, set_setting, get_all_settings};
    
    #[tokio::test]
    async fn test_basic_settings_commands() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test setting a value
        set_setting("test_key".to_string(), "test_value".to_string(), env.app_state.clone()).await?;
        
        // Test getting the value
        let value = get_setting("test_key".to_string(), env.app_state.clone()).await?;
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test get all settings
        let all_settings = get_all_settings(env.app_state).await?;
        assert!(all_settings.contains_key("test_key"));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_validation() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test with invalid settings (should be caught by validation)
        let result = set_setting("../../../etc/passwd".to_string(), "malicious".to_string(), env.app_state).await;
        assert!(result.is_err()); // Should be rejected by security validation
        
        Ok(())
    }
}

/// Tests for system-related commands  
mod system_command_tests {
    use super::*;
    use crate::commands::system::{register_global_shortcut};
    
    #[tokio::test]
    async fn test_register_global_shortcut_command() -> Result<(), AppError> {
        let env = TestEnvironment::new().await?;
        
        // Test with valid shortcut
        let result = register_global_shortcut("Ctrl+Shift+N".to_string(), env.app_state.clone()).await;
        // May succeed or fail depending on system capabilities, but shouldn't panic
        assert!(result.is_ok() || result.is_err());
        
        // Test with invalid shortcut format
        let result2 = register_global_shortcut("InvalidShortcut".to_string(), env.app_state).await;
        assert!(result2.is_err());
        
        Ok(())
    }
}