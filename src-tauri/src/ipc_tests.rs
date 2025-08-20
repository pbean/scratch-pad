// Integration tests for IPC functionality
// This file contains comprehensive tests for the IPC layer
// ensuring all Tauri commands work correctly end-to-end

use crate::database::DbService;
use crate::error::AppError;
use crate::models::{Note, NoteFormat};
use std::sync::Arc;
use tempfile::NamedTempFile;

async fn create_test_db() -> Result<Arc<DbService>, AppError> {
    let temp_file = NamedTempFile::new().unwrap();
    let db_path = temp_file.path().to_string_lossy().to_string();
    Ok(Arc::new(DbService::new(&db_path)?))
}

#[tokio::test]
async fn test_note_crud_operations() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Test create note
    let note = db_service.create_note("Test note content".to_string()).await?;
    assert_eq!(note.content, "Test note content");
    assert_eq!(note.format, NoteFormat::PlainText);
    assert!(!note.is_favorite);  // Fixed: Use is_favorite instead of is_pinned
    
    // Test get note
    let retrieved = db_service.get_note(note.id).await?;
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().content, "Test note content");
    
    // Test get_all_notes (Fixed: no parameters)
    let all_notes = db_service.get_all_notes().await?;
    assert!(!all_notes.is_empty());
    assert_eq!(all_notes.len(), 1);
    
    // Test update note (Fixed: use update_note_content)
    let updated = db_service.update_note_content(note.id, "Updated content".to_string()).await?;
    assert_eq!(updated.content, "Updated content");
    assert_eq!(updated.id, note.id);
    
    // Test get_all_notes again (Fixed: no parameters)
    let notes_after_update = db_service.get_all_notes().await?;
    assert_eq!(notes_after_update.len(), 1);
    assert_eq!(notes_after_update[0].content, "Updated content");
    
    // Test delete note
    db_service.delete_note(note.id).await?;
    
    // Verify note is deleted
    let deleted_note = db_service.get_note(note.id).await?;
    assert!(deleted_note.is_none());
    
    // Test get_all_notes after delete (Fixed: no parameters)
    let notes_after_delete = db_service.get_all_notes().await?;
    assert!(notes_after_delete.is_empty());
    
    Ok(())
}

#[tokio::test]
async fn test_note_search_functionality() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Create test notes
    let _note1 = db_service.create_note("Rust programming tutorial".to_string()).await?;
    let _note2 = db_service.create_note("JavaScript development guide".to_string()).await?;
    let _note3 = db_service.create_note("Python data science".to_string()).await?;
    
    // Test basic search
    let rust_results = db_service.search_notes("Rust").await?;
    assert_eq!(rust_results.len(), 1);
    assert!(rust_results[0].content.contains("Rust"));
    
    let programming_results = db_service.search_notes("programming").await?;
    assert_eq!(programming_results.len(), 1);
    assert!(programming_results[0].content.contains("programming"));
    
    // Test search with no results
    let no_results = db_service.search_notes("NonExistent").await?;
    assert!(no_results.is_empty());
    
    // Test case insensitive search
    let case_results = db_service.search_notes("PYTHON").await?;
    assert_eq!(case_results.len(), 1);
    assert!(case_results[0].content.to_lowercase().contains("python"));
    
    Ok(())
}

#[tokio::test]
async fn test_paginated_search() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Create multiple notes with searchable content
    for i in 1..=5 {
        db_service.create_note(format!("Search test note {}", i)).await?;
    }
    
    // Test paginated search
    let (page1, total1) = db_service.search_notes_paginated("Search", 0, 2).await?;
    assert_eq!(page1.len(), 2);
    assert_eq!(total1, 5);
    
    let (page2, total2) = db_service.search_notes_paginated("Search", 2, 2).await?;
    assert_eq!(page2.len(), 2);
    assert_eq!(total2, 5);
    
    let (page3, total3) = db_service.search_notes_paginated("Search", 4, 2).await?;
    assert_eq!(page3.len(), 1);
    assert_eq!(total3, 5);
    
    // Test search with different query
    let (no_results, total_none) = db_service.search_notes_paginated("NonExistent", 0, 10).await?;
    assert_eq!(no_results.len(), 0);
    assert_eq!(total_none, 0);
    
    Ok(())
}

#[tokio::test]
async fn test_note_persistence() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Create notes with various content types
    let simple_note = db_service.create_note("Simple text note".to_string()).await?;
    let markdown_note = db_service.create_note("# Markdown Header\n\nSome **bold** text".to_string()).await?;
    let unicode_note = db_service.create_note("Unicode: 🚀 Café naïve résumé".to_string()).await?;
    let long_note = db_service.create_note("Long content: ".to_owned() + &"x".repeat(1000)).await?;
    
    // Verify all notes were created
    let all_notes = db_service.get_all_notes().await?;
    assert_eq!(all_notes.len(), 4);
    
    // Verify content integrity
    let retrieved_simple = db_service.get_note(simple_note.id).await?.unwrap();
    assert_eq!(retrieved_simple.content, "Simple text note");
    
    let retrieved_markdown = db_service.get_note(markdown_note.id).await?.unwrap();
    assert!(retrieved_markdown.content.contains("# Markdown Header"));
    assert!(retrieved_markdown.content.contains("**bold**"));
    
    let retrieved_unicode = db_service.get_note(unicode_note.id).await?.unwrap();
    assert!(retrieved_unicode.content.contains("🚀"));
    assert!(retrieved_unicode.content.contains("Café"));
    assert!(retrieved_unicode.content.contains("naïve"));
    assert!(retrieved_unicode.content.contains("résumé"));
    
    let retrieved_long = db_service.get_note(long_note.id).await?.unwrap();
    assert!(retrieved_long.content.len() > 1000);
    assert!(retrieved_long.content.starts_with("Long content: "));
    
    Ok(())
}

