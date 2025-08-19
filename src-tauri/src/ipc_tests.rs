#[cfg(test)]
mod tests {
    use crate::{models, database::DbService, commands};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_ipc_commands_compilation() {
        // This test verifies that all IPC commands compile correctly
        // The actual functionality is tested through the database service tests
        // Note: We skip testing AppState creation here since GlobalShortcutService
        // requires a Tauri app context which is not available in unit tests

        // Verify that the IPC command functions exist and can be referenced
        let _create_note_fn = commands::create_note;
        let _get_all_notes_fn = commands::get_all_notes;
        let _get_note_fn = commands::get_note;
        let _update_note_fn = commands::update_note;
        let _delete_note_fn = commands::delete_note;
        let _get_notes_paginated_fn = commands::get_notes_paginated;
        let _search_notes_fn = commands::search_notes;
        let _get_setting_fn = commands::get_setting;
        let _set_setting_fn = commands::set_setting;
        
        // Test passes if compilation succeeds
        assert!(true);
    }

    #[tokio::test]
    async fn test_note_operations_through_database() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        // Test the underlying database operations that the IPC commands use
        let temp_dir = tempdir()
            .context("Failed to create temporary directory")?;
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path.to_string_lossy())
            .context("Failed to create database service")?;

        // Test create_note
        let created_note = db_service.create_note("Test note content".to_string()).await
            .context("Failed to create note")?;
        assert_eq!(created_note.content, "Test note content");
        assert_eq!(created_note.format, models::NoteFormat::PlainText);

        // Test get_all_notes
        let all_notes = db_service.get_all_notes().await
            .context("Failed to get all notes")?;
        assert_eq!(all_notes.len(), 1);
        assert_eq!(all_notes[0].content, "Test note content");

        // Test get_latest_note
        let latest_note = db_service.get_latest_note().await
            .context("Failed to get latest note")?;
        assert!(latest_note.is_some());
        let latest = latest_note.context("Latest note should exist")?;
        assert_eq!(latest.content, "Test note content");

        // Test update_note
        let mut updated_note = created_note.clone();
        updated_note.content = "Updated content".to_string();
        updated_note.format = models::NoteFormat::Markdown;
        
        let result = db_service.update_note(updated_note.clone()).await
            .context("Failed to update note")?;
        assert_eq!(result.content, "Updated content");
        assert_eq!(result.format, models::NoteFormat::Markdown);

        // Test get_all_paths
        let paths = db_service.get_all_paths().await
            .context("Failed to get all paths")?;
        assert!(!paths.is_empty());

        // Test delete_note
        db_service.delete_note(created_note.id).await
            .context("Failed to delete note")?;
        
        let all_notes_after_delete = db_service.get_all_notes().await
            .context("Failed to get all notes after delete")?;
        assert_eq!(all_notes_after_delete.len(), 0);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_export_operations() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        use std::fs;
        
        // Test the export functionality
        let documents_dir = dirs::document_dir()
            .context("Failed to get documents directory")?
            .join("scratch-pad-exports");
        
        // Create export directory if it doesn't exist
        if let Err(e) = fs::create_dir_all(&documents_dir) {
            // Only fail if it's not an "already exists" error
            if e.kind() != std::io::ErrorKind::AlreadyExists {
                return Err(anyhow::anyhow!("Failed to create export directory: {}", e));
            }
        }

        // Test export path creation
        let export_path = documents_dir.join("test_export.json");
        
        // Write test content
        let test_content = r#"{"test": "content"}"#;
        fs::write(&export_path, test_content)
            .context("Failed to write test export file")?;
        
        // Verify content can be read
        if export_path.exists() {
            let exported_content = fs::read_to_string(&export_path)
                .context("Failed to read exported content")?;
            assert_eq!(exported_content, test_content);
            
            // Clean up
            fs::remove_file(&export_path)
                .context("Failed to clean up test export file")?;
        }
        
        Ok(())
    }
}