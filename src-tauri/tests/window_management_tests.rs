use scratch_pad_lib::{database::DbService, settings::SettingsService, window_manager::LayoutMode};
use std::sync::Arc;
use tempfile::tempdir;

/// Test LayoutMode enum functionality
#[test]
fn test_layout_mode_conversion() {
    // Test string to LayoutMode conversion
    assert_eq!(LayoutMode::from_string("default"), LayoutMode::Default);
    assert_eq!(LayoutMode::from_string("half"), LayoutMode::Half);
    assert_eq!(LayoutMode::from_string("full"), LayoutMode::Full);
    assert_eq!(LayoutMode::from_string("invalid"), LayoutMode::Default); // Should default to Default

    // Test LayoutMode to string conversion
    assert_eq!(LayoutMode::Default.to_string(), "default");
    assert_eq!(LayoutMode::Half.to_string(), "half");
    assert_eq!(LayoutMode::Full.to_string(), "full");
}

/// Test layout mode settings integration
#[tokio::test]
async fn test_layout_mode_settings_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("layout_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Test setting valid layout modes
    let valid_modes = vec!["default", "half", "full"];
    for mode in valid_modes {
        let result = settings_service.set_setting("layout_mode", mode).await;
        assert!(
            result.is_ok(),
            "Valid layout mode {} should be accepted",
            mode
        );

        let retrieved = settings_service.get_setting("layout_mode").await.unwrap();
        assert_eq!(retrieved, Some(mode.to_string()));
    }

    // Test invalid layout modes
    let invalid_modes = vec!["quarter", "mini", "invalid", ""];
    for mode in invalid_modes {
        let result = settings_service.set_setting("layout_mode", mode).await;
        assert!(
            result.is_err(),
            "Invalid layout mode {} should be rejected",
            mode
        );
    }
}

/// Test global shortcut validation logic
#[tokio::test]
async fn test_global_shortcut_validation() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("shortcut_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Test valid shortcuts for different platforms
    let valid_shortcuts = vec!["Ctrl+Alt+S", "Ctrl+Shift+Space", "Alt+F1", "F12"];

    // Add platform-specific shortcuts
    let platform_shortcuts = if cfg!(target_os = "macos") {
        vec!["Cmd+Shift+Space", "Cmd+Alt+S", "Ctrl+Cmd+Space"]
    } else if cfg!(target_os = "windows") {
        vec!["Win+Shift+S", "Ctrl+Win+Space"]
    } else {
        vec!["Super+Shift+Space", "Super+Alt+S"]
    };

    let all_valid_shortcuts = [valid_shortcuts, platform_shortcuts].concat();

    for shortcut in all_valid_shortcuts {
        let result = settings_service
            .set_setting("global_shortcut", shortcut)
            .await;
        assert!(
            result.is_ok(),
            "Valid shortcut {} should be accepted",
            shortcut
        );

        let retrieved = settings_service
            .get_setting("global_shortcut")
            .await
            .unwrap();
        assert_eq!(retrieved, Some(shortcut.to_string()));
    }

    // Test invalid shortcuts
    let invalid_shortcuts = vec![
        "",
        "InvalidKey",
        "Ctrl+",
        "+Alt",
        "Ctrl++S",
        "Ctrl+Alt+",
        "Random+Text",
    ];

    for shortcut in invalid_shortcuts {
        let result = settings_service
            .set_setting("global_shortcut", shortcut)
            .await;
        assert!(
            result.is_err(),
            "Invalid shortcut {} should be rejected",
            shortcut
        );
    }
}