#[tokio::test]
async fn test_concurrent_operations() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Test concurrent note creation
    let handles: Vec<_> = (0..10)
        .map(|i| {
            let db = Arc::clone(&db_service);
            tokio::spawn(async move {
                db.create_note(format!("Concurrent note {}", i)).await
            })
        })
        .collect();
    
    // Wait for all operations to complete
    let mut results = Vec::new();
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        results.push(result.unwrap());
    }
    
    // Verify all notes were created
    assert_eq!(results.len(), 10);
    
    // Verify all notes are in database (Fixed: no parameters)
    let all_notes = db_service.get_all_notes().await?;
    assert_eq!(all_notes.len(), 10);
    
    // Test concurrent search operations
    let search_handles: Vec<_> = (0..5)
        .map(|_| {
            let db = Arc::clone(&db_service);
            tokio::spawn(async move {
                db.search_notes("Concurrent").await
            })
        })
        .collect();
    
    // Wait for all search operations to complete
    for handle in search_handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        let notes = result.unwrap();
        assert_eq!(notes.len(), 10); // All notes should match "Concurrent"
    }
    
    Ok(())
}

#[tokio::test]
async fn test_error_handling() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Test getting non-existent note
    let result = db_service.get_note(99999).await?;
    assert!(result.is_none());
    
    // Test updating non-existent note (Fixed: use update_note_content)
    let update_result = db_service.update_note_content(99999, "New content".to_string()).await;
    assert!(update_result.is_err());
    
    // Test deleting non-existent note
    let delete_result = db_service.delete_note(99999).await;
    assert!(delete_result.is_err());
    
    // Test empty search
    let empty_search = db_service.search_notes("").await?;
    assert!(empty_search.is_empty());
    
    // Verify database is still functional after errors
    let test_note = db_service.create_note("Error recovery test".to_string()).await?;
    assert_eq!(test_note.content, "Error recovery test");
    
    Ok(())
}

#[tokio::test]
async fn test_database_health_check() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Test health check
    let health = db_service.health_check().await?;
    assert!(health);
    
    // Create a note to verify database is writable
    let _note = db_service.create_note("Health check test".to_string()).await?;
    
    // Test health check again
    let health2 = db_service.health_check().await?;
    assert!(health2);
    
    Ok(())
}

#[tokio::test]
async fn test_note_timestamps() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Create a note
    let note = db_service.create_note("Timestamp test".to_string()).await?;
    assert!(!note.created_at.is_empty());
    assert!(!note.updated_at.is_empty());
    assert_eq!(note.created_at, note.updated_at); // Should be equal for new notes
    
    // Wait a bit to ensure timestamp difference
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    
    // Update the note (Fixed: use update_note_content)
    let updated_note = db_service.update_note_content(note.id, "Updated timestamp test".to_string()).await?;
    assert_eq!(updated_note.created_at, note.created_at); // Created time should not change
    assert_ne!(updated_note.updated_at, note.updated_at); // Updated time should change
    
    Ok(())
}

#[tokio::test]
async fn test_note_format_handling() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Create notes - they should all default to PlainText format
    let plain_note = db_service.create_note("Plain text content".to_string()).await?;
    assert_eq!(plain_note.format, NoteFormat::PlainText);
    
    let markdown_content = db_service.create_note("# Markdown Content\n\nWith **formatting**".to_string()).await?;
    assert_eq!(markdown_content.format, NoteFormat::PlainText); // Still defaults to PlainText
    
    // Verify format persists through retrieval
    let retrieved = db_service.get_note(plain_note.id).await?.unwrap();
    assert_eq!(retrieved.format, NoteFormat::PlainText);
    
    Ok(())
}

#[tokio::test]
async fn test_special_characters_and_escaping() -> Result<(), AppError> {
    let db_service = create_test_db().await?;
    
    // Test notes with special characters that might cause SQL issues
    let special_chars = vec![
        "Single 'quotes' test",
        "Double \"quotes\" test", 
        "Backslash \\ test",
        "Newline\ntest",
        "Tab\ttest",
        "Unicode: 🚀 ❤️ 中文 العربية",
        "SQL injection attempt: '; DROP TABLE notes; --",
        "Null byte test: content\0with\0nulls",
    ];
    
    let mut created_notes = Vec::new();
    for (i, content) in special_chars.iter().enumerate() {
        let note = db_service.create_note(content.to_string()).await?;
        created_notes.push(note);
    }
    
    // Verify all notes were created and content is preserved
    for (i, note) in created_notes.iter().enumerate() {
        let retrieved = db_service.get_note(note.id).await?.unwrap();
        assert_eq!(retrieved.content, special_chars[i]);
    }
    
    // Test search with special characters
    let search_results = db_service.search_notes("quotes").await?;
    assert_eq!(search_results.len(), 2); // Should find both single and double quote notes
    
    let unicode_results = db_service.search_notes("🚀").await?;
    assert_eq!(unicode_results.len(), 1);
    
    // Test that SQL injection attempt doesn't break anything
    let injection_results = db_service.search_notes("injection").await?;
    assert_eq!(injection_results.len(), 1);
    
    // Verify database integrity (Fixed: no parameters)
    let all_notes = db_service.get_all_notes().await?;
    assert_eq!(all_notes.len(), 8); // All special character notes should exist
    
    Ok(())
}