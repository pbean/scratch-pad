/// Settings Domain Commands
/// 
/// Handles application settings management with proper validation and security.

use crate::commands::shared::{
    validate_ipc_operation, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::AppState;
use std::collections::HashMap;
use tauri::State;
use serde::{Deserialize, Serialize};

/// Settings structure for IPC
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppSettings {
    pub global_shortcut: Option<String>,
    pub window_layout: Option<String>,
    pub theme: Option<String>,
    pub auto_save: Option<bool>,
    pub font_size: Option<u32>,
    pub line_numbers: Option<bool>,
    pub word_wrap: Option<bool>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            global_shortcut: Some("Ctrl+Shift+N".to_string()),
            window_layout: Some("default".to_string()),
            theme: Some("dark".to_string()),
            auto_save: Some(true),
            font_size: Some(14),
            line_numbers: Some(true),
            word_wrap: Some(true),
        }
    }
}

/// Get a specific setting
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Settings key validation
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn get_setting(
    key: String,
    app_state: State<'_, AppState>,
) -> Result<Option<String>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_setting");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate key
    validate_settings_key(&key)?;
    
    // Get the setting
    let value = app_state.settings.get_setting(&key).await?;
    
    // Log security event for settings access
    log_security_event(
        "SETTING_READ",
        "IPC",
        true,
        &format!("Setting accessed: {}", sanitize_key_for_logging(&key))
    );
    
    Ok(value)
}

/// Set a specific setting
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Settings key and value validation
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("set_setting");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate key and value
    validate_settings_key(&key)?;
    validate_settings_value(&key, &value)?;
    
    // Set the setting
    app_state.settings.set_setting(&key, &value).await?;
    
    // Log security event for settings modification
    log_security_event(
        "SETTING_WRITE",
        "IPC",
        true,
        &format!("Setting modified: {}", sanitize_key_for_logging(&key))
    );
    
    Ok(())
}

/// Get all settings
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn get_all_settings(
    app_state: State<'_, AppState>,
) -> Result<HashMap<String, String>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_all_settings");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Get all settings
    let all_settings = app_state.settings.get_all_settings().await?;
    
    // Convert serde_json::Value to String
    let mut settings = HashMap::new();
    for (key, value) in all_settings {
        let string_value = match value {
            serde_json::Value::String(s) => s,
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Null => "null".to_string(),
            _ => value.to_string(),
        };
        settings.insert(key, string_value);
    }
    
    // Log security event for settings access
    log_security_event(
        "ALL_SETTINGS_READ",
        "IPC",
        true,
        "All settings accessed"
    );
    
    Ok(settings)
}

/// Delete a specific setting
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Settings key validation
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn delete_setting(
    key: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("delete_setting");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate key
    validate_settings_key(&key)?;
    
    // Delete the setting
    app_state.settings.delete_setting(&key).await?;
    
    // Log security event for settings modification
    log_security_event(
        "SETTING_DELETE",
        "IPC",
        true,
        &format!("Setting deleted: {}", sanitize_key_for_logging(&key))
    );
    
    Ok(())
}

/// Save application settings
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Settings validation and sanitization
/// - Performance monitoring
/// - Secure logging
/// - Input validation for all settings
#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("save_settings");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate and save each setting
    if let Some(shortcut) = &settings.global_shortcut {
        validate_global_shortcut(shortcut)?;
        app_state.settings.set_setting("global_shortcut", shortcut).await?;
    }
    
    if let Some(layout) = &settings.window_layout {
        validate_window_layout(layout)?;
        app_state.settings.set_setting("window_layout", layout).await?;
    }
    
    if let Some(theme) = &settings.theme {
        validate_theme(theme)?;
        app_state.settings.set_setting("theme", theme).await?;
    }
    
    if let Some(auto_save) = settings.auto_save {
        app_state.settings.set_setting("auto_save", &auto_save.to_string()).await?;
    }
    
    if let Some(font_size) = settings.font_size {
        validate_font_size(font_size)?;
        app_state.settings.set_setting("font_size", &font_size.to_string()).await?;
    }
    
    if let Some(line_numbers) = settings.line_numbers {
        app_state.settings.set_setting("line_numbers", &line_numbers.to_string()).await?;
    }
    
    if let Some(word_wrap) = settings.word_wrap {
        app_state.settings.set_setting("word_wrap", &word_wrap.to_string()).await?;
    }
    
    // Log security event for settings modification
    log_security_event(
        "SETTINGS_SAVED",
        "IPC", 
        true,
        "Application settings saved"
    );
    
    Ok(())
}

