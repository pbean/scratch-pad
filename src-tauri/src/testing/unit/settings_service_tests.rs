/// Unit Tests for SettingsService Business Logic
/// 
/// These tests focus on testing the SettingsService business logic in isolation
/// using mock repository dependencies. This enables fast, reliable testing
/// without database dependencies while maintaining all security validation.

use crate::error::AppError;
use crate::settings::{SettingsService, get_default_settings};
use std::sync::Arc;
use tokio;

/// Test helper to create a SettingsService with real dependencies for business logic testing
async fn create_test_settings_service() -> Result<SettingsService, AppError> {
    use tempfile::NamedTempFile;
    use crate::database::DbService;
    
    let temp_file = NamedTempFile::new().unwrap();
    let db_path = temp_file.path().to_string_lossy().to_string();
    let db_service = Arc::new(DbService::new(&db_path)?);
    
    Ok(SettingsService::new(db_service))
}

/// Tests for SettingsService business logic using real service with temporary database
mod settings_service_integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_settings_service_basic_operations() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test setting and getting a value
        settings_service.set_setting("test_key", "test_value").await?;
        let value = settings_service.get_setting("test_key").await?;
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test has_setting
        assert!(settings_service.has_setting("test_key").await?);
        assert!(!settings_service.has_setting("nonexistent_key").await?);
        
        // Test getting non-existent setting
        let no_value = settings_service.get_setting("nonexistent").await?;
        assert!(no_value.is_none());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_typed_operations() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test boolean settings
        settings_service.set_bool_setting("test_bool", true).await?;
        let bool_value = settings_service.get_bool_setting("test_bool").await?;
        assert_eq!(bool_value, Some(true));
        
        settings_service.set_bool_setting("test_bool_false", false).await?;
        let bool_value = settings_service.get_bool_setting("test_bool_false").await?;
        assert_eq!(bool_value, Some(false));
        
        // Test integer settings
        settings_service.set_int_setting("test_int", 42).await?;
        let int_value = settings_service.get_int_setting("test_int").await?;
        assert_eq!(int_value, Some(42));
        
        // Test negative integer
        settings_service.set_int_setting("test_negative", -100).await?;
        let neg_value = settings_service.get_int_setting("test_negative").await?;
        assert_eq!(neg_value, Some(-100));
        
        // Test float settings
        settings_service.set_float_setting("test_float", 3.14).await?;
        let float_value = settings_service.get_float_setting("test_float").await?;
        assert_eq!(float_value, Some(3.14));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_generic_operations() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test get_setting_as with valid type
        settings_service.set_setting("test_number", "123").await?;
        let number: Option<i32> = settings_service.get_setting_as("test_number").await?;
        assert_eq!(number, Some(123));
        
        // Test set_setting_from with serializable type
        let test_data = vec![1, 2, 3, 4, 5];
        settings_service.set_setting_from("test_array", &test_data).await?;
        let stored_value = settings_service.get_setting("test_array").await?;
        assert!(stored_value.is_some());
        
        // Verify the stored value can be parsed back
        let parsed_data: Vec<i32> = serde_json::from_str(&stored_value.unwrap())?;
        assert_eq!(parsed_data, test_data);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_default_settings() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Initialize defaults
        settings_service.initialize_defaults().await?;
        
        // Check that some default settings exist
        assert!(settings_service.has_setting("window.width").await?);
        assert!(settings_service.has_setting("theme.mode").await?);
        assert!(settings_service.has_setting("editor.auto_save").await?);
        
        // Get specific default values
        let window_width = settings_service.get_setting("window.width").await?;
        assert_eq!(window_width, Some("800".to_string()));
        
        let theme_mode = settings_service.get_setting("theme.mode").await?;
        assert_eq!(theme_mode, Some("auto".to_string()));
        
        // Test that initializing defaults doesn't overwrite existing settings
        settings_service.set_setting("window.width", "1200").await?;
        settings_service.initialize_defaults().await?;
        let width_after = settings_service.get_setting("window.width").await?;
        assert_eq!(width_after, Some("1200".to_string())); // Should remain unchanged
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_get_all_settings() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set various types of settings
        settings_service.set_setting("string_setting", "value").await?;
        settings_service.set_setting("number_setting", "42").await?;
        settings_service.set_setting("json_setting", r#"{"key": "value"}"#).await?;
        
        // Get all settings
        let all_settings = settings_service.get_all_settings().await?;
        
        assert!(all_settings.contains_key("string_setting"));
        assert!(all_settings.contains_key("number_setting"));
        assert!(all_settings.contains_key("json_setting"));
        
        // Verify JSON parsing
        if let Some(json_value) = all_settings.get("json_setting") {
            assert!(json_value.is_object());
        }
        
        // Verify string value preservation
        if let Some(string_value) = all_settings.get("string_setting") {
            assert_eq!(string_value.as_str(), Some("value"));
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_delete_operations() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some settings
        settings_service.set_setting("to_delete", "value").await?;
        settings_service.set_setting("to_keep", "keep_this").await?;
        
        // Verify settings exist
        assert!(settings_service.has_setting("to_delete").await?);
        assert!(settings_service.has_setting("to_keep").await?);
        
        // Delete one setting
        settings_service.delete_setting("to_delete").await?;
        
        // Verify deletion
        assert!(!settings_service.has_setting("to_delete").await?);
        assert!(settings_service.has_setting("to_keep").await?);
        
        // Test deleting non-existent setting (should not error)
        settings_service.delete_setting("nonexistent").await?;
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_reset_to_defaults() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some custom settings
        settings_service.set_setting("custom_setting", "custom_value").await?;
        settings_service.set_setting("window.width", "1920").await?;
        
        // Verify custom settings exist
        assert!(settings_service.has_setting("custom_setting").await?);
        let width = settings_service.get_setting("window.width").await?;
        assert_eq!(width, Some("1920".to_string()));
        
        // Reset to defaults
        settings_service.reset_to_defaults().await?;
        
        // Verify custom setting is gone
        assert!(!settings_service.has_setting("custom_setting").await?);
        
        // Verify default setting is restored
        let width = settings_service.get_setting("window.width").await?;
        assert_eq!(width, Some("800".to_string())); // Default value
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_get_setting_or_default() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test with existing setting
        settings_service.set_setting("existing", "value").await?;
        let result = settings_service.get_setting_or_default("existing", "default").await?;
        assert_eq!(result, "value");
        
        // Test with non-existing setting
        let result = settings_service.get_setting_or_default("nonexistent", "default").await?;
        assert_eq!(result, "default");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_validation() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test valid setting (should succeed)
        let result = settings_service.set_setting("valid_key", "valid_value").await;
        assert!(result.is_ok());
        
        // Test invalid key (empty)
        let result = settings_service.set_setting("", "value").await;
        assert!(result.is_err());
        
        // Test invalid key (whitespace only)
        let result = settings_service.set_setting("   ", "value").await;
        assert!(result.is_err());
        
        // Test key validation with special characters (if implemented)
        // Note: This depends on the actual validation implementation
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_boolean_parsing() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test various boolean representations
        let test_cases = vec![
            ("true", Some(true)),
            ("1", Some(true)),
            ("yes", Some(true)),
            ("on", Some(true)),
            ("TRUE", Some(true)),
            ("false", Some(false)),
            ("0", Some(false)),
            ("no", Some(false)),
            ("off", Some(false)),
            ("FALSE", Some(false)),
        ];
        
        for (input, expected) in test_cases {
            settings_service.set_setting("test_bool", input).await?;
            let result = settings_service.get_bool_setting("test_bool").await?;
            assert_eq!(result, expected, "Failed for input: {}", input);
        }
        
        // Test invalid boolean value
        settings_service.set_setting("invalid_bool", "maybe").await?;
        let result = settings_service.get_bool_setting("invalid_bool").await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_numeric_parsing() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test parse_numeric_setting
        let result = settings_service.parse_numeric_setting("test", "42.5");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42.5);
        
        // Test invalid numeric value
        let result = settings_service.parse_numeric_setting("test", "not_a_number");
        assert!(result.is_err());
        
        // Test parsing with get_setting_as
        settings_service.set_setting("test_float", "3.14159").await?;
        let float_value: Option<f64> = settings_service.get_setting_as("test_float").await?;
        assert_eq!(float_value, Some(3.14159));
        
        // Test parsing invalid format
        settings_service.set_setting("invalid_number", "not_a_number").await?;
        let result: Result<Option<f64>, AppError> = settings_service.get_setting_as("invalid_number").await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_flush_pending_changes() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some settings
        settings_service.set_setting("flush_test", "value").await?;
        
        // Test flush operation (should not fail)
        let result = settings_service.flush_pending_changes().await;
        assert!(result.is_ok());
        
        // Verify setting still exists after flush
        let value = settings_service.get_setting("flush_test").await?;
        assert_eq!(value, Some("value".to_string()));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_export_import() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some test settings
        settings_service.set_setting("export_test1", "value1").await?;
        settings_service.set_setting("export_test2", "value2").await?;
        settings_service.set_bool_setting("export_bool", true).await?;
        settings_service.set_int_setting("export_int", 42).await?;
        
        // Export to temporary file
        let temp_dir = tempfile::tempdir().unwrap();
        let export_file = temp_dir.path().join("settings.json");
        settings_service.export_settings(&export_file.to_string_lossy()).await?;
        
        // Verify file was created
        assert!(export_file.exists());
        
        // Clear settings
        settings_service.delete_setting("export_test1").await?;
        settings_service.delete_setting("export_test2").await?;
        settings_service.delete_setting("export_bool").await?;
        settings_service.delete_setting("export_int").await?;
        
        // Verify settings are gone
        assert!(!settings_service.has_setting("export_test1").await?);
        assert!(!settings_service.has_setting("export_test2").await?);
        
        // Import settings
        settings_service.import_settings(&export_file.to_string_lossy()).await?;
        
        // Verify settings were restored
        let value1 = settings_service.get_setting("export_test1").await?;
        assert_eq!(value1, Some("value1".to_string()));
        
        let value2 = settings_service.get_setting("export_test2").await?;
        assert_eq!(value2, Some("value2".to_string()));
        
        // Note: Boolean and integer values will be imported as strings
        // and need to be parsed using the appropriate methods
        assert!(settings_service.has_setting("export_bool").await?);
        assert!(settings_service.has_setting("export_int").await?);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_error_handling() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test setting with empty key
        let result = settings_service.set_setting("", "value").await;
        assert!(result.is_err());
        
        // Test getting setting after error (should still work)
        settings_service.set_setting("valid_key", "valid_value").await?;
        let value = settings_service.get_setting("valid_key").await?;
        assert_eq!(value, Some("valid_value".to_string()));
        
        // Test importing from non-existent file
        let result = settings_service.import_settings("/nonexistent/file.json").await;
        assert!(result.is_err());
        
        // Test exporting to invalid path (if applicable)
        let _result = settings_service.export_settings("/invalid/path/file.json").await;
        // May succeed or fail depending on system permissions
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_concurrency() -> Result<(), AppError> {
        let settings_service = Arc::new(create_test_settings_service().await?);
        
        // Test concurrent setting operations
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let service = Arc::clone(&settings_service);
                tokio::spawn(async move {
                    service.set_setting(&format!("concurrent_key_{}", i), &format!("value_{}", i)).await
                })
            })
            .collect();
        
        // Wait for all operations to complete
        for handle in handles {
            handle.await.unwrap()?;
        }
        
        // Verify all settings were created
        for i in 0..10 {
            let value = settings_service.get_setting(&format!("concurrent_key_{}", i)).await?;
            assert_eq!(value, Some(format!("value_{}", i)));
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_edge_cases() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test very long setting value
        let long_value = "x".repeat(1000);
        let result = settings_service.set_setting("long_value", &long_value).await;
        assert!(result.is_ok()); // Should handle reasonable length values
        
        // Test special characters in value
        let special_value = "Value with unicode: 🦀 and newlines:\nLine 2\tTabbed";
        settings_service.set_setting("special_value", special_value).await?;
        let retrieved = settings_service.get_setting("special_value").await?;
        assert_eq!(retrieved, Some(special_value.to_string()));
        
        // Test JSON-like value that's not valid JSON
        let pseudo_json = r#"{"incomplete": json"#;
        settings_service.set_setting("pseudo_json", pseudo_json).await?;
        let retrieved = settings_service.get_setting("pseudo_json").await?;
        assert_eq!(retrieved, Some(pseudo_json.to_string()));
        
        // Test numeric string handling
        settings_service.set_setting("numeric_string", "123.456").await?;
        let as_float: Option<f64> = settings_service.get_setting_as("numeric_string").await?;
        assert_eq!(as_float, Some(123.456));
        
        Ok(())
    }
}

