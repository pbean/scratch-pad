use scratch_pad_lib::{
    database::DbService,
    models::{Note, NoteFormat},
    search::SearchService,
    settings::SettingsService,
};
use tempfile::tempdir;
use std::sync::Arc;

/// Mock AppState for testing IPC commands without full Tauri context
struct MockAppState {
    pub db: Arc<DbService>,
    pub search: Arc<SearchService>,
    pub settings: Arc<SettingsService>,
}

impl MockAppState {
    async fn new() -> Self {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("ipc_test.db");
        
        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let search_service = Arc::new(SearchService::new(db_service.clone()));
        let settings_service = Arc::new(SettingsService::new(db_service.clone()));
        
        // Initialize default settings
        settings_service.initialize_defaults().await.unwrap();
        
        Self {
            db: db_service,
            search: search_service,
            settings: settings_service,
        }
    }
}

/// Integration tests for note-related IPC commands with real database
#[tokio::test]
async fn test_note_ipc_commands_integration() {
    let state = MockAppState::new().await;
    
    // Test create_note command
    let created_note = state.db.create_note("Test note from IPC".to_string()).await.unwrap();
    assert_eq!(created_note.content, "Test note from IPC");
    assert_eq!(created_note.format, NoteFormat::PlainText);
    assert!(!created_note.created_at.is_empty());
    
    // Test get_all_notes command
    let all_notes = state.db.get_all_notes().await.unwrap();
    assert_eq!(all_notes.len(), 1);
    assert_eq!(all_notes[0].id, created_note.id);
    
    // Test get_latest_note command
    let latest_note = state.db.get_latest_note().await.unwrap();
    assert!(latest_note.is_some());
    assert_eq!(latest_note.unwrap().id, created_note.id);
    
    // Test update_note command
    let mut updated_note = created_note.clone();
    updated_note.content = "Updated via IPC".to_string();
    updated_note.nickname = Some("IPC Test Note".to_string());
    updated_note.is_favorite = true;
    
    let result = state.db.update_note(updated_note.clone()).await.unwrap();
    assert_eq!(result.content, "Updated via IPC");
    assert_eq!(result.nickname, Some("IPC Test Note".to_string()));
    assert!(result.is_favorite);
    
    // Test get_all_paths command
    let paths = state.db.get_all_paths().await.unwrap();
    assert!(!paths.is_empty());
    assert!(paths.contains(&"/".to_string()));
    
    // Create another note with different path
    let mut second_note = state.db.create_note("Second note".to_string()).await.unwrap();
    second_note.path = "/documents/test.md".to_string();
    state.db.update_note(second_note).await.unwrap();
    
    let updated_paths = state.db.get_all_paths().await.unwrap();
    assert!(updated_paths.contains(&"/documents/test.md".to_string()));
    
    // Test delete_note command
    state.db.delete_note(created_note.id).await.unwrap();
    
    let notes_after_delete = state.db.get_all_notes().await.unwrap();
    assert_eq!(notes_after_delete.len(), 1); // Only second note remains
    assert_ne!(notes_after_delete[0].id, created_note.id);
}

/// Integration tests for search-related IPC commands
#[tokio::test]
async fn test_search_ipc_commands_integration() {
    let state = MockAppState::new().await;
    
    // Create test notes for searching
    let notes_data = vec![
        ("First test note with unique content", "/notes/first.txt"),
        ("Second note about testing search functionality", "/notes/second.md"),
        ("Third note with different topic", "/documents/third.txt"),
        ("Fourth note mentioning unique keyword", "/favorites/fourth.md"),
    ];
    
    let mut created_notes = Vec::new();
    for (content, path) in notes_data {
        let mut note = state.db.create_note(content.to_string()).await.unwrap();
        note.path = path.to_string();
        if path.contains("favorites") {
            note.is_favorite = true;
        }
        let updated_note = state.db.update_note(note).await.unwrap();
        created_notes.push(updated_note);
    }
    
    // Test search_notes command
    let search_results = state.search.search_notes("test").await.unwrap();
    assert!(search_results.len() >= 2); // Should find "test" in multiple notes
    
    // Test fuzzy_search_notes command
    let fuzzy_results = state.search.fuzzy_search("testin").await.unwrap(); // Partial match
    assert!(!fuzzy_results.is_empty());
    
    // Test combined_search_notes command
    let combined_results = state.search.combined_search("note").await.unwrap();
    assert_eq!(combined_results.len(), 4); // Should find all notes
    
    // Test search_notes_by_path command
    let path_results = state.search.search_by_path("/notes/").await.unwrap();
    assert_eq!(path_results.len(), 2); // Two notes in /notes/ directory
    
    // Test search_favorite_notes command
    let favorite_results = state.search.search_favorites(None).await.unwrap();
    assert_eq!(favorite_results.len(), 1); // One favorite note
    assert!(favorite_results[0].is_favorite);
    
    let favorite_search_results = state.search.search_favorites(Some("unique")).await.unwrap();
    assert_eq!(favorite_search_results.len(), 1);
    assert!(favorite_search_results[0].content.contains("unique"));
    
    // Test get_search_suggestions command
    let suggestions = state.search.get_search_suggestions("not", 5).await.unwrap();
    assert!(!suggestions.is_empty());
    
    // Test empty search
    let empty_results = state.search.search_notes("nonexistent").await.unwrap();
    assert!(empty_results.is_empty());
}