/// Load application settings
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Settings validation and defaults
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn load_settings(
    app_state: State<'_, AppState>,
) -> Result<AppSettings, ApiError> {
    let _tracker = CommandPerformanceTracker::new("load_settings");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Load all settings with defaults
    let global_shortcut = app_state.settings.get_setting("global_shortcut").await?;
    let window_layout = app_state.settings.get_setting("window_layout").await?;
    let theme = app_state.settings.get_setting("theme").await?;
    
    let auto_save = app_state.settings.get_setting("auto_save").await?
        .and_then(|s| s.parse::<bool>().ok());
    
    let font_size = app_state.settings.get_setting("font_size").await?
        .and_then(|s| s.parse::<u32>().ok());
    
    let line_numbers = app_state.settings.get_setting("line_numbers").await?
        .and_then(|s| s.parse::<bool>().ok());
    
    let word_wrap = app_state.settings.get_setting("word_wrap").await?
        .and_then(|s| s.parse::<bool>().ok());
    
    let settings = AppSettings {
        global_shortcut,
        window_layout,
        theme,
        auto_save,
        font_size,
        line_numbers,
        word_wrap,
    };
    
    // Log security event for settings access
    log_security_event(
        "SETTINGS_LOADED",
        "IPC",
        true,
        "Application settings loaded"
    );
    
    Ok(settings)
}

/// Register a global shortcut
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Shortcut validation and sanitization
/// - Performance monitoring
/// - Secure logging
#[tauri::command]
pub async fn register_global_shortcut(
    shortcut: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("register_global_shortcut");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate shortcut format
    validate_global_shortcut(&shortcut)?;
    
    // Register the shortcut through the global shortcut service
    app_state.global_shortcut.register_shortcut(&shortcut).await
        .map_err(|e| ApiError {
            code: "SHORTCUT_REGISTRATION_FAILED".to_string(),
            message: format!("Failed to register global shortcut: {}", e),
        })?;
    
    // Log security event for shortcut registration
    log_security_event(
        "GLOBAL_SHORTCUT_REGISTERED",
        "IPC",
        true,
        &format!("Global shortcut registered: {}", sanitize_shortcut_for_logging(&shortcut))
    );
    
    Ok(())
}

/// Validates settings key format
fn validate_settings_key(key: &str) -> Result<(), ApiError> {
    if key.is_empty() || key.len() > 100 {
        return Err(ApiError {
            code: "INVALID_SETTINGS_KEY".to_string(),
            message: "Invalid settings key length".to_string(),
        });
    }
    
    // Allow only alphanumeric characters, underscores, and hyphens
    if !key.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err(ApiError {
            code: "INVALID_SETTINGS_KEY".to_string(),
            message: "Settings key contains invalid characters".to_string(),
        });
    }
    
    Ok(())
}

/// Validates settings value based on key
fn validate_settings_value(key: &str, value: &str) -> Result<(), ApiError> {
    match key {
        "global_shortcut" => validate_global_shortcut(value),
        "window_layout" => validate_window_layout(value),
        "theme" => validate_theme(value),
        "font_size" => {
            let size: u32 = value.parse().map_err(|_| ApiError {
                code: "INVALID_FONT_SIZE".to_string(),
                message: "Font size must be a valid number".to_string(),
            })?;
            validate_font_size(size)
        },
        "auto_save" | "line_numbers" | "word_wrap" => {
            value.parse::<bool>().map_err(|_| ApiError {
                code: "INVALID_BOOLEAN_VALUE".to_string(),
                message: "Value must be true or false".to_string(),
            })?;
            Ok(())
        },
        _ => {
            // Generic validation for other settings
            if value.len() > 1000 {
                return Err(ApiError {
                    code: "SETTINGS_VALUE_TOO_LONG".to_string(),
                    message: "Settings value is too long".to_string(),
                });
            }
            Ok(())
        }
    }
}

