use scratch_pad_lib::{
    database::DbService,
    models::{Note, NoteFormat},
    search::SearchService,
    settings::SettingsService,
};
use tempfile::tempdir;

/// Integration tests for full database schema and migrations
#[tokio::test]
async fn test_database_schema_and_migrations() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("integration_test.db");
    
    // Test database initialization and schema creation
    let db_service = DbService::new(&db_path).expect("Failed to create database service");
    
    // Test that all tables were created properly by performing operations
    
    // Test notes table
    let note = db_service.create_note("Test note for schema validation".to_string()).await
        .expect("Failed to create note - notes table may not exist");
    assert_eq!(note.content, "Test note for schema validation");
    assert_eq!(note.format, NoteFormat::PlainText);
    assert!(!note.path.is_empty());
    assert!(!note.created_at.is_empty());
    assert!(!note.updated_at.is_empty());
    
    // Test that FTS5 virtual table works
    let search_service = SearchService::new(std::sync::Arc::new(db_service));
    let search_results = search_service.search_notes("schema").await
        .expect("Failed to search - FTS5 table may not exist");
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].content, "Test note for schema validation");
}

/// Integration tests for settings table and operations
#[tokio::test]
async fn test_settings_table_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("settings_test.db");
    
    let db_service = std::sync::Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);
    
    // Test settings table operations
    settings_service.set_setting("test_key", "test_value").await
        .expect("Failed to set setting - settings table may not exist");
    
    let retrieved_value = settings_service.get_setting("test_key").await
        .expect("Failed to get setting");
    assert_eq!(retrieved_value, Some("test_value".to_string()));
    
    // Test default settings initialization
    settings_service.initialize_defaults().await
        .expect("Failed to initialize default settings");
    
    let all_settings = settings_service.get_all_settings().await
        .expect("Failed to get all settings");
    assert!(!all_settings.is_empty());
    
    // Test settings export/import
    let exported = settings_service.export_settings().await
        .expect("Failed to export settings");
    assert!(!exported.is_empty());
    
    let import_count = settings_service.import_settings(exported).await
        .expect("Failed to import settings");
    assert!(import_count > 0);
}

/// Integration tests for database triggers and automatic updates
#[tokio::test]
async fn test_database_triggers() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("triggers_test.db");
    
    let db_service = DbService::new(&db_path).unwrap();
    
    // Create a note and verify timestamps
    let original_note = db_service.create_note("Original content".to_string()).await.unwrap();
    let original_updated_at = original_note.updated_at.clone();
    
    // Wait a moment to ensure timestamp difference
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    
    // Update the note and verify updated_at changed
    let mut updated_note = original_note.clone();
    updated_note.content = "Updated content".to_string();
    
    let result = db_service.update_note(updated_note).await.unwrap();
    assert_ne!(result.updated_at, original_updated_at);
    assert_eq!(result.content, "Updated content");
    
    // Verify FTS5 sync trigger by searching for updated content
    let search_service = SearchService::new(std::sync::Arc::new(db_service));
    let search_results = search_service.search_notes("Updated").await.unwrap();
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].content, "Updated content");
}

/// Integration tests for complex database operations
#[tokio::test]
async fn test_complex_database_operations() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("complex_ops_test.db");
    
    let db_service = std::sync::Arc::new(DbService::new(&db_path).unwrap());
    let search_service = SearchService::new(db_service.clone());
    
    // Create multiple notes with different properties
    let notes_data = vec![
        ("First note content", "/documents/first.txt", Some("First Note")),
        ("Second note with different content", "/documents/second.md", Some("Second Note")),
        ("Third note in different folder", "/projects/third.txt", None),
        ("Fourth favorite note", "/favorites/fourth.md", Some("Favorite")),
    ];
    
    let mut created_notes = Vec::new();
    for (content, path, nickname) in notes_data {
        let mut note = db_service.create_note(content.to_string()).await.unwrap();
        note.path = path.to_string();
        note.nickname = nickname.map(|s| s.to_string());
        if path.contains("favorite") {
            note.is_favorite = true;
        }
        let updated_note = db_service.update_note(note).await.unwrap();
        created_notes.push(updated_note);
    }
    
    // Test path-based operations
    let all_paths = db_service.get_all_paths().await.unwrap();
    assert!(all_paths.contains(&"/documents/first.txt".to_string()));
    assert!(all_paths.contains(&"/projects/third.txt".to_string()));
    
    // Test search operations
    let search_results = search_service.search_notes("different").await.unwrap();
    assert_eq!(search_results.len(), 2); // "different content" and "different folder"
    
    // Test fuzzy search
    let fuzzy_results = search_service.fuzzy_search("secnd").await.unwrap(); // Typo in "second"
    assert!(!fuzzy_results.is_empty());
    
    // Test favorite search
    let favorite_results = search_service.search_favorites(None).await.unwrap();
    assert_eq!(favorite_results.len(), 1);
    assert!(favorite_results[0].is_favorite);
    
    // Test combined search
    let combined_results = search_service.combined_search("note").await.unwrap();
    assert!(combined_results.len() >= 4); // Should find all notes
    
    // Test search suggestions
    let suggestions = search_service.get_search_suggestions("not", 5).await.unwrap();
    assert!(!suggestions.is_empty());
}

