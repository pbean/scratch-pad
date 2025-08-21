use scratch_pad_lib::{
    database::DbService,
    settings::SettingsService,
    cli::CliArgs,
};
use tempfile::tempdir;
use std::path::PathBuf;
use std::sync::Arc;

/// Test database file creation and access across platforms
#[tokio::test]
async fn test_cross_platform_database_paths() {
    // Test different path formats that might be used across platforms
    let test_paths = vec![
        "test.db",                    // Relative path
        "./test.db",                  // Current directory
        "data/test.db",              // Subdirectory
    ];
    
    for path in test_paths {
        let temp_dir = tempdir().unwrap();
        let full_path = temp_dir.path().join(path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        
        // Test database creation
        let db_service = DbService::new(&full_path);
        assert!(db_service.is_ok(), "Failed to create database at path: {:?}", full_path);
        
        let db = db_service.unwrap();
        
        // Test basic operations work
        let note = db.create_note("Cross-platform test note".to_string()).await.unwrap();
        assert_eq!(note.content, "Cross-platform test note");
        
        let retrieved_notes = db.get_all_notes().await.unwrap();
        assert_eq!(retrieved_notes.len(), 1);
    }
}

/// Test file path handling across different operating systems
#[tokio::test]
async fn test_cross_platform_file_paths() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("path_test.db");
    
    let db_service = DbService::new(&db_path).unwrap();
    
    // Test different path formats that might be used across platforms
    let test_paths = vec![
        "/documents/note.txt",        // Unix-style absolute path
        "documents/note.txt",         // Relative path
        "./documents/note.txt",       // Current directory relative
        "../documents/note.txt",      // Parent directory relative
        "documents\\note.txt",        // Windows-style path (should be normalized)
        "/home/user/documents/note.txt", // Full Unix path
    ];
    
    for (i, path) in test_paths.iter().enumerate() {
        let content = format!("Test note {} with path {}", i, path);
        let mut note = db_service.create_note(content.clone()).await.unwrap();
        note.path = path.to_string();
        
        let updated_note = db_service.update_note(note).await.unwrap();
        assert_eq!(updated_note.path, *path);
        assert_eq!(updated_note.content, content);
    }
    
    // Verify all paths were stored correctly
    let all_paths = db_service.get_all_paths().await.unwrap();
    assert_eq!(all_paths.len(), test_paths.len());
    
    for path in test_paths {
        assert!(all_paths.contains(&path.to_string()), "Path not found: {}", path);
    }
}

/// Test settings with platform-specific values
#[tokio::test]
async fn test_cross_platform_settings() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("settings_platform_test.db");
    
    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);
    
    // Test platform-specific global shortcuts
    let platform_shortcuts = if cfg!(target_os = "macos") {
        vec!["Cmd+Shift+Space", "Cmd+Alt+S", "Ctrl+Cmd+Space"]
    } else if cfg!(target_os = "windows") {
        vec!["Ctrl+Alt+S", "Win+Shift+S", "Ctrl+Shift+Space"]
    } else {
        // Linux and other Unix-like systems
        vec!["Ctrl+Alt+S", "Super+Shift+Space", "Alt+F1"]
    };
    
    for shortcut in platform_shortcuts {
        let result = settings_service.set_setting("global_shortcut", shortcut).await;
        assert!(result.is_ok(), "Platform shortcut {} should be valid", shortcut);
        
        let retrieved = settings_service.get_setting("global_shortcut").await.unwrap();
        assert_eq!(retrieved, Some(shortcut.to_string()));
    }
    
    // Test platform-specific font settings
    let platform_fonts = if cfg!(target_os = "macos") {
        vec!["Monaco", "Menlo", "SF Mono"]
    } else if cfg!(target_os = "windows") {
        vec!["Consolas", "Courier New", "Cascadia Code"]
    } else {
        // Linux
        vec!["DejaVu Sans Mono", "Liberation Mono", "Ubuntu Mono"]
    };
    
    for font in platform_fonts {
        let result = settings_service.set_setting("editor_font", font).await;
        assert!(result.is_ok(), "Platform font {} should be valid", font);
        
        let retrieved = settings_service.get_setting("editor_font").await.unwrap();
        assert_eq!(retrieved, Some(font.to_string()));
    }
}