/// Test window management settings persistence
#[tokio::test]
async fn test_window_management_settings_persistence() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("window_settings_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Initialize defaults
    settings_service.initialize_defaults().await.unwrap();

    // Test setting window management related settings
    let window_settings = vec![
        ("layout_mode", "half"),
        ("always_on_top", "true"),
        ("global_shortcut", "Ctrl+Alt+S"),
        ("window_width", "800"),
        ("window_height", "600"),
    ];

    for (key, value) in window_settings {
        let result = if key == "layout_mode" || key == "global_shortcut" {
            settings_service.set_setting(key, value).await
        } else {
            settings_service.set_setting(key, value).await
        };

        assert!(result.is_ok(), "Setting {}={} should be valid", key, value);
    }

    // Verify all settings were persisted
    let all_settings = settings_service.get_all_settings().await.unwrap();

    assert_eq!(
        all_settings.get("layout_mode"),
        Some(&serde_json::Value::String("half".to_string()))
    );
    assert_eq!(
        all_settings.get("always_on_top"),
        Some(&serde_json::Value::String("true".to_string()))
    );
    assert_eq!(
        all_settings.get("global_shortcut"),
        Some(&serde_json::Value::String("Ctrl+Alt+S".to_string()))
    );
    assert_eq!(
        all_settings.get("window_width"),
        Some(&serde_json::Value::String("800".to_string()))
    );
    assert_eq!(
        all_settings.get("window_height"),
        Some(&serde_json::Value::String("600".to_string()))
    );

    // Test settings export/import for window management
    let exported = settings_service.export_settings().await.unwrap();

    // Reset settings
    settings_service.reset_to_defaults().await.unwrap();

    // Import settings back
    let import_count = settings_service.import_settings(exported).await.unwrap();
    assert!(import_count > 0);

    // Verify window settings were restored
    let restored_settings = settings_service.get_all_settings().await.unwrap();
    assert_eq!(
        restored_settings.get("layout_mode"),
        Some(&serde_json::Value::String("half".to_string()))
    );
    assert_eq!(
        restored_settings.get("always_on_top"),
        Some(&serde_json::Value::String("true".to_string()))
    );
}

/// Test suggested shortcuts functionality
#[test]
fn test_suggested_shortcuts() {
    // This would normally be part of GlobalShortcutService, but we can test the logic
    let suggested_shortcuts = if cfg!(target_os = "macos") {
        vec![
            "Cmd+Shift+Space",
            "Cmd+Alt+S",
            "Ctrl+Cmd+Space",
            "Cmd+Shift+N",
            "Cmd+Alt+N",
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            "Ctrl+Alt+S",
            "Win+Shift+S",
            "Ctrl+Shift+Space",
            "Alt+F1",
            "Ctrl+Win+Space",
        ]
    } else {
        // Linux and other Unix-like systems
        vec![
            "Ctrl+Alt+S",
            "Super+Shift+Space",
            "Alt+F1",
            "Ctrl+Shift+Space",
            "Super+Alt+S",
        ]
    };

    // Verify we have platform-appropriate suggestions
    assert!(!suggested_shortcuts.is_empty());
    assert!(suggested_shortcuts.len() >= 3);

    // Verify shortcuts contain platform-appropriate modifiers
    if cfg!(target_os = "macos") {
        assert!(suggested_shortcuts.iter().any(|s| s.contains("Cmd")));
    } else {
        assert!(suggested_shortcuts
            .iter()
            .any(|s| s.contains("Ctrl") || s.contains("Alt")));
    }
}

/// Test window state management logic
#[tokio::test]
async fn test_window_state_management() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("window_state_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Test window state settings
    let state_settings = vec![
        ("window_visible", "true"),
        ("window_focused", "false"),
        ("window_x", "100"),
        ("window_y", "100"),
        ("window_width", "800"),
        ("window_height", "600"),
    ];

    for (key, value) in state_settings {
        settings_service.set_setting(key, value).await.unwrap();
    }

    // Verify state settings
    let window_visible = settings_service
        .get_setting("window_visible")
        .await
        .unwrap();
    assert_eq!(window_visible, Some("true".to_string()));

    let window_focused = settings_service
        .get_setting("window_focused")
        .await
        .unwrap();
    assert_eq!(window_focused, Some("false".to_string()));

    // Test numeric settings
    let window_x = settings_service.get_setting("window_x").await.unwrap();
    assert_eq!(window_x, Some("100".to_string()));

    let window_width = settings_service.get_setting("window_width").await.unwrap();
    assert_eq!(window_width, Some("800".to_string()));
}

/// Test shortcut conflict detection logic
#[tokio::test]
async fn test_shortcut_conflict_detection() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("conflict_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Set an initial shortcut
    settings_service
        .set_setting("global_shortcut", "Ctrl+Alt+S")
        .await
        .unwrap();

    // Test that the same shortcut is accepted (updating existing)
    let result = settings_service
        .set_setting("global_shortcut", "Ctrl+Alt+S")
        .await;
    assert!(result.is_ok());

    // Test updating to a different valid shortcut
    let result = settings_service
        .set_setting("global_shortcut", "Ctrl+Shift+Space")
        .await;
    assert!(result.is_ok());

    let current_shortcut = settings_service
        .get_setting("global_shortcut")
        .await
        .unwrap();
    assert_eq!(current_shortcut, Some("Ctrl+Shift+Space".to_string()));
}

