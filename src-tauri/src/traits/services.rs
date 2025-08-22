use crate::commands::search::QueryComplexity;
/// Service Traits for Business Logic Operations
///
/// These traits define the contract for service layer operations, enabling
/// better testing through dependency injection and cleaner separation of concerns.
/// All methods maintain exact compatibility with existing service operations.
use crate::error::AppError;
use crate::models::Note;
use async_trait::async_trait;
use std::collections::HashMap;

/// Search service trait for search business logic
#[async_trait]
pub trait SearchService: Send + Sync {
    /// Search notes using FTS5 full-text search
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError>;

    /// Search notes with pagination
    async fn search_notes_paginated(
        &self,
        query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize), AppError>;

    /// Advanced Boolean search with pagination and query complexity analytics
    async fn search_notes_boolean_paginated(
        &self,
        query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize, QueryComplexity), AppError>;

    /// Validate query syntax and complexity for security and performance limits
    async fn validate_search_query(&self, query: &str) -> Result<bool, AppError>;

    /// Get Boolean search examples for user guidance
    fn get_search_examples(&self) -> Vec<String>;
}

/// Settings service trait for settings management
#[async_trait]
pub trait SettingsService: Send + Sync {
    /// Save a setting key-value pair
    async fn save_setting(&self, key: &str, value: &str) -> Result<(), AppError>;

    /// Load a setting by key  
    async fn load_setting(&self, key: &str) -> Result<Option<String>, AppError>;

    /// Get all settings as a HashMap
    async fn get_all_settings(&self) -> Result<HashMap<String, String>, AppError>;

    /// Delete a setting by key
    async fn delete_setting(&self, key: &str) -> Result<(), AppError>;

    /// Check if a setting exists
    async fn has_setting(&self, key: &str) -> Result<bool, AppError>;

    /// Export settings to JSON format
    async fn export_settings(&self) -> Result<String, AppError>;

    /// Import settings from JSON format
    async fn import_settings(&self, json: &str) -> Result<(), AppError>;

    /// Reset all settings to defaults
    async fn reset_settings(&self) -> Result<(), AppError>;

    /// Backup current settings
    async fn backup_settings(&self, path: &str) -> Result<(), AppError>;

    /// Restore settings from backup
    async fn restore_settings(&self, path: &str) -> Result<(), AppError>;

    /// Get settings schema for validation
    fn get_settings_schema(&self) -> HashMap<String, String>;

    /// Validate setting key and value format
    fn validate_setting(&self, key: &str, value: &str) -> Result<(), AppError>;

    /// Get setting with type conversion support  
    async fn get_setting_as<T>(&self, key: &str) -> Result<Option<T>, AppError>
    where
        T: serde::de::DeserializeOwned + Send;

    /// Set setting with type conversion support
    async fn set_setting_from<T>(&self, key: &str, value: &T) -> Result<(), AppError>
    where
        T: serde::Serialize + Send + Sync;
}

/// Window manager trait for window operations
#[async_trait]
pub trait WindowManager: Send + Sync {
    /// Toggle window visibility
    async fn toggle_window(&self) -> Result<(), AppError>;

    /// Show the window
    async fn show_window(&self) -> Result<(), AppError>;

    /// Hide the window  
    async fn hide_window(&self) -> Result<(), AppError>;

    /// Check if window is currently visible
    async fn is_window_visible(&self) -> Result<bool, AppError>;

    /// Set window position
    async fn set_window_position(&self, x: i32, y: i32) -> Result<(), AppError>;

    /// Get current window position
    async fn get_window_position(&self) -> Result<(i32, i32), AppError>;

    /// Set window size
    async fn set_window_size(&self, width: u32, height: u32) -> Result<(), AppError>;

    /// Get current window size
    async fn get_window_size(&self) -> Result<(u32, u32), AppError>;

    /// Register a global keyboard shortcut
    async fn register_global_shortcut(&self, shortcut: &str) -> Result<(), AppError>;

    /// Unregister a global keyboard shortcut
    async fn unregister_global_shortcut(&self, shortcut: &str) -> Result<(), AppError>;

    /// Get all registered shortcuts
    async fn get_registered_shortcuts(&self) -> Result<Vec<String>, AppError>;

    /// Set window to always on top
    async fn set_always_on_top(&self, on_top: bool) -> Result<(), AppError>;

    /// Focus the window
    async fn focus_window(&self) -> Result<(), AppError>;

    /// Minimize the window
    async fn minimize_window(&self) -> Result<(), AppError>;

    /// Maximize the window
    async fn maximize_window(&self) -> Result<(), AppError>;

    /// Get window theme (light/dark)
    async fn get_window_theme(&self) -> Result<String, AppError>;

    /// Set window theme
    async fn set_window_theme(&self, theme: &str) -> Result<(), AppError>;
}
