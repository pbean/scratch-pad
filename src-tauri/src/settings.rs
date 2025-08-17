use crate::database::DbService;
use crate::error::AppError;
// Settings model is defined in models.rs but we use HashMap for easier manipulation
use serde_json;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
// Note: File dialog functionality will be implemented via frontend
// Tauri v2 requires dialog operations to be handled from the frontend
use tokio::fs;

pub struct SettingsService {
    db_service: Arc<DbService>,
}

impl SettingsService {
    /// Create a new SettingsService
    pub fn new(db_service: Arc<DbService>) -> Self {
        Self { db_service }
    }

    /// Get a setting value by key
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        self.db_service.get_setting(key).await
    }

    /// Set a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.db_service.set_setting(key, value).await
    }

    /// Get all settings as a HashMap for easier manipulation
    pub async fn get_all_settings(&self) -> Result<HashMap<String, String>, AppError> {
        let settings = self.db_service.get_all_settings().await?;
        let mut settings_map = HashMap::new();
        
        for setting in settings {
            settings_map.insert(setting.key, setting.value);
        }
        
        Ok(settings_map)
    }

    /// Set multiple settings at once
    pub async fn set_multiple_settings(&self, settings: HashMap<String, String>) -> Result<(), AppError> {
        for (key, value) in settings {
            self.set_setting(&key, &value).await?;
        }
        Ok(())
    }

    /// Export settings as JSON string (frontend will handle file saving)
    pub async fn export_settings(&self) -> Result<String, AppError> {
        let settings = self.get_all_settings().await?;
        let json_content = serde_json::to_string_pretty(&settings)?;
        Ok(json_content)
    }

    /// Import settings from JSON string (frontend will handle file reading)
    pub async fn import_settings(&self, json_content: String) -> Result<usize, AppError> {
        let settings: HashMap<String, String> = serde_json::from_str(&json_content)?;
        let count = settings.len();
        
        self.set_multiple_settings(settings).await?;
        
        Ok(count)
    }

    /// Export settings to a specific file path (for programmatic use)
    pub async fn export_settings_to_path<P: AsRef<Path>>(&self, path: P) -> Result<(), AppError> {
        let settings = self.get_all_settings().await?;
        let json_content = serde_json::to_string_pretty(&settings)?;
        fs::write(path, json_content).await?;
        Ok(())
    }

    /// Import settings from a specific file path (for programmatic use)
    pub async fn import_settings_from_path<P: AsRef<Path>>(&self, path: P) -> Result<usize, AppError> {
        let json_content = fs::read_to_string(path).await?;
        let settings: HashMap<String, String> = serde_json::from_str(&json_content)?;
        let count = settings.len();
        
        self.set_multiple_settings(settings).await?;
        
        Ok(count)
    }

    /// Reset settings to default values
    pub async fn reset_to_defaults(&self) -> Result<(), AppError> {
        let default_settings = self.get_default_settings();
        self.set_multiple_settings(default_settings).await
    }

    /// Get default settings configuration
    pub fn get_default_settings(&self) -> HashMap<String, String> {
        let mut defaults = HashMap::new();
        
        // Global shortcut settings
        defaults.insert("global_shortcut".to_string(), "Ctrl+Shift+N".to_string());
        
        // Font settings
        defaults.insert("ui_font".to_string(), "Inter".to_string());
        defaults.insert("editor_font".to_string(), "SauceCodePro Nerd Font".to_string());
        
        // Note format settings
        defaults.insert("default_note_format".to_string(), "plaintext".to_string());
        
        // Layout settings
        defaults.insert("layout_mode".to_string(), "default".to_string());
        defaults.insert("window_width".to_string(), "800".to_string());
        defaults.insert("window_height".to_string(), "600".to_string());
        
        // Auto-save settings
        defaults.insert("auto_save_delay_ms".to_string(), "500".to_string());
        
        // Search settings
        defaults.insert("search_limit".to_string(), "100".to_string());
        defaults.insert("fuzzy_search_threshold".to_string(), "0.6".to_string());
        
        defaults
    }

    /// Initialize default settings if they don't exist
    pub async fn initialize_defaults(&self) -> Result<(), AppError> {
        let defaults = self.get_default_settings();
        
        for (key, default_value) in defaults {
            // Only set if the setting doesn't already exist
            if self.get_setting(&key).await?.is_none() {
                self.set_setting(&key, &default_value).await?;
            }
        }
        
        Ok(())
    }

    /// Validate a setting value before setting it
    pub fn validate_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        match key {
            "global_shortcut" => {
                // Basic validation for global shortcut format
                if value.is_empty() {
                    return Err(AppError::GlobalShortcut {
                        message: "Global shortcut cannot be empty".to_string(),
                    });
                }
                // Additional validation could be added here
            }
            "layout_mode" => {
                if !["default", "half", "full"].contains(&value) {
                    return Err(AppError::Io(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Invalid layout mode. Must be 'default', 'half', or 'full'",
                    )));
                }
            }
            "default_note_format" => {
                if !["plaintext", "markdown"].contains(&value) {
                    return Err(AppError::Io(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        "Invalid note format. Must be 'plaintext' or 'markdown'",
                    )));
                }
            }
            "window_width" | "window_height" | "auto_save_delay_ms" | "search_limit" => {
                if value.parse::<u32>().is_err() {
                    return Err(AppError::Io(std::io::Error::new(
                        std::io::ErrorKind::InvalidInput,
                        format!("Invalid numeric value for {}: {}", key, value),
                    )));
                }
            }
            "fuzzy_search_threshold" => {
                match value.parse::<f64>() {
                    Ok(threshold) if threshold >= 0.0 && threshold <= 1.0 => {}
                    _ => {
                        return Err(AppError::Io(std::io::Error::new(
                            std::io::ErrorKind::InvalidInput,
                            "Fuzzy search threshold must be a number between 0.0 and 1.0",
                        )));
                    }
                }
            }
            _ => {
                // Unknown settings are allowed for extensibility
            }
        }
        
        Ok(())
    }

    /// Set a setting with validation
    pub async fn set_setting_validated(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.validate_setting(key, value)?;
        self.set_setting(key, value).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::tempdir;

    async fn create_test_settings_service() -> (SettingsService, tempfile::TempDir) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let service = SettingsService::new(db_service);
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_get_set_setting() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Test setting and getting a value
        service.set_setting("test_key", "test_value").await.unwrap();
        let value = service.get_setting("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));
        
        // Test getting non-existent setting
        let missing = service.get_setting("missing_key").await.unwrap();
        assert_eq!(missing, None);
    }

    #[tokio::test]
    async fn test_get_all_settings() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Set multiple settings
        service.set_setting("key1", "value1").await.unwrap();
        service.set_setting("key2", "value2").await.unwrap();
        
        let all_settings = service.get_all_settings().await.unwrap();
        assert_eq!(all_settings.get("key1"), Some(&"value1".to_string()));
        assert_eq!(all_settings.get("key2"), Some(&"value2".to_string()));
    }

    #[tokio::test]
    async fn test_set_multiple_settings() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        let mut settings = HashMap::new();
        settings.insert("key1".to_string(), "value1".to_string());
        settings.insert("key2".to_string(), "value2".to_string());
        
        service.set_multiple_settings(settings).await.unwrap();
        
        let value1 = service.get_setting("key1").await.unwrap();
        let value2 = service.get_setting("key2").await.unwrap();
        
        assert_eq!(value1, Some("value1".to_string()));
        assert_eq!(value2, Some("value2".to_string()));
    }

    #[tokio::test]
    async fn test_default_settings() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        let defaults = service.get_default_settings();
        assert!(defaults.contains_key("global_shortcut"));
        assert!(defaults.contains_key("ui_font"));
        assert!(defaults.contains_key("editor_font"));
        assert!(defaults.contains_key("default_note_format"));
        assert!(defaults.contains_key("layout_mode"));
    }

    #[tokio::test]
    async fn test_initialize_defaults() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        service.initialize_defaults().await.unwrap();
        
        let global_shortcut = service.get_setting("global_shortcut").await.unwrap();
        assert_eq!(global_shortcut, Some("Ctrl+Shift+N".to_string()));
        
        let ui_font = service.get_setting("ui_font").await.unwrap();
        assert_eq!(ui_font, Some("Inter".to_string()));
    }

    #[tokio::test]
    async fn test_setting_validation() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Test valid layout mode
        assert!(service.validate_setting("layout_mode", "default").is_ok());
        assert!(service.validate_setting("layout_mode", "half").is_ok());
        assert!(service.validate_setting("layout_mode", "full").is_ok());
        
        // Test invalid layout mode
        assert!(service.validate_setting("layout_mode", "invalid").is_err());
        
        // Test valid note format
        assert!(service.validate_setting("default_note_format", "plaintext").is_ok());
        assert!(service.validate_setting("default_note_format", "markdown").is_ok());
        
        // Test invalid note format
        assert!(service.validate_setting("default_note_format", "invalid").is_err());
        
        // Test numeric validation
        assert!(service.validate_setting("window_width", "800").is_ok());
        assert!(service.validate_setting("window_width", "invalid").is_err());
        
        // Test fuzzy search threshold
        assert!(service.validate_setting("fuzzy_search_threshold", "0.6").is_ok());
        assert!(service.validate_setting("fuzzy_search_threshold", "1.5").is_err());
        assert!(service.validate_setting("fuzzy_search_threshold", "-0.1").is_err());
    }

    #[tokio::test]
    async fn test_export_import_settings_json() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Set some settings
        service.set_setting("key1", "value1").await.unwrap();
        service.set_setting("key2", "value2").await.unwrap();
        
        // Export settings as JSON
        let json_content = service.export_settings().await.unwrap();
        assert!(json_content.contains("key1"));
        assert!(json_content.contains("value1"));
        
        // Create new service and import settings
        let (service2, _temp_dir2) = create_test_settings_service().await;
        let count = service2.import_settings(json_content).await.unwrap();
        assert_eq!(count, 2);
        
        // Verify imported settings
        let value1 = service2.get_setting("key1").await.unwrap();
        let value2 = service2.get_setting("key2").await.unwrap();
        
        assert_eq!(value1, Some("value1".to_string()));
        assert_eq!(value2, Some("value2".to_string()));
    }

    #[tokio::test]
    async fn test_export_import_settings_programmatic() {
        let (service, _temp_dir) = create_test_settings_service().await;
        let temp_dir2 = tempdir().unwrap();
        let export_path = temp_dir2.path().join("settings.json");
        
        // Set some settings
        service.set_setting("key1", "value1").await.unwrap();
        service.set_setting("key2", "value2").await.unwrap();
        
        // Export settings
        service.export_settings_to_path(&export_path).await.unwrap();
        
        // Clear settings
        let (service2, _temp_dir3) = create_test_settings_service().await;
        
        // Import settings
        let count = service2.import_settings_from_path(&export_path).await.unwrap();
        assert_eq!(count, 2);
        
        // Verify imported settings
        let value1 = service2.get_setting("key1").await.unwrap();
        let value2 = service2.get_setting("key2").await.unwrap();
        
        assert_eq!(value1, Some("value1".to_string()));
        assert_eq!(value2, Some("value2".to_string()));
    }

    #[tokio::test]
    async fn test_reset_to_defaults() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Set some custom settings
        service.set_setting("global_shortcut", "Ctrl+Alt+N").await.unwrap();
        service.set_setting("custom_setting", "custom_value").await.unwrap();
        
        // Reset to defaults
        service.reset_to_defaults().await.unwrap();
        
        // Check that default was restored
        let global_shortcut = service.get_setting("global_shortcut").await.unwrap();
        assert_eq!(global_shortcut, Some("Ctrl+Shift+N".to_string()));
        
        // Custom setting should still exist (reset doesn't delete non-default settings)
        let custom = service.get_setting("custom_setting").await.unwrap();
        assert_eq!(custom, Some("custom_value".to_string()));
    }

    #[tokio::test]
    async fn test_set_setting_validated() {
        let (service, _temp_dir) = create_test_settings_service().await;
        
        // Test valid setting
        assert!(service.set_setting_validated("layout_mode", "half").await.is_ok());
        let value = service.get_setting("layout_mode").await.unwrap();
        assert_eq!(value, Some("half".to_string()));
        
        // Test invalid setting
        assert!(service.set_setting_validated("layout_mode", "invalid").await.is_err());
        
        // Verify invalid setting wasn't saved
        let value = service.get_setting("layout_mode").await.unwrap();
        assert_eq!(value, Some("half".to_string())); // Should still be the valid value
    }
}