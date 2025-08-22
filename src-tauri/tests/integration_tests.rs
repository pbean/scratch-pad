use scratch_pad_lib::{
    database::DbService,
    models::{Note, NoteFormat},
    search::SearchService,
    settings::SettingsService,
};
use std::sync::Arc;
use tempfile::tempdir;

/// Integration tests for full database schema and migrations
#[tokio::test]
async fn test_database_schema_and_migrations() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("integration_test.db");

    // Test database initialization and schema creation - Fixed: pass path directly
    let db_service = DbService::new(&db_path).expect("Failed to create database service");

    // Test that all tables were created properly by performing operations

    // Test notes table
    let note = db_service
        .create_note("Test note for schema validation".to_string())
        .await
        .expect("Failed to create note - notes table may not exist");
    assert_eq!(note.content, "Test note for schema validation");
    assert_eq!(note.format, NoteFormat::PlainText);
    assert!(!note.path.is_empty());
    assert!(!note.created_at.is_empty());
    assert!(!note.updated_at.is_empty());

    // Test that FTS5 virtual table works
    let search_service = SearchService::new(Arc::new(db_service));
    let search_results = search_service
        .search_notes("schema")
        .await
        .expect("Failed to search - FTS5 table may not exist");
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0].content, "Test note for schema validation");
}

/// Integration tests for settings table and operations
#[tokio::test]
async fn test_settings_table_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("settings_test.db");

    // Fixed: pass path directly
    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Test settings table operations
    settings_service
        .set_setting("test_key", "test_value")
        .await
        .expect("Failed to set setting - settings table may not exist");

    let value = settings_service
        .get_setting("test_key")
        .await
        .expect("Failed to get setting");
    assert_eq!(value, Some("test_value".to_string()));

    // Test export/import functionality
    let temp_export_dir = tempdir().unwrap();
    let export_path = temp_export_dir.path().join("test_settings.json");

    // Export settings - Fixed: convert to string properly
    settings_service
        .export_settings_to_file(&export_path.to_string_lossy())
        .await
        .expect("Failed to export settings");

    // Clear settings and import again
    settings_service
        .delete_setting("test_key")
        .await
        .expect("Failed to delete setting");

    // Import settings - Fixed: use import_settings_from_file with string
    settings_service
        .import_settings_from_file(&export_path.to_string_lossy())
        .await
        .expect("Failed to import settings");

    // Verify setting was restored
    let restored_value = settings_service
        .get_setting("test_key")
        .await
        .expect("Failed to get restored setting");
    assert_eq!(restored_value, Some("test_value".to_string()));
}

/// Integration tests for full-text search functionality
#[tokio::test]
async fn test_fts5_search_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("search_test.db");

    // Fixed: pass path directly
    let db_service = DbService::new(&db_path).unwrap();
    let search_service = SearchService::new(Arc::new(db_service));

    // Create test data
    let note1_content = "Rust programming is powerful and safe";
    let note2_content = "JavaScript async programming patterns";
    let note3_content = "Python machine learning algorithms";

    search_service
        .db_service
        .create_note(note1_content.to_string())
        .await
        .unwrap();
    search_service
        .db_service
        .create_note(note2_content.to_string())
        .await
        .unwrap();
    search_service
        .db_service
        .create_note(note3_content.to_string())
        .await
        .unwrap();

    // Test basic search
    let results = search_service.search_notes("programming").await.unwrap();
    assert_eq!(results.len(), 2); // Should match Rust and JavaScript notes

    // Test paginated search
    let (paginated_results, total_count) = search_service
        .search_notes_paginated("programming", 0, 1)
        .await
        .unwrap();
    assert_eq!(paginated_results.len(), 1);
    assert_eq!(total_count, 2);

    // Test Boolean search
    let (boolean_results, _total_count, complexity) = search_service
        .search_notes_boolean_paginated("programming AND Rust", 0, 10)
        .await
        .unwrap();
    assert!(complexity.operator_count > 0);

    // Test query validation
    let validation = search_service
        .validate_boolean_search_query("programming AND Rust")
        .unwrap();
    assert!(validation.is_valid);

    // Test search examples
    let examples = search_service.get_boolean_search_examples();
    assert!(!examples.is_empty());
}

/// Integration tests for concurrent operations
#[tokio::test]
async fn test_concurrent_operations_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("concurrent_test.db");

    // Fixed: pass path directly
    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let search_service = Arc::new(SearchService::new(db_service.clone()));

    // Test concurrent note creation
    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = db_service.clone();
        let handle =
            tokio::spawn(
                async move { db_clone.create_note(format!("Concurrent note {}", i)).await },
            );
        handles.push(handle);
    }

    // Wait for all operations to complete
    let mut notes = Vec::new();
    for handle in handles {
        let note = handle.await.unwrap().unwrap();
        notes.push(note);
    }

    // Verify all notes were created
    assert_eq!(notes.len(), 10);

    // Test concurrent search operations
    let mut search_handles = Vec::new();
    for i in 0..5 {
        let search_clone = search_service.clone();
        let handle =
            tokio::spawn(async move { search_clone.search_notes(&format!("note {}", i)).await });
        search_handles.push(handle);
    }

    // Wait for all searches to complete
    for handle in search_handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }
}

/// Integration tests for database persistence and recovery
#[tokio::test]
async fn test_database_persistence_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("persistence_test.db");

    // Create initial data
    {
        // Fixed: pass path directly
        let db_service = DbService::new(&db_path).unwrap();
        let note = db_service
            .create_note("Persistent test note".to_string())
            .await
            .unwrap();
        assert_eq!(note.content, "Persistent test note");
    }

    // Reopen database and verify data persists
    {
        // Fixed: pass path directly
        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let search_service = SearchService::new(db_service);

        let results = search_service.search_notes("Persistent").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "Persistent test note");
    }
}