/// Integration tests for error handling and edge cases
#[tokio::test]
async fn test_database_error_handling() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("error_test.db");
    
    let db_service = DbService::new(&db_path).unwrap();
    
    // Test operations on non-existent note
    let result = db_service.delete_note(99999).await;
    assert!(result.is_ok()); // Delete should succeed even if note doesn't exist
    
    // Test updating non-existent note
    let fake_note = Note {
        id: 99999,
        content: "Fake content".to_string(),
        format: NoteFormat::PlainText,
        nickname: None,
        path: "/fake".to_string(),
        is_favorite: false,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };
    
    let result = db_service.update_note(fake_note).await;
    assert!(result.is_err()); // Should fail for non-existent note
    
    // Test empty search
    let search_service = SearchService::new(std::sync::Arc::new(db_service));
    let empty_results = search_service.search_notes("").await.unwrap();
    assert!(empty_results.is_empty());
    
    // Test search with special characters
    let special_results = search_service.search_notes("@#$%^&*()").await.unwrap();
    assert!(special_results.is_empty());
}

/// Integration tests for concurrent database operations
#[tokio::test]
async fn test_concurrent_database_operations() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("concurrent_test.db");
    
    let db_service = std::sync::Arc::new(DbService::new(&db_path).unwrap());
    
    // Create multiple concurrent tasks
    let mut handles = Vec::new();
    
    for i in 0..10 {
        let db_clone = db_service.clone();
        let handle = tokio::spawn(async move {
            let content = format!("Concurrent note {}", i);
            db_clone.create_note(content).await
        });
        handles.push(handle);
    }
    
    // Wait for all tasks to complete
    let mut results = Vec::new();
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        results.push(result.unwrap());
    }
    
    // Verify all notes were created
    assert_eq!(results.len(), 10);
    
    // Verify database consistency
    let all_notes = db_service.get_all_notes().await.unwrap();
    assert_eq!(all_notes.len(), 10);
    
    // Test concurrent search operations
    let search_service = SearchService::new(db_service);
    let mut search_handles = Vec::new();
    
    for i in 0..5 {
        let search_clone = search_service.clone();
        let handle = tokio::spawn(async move {
            search_clone.search_notes(&format!("Concurrent note {}", i)).await
        });
        search_handles.push(handle);
    }
    
    // Verify all searches complete successfully
    for handle in search_handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        let search_results = result.unwrap();
        assert_eq!(search_results.len(), 1);
    }
}