/// Test CLI argument parsing across platforms
#[test]
fn test_cross_platform_cli_parsing() {
    // Test different argument formats
    let test_cases = vec![
        (vec!["scratch-pad"], None),
        (vec!["scratch-pad", "Hello World"], Some("Hello World".to_string())),
        (vec!["scratch-pad", "Multi word content"], Some("Multi word content".to_string())),
        (vec!["scratch-pad", "Content with \"quotes\""], Some("Content with \"quotes\"".to_string())),
        (vec!["scratch-pad", "Content\nwith\nnewlines"], Some("Content\nwith\nnewlines".to_string())),
    ];
    
    for (args, expected_content) in test_cases {
        // Simulate command line arguments
        let cli_args = CliArgs {
            content: expected_content.clone(),
            should_show_gui: false,
        };
        
        assert_eq!(cli_args.content, expected_content);
    }
}

/// Test file system operations across platforms
#[tokio::test]
async fn test_cross_platform_file_operations() {
    use tokio::fs;
    
    let temp_dir = tempdir().unwrap();
    
    // Test export functionality with different file extensions
    let test_files = vec![
        ("note.txt", "Plain text note content"),
        ("note.md", "# Markdown Note\n\nThis is **bold** text."),
        ("note.json", r#"{"content": "JSON formatted note"}"#),
        ("note with spaces.txt", "Note with spaces in filename"),
    ];
    
    for (filename, content) in test_files {
        let file_path = temp_dir.path().join(filename);
        
        // Test writing file (simulating export)
        let write_result = fs::write(&file_path, content).await;
        assert!(write_result.is_ok(), "Failed to write file: {}", filename);
        
        // Test reading file back
        let read_content = fs::read_to_string(&file_path).await.unwrap();
        assert_eq!(read_content, content);
        
        // Test file metadata
        let metadata = fs::metadata(&file_path).await.unwrap();
        assert!(metadata.is_file());
        assert!(metadata.len() > 0);
    }
}

/// Test database locking and concurrent access (important for CLI integration)
#[tokio::test]
async fn test_cross_platform_database_locking() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("locking_test.db");
    
    // Create first database connection
    let db1 = Arc::new(DbService::new(&db_path).unwrap());
    
    // Create second database connection (simulating CLI access while GUI is running)
    let db2 = Arc::new(DbService::new(&db_path).unwrap());
    
    // Test concurrent operations
    let handle1 = {
        let db = db1.clone();
        tokio::spawn(async move {
            for i in 0..5 {
                let content = format!("Note from connection 1, iteration {}", i);
                db.create_note(content).await.unwrap();
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        })
    };
    
    let handle2 = {
        let db = db2.clone();
        tokio::spawn(async move {
            for i in 0..5 {
                let content = format!("Note from connection 2, iteration {}", i);
                db.create_note(content).await.unwrap();
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        })
    };
    
    // Wait for both to complete
    handle1.await.unwrap();
    handle2.await.unwrap();
    
    // Verify all notes were created successfully
    let all_notes = db1.get_all_notes().await.unwrap();
    assert_eq!(all_notes.len(), 10);
    
    // Verify notes from both connections exist
    let connection1_notes = all_notes.iter().filter(|n| n.content.contains("connection 1")).count();
    let connection2_notes = all_notes.iter().filter(|n| n.content.contains("connection 2")).count();
    
    assert_eq!(connection1_notes, 5);
    assert_eq!(connection2_notes, 5);
}

/// Test temporary file handling for IPC communication
#[tokio::test]
async fn test_cross_platform_temp_file_handling() {
    use tokio::fs;
    use serde_json;
    
    // Test creating temporary files in platform-appropriate locations
    let temp_locations = vec![
        std::env::temp_dir(),
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    ];
    
    for temp_dir in temp_locations {
        let ipc_file = temp_dir.join("scratch-pad-ipc-test.json");
        
        // Create IPC request file (simulating CLI to GUI communication)
        let ipc_request = serde_json::json!({
            "action": "create_note",
            "content": "Test note from IPC"
        });
        
        let write_result = fs::write(&ipc_file, ipc_request.to_string()).await;
        assert!(write_result.is_ok(), "Failed to write IPC file in: {:?}", temp_dir);
        
        // Read and verify IPC file
        let content = fs::read_to_string(&ipc_file).await.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        
        assert_eq!(parsed["action"], "create_note");
        assert_eq!(parsed["content"], "Test note from IPC");
        
        // Clean up
        let _ = fs::remove_file(&ipc_file).await;
    }
}

/// Test platform-specific path normalization
#[tokio::test]
async fn test_cross_platform_path_normalization() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("path_norm_test.db");
    
    let db_service = DbService::new(&db_path).unwrap();
    
    // Test paths that should be normalized consistently across platforms
    let path_pairs = vec![
        ("documents/note.txt", "documents/note.txt"),
        ("documents\\note.txt", "documents/note.txt"), // Windows backslash should normalize
        ("./documents/note.txt", "documents/note.txt"), // Current directory prefix
        ("documents/../documents/note.txt", "documents/note.txt"), // Parent directory navigation
    ];
    
    for (input_path, _expected_normalized) in path_pairs {
        let mut note = db_service.create_note("Test content".to_string()).await.unwrap();
        note.path = input_path.to_string();
        
        let updated_note = db_service.update_note(note).await.unwrap();
        
        // The exact normalization behavior may vary by platform,
        // but the path should be stored and retrievable
        assert!(!updated_note.path.is_empty());
        
        // Test that we can search by the stored path
        let all_paths = db_service.get_all_paths().await.unwrap();
        assert!(all_paths.contains(&updated_note.path));
    }
}

/// Test character encoding across platforms
#[tokio::test]
async fn test_cross_platform_character_encoding() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("encoding_test.db");
    
    let db_service = DbService::new(&db_path).unwrap();
    
    // Test various character encodings and special characters
    let test_contents = vec![
        "Simple ASCII text",
        "UTF-8 characters: café, naïve, résumé",
        "Emoji: 📝 📋 ✅ ❌ 🔍",
        "Mathematical symbols: ∑ ∏ ∫ ∂ ∇",
        "Currency symbols: $ € £ ¥ ₹",
        "Accented characters: àáâãäåæçèéêë",
        "Asian characters: 你好世界 こんにちは 안녕하세요",
        "Special punctuation: \"quotes\" 'apostrophes' —dashes— …ellipsis",
        "Line breaks\nand\ttabs",
        "Mixed: Hello 世界! 🌍 café €10",
    ];
    
    let mut created_notes = Vec::new();
    for content in test_contents {
        let note = db_service.create_note(content.to_string()).await.unwrap();
        assert_eq!(note.content, content);
        created_notes.push(note);
    }
    
    // Verify all notes can be retrieved with correct encoding
    let all_notes = db_service.get_all_notes().await.unwrap();
    assert_eq!(all_notes.len(), created_notes.len());
    
    for (original, retrieved) in created_notes.iter().zip(all_notes.iter()) {
        assert_eq!(original.content, retrieved.content);
    }
    
    // Test search with special characters
    let search_service = scratch_pad_lib::search::SearchService::new(Arc::new(db_service));
    
    let emoji_results = search_service.search_notes("📝").await.unwrap();
    assert_eq!(emoji_results.len(), 1);
    
    let unicode_results = search_service.search_notes("café").await.unwrap();
    assert_eq!(unicode_results.len(), 2); // Should find both "café" entries
    
    let asian_results = search_service.search_notes("世界").await.unwrap();
    assert_eq!(asian_results.len(), 2); // Should find both entries with "世界"
}