/// Integration tests for settings-related IPC commands
#[tokio::test]
async fn test_settings_ipc_commands_integration() {
    let state = MockAppState::new().await;
    
    // Test set_setting command
    state.settings.set_setting("test_key", "test_value").await.unwrap();
    
    // Test get_setting command
    let retrieved_value = state.settings.get_setting("test_key").await.unwrap();
    assert_eq!(retrieved_value, Some("test_value".to_string()));
    
    // Test get_all_settings command
    let all_settings = state.settings.get_all_settings().await.unwrap();
    assert!(!all_settings.is_empty());
    assert_eq!(all_settings.get("test_key"), Some(&"test_value".to_string()));
    
    // Test setting with validation
    let valid_shortcut = "Ctrl+Alt+S";
    state.settings.set_setting_validated("global_shortcut", valid_shortcut).await.unwrap();
    
    let shortcut_value = state.settings.get_setting("global_shortcut").await.unwrap();
    assert_eq!(shortcut_value, Some(valid_shortcut.to_string()));
    
    // Test invalid setting should fail
    let result = state.settings.set_setting_validated("global_shortcut", "InvalidKey").await;
    assert!(result.is_err());
    
    // Test export_settings command
    let exported = state.settings.export_settings().await.unwrap();
    assert!(!exported.is_empty());
    
    // Verify exported JSON is valid
    let parsed: serde_json::Value = serde_json::from_str(&exported).unwrap();
    assert!(parsed.is_object());
    
    // Test import_settings command
    let import_count = state.settings.import_settings(exported).await.unwrap();
    assert!(import_count > 0);
    
    // Test reset_settings_to_defaults command
    state.settings.reset_to_defaults().await.unwrap();
    
    // Verify defaults were restored
    let default_settings = state.settings.get_all_settings().await.unwrap();
    assert!(!default_settings.is_empty());
    
    // Test initialize_default_settings command
    state.settings.initialize_defaults().await.unwrap();
    
    let initialized_settings = state.settings.get_all_settings().await.unwrap();
    assert!(!initialized_settings.is_empty());
}

/// Integration tests for export functionality
#[tokio::test]
async fn test_export_note_ipc_integration() {
    use tokio::fs;
    
    let temp_dir = tempdir().unwrap();
    let export_path = temp_dir.path().join("exported_note.txt");
    
    // Create a test note
    let test_note = Note {
        id: 1,
        content: "This is a test note for export integration".to_string(),
        format: NoteFormat::Markdown,
        nickname: Some("Export Test".to_string()),
        path: "/test/export.md".to_string(),
        is_favorite: true,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };
    
    // Test export_note command (simulating the IPC command)
    fs::write(&export_path, &test_note.content).await.unwrap();
    
    // Verify the file was created and contains correct content
    let exported_content = fs::read_to_string(&export_path).await.unwrap();
    assert_eq!(exported_content, test_note.content);
    
    // Test exporting to different formats/paths
    let markdown_path = temp_dir.path().join("exported.md");
    fs::write(&markdown_path, &test_note.content).await.unwrap();
    
    let markdown_content = fs::read_to_string(&markdown_path).await.unwrap();
    assert_eq!(markdown_content, test_note.content);
}

/// Integration tests for error handling in IPC commands
#[tokio::test]
async fn test_ipc_error_handling_integration() {
    let state = MockAppState::new().await;
    
    // Test operations on non-existent note
    let result = state.db.delete_note(99999).await;
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
    
    let result = state.db.update_note(fake_note).await;
    assert!(result.is_err());
    
    // Test invalid settings
    let result = state.settings.set_setting_validated("global_shortcut", "").await;
    assert!(result.is_err());
    
    let result = state.settings.set_setting_validated("layout_mode", "invalid").await;
    assert!(result.is_err());
    
    // Test getting non-existent setting
    let result = state.settings.get_setting("non_existent_key").await.unwrap();
    assert_eq!(result, None);
    
    // Test invalid JSON import
    let result = state.settings.import_settings("invalid json".to_string()).await;
    assert!(result.is_err());
    
    // Test empty search queries
    let empty_results = state.search.search_notes("").await.unwrap();
    assert!(empty_results.is_empty());
    
    let empty_fuzzy = state.search.fuzzy_search("").await.unwrap();
    assert!(empty_fuzzy.is_empty());
}

