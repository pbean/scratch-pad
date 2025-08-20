use std::sync::Arc;
use std::collections::HashMap;
use crate::database::DbService;
use crate::error::AppError;

pub struct SettingsService {
    db_service: Arc<DbService>,
}

impl SettingsService {
    pub fn new(db_service: Arc<DbService>) -> Self {
        Self { db_service }
    }

    /// Get a specific setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        self.db_service.get_setting(key).await
    }

    /// Set a specific setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        // SECURITY: Validate setting before storing
        use crate::validation::SecurityValidator;
        SecurityValidator::validate_setting(key, value)?;
        
        self.db_service.set_setting(key, value).await
    }

    /// Check if a setting exists
    pub async fn has_setting(&self, key: &str) -> Result<bool, AppError> {
        Ok(self.get_setting(key).await?.is_some())
    }

    /// Get all settings as a hashmap
    pub async fn get_all_settings(&self) -> Result<HashMap<String, serde_json::Value>, AppError> {
        let mut settings = HashMap::new();
        
        // Get all settings from database
        let all_settings = self.db_service.get_all_settings().await?;
        
        for setting in all_settings {
            let key = setting.key;
            let value = setting.value;
            // Try to parse as JSON, fallback to string
            let json_value = serde_json::from_str::<serde_json::Value>(&value)
                .unwrap_or_else(|_| serde_json::Value::String(value));
            settings.insert(key, json_value);
        }
        
        Ok(settings)
    }

    /// Export settings to a JSON file
    pub async fn export_settings(&self, file_path: &str) -> Result<(), AppError> {
        let settings = self.get_all_settings().await?;
        let json = serde_json::to_string_pretty(&settings)?;
        std::fs::write(file_path, json).map_err(|e| AppError::Io(e))
    }

    /// Import settings from a JSON file
    pub async fn import_settings(&self, file_path: &str) -> Result<(), AppError> {
        let content = std::fs::read_to_string(file_path)?;
        let settings: HashMap<String, serde_json::Value> = serde_json::from_str(&content)?;
        
        for (key, value) in settings {
            let value_str = match value {
                serde_json::Value::String(s) => s,
                _ => value.to_string(),
            };
            self.set_setting(&key, &value_str).await?;
        }
        
        Ok(())
    }

    /// Reset all settings to default values
    pub async fn reset_to_defaults(&self) -> Result<(), AppError> {
        // Clear all existing settings
        self.db_service.clear_all_settings().await?;
        
        // Initialize with defaults
        self.initialize_defaults().await
    }

    /// Initialize default settings if they don't exist
    pub async fn initialize_defaults(&self) -> Result<(), AppError> {
        let defaults = get_default_settings();
        
        for (key, value) in defaults {
            if !self.has_setting(&key).await? {
                self.set_setting(&key, &value).await?;
            }
        }
        
        Ok(())
    }

    /// Get a setting value parsed as a specific type
    pub async fn get_setting_as<T>(&self, key: &str) -> Result<Option<T>, AppError>
    where
        T: std::str::FromStr,
        T::Err: std::fmt::Display,
    {
        if let Some(value) = self.get_setting(key).await? {
            Ok(Some(value.parse().map_err(|e| AppError::Parse {
                message: format!("Failed to parse setting '{}': {}", key, e)
            })?))
        } else {
            Ok(None)
        }
    }

    /// Set a setting value from any serializable type
    pub async fn set_setting_from<T>(&self, key: &str, value: &T) -> Result<(), AppError>
    where
        T: serde::Serialize,
    {
        let value_str = serde_json::to_string(value)?;
        self.set_setting(key, &value_str).await
    }

    /// Get a setting as a boolean
    pub async fn get_bool_setting(&self, key: &str) -> Result<Option<bool>, AppError> {
        if let Some(value) = self.get_setting(key).await? {
            match value.to_lowercase().as_str() {
                "true" | "1" | "yes" | "on" => Ok(Some(true)),
                "false" | "0" | "no" | "off" => Ok(Some(false)),
                _ => Err(AppError::Parse {
                    message: format!("Invalid boolean value for setting '{}': {}", key, value)
                })
            }
        } else {
            Ok(None)
        }
    }

    /// Set a boolean setting
    pub async fn set_bool_setting(&self, key: &str, value: bool) -> Result<(), AppError> {
        self.set_setting(key, if value { "true" } else { "false" }).await
    }

    /// Get a setting as an integer
    pub async fn get_int_setting(&self, key: &str) -> Result<Option<i64>, AppError> {
        if let Some(value) = self.get_setting(key).await? {
            Ok(Some(value.parse().map_err(|e| AppError::Parse {
                message: format!("Failed to parse setting '{}' as integer: {}", key, e)
            })?))
        } else {
            Ok(None)
        }
    }

    /// Set an integer setting
    pub async fn set_int_setting(&self, key: &str, value: i64) -> Result<(), AppError> {
        self.set_setting(key, &value.to_string()).await
    }

    /// Get a setting as a float
    pub async fn get_float_setting(&self, key: &str) -> Result<Option<f64>, AppError> {
        if let Some(value) = self.get_setting(key).await? {
            Ok(Some(value.parse().map_err(|e| AppError::Parse {
                message: format!("Failed to parse setting '{}' as float: {}", key, e)
            })?))
        } else {
            Ok(None)
        }
    }

    /// Set a float setting
    pub async fn set_float_setting(&self, key: &str, value: f64) -> Result<(), AppError> {
        self.set_setting(key, &value.to_string()).await
    }

    /// Delete a specific setting
    pub async fn delete_setting(&self, key: &str) -> Result<(), AppError> {
        self.db_service.delete_setting(key).await
    }

    /// Get setting with a default value if not found
    pub async fn get_setting_or_default(&self, key: &str, default: &str) -> Result<String, AppError> {
        Ok(self.get_setting(key).await?.unwrap_or_else(|| default.to_string()))
    }

    /// Validate and parse a numeric setting
    pub fn parse_numeric_setting(&self, key: &str, value: &str) -> Result<f64, AppError> {
        value.parse().map_err(|e| AppError::Parse {
            message: format!("Failed to parse setting '{}' as number: {}", key, e)
        })
    }

    /// Flush any pending changes to the database for graceful shutdown
    pub async fn flush_pending_changes(&self) -> Result<(), AppError> {
        // Force WAL checkpoint on the database connection
        if let Ok(conn) = self.db_service.get_connection() {
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
                .map_err(|e| AppError::Database(e))?;
        }
        Ok(())
    }
}

