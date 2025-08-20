// ipc_tests.rs - Integration tests for IPC commands and database operations

#[cfg(test)]
use crate::database::DbService;
#[cfg(test)]
use crate::error::AppError;
#[cfg(test)]
use crate::models;
#[cfg(test)]
use anyhow::Context;
#[cfg(test)]
use tempfile::NamedTempFile;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_operations() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path())?;

        // Test create_note
        let created_note = db_service
            .create_note("Test note content".to_string())
            .await
            .context("Failed to create note")?;
        
        assert_eq!(created_note.content, "Test note content");
        assert_eq!(created_note.is_favorite, false);

        // Test get_note
        let retrieved_note = db_service
            .get_note(created_note.id)
            .await
            .context("Failed to get note")?;
        
        assert!(retrieved_note.is_some());
        let note = retrieved_note.unwrap();
        assert_eq!(note.content, "Test note content");

        // Test get_all_notes
        let all_notes = db_service.get_all_notes(None, None).await
            .context("Failed to get all notes")?;
        assert_eq!(all_notes.len(), 1);

        // Test update_note_content - Fixed method call
        let mut updated_note = created_note.clone();
        updated_note.content = "Updated content".to_string();
        updated_note.format = models::NoteFormat::Markdown;
        
        let result = db_service.update_note_content(created_note.id, "Updated content".to_string()).await
            .context("Failed to update note")?;
        assert_eq!(result.content, "Updated content");

        // Test get_all_notes again
        let notes_after_update = db_service.get_all_notes(None, None).await
            .context("Failed to get notes after update")?;
        assert_eq!(notes_after_update.len(), 1);
        assert_eq!(notes_after_update[0].content, "Updated content");

        // Test search_notes
        let search_results = db_service.search_notes("Updated").await
            .map_err(|e| anyhow::Error::from(e))?;
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].content, "Updated content");

        // Test delete_note
        db_service.delete_note(created_note.id).await
            .context("Failed to delete note")?;
        
        let notes_after_delete = db_service.get_all_notes(None, None).await
            .context("Failed to get notes after delete")?;
        assert_eq!(notes_after_delete.len(), 0);

        Ok(())
    }

    #[tokio::test]
    async fn test_search_functionality() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path())?;

        // Create multiple test notes
        let notes = vec![
            "Rust programming tutorial",
            "JavaScript async patterns", 
            "Python machine learning",
            "Database design principles",
            "API documentation guide"
        ];

        for content in notes {
            db_service.create_note(content.to_string()).await
                .context("Failed to create test note")?;
        }

        // Test FTS search
        let rust_results = db_service.search_notes("Rust").await
            .context("Failed to search for Rust")?;
        assert_eq!(rust_results.len(), 1);
        assert!(rust_results[0].content.contains("Rust"));

        // Test paginated search
        let (all_results, _) = db_service.search_notes_paginated("programming", 0, 3).await
            .context("Failed to get paginated results")?;
        assert!(all_results.len() <= 3);

        // Test search count (using paginated search to get count)
        let (_, count) = db_service.search_notes_paginated("programming", 0, 1000).await
            .context("Failed to count search results")?;
        assert!(count >= 1);

        Ok(())
    }

    #[tokio::test]
    async fn test_note_format_handling() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path())?;

        // Create note with different format
        let note = db_service.create_note("# Markdown Header\n\nThis is *markdown* content".to_string()).await
            .context("Failed to create markdown note")?;
        
        assert_eq!(note.format, models::NoteFormat::PlainText); // Default format
        
        // Verify note retrieval preserves format
        let retrieved = db_service.get_note(note.id).await
            .context("Failed to retrieve note")?;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().format, models::NoteFormat::PlainText);

        Ok(())
    }

    #[tokio::test] 
    async fn test_favorite_note_operations() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path())?;

        // Create a note
        let mut note = db_service.create_note("Favorite test note".to_string()).await
            .context("Failed to create note")?;
        
        assert_eq!(note.is_favorite, false);

        // Update note to be favorite using update_note method
        note.is_favorite = true;
        let updated_note = db_service.update_note(note.clone()).await
            .context("Failed to update note to favorite")?;
        
        assert_eq!(updated_note.is_favorite, true);

        // Verify the favorite status is persisted
        let retrieved = db_service.get_note(note.id).await
            .context("Failed to retrieve favorite note")?;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().is_favorite, true);

        Ok(())
    }

    #[tokio::test]
    async fn test_database_error_handling() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path())?;

        // Test getting non-existent note
        let result = db_service.get_note(999).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        // Test deleting non-existent note
        let delete_result = db_service.delete_note(999).await;
        assert!(delete_result.is_err());

        // Test updating non-existent note
        let update_result = db_service.update_note_content(999, "test content".to_string()).await;
        assert!(update_result.is_err());

        Ok(())
    }

    #[tokio::test]
    async fn test_concurrent_operations() -> Result<(), AppError> {
        // Create temporary database
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = std::sync::Arc::new(DbService::new(temp_file.path())?);

        // Test concurrent note creation
        let mut handles = Vec::new();
        for i in 0..10 {
            let service = db_service.clone();
            let handle = tokio::spawn(async move {
                service.create_note(format!("Concurrent note {}", i)).await
            });
            handles.push(handle);
        }

        // Wait for all operations to complete
        let results: Result<Vec<_>, _> = futures::future::try_join_all(handles).await;
        assert!(results.is_ok());
        
        let notes = results.unwrap();
        assert_eq!(notes.len(), 10);

        // Verify all notes were created
        let all_notes = db_service.get_all_notes(None, None).await
            .context("Failed to get all concurrent notes")?;
        assert_eq!(all_notes.len(), 10);

        Ok(())
    }
}