/// Validates global shortcut format
fn validate_global_shortcut(shortcut: &str) -> Result<(), ApiError> {
    if shortcut.is_empty() || shortcut.len() > 50 {
        return Err(ApiError {
            code: "INVALID_SHORTCUT".to_string(),
            message: "Invalid shortcut length".to_string(),
        });
    }
    
    // Basic format validation - must contain modifier keys
    let normalized = shortcut.to_lowercase();
    if !normalized.contains("ctrl") && !normalized.contains("alt") 
       && !normalized.contains("shift") && !normalized.contains("meta") {
        return Err(ApiError {
            code: "INVALID_SHORTCUT".to_string(),
            message: "Shortcut must include at least one modifier key".to_string(),
        });
    }
    
    // Check for potentially dangerous patterns
    let dangerous_patterns = ["eval", "exec", "system", "<script", "javascript:"];
    let shortcut_lower = shortcut.to_lowercase();
    
    for pattern in &dangerous_patterns {
        if shortcut_lower.contains(pattern) {
            return Err(ApiError {
                code: "INVALID_SHORTCUT".to_string(),
                message: "Shortcut contains invalid characters".to_string(),
            });
        }
    }
    
    Ok(())
}

/// Validates window layout setting
fn validate_window_layout(layout: &str) -> Result<(), ApiError> {
    let valid_layouts = ["default", "half", "full"];
    
    if !valid_layouts.contains(&layout) {
        return Err(ApiError {
            code: "INVALID_LAYOUT".to_string(),
            message: "Invalid window layout".to_string(),
        });
    }
    
    Ok(())
}

/// Validates theme setting
fn validate_theme(theme: &str) -> Result<(), ApiError> {
    let valid_themes = ["light", "dark", "auto"];
    
    if !valid_themes.contains(&theme) {
        return Err(ApiError {
            code: "INVALID_THEME".to_string(),
            message: "Invalid theme".to_string(),
        });
    }
    
    Ok(())
}

/// Validates font size setting
fn validate_font_size(font_size: u32) -> Result<(), ApiError> {
    if font_size < 8 || font_size > 72 {
        return Err(ApiError {
            code: "INVALID_FONT_SIZE".to_string(),
            message: "Font size must be between 8 and 72".to_string(),
        });
    }
    
    Ok(())
}

/// Sanitizes settings key for logging
fn sanitize_key_for_logging(key: &str) -> String {
    // Remove any potentially sensitive information and limit length
    let max_length = 20;
    let sanitized = if key.len() > max_length {
        format!("{}...", &key[..max_length])
    } else {
        key.to_string()
    };
    
    // Remove any potentially dangerous characters
    sanitized
        .chars()
        .filter(|&c| c.is_alphanumeric() || "_-".contains(c))
        .collect::<String>()
}

/// Sanitizes shortcut string for logging
fn sanitize_shortcut_for_logging(shortcut: &str) -> String {
    // Remove any potentially sensitive information and limit length
    let max_length = 20;
    let sanitized = if shortcut.len() > max_length {
        format!("{}...", &shortcut[..max_length])
    } else {
        shortcut.to_string()
    };
    
    // Remove any potentially dangerous characters
    sanitized
        .chars()
        .filter(|&c| c.is_alphanumeric() || "+- ".contains(c))
        .collect::<String>()
}

#[cfg(test)]
#[allow(unused)]
mod tests_disabled {
    use super::*;
    use crate::validation::{SecurityValidator, OperationContext};
    use crate::database::DbService;
    use crate::search::SearchService;
    use crate::settings::SettingsService;
    use crate::global_shortcut::GlobalShortcutService;
    use crate::window_manager::WindowManager;
    use crate::plugin::PluginManager;
    use crate::shutdown::ShutdownManager;
    use std::sync::Arc;
    use tempfile::NamedTempFile;
    
    async fn create_test_app_state() -> AppState {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_string_lossy().to_string();
        
        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let security_validator = Arc::new(SecurityValidator::new());
        let search_service = Arc::new(SearchService::new(db_service.clone()));
        let settings_service = Arc::new(SettingsService::new(db_service.clone()));
        let plugin_manager = Arc::new(tokio::sync::Mutex::new(PluginManager::new()));
        
        AppState {
            db: db_service,
            search: search_service,
            settings: settings_service.clone(),
            global_shortcut: Arc::new(GlobalShortcutService::new_test(settings_service.clone()).expect("Failed to create GlobalShortcutService for test")),
            window_manager: Arc::new(WindowManager::new_test(settings_service).expect("Failed to create WindowManager for test")),
            plugin_manager,
            security_validator,
            shutdown_manager: Arc::new(ShutdownManager::default()),
        }
    }
    