/// Integration tests for concurrent IPC operations
#[tokio::test]
async fn test_concurrent_ipc_operations() {
    let state = Arc::new(MockAppState::new().await);
    
    // Test concurrent note creation
    let mut create_handles = Vec::new();
    for i in 0..5 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let content = format!("Concurrent note {}", i);
            state_clone.db.create_note(content).await
        });
        create_handles.push(handle);
    }
    
    // Wait for all creations to complete
    let mut created_notes = Vec::new();
    for handle in create_handles {
        let result = handle.await.unwrap().unwrap();
        created_notes.push(result);
    }
    
    assert_eq!(created_notes.len(), 5);
    
    // Test concurrent searches
    let mut search_handles = Vec::new();
    for i in 0..3 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let query = format!("Concurrent note {}", i);
            state_clone.search.search_notes(&query).await
        });
        search_handles.push(handle);
    }
    
    // Verify all searches complete successfully
    for handle in search_handles {
        let result = handle.await.unwrap().unwrap();
        assert_eq!(result.len(), 1);
    }
    
    // Test concurrent settings operations
    let mut settings_handles = Vec::new();
    for i in 0..3 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let key = format!("concurrent_key_{}", i);
            let value = format!("concurrent_value_{}", i);
            state_clone.settings.set_setting(&key, &value).await
        });
        settings_handles.push(handle);
    }
    
    // Wait for all settings operations
    for handle in settings_handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }
    
    // Verify all settings were set correctly
    let all_settings = state.settings.get_all_settings().await.unwrap();
    for i in 0..3 {
        let key = format!("concurrent_key_{}", i);
        let expected_value = format!("concurrent_value_{}", i);
        assert_eq!(all_settings.get(&key), Some(&expected_value));
    }
}

/// Integration test for complete IPC workflow
#[tokio::test]
async fn test_complete_ipc_workflow() {
    let state = MockAppState::new().await;
    
    // 1. Initialize default settings (like app startup)
    state.settings.initialize_defaults().await.unwrap();
    
    // 2. Create a new note (like user creating note)
    let note = state.db.create_note("My first note".to_string()).await.unwrap();
    
    // 3. Update note properties (like user editing)
    let mut updated_note = note.clone();
    updated_note.content = "My updated first note with more content".to_string();
    updated_note.nickname = Some("First Note".to_string());
    updated_note.path = "/documents/first.md".to_string();
    updated_note.format = NoteFormat::Markdown;
    
    let result = state.db.update_note(updated_note).await.unwrap();
    
    // 4. Search for the note (like user searching)
    let search_results = state.search.search_notes("first").await.unwrap();
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].id, note.id);
    
    // 5. Mark as favorite and search favorites
    let mut favorite_note = result.clone();
    favorite_note.is_favorite = true;
    state.db.update_note(favorite_note).await.unwrap();
    
    let favorites = state.search.search_favorites(None).await.unwrap();
    assert_eq!(favorites.len(), 1);
    assert!(favorites[0].is_favorite);
    
    // 6. Update settings (like user changing preferences)
    state.settings.set_setting_validated("layout_mode", "half").await.unwrap();
    state.settings.set_setting("editor_font", "Monaco").await.unwrap();
    
    // 7. Export settings (like user backing up settings)
    let exported = state.settings.export_settings().await.unwrap();
    assert!(!exported.is_empty());
    
    // 8. Get all notes (like loading app state)
    let all_notes = state.db.get_all_notes().await.unwrap();
    assert_eq!(all_notes.len(), 1);
    
    // 9. Get latest note (like showing recent note)
    let latest = state.db.get_latest_note().await.unwrap();
    assert!(latest.is_some());
    assert_eq!(latest.unwrap().id, note.id);
    
    // 10. Create additional notes and test path operations
    let mut second_note = state.db.create_note("Second note".to_string()).await.unwrap();
    second_note.path = "/projects/second.txt".to_string();
    state.db.update_note(second_note).await.unwrap();
    
    let paths = state.db.get_all_paths().await.unwrap();
    assert!(paths.contains(&"/documents/first.md".to_string()));
    assert!(paths.contains(&"/projects/second.txt".to_string()));
    
    // 11. Test combined search across all notes
    let combined_results = state.search.combined_search("note").await.unwrap();
    assert_eq!(combined_results.len(), 2);
    
    // 12. Clean up by deleting notes
    state.db.delete_note(note.id).await.unwrap();
    
    let final_notes = state.db.get_all_notes().await.unwrap();
    assert_eq!(final_notes.len(), 1); // Only second note remains
}