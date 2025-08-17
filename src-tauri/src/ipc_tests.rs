#[cfg(test)]
mod tests {
    use crate::{models, database::DbService};
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_ipc_commands_compilation() {
        // This test verifies that all IPC commands compile correctly
        // The actual functionality is tested through the database service tests
        // Note: We skip testing AppState creation here since GlobalShortcutService
        // requires a Tauri app context which is not available in unit tests

        // Verify that the IPC command functions exist and can be referenced
        let _create_note_fn = crate::create_note;
        let _get_all_notes_fn = crate::get_all_notes;
        let _get_latest_note_fn = crate::get_latest_note;
        let _update_note_fn = crate::update_note;
        let _delete_note_fn = crate::delete_note;
        let _get_all_paths_fn = crate::get_all_paths;
        
        // Test passes if compilation succeeds
        assert!(true);
    }

    #[tokio::test]
    async fn test_note_operations_through_database() {
        // Test the underlying database operations that the IPC commands use
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = DbService::new(&db_path).unwrap();

        // Test create_note
        let created_note = db_service.create_note("Test note content".to_string()).await.unwrap();
        assert_eq!(created_note.content, "Test note content");
        assert_eq!(created_note.format, models::NoteFormat::PlainText);

        // Test get_all_notes
        let all_notes = db_service.get_all_notes().await.unwrap();
        assert_eq!(all_notes.len(), 1);
        assert_eq!(all_notes[0].content, "Test note content");

        // Test get_latest_note
        let latest_note = db_service.get_latest_note().await.unwrap();
        assert!(latest_note.is_some());
        assert_eq!(latest_note.unwrap().content, "Test note content");

        // Test update_note
        let mut updated_note = created_note.clone();
        updated_note.content = "Updated content".to_string();
        updated_note.format = models::NoteFormat::Markdown;
        updated_note.nickname = Some("Test Note".to_string());

        let result = db_service.update_note(updated_note.clone()).await.unwrap();
        assert_eq!(result.content, "Updated content");
        assert_eq!(result.format, models::NoteFormat::Markdown);
        assert_eq!(result.nickname, Some("Test Note".to_string()));

        // Test get_all_paths
        let paths = db_service.get_all_paths().await.unwrap();
        assert!(paths.contains(&"/".to_string()));

        // Test delete_note
        db_service.delete_note(created_note.id).await.unwrap();
        
        // Verify note was deleted
        let all_notes_after_delete = db_service.get_all_notes().await.unwrap();
        assert_eq!(all_notes_after_delete.len(), 0);
    }

    #[tokio::test]
    async fn test_export_note_functionality() {
        use tokio::fs;
        
        // Test the export_note IPC command functionality
        let temp_dir = tempdir().unwrap();
        let export_path = temp_dir.path().join("exported_note.txt");
        
        // Create a test note
        let test_note = models::Note {
            id: 1,
            content: "This is a test note for export".to_string(),
            format: models::NoteFormat::PlainText,
            nickname: Some("Test Export Note".to_string()),
            path: "/test".to_string(),
            is_favorite: false,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };
        
        // Test export_note command
        let result = crate::export_note(test_note.clone(), export_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        
        // Verify the file was created and contains the correct content
        let exported_content = fs::read_to_string(&export_path).await.unwrap();
        assert_eq!(exported_content, test_note.content);
    }
}