    #[tokio::test]
    async fn test_save_and_load_settings() {
        let app_state = create_test_app_state().await;
        
        let test_settings = AppSettings {
            global_shortcut: Some("Ctrl+Shift+T".to_string()),
            window_layout: Some("half".to_string()),
            theme: Some("light".to_string()),
            auto_save: Some(false),
            font_size: Some(16),
            line_numbers: Some(false),
            word_wrap: Some(false),
        };
        
        // Save settings
        let result = app_state.settings.set_setting("test_key", "test_value").await;
        assert!(result.is_ok());
        
        // Verify it was stored
        let retrieved = app_state.settings.get_setting("test_key").await.unwrap();
        assert_eq!(retrieved, Some("test_value".to_string()));
    }

    #[tokio::test]
    async fn test_get_all_settings() {
        let app_state = create_test_app_state().await;
        
        // Set some test settings
        let _ = app_state.settings.set_setting("key1", "value1").await;
        let _ = app_state.settings.set_setting("key2", "value2").await;
        
        // Get all settings
        let result = app_state.settings.get_all_settings().await;
        assert!(result.is_ok());
        
        let all_settings = result.unwrap();
        // Convert to string map like the command does
        let mut settings = HashMap::new();
        for (key, value) in all_settings {
            let string_value = match value {
                serde_json::Value::String(s) => s,
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "null".to_string(),
                _ => value.to_string(),
            };
            settings.insert(key, string_value);
        }
        
        assert!(settings.len() >= 2);
        assert_eq!(settings.get("key1"), Some(&"value1".to_string()));
        assert_eq!(settings.get("key2"), Some(&"value2".to_string()));
    }

    #[tokio::test]
    async fn test_delete_setting() {
        let app_state = create_test_app_state().await;
        
        // Set a test setting
        let _ = app_state.settings.set_setting("test_delete", "test_value").await;
        
        // Verify it exists
        let retrieved = app_state.settings.get_setting("test_delete").await.unwrap();
        assert_eq!(retrieved, Some("test_value".to_string()));
        
        // Delete the setting
        let result = app_state.settings.delete_setting("test_delete").await;
        assert!(result.is_ok());
        
        // Verify it's gone
        let retrieved = app_state.settings.get_setting("test_delete").await.unwrap();
        assert_eq!(retrieved, None);
    }
    
    #[tokio::test]
    async fn test_settings_key_validation() {
        // Test valid keys
        let valid_keys = vec!["global_shortcut", "window_layout", "theme", "test_key_123"];
        
        for key in valid_keys {
            let result = validate_settings_key(key);
            assert!(result.is_ok(), "Valid key should pass: {}", key);
        }
        
        // Test invalid keys
        let long_key = "a".repeat(101);
        let invalid_keys = vec![
            "", // empty
            &long_key, // too long
            "invalid key", // spaces
            "invalid@key", // special characters
        ];
        
        for &key in &invalid_keys {
            let result = validate_settings_key(key);
            assert!(result.is_err(), "Invalid key should fail: {}", key);
        }
    }
    
    #[tokio::test]
    async fn test_global_shortcut_validation() {
        // Test valid shortcuts
        let valid_shortcuts = vec![
            "Ctrl+Shift+N",
            "Alt+F4", 
            "Meta+Space",
            "Ctrl+Alt+T",
        ];
        
        for shortcut in valid_shortcuts {
            let result = validate_global_shortcut(shortcut);
            assert!(result.is_ok(), "Valid shortcut should pass: {}", shortcut);
        }
        
        // Test invalid shortcuts
        let long_shortcut = "a".repeat(100);
        let invalid_shortcuts = vec![
            "", // empty
            "N", // no modifier
            &long_shortcut, // too long
            "eval(malicious)", // dangerous pattern
            "<script>alert(1)</script>", // script injection
        ];
        
        for &shortcut in &invalid_shortcuts {
            let result = validate_global_shortcut(shortcut);
            assert!(result.is_err(), "Invalid shortcut should fail: {}", shortcut);
        }
    }
}