/// Tests for default settings functionality
mod default_settings_tests {
    use super::*;
    
    #[test]
    fn test_default_settings_structure() {
        let defaults = get_default_settings();
        
        // Verify essential default settings exist
        assert!(defaults.contains_key("window.width"));
        assert!(defaults.contains_key("window.height"));
        assert!(defaults.contains_key("theme.mode"));
        assert!(defaults.contains_key("editor.auto_save"));
        assert!(defaults.contains_key("search.max_results"));
        
        // Verify default values are reasonable
        assert_eq!(defaults.get("window.width"), Some(&"800".to_string()));
        assert_eq!(defaults.get("window.height"), Some(&"600".to_string()));
        assert_eq!(defaults.get("theme.mode"), Some(&"auto".to_string()));
        assert_eq!(defaults.get("editor.auto_save"), Some(&"true".to_string()));
        
        // Verify all values are non-empty strings
        for (key, value) in &defaults {
            assert!(!key.is_empty(), "Default setting key should not be empty");
            assert!(!value.is_empty(), "Default setting value should not be empty for key: {}", key);
        }
    }
    
    #[test]
    fn test_default_settings_categories() {
        let defaults = get_default_settings();
        
        // Count settings by category
        let window_settings: Vec<_> = defaults.keys().filter(|k| k.starts_with("window.")).collect();
        let theme_settings: Vec<_> = defaults.keys().filter(|k| k.starts_with("theme.")).collect();
        let editor_settings: Vec<_> = defaults.keys().filter(|k| k.starts_with("editor.")).collect();
        let search_settings: Vec<_> = defaults.keys().filter(|k| k.starts_with("search.")).collect();
        let general_settings: Vec<_> = defaults.keys().filter(|k| k.starts_with("general.")).collect();
        
        // Verify each category has settings
        assert!(!window_settings.is_empty(), "Should have window settings");
        assert!(!theme_settings.is_empty(), "Should have theme settings");
        assert!(!editor_settings.is_empty(), "Should have editor settings");
        assert!(!search_settings.is_empty(), "Should have search settings");
        assert!(!general_settings.is_empty(), "Should have general settings");
        
        // Verify total number of defaults is reasonable
        assert!(defaults.len() >= 20, "Should have at least 20 default settings");
        assert!(defaults.len() <= 50, "Should have at most 50 default settings");
    }
    
    #[test]
    fn test_default_settings_data_types() {
        let defaults = get_default_settings();
        
        // Test boolean-like values
        let bool_keys = ["window.always_on_top", "editor.auto_save", "search.case_sensitive"];
        for key in &bool_keys {
            if let Some(value) = defaults.get(*key) {
                assert!(
                    value == "true" || value == "false",
                    "Boolean setting '{}' should have 'true' or 'false' value, got: '{}'",
                    key, value
                );
            }
        }
        
        // Test numeric-like values
        let numeric_keys = ["window.width", "window.height", "theme.font_size", "search.max_results"];
        for key in &numeric_keys {
            if let Some(value) = defaults.get(*key) {
                assert!(
                    value.parse::<i32>().is_ok(),
                    "Numeric setting '{}' should be parseable as integer, got: '{}'",
                    key, value
                );
            }
        }
        
        // Test string values
        let string_keys = ["theme.mode", "theme.accent_color", "editor.default_format"];
        for key in &string_keys {
            if let Some(value) = defaults.get(*key) {
                assert!(
                    !value.is_empty() && value.len() > 2,
                    "String setting '{}' should be non-empty with reasonable length, got: '{}'",
                    key, value
                );
            }
        }
    }
}