/// Integration tests for settings validation and edge cases
#[tokio::test]
async fn test_settings_validation_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("settings_validation_test.db");
    
    let db_service = std::sync::Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);
    
    // Test setting validation for global shortcuts
    let valid_shortcuts = vec!["Ctrl+Alt+S", "Cmd+Shift+Space", "Alt+F1"];
    for shortcut in valid_shortcuts {
        let result = settings_service.set_setting_validated("global_shortcut", shortcut).await;
        assert!(result.is_ok(), "Valid shortcut {} should be accepted", shortcut);
    }
    
    // Test invalid shortcuts
    let invalid_shortcuts = vec!["InvalidKey", "Ctrl+", "+Alt", ""];
    for shortcut in invalid_shortcuts {
        let result = settings_service.set_setting_validated("global_shortcut", shortcut).await;
        assert!(result.is_err(), "Invalid shortcut {} should be rejected", shortcut);
    }
    
    // Test layout mode validation
    let valid_modes = vec!["default", "half", "full"];
    for mode in valid_modes {
        let result = settings_service.set_setting_validated("layout_mode", mode).await;
        assert!(result.is_ok(), "Valid layout mode {} should be accepted", mode);
    }
    
    let invalid_modes = vec!["invalid", "quarter", ""];
    for mode in invalid_modes {
        let result = settings_service.set_setting_validated("layout_mode", mode).await;
        assert!(result.is_err(), "Invalid layout mode {} should be rejected", mode);
    }
    
    // Test font validation
    let valid_fonts = vec!["SauceCodePro Nerd Font", "Consolas", "Monaco"];
    for font in valid_fonts {
        let result = settings_service.set_setting_validated("editor_font", font).await;
        assert!(result.is_ok(), "Valid font {} should be accepted", font);
    }
    
    // Test boolean settings
    let boolean_settings = vec![("always_on_top", "true"), ("auto_save", "false")];
    for (key, value) in boolean_settings {
        let result = settings_service.set_setting_validated(key, value).await;
        assert!(result.is_ok(), "Boolean setting {}={} should be accepted", key, value);
    }
    
    let invalid_booleans = vec![("always_on_top", "maybe"), ("auto_save", "1")];
    for (key, value) in invalid_booleans {
        let result = settings_service.set_setting_validated(key, value).await;
        assert!(result.is_err(), "Invalid boolean {}={} should be rejected", key, value);
    }
}

/// Integration test for complete note lifecycle
#[tokio::test]
async fn test_complete_note_lifecycle() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("lifecycle_test.db");
    
    let db_service = std::sync::Arc::new(DbService::new(&db_path).unwrap());
    let search_service = SearchService::new(db_service.clone());
    
    // 1. Create note
    let original_content = "This is a test note for lifecycle testing";
    let note = db_service.create_note(original_content.to_string()).await.unwrap();
    assert_eq!(note.content, original_content);
    assert_eq!(note.format, NoteFormat::PlainText);
    
    // 2. Update note properties
    let mut updated_note = note.clone();
    updated_note.content = "Updated content for lifecycle test".to_string();
    updated_note.format = NoteFormat::Markdown;
    updated_note.nickname = Some("Lifecycle Test Note".to_string());
    updated_note.path = "/tests/lifecycle.md".to_string();
    updated_note.is_favorite = true;
    
    let result = db_service.update_note(updated_note.clone()).await.unwrap();
    assert_eq!(result.content, updated_note.content);
    assert_eq!(result.format, NoteFormat::Markdown);
    assert_eq!(result.nickname, updated_note.nickname);
    assert_eq!(result.path, updated_note.path);
    assert!(result.is_favorite);
    
    // 3. Search for the note
    let search_results = search_service.search_notes("lifecycle").await.unwrap();
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].id, note.id);
    
    // 4. Test as favorite
    let favorite_results = search_service.search_favorites(Some("lifecycle")).await.unwrap();
    assert_eq!(favorite_results.len(), 1);
    assert!(favorite_results[0].is_favorite);
    
    // 5. Test path search
    let path_results = search_service.search_by_path("/tests/").await.unwrap();
    assert_eq!(path_results.len(), 1);
    assert_eq!(path_results[0].path, "/tests/lifecycle.md");
    
    // 6. Verify in all notes
    let all_notes = db_service.get_all_notes().await.unwrap();
    assert!(all_notes.iter().any(|n| n.id == note.id));
    
    // 7. Verify as latest note
    let latest = db_service.get_latest_note().await.unwrap();
    assert!(latest.is_some());
    assert_eq!(latest.unwrap().id, note.id);
    
    // 8. Delete note
    db_service.delete_note(note.id).await.unwrap();
    
    // 9. Verify deletion
    let all_notes_after = db_service.get_all_notes().await.unwrap();
    assert!(!all_notes_after.iter().any(|n| n.id == note.id));
    
    let search_after = search_service.search_notes("lifecycle").await.unwrap();
    assert!(search_after.is_empty());
}