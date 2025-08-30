/// Unit Tests for SettingsService Business Logic
/// 
/// These tests focus on testing the SettingsService business logic in isolation
/// using real service with temporary database. This enables comprehensive testing
/// of settings functionality while maintaining all security validation.

use crate::error::AppError;
use crate::settings::SettingsService;
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
        
        // Test boolean settings - Fixed: use actual method signature
        settings_service.set_bool_setting("bool_key", true).await?;
        let bool_value = settings_service.get_bool_setting("bool_key").await?;
        assert_eq!(bool_value, Some(true));
        
        // Test integer settings - Fixed: use actual method signature
        settings_service.set_int_setting("int_key", 42).await?;
        let int_value = settings_service.get_int_setting("int_key").await?;
        assert_eq!(int_value, Some(42));
        
        // Test float settings - Fixed: use actual method signature
        settings_service.set_float_setting("float_key", 3.14).await?;
        let float_value = settings_service.get_float_setting("float_key").await?;
        assert!((float_value.unwrap_or(0.0) - 3.14).abs() < 0.001);
        
        // Test string settings via generic set_setting
        settings_service.set_setting("string_key", "test_string").await?;
        let string_value = settings_service.get_setting("string_key").await?;
        assert_eq!(string_value, Some("test_string".to_string()));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_defaults() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test getting non-existent values (returns None)
        let bool_default = settings_service.get_bool_setting("non_existent_bool").await?;
        assert_eq!(bool_default, None);
        
        let int_default = settings_service.get_int_setting("non_existent_int").await?;
        assert_eq!(int_default, None);
        
        let float_default = settings_service.get_float_setting("non_existent_float").await?;
        assert_eq!(float_default, None);
        
        let string_default = settings_service.get_setting("non_existent_string").await?;
        assert_eq!(string_default, None);
        
        // Test with get_setting_or_default for fallback values
        let string_with_default = settings_service.get_setting_or_default("non_existent_string", "default_value").await?;
        assert_eq!(string_with_default, "default_value");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_delete_operations() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Create a setting
        settings_service.set_setting("delete_test", "value").await?;
        assert!(settings_service.has_setting("delete_test").await?);
        
        // Delete the setting
        settings_service.delete_setting("delete_test").await?;
        assert!(!settings_service.has_setting("delete_test").await?);
        
        // Test deleting non-existent setting (should not error)
        let result = settings_service.delete_setting("non_existent").await;
        assert!(result.is_ok());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_get_all_settings() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set multiple settings
        settings_service.set_setting("key1", "value1").await?;
        settings_service.set_setting("key2", "value2").await?;
        settings_service.set_bool_setting("bool_key", false).await?;
        settings_service.set_int_setting("int_key", 123).await?;
        
        // Get all settings
        let all_settings = settings_service.get_all_settings().await?;
        
        // Verify settings are present
        assert!(all_settings.contains_key("key1"));
        assert!(all_settings.contains_key("key2"));
        assert!(all_settings.contains_key("bool_key"));
        assert!(all_settings.contains_key("int_key"));
        
        // Verify values (stored as JSON values)
        assert_eq!(all_settings.get("key1"), Some(&serde_json::Value::String("value1".to_string())));
        assert_eq!(all_settings.get("key2"), Some(&serde_json::Value::String("value2".to_string())));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_reset_to_defaults() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some custom settings
        settings_service.set_setting("custom1", "value1").await?;
        settings_service.set_setting("custom2", "value2").await?;
        
        // Verify they exist
        assert!(settings_service.has_setting("custom1").await?);
        assert!(settings_service.has_setting("custom2").await?);
        
        // Reset to defaults - Fixed: doesn't return count, just ()
        settings_service.reset_to_defaults().await?;
        
        // Custom settings should be gone (they get cleared during reset)
        assert!(!settings_service.has_setting("custom1").await?);
        assert!(!settings_service.has_setting("custom2").await?);
        
        // Default settings should be present
        let all_settings = settings_service.get_all_settings().await?;
        assert!(!all_settings.is_empty()); // Should have default settings
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_json_export_import() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some test settings
        settings_service.set_setting("export_test1", "value1").await?;
        settings_service.set_setting("export_test2", "value2").await?;
        settings_service.set_bool_setting("export_bool", true).await?;
        settings_service.set_int_setting("export_int", 42).await?;
        
        // Export settings as JSON string - Fixed: no arguments
        let json_export = settings_service.export_settings().await?;
        assert!(!json_export.is_empty());
        assert!(json_export.contains("export_test1"));
        assert!(json_export.contains("value1"));
        
        // Clear settings
        settings_service.delete_setting("export_test1").await?;
        settings_service.delete_setting("export_test2").await?;
        settings_service.delete_setting("export_bool").await?;
        settings_service.delete_setting("export_int").await?;
        
        // Verify settings are gone
        assert!(!settings_service.has_setting("export_test1").await?);
        assert!(!settings_service.has_setting("export_test2").await?);
        
        // Import settings from JSON string - Fixed: pass String instead of &str
        let imported_count = settings_service.import_settings(json_export).await?;
        assert!(imported_count >= 4);
        
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
    async fn test_settings_service_file_export_import() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Set some test settings
        settings_service.set_setting("file_test1", "value1").await?;
        settings_service.set_setting("file_test2", "value2").await?;
        settings_service.set_bool_setting("file_bool", true).await?;
        settings_service.set_int_setting("file_int", 42).await?;
        
        // Export to temporary file
        let temp_dir = tempfile::tempdir().unwrap();
        let export_file = temp_dir.path().join("settings.json");
        settings_service.export_settings_to_file(&export_file.to_string_lossy()).await?;
        
        // Verify file was created
        assert!(export_file.exists());
        
        // Clear settings
        settings_service.delete_setting("file_test1").await?;
        settings_service.delete_setting("file_test2").await?;
        settings_service.delete_setting("file_bool").await?;
        settings_service.delete_setting("file_int").await?;
        
        // Verify settings are gone
        assert!(!settings_service.has_setting("file_test1").await?);
        assert!(!settings_service.has_setting("file_test2").await?);
        
        // Import settings from file
        settings_service.import_settings_from_file(&export_file.to_string_lossy()).await?;
        
        // Verify settings were restored
        let value1 = settings_service.get_setting("file_test1").await?;
        assert_eq!(value1, Some("value1".to_string()));
        
        let value2 = settings_service.get_setting("file_test2").await?;
        assert_eq!(value2, Some("value2".to_string()));
        
        // Note: Boolean and integer values will be imported as strings
        // and need to be parsed using the appropriate methods
        assert!(settings_service.has_setting("file_bool").await?);
        assert!(settings_service.has_setting("file_int").await?);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_error_handling() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test setting with empty key (should be caught by validation)
        let result = settings_service.set_setting("", "value").await;
        assert!(result.is_err());
        
        // Test getting setting after error (should still work)
        settings_service.set_setting("valid_key", "valid_value").await?;
        let value = settings_service.get_setting("valid_key").await?;
        assert_eq!(value, Some("valid_value".to_string()));
        
        // Test importing invalid JSON - Fixed: pass String instead of file path
        let result = settings_service.import_settings("invalid json content".to_string()).await;
        assert!(result.is_err());
        
        // Settings service should still be functional after error
        let value = settings_service.get_setting("valid_key").await?;
        assert_eq!(value, Some("valid_value".to_string()));
        
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
    async fn test_settings_service_security_validation() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Test SQL injection attempts in setting values
        let result = settings_service.set_setting("test_key", "'; DROP TABLE settings; --").await;
        // Should be caught by security validation
        assert!(result.is_err());
        
        // Test very long setting values
        let long_value = "a".repeat(10000);
        let result = settings_service.set_setting("long_test", &long_value).await;
        // Should be caught by security validation
        assert!(result.is_err());
        
        // Test invalid setting keys
        let result = settings_service.set_setting("../../../etc/passwd", "value").await;
        // Should be caught by security validation
        assert!(result.is_err());
        
        // Test setting with null bytes
        let result = settings_service.set_setting("null_test", "value\0with\0nulls").await;
        // Should be caught by security validation
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_settings_service_defaults_initialization() -> Result<(), AppError> {
        let settings_service = create_test_settings_service().await?;
        
        // Initialize defaults
        settings_service.initialize_defaults().await?;
        
        // Check that some default settings exist
        assert!(settings_service.has_setting("window.width").await?);
        assert!(settings_service.has_setting("theme.mode").await?);
        
        // Get specific default values
        let window_width = settings_service.get_setting("window.width").await?;
        assert_eq!(window_width, Some("800".to_string()));
        
        // Test override of default setting
        let current_width = settings_service.get_int_setting("window.width").await?;
        assert_eq!(current_width, Some(800));
        
        let new_width = 1000i64;
        settings_service.set_int_setting("window.width", new_width).await?;
        
        let updated_width = settings_service.get_int_setting("window.width").await?;
        assert_eq!(updated_width, Some(new_width));
        assert_ne!(updated_width, Some(800));
        
        Ok(())
    }
}