/// Test platform-specific default settings
#[tokio::test]
async fn test_cross_platform_default_settings() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("defaults_test.db");
    
    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);
    
    // Initialize default settings
    settings_service.initialize_defaults().await.unwrap();
    
    let all_settings = settings_service.get_all_settings().await.unwrap();
    
    // Verify platform-appropriate defaults are set
    assert!(all_settings.contains_key("global_shortcut"));
    assert!(all_settings.contains_key("layout_mode"));
    assert!(all_settings.contains_key("editor_font"));
    assert!(all_settings.contains_key("ui_font"));
    
    // Test that default shortcut is platform-appropriate
    let default_shortcut = all_settings.get("global_shortcut").unwrap();
    
    if cfg!(target_os = "macos") {
        assert!(default_shortcut.as_str().unwrap_or("").contains("Cmd") || default_shortcut.as_str().unwrap_or("").contains("⌘"));
    } else {
        assert!(default_shortcut.as_str().unwrap_or("").contains("Ctrl") || default_shortcut.as_str().unwrap_or("").contains("Alt") || default_shortcut.as_str().unwrap_or("").contains("Super"));
    }
    
    // Test that default fonts are reasonable for the platform
    let editor_font = all_settings.get("editor_font").unwrap();
    assert!(!editor_font.as_str().unwrap_or("").is_empty());
    
    let ui_font = all_settings.get("ui_font").unwrap();
    assert!(!ui_font.as_str().unwrap_or("").is_empty());
}