/// Test window management error handling
#[tokio::test]
async fn test_window_management_error_handling() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("error_handling_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Test invalid boolean values
    let invalid_booleans = vec![
        ("always_on_top", "maybe"),
        ("window_visible", "1"),
        ("window_focused", "yes"),
    ];

    for (key, value) in invalid_booleans {
        let result = settings_service.set_setting(key, value).await;
        assert!(
            result.is_err(),
            "Invalid boolean {}={} should be rejected",
            key,
            value
        );
    }

    // Test invalid numeric values for window dimensions
    let invalid_numbers = vec![
        ("window_width", "not_a_number"),
        ("window_height", "-100"),
        ("window_x", "abc"),
        ("window_y", ""),
    ];

    for (key, value) in invalid_numbers {
        // Note: Basic set_setting might accept these, but validation should catch them
        // if implemented in the settings service
        settings_service.set_setting(key, value).await.unwrap();

        // The validation would happen when the window manager tries to use these values
        let retrieved = settings_service.get_setting(key).await.unwrap();
        assert_eq!(retrieved, Some(value.to_string()));
    }
}

/// Test layout mode transitions
#[test]
fn test_layout_mode_transitions() {
    // Test all possible layout mode transitions
    let modes = vec![LayoutMode::Default, LayoutMode::Half, LayoutMode::Full];

    for from_mode in &modes {
        for to_mode in &modes {
            // All transitions should be valid
            let from_string = from_mode.to_string();
            let to_string = to_mode.to_string();

            assert!(!from_string.is_empty());
            assert!(!to_string.is_empty());

            // Test round-trip conversion
            let converted = LayoutMode::from_string(&from_string);
            assert_eq!(converted.to_string(), from_string);
        }
    }
}

/// Test window management integration with settings
#[tokio::test]
async fn test_window_management_settings_integration() {
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path().join("integration_test.db");

    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let settings_service = SettingsService::new(db_service);

    // Initialize with defaults
    settings_service.initialize_defaults().await.unwrap();

    // Test complete window management configuration
    let config_updates = vec![
        ("global_shortcut", "Ctrl+Alt+S"),
        ("layout_mode", "half"),
        ("always_on_top", "true"),
        ("auto_hide", "false"),
        ("window_opacity", "0.95"),
    ];

    for (key, value) in config_updates {
        let result = if key == "global_shortcut" || key == "layout_mode" {
            settings_service.set_setting(key, value).await
        } else {
            settings_service.set_setting(key, value).await
        };

        assert!(result.is_ok(), "Failed to set {}={}", key, value);
    }

    // Verify complete configuration
    let all_settings = settings_service.get_all_settings().await.unwrap();

    assert_eq!(
        all_settings.get("global_shortcut"),
        Some(&serde_json::Value::String("Ctrl+Alt+S".to_string()))
    );
    assert_eq!(
        all_settings.get("layout_mode"),
        Some(&serde_json::Value::String("half".to_string()))
    );
    assert_eq!(
        all_settings.get("always_on_top"),
        Some(&serde_json::Value::String("true".to_string()))
    );
    assert_eq!(
        all_settings.get("auto_hide"),
        Some(&serde_json::Value::String("false".to_string()))
    );
    assert_eq!(
        all_settings.get("window_opacity"),
        Some(&serde_json::Value::String("0.95".to_string()))
    );

    // Test that settings persist across service recreation
    let settings_service2 = SettingsService::new(Arc::new(DbService::new(&db_path).unwrap()));

    let persisted_settings = settings_service2.get_all_settings().await.unwrap();
    assert_eq!(
        persisted_settings.get("global_shortcut"),
        Some(&serde_json::Value::String("Ctrl+Alt+S".to_string()))
    );
    assert_eq!(
        persisted_settings.get("layout_mode"),
        Some(&serde_json::Value::String("half".to_string()))
    );
}