/// Get default application settings
pub fn get_default_settings() -> HashMap<String, String> {
    let mut defaults = HashMap::new();
    
    // Window settings
    defaults.insert("window.width".to_string(), "800".to_string());
    defaults.insert("window.height".to_string(), "600".to_string());
    defaults.insert("window.x".to_string(), "100".to_string());
    defaults.insert("window.y".to_string(), "100".to_string());
    defaults.insert("window.always_on_top".to_string(), "false".to_string());
    defaults.insert("window.resizable".to_string(), "true".to_string());
    defaults.insert("window.decorations".to_string(), "true".to_string());
    defaults.insert("window.transparent".to_string(), "false".to_string());
    
    // Theme settings
    defaults.insert("theme.mode".to_string(), "auto".to_string());
    defaults.insert("theme.accent_color".to_string(), "#3b82f6".to_string());
    defaults.insert("theme.font_family".to_string(), "Inter".to_string());
    defaults.insert("theme.font_size".to_string(), "14".to_string());
    
    // Editor settings
    defaults.insert("editor.auto_save".to_string(), "true".to_string());
    defaults.insert("editor.auto_save_delay".to_string(), "1000".to_string());
    defaults.insert("editor.word_wrap".to_string(), "true".to_string());
    defaults.insert("editor.line_numbers".to_string(), "false".to_string());
    defaults.insert("editor.vim_mode".to_string(), "false".to_string());
    defaults.insert("editor.default_format".to_string(), "plaintext".to_string());
    
    // Search settings
    defaults.insert("search.max_results".to_string(), "100".to_string());
    defaults.insert("search.highlight_matches".to_string(), "true".to_string());
    defaults.insert("search.case_sensitive".to_string(), "false".to_string());
    defaults.insert("search.fuzzy_threshold".to_string(), "0.6".to_string());
    
    // Global shortcut settings
    defaults.insert("shortcuts.toggle_window".to_string(), "Ctrl+Alt+Space".to_string());
    defaults.insert("shortcuts.quick_note".to_string(), "Ctrl+Alt+N".to_string());
    defaults.insert("shortcuts.search".to_string(), "Ctrl+Alt+F".to_string());
    
    // General settings
    defaults.insert("general.startup_behavior".to_string(), "minimize".to_string());
    defaults.insert("general.confirm_delete".to_string(), "true".to_string());
    defaults.insert("general.backup_enabled".to_string(), "true".to_string());
    defaults.insert("general.backup_interval".to_string(), "24".to_string()); // hours
    defaults.insert("general.max_recent_files".to_string(), "10".to_string());
    
    // Performance settings
    defaults.insert("performance.animation_enabled".to_string(), "true".to_string());
    defaults.insert("performance.virtual_scrolling".to_string(), "true".to_string());
    defaults.insert("performance.debounce_delay".to_string(), "300".to_string());
    
    // Privacy settings
    defaults.insert("privacy.analytics_enabled".to_string(), "false".to_string());
    defaults.insert("privacy.crash_reporting".to_string(), "false".to_string());
    defaults.insert("privacy.usage_stats".to_string(), "false".to_string());
    
    defaults
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::tempdir;
    use anyhow::Context;

    async fn setup_test_service() -> Result<SettingsService, anyhow::Error> {
        let temp_dir = tempdir()
            .context("Failed to create temporary directory")?;
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = Arc::new(DbService::new(&*db_path.to_string_lossy())
            .context("Failed to create database service")?);
        Ok(SettingsService::new(db_service))
    }

    #[tokio::test]
    async fn test_setting_operations() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Test setting and getting a value
        service.set_setting("test_key", "test_value").await
            .context("Failed to set setting")?;
        
        let value = service.get_setting("test_key").await
            .context("Failed to get setting")?;
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test has_setting
        assert!(service.has_setting("test_key").await
            .context("Failed to check if setting exists")?);
        assert!(!service.has_setting("nonexistent_key").await
            .context("Failed to check nonexistent setting")?);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_default_settings() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Initialize defaults
        service.initialize_defaults().await
            .context("Failed to initialize defaults")?;
        
        // Check that some default settings exist
        assert!(service.has_setting("window.width").await
            .context("window.width setting should exist")?);
        assert!(service.has_setting("theme.mode").await
            .context("theme.mode setting should exist")?);
        
        // Get specific default values
        let window_width = service.get_setting("window.width").await
            .context("Failed to get window.width")?;
        assert_eq!(window_width, Some("800".to_string()));
        
        Ok(())
    }

    #[tokio::test]
    async fn test_typed_settings() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Test boolean settings
        service.set_bool_setting("test_bool", true).await
            .context("Failed to set boolean setting")?;
        let bool_value = service.get_bool_setting("test_bool").await
            .context("Failed to get boolean setting")?;
        assert_eq!(bool_value, Some(true));
        
        // Test integer settings
        service.set_int_setting("test_int", 42).await
            .context("Failed to set integer setting")?;
        let int_value = service.get_int_setting("test_int").await
            .context("Failed to get integer setting")?;
        assert_eq!(int_value, Some(42));
        
        // Test float settings
        service.set_float_setting("test_float", 3.14).await
            .context("Failed to set float setting")?;
        let float_value = service.get_float_setting("test_float").await
            .context("Failed to get float setting")?;
        assert_eq!(float_value, Some(3.14));
        
        Ok(())
    }

    #[tokio::test]
    async fn test_get_all_settings() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Set some test settings
        service.set_setting("key1", "value1").await
            .context("Failed to set key1")?;
        service.set_setting("key2", "2").await
            .context("Failed to set key2")?;
        service.set_setting("key3", "true").await
            .context("Failed to set key3")?;
        
        let all_settings = service.get_all_settings().await
            .context("Failed to get all settings")?;
        
        assert!(all_settings.contains_key("key1"));
        assert!(all_settings.contains_key("key2"));
        assert!(all_settings.contains_key("key3"));
        
        // Check that values are preserved as JSON values
        if let Some(value1) = all_settings.get("key1") {
            assert_eq!(value1.as_str(), Some("value1"));
        }
        
        Ok(())
    }

    #[tokio::test]
    async fn test_delete_setting() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Set a setting and verify it exists
        service.set_setting("to_delete", "value").await
            .context("Failed to set setting")?;
        assert!(service.has_setting("to_delete").await
            .context("Setting should exist")?);
        
        // Delete the setting
        service.delete_setting("to_delete").await
            .context("Failed to delete setting")?;
        
        // Verify it no longer exists
        assert!(!service.has_setting("to_delete").await
            .context("Setting should not exist after deletion")?);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_get_setting_or_default() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Test with existing setting
        service.set_setting("existing", "value").await
            .context("Failed to set existing setting")?;
        let result = service.get_setting_or_default("existing", "default").await
            .context("Failed to get existing setting")?;
        assert_eq!(result, "value");
        
        // Test with non-existing setting
        let result = service.get_setting_or_default("nonexistent", "default").await
            .context("Failed to get nonexistent setting")?;
        assert_eq!(result, "default");
        
        Ok(())
    }

    #[tokio::test]
    async fn test_validation() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Test valid setting
        assert!(service.set_setting("valid_key", "valid_value").await.is_ok());
        
        // Test invalid key (should fail validation)
        assert!(service.set_setting("", "value").await.is_err());
        assert!(service.set_setting("key with spaces", "value").await.is_err());
        
        Ok(())
    }

    #[tokio::test] 
    async fn test_export_import() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        let temp_dir = tempdir().context("Failed to create temp dir")?;
        let export_file = temp_dir.path().join("settings.json");
        
        // Set some test settings
        service.set_setting("export_test1", "value1").await
            .context("Failed to set export_test1")?;
        service.set_setting("export_test2", "value2").await
            .context("Failed to set export_test2")?;
        
        // Export settings
        service.export_settings(&export_file.to_string_lossy()).await
            .context("Failed to export settings")?;
        
        // Verify file was created
        assert!(export_file.exists());
        
        // Clear settings and import
        service.delete_setting("export_test1").await
            .context("Failed to delete export_test1")?;
        service.delete_setting("export_test2").await
            .context("Failed to delete export_test2")?;
        
        service.import_settings(&export_file.to_string_lossy()).await
            .context("Failed to import settings")?;
        
        // Verify settings were restored
        let value1 = service.get_setting("export_test1").await
            .context("Failed to get imported export_test1")?;
        assert_eq!(value1, Some("value1".to_string()));
        
        let value2 = service.get_setting("export_test2").await
            .context("Failed to get imported export_test2")?;
        assert_eq!(value2, Some("value2".to_string()));
        
        Ok(())
    }

    #[tokio::test]
    async fn test_flush_pending_changes() -> Result<(), anyhow::Error> {
        let service = setup_test_service().await?;
        
        // Set a setting and flush
        service.set_setting("flush_test", "value").await
            .context("Failed to set flush_test")?;
        
        // This should not fail
        service.flush_pending_changes().await
            .context("Failed to flush pending changes")?;
        
        // Verify setting still exists
        let value = service.get_setting("flush_test").await
            .context("Failed to get setting after flush")?;
        assert_eq!(value, Some("value".to_string()));
        
        Ok(())
    }
}