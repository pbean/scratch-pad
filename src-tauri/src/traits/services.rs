/// Service Traits for Business Logic Operations
/// 
/// These traits define the contract for service layer operations, enabling
/// better testing through dependency injection and cleaner separation of concerns.
/// All methods maintain exact compatibility with existing service operations.

use crate::error::AppError;
use crate::models::{Note, NoteFormat};
use crate::search::QueryComplexity;
use async_trait::async_trait;
use std::collections::HashMap;

/// Search service trait for search business logic
#[async_trait]
pub trait SearchService: Send + Sync {
    /// Search notes using FTS5 full-text search
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError>;

    /// Search notes with pagination
    async fn search_notes_paginated(&self, query: &str, page: usize, page_size: usize) -> Result<(Vec<Note>, usize), AppError>;

    /// Advanced Boolean search with pagination and query complexity analytics
    async fn search_notes_boolean_paginated(
        &self, 
        query: &str, 
        page: usize, 
        page_size: usize
    ) -> Result<(Vec<Note>, usize, QueryComplexity), AppError>;

    /// Search notes using fuzzy matching
    async fn fuzzy_search_notes(&self, query: &str) -> Result<Vec<Note>, AppError>;

    /// Search notes by path prefix
    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError>;

    /// Search favorite notes
    async fn search_favorites(&self) -> Result<Vec<Note>, AppError>;

    /// Search recent notes (created or updated within last N days)
    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError>;

    /// Get search suggestions based on partial query
    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError>;

    /// Advanced search with multiple criteria
    async fn advanced_search(
        &self,
        query: Option<&str>,
        path_filter: Option<&str>,
        favorites_only: bool,
        format_filter: Option<NoteFormat>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError>;

    /// Validate Boolean search query without executing it
    fn validate_boolean_query(&self, query: &str) -> Result<QueryComplexity, AppError>;

    /// Get Boolean search help examples - made dyn-compatible with &self
    fn get_boolean_search_examples(&self) -> Vec<(&'static str, &'static str)>;
}

/// Settings service trait for settings management
/// 
/// Generic methods are split into a separate trait for dyn compatibility
#[async_trait]
pub trait SettingsService: Send + Sync {
    /// Get a specific setting value
    async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError>;

    /// Set a specific setting value
    async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError>;

    /// Check if a setting exists
    async fn has_setting(&self, key: &str) -> Result<bool, AppError>;

    /// Get all settings as a hashmap
    async fn get_all_settings(&self) -> Result<HashMap<String, serde_json::Value>, AppError>;

    /// Export settings to a JSON file
    async fn export_settings(&self, file_path: &str) -> Result<(), AppError>;

    /// Import settings from a JSON file
    async fn import_settings(&self, file_path: &str) -> Result<(), AppError>;

    /// Reset all settings to default values
    async fn reset_to_defaults(&self) -> Result<(), AppError>;

    /// Initialize default settings if they don't exist
    async fn initialize_defaults(&self) -> Result<(), AppError>;

    /// Get a setting as a boolean
    async fn get_bool_setting(&self, key: &str) -> Result<Option<bool>, AppError>;

    /// Set a boolean setting
    async fn set_bool_setting(&self, key: &str, value: bool) -> Result<(), AppError>;

    /// Get a setting as an integer
    async fn get_int_setting(&self, key: &str) -> Result<Option<i64>, AppError>;

    /// Set an integer setting
    async fn set_int_setting(&self, key: &str, value: i64) -> Result<(), AppError>;

    /// Get a setting as a float
    async fn get_float_setting(&self, key: &str) -> Result<Option<f64>, AppError>;

    /// Set a float setting
    async fn set_float_setting(&self, key: &str, value: f64) -> Result<(), AppError>;

    /// Delete a specific setting
    async fn delete_setting(&self, key: &str) -> Result<(), AppError>;

    /// Get setting with a default value if not found
    async fn get_setting_or_default(&self, key: &str, default: &str) -> Result<String, AppError>;

    /// Validate and parse a numeric setting
    fn parse_numeric_setting(&self, key: &str, value: &str) -> Result<f64, AppError>;

    /// Flush any pending changes to the database for graceful shutdown
    async fn flush_pending_changes(&self) -> Result<(), AppError>;
}

/// Extended settings service trait for generic methods
/// 
/// These methods use generics and are not dyn-compatible,
/// so they're in a separate trait for when static dispatch is available.
pub trait SettingsServiceExt: SettingsService {
    /// Get a setting value parsed as a specific type
    async fn get_setting_as<T>(&self, key: &str) -> Result<Option<T>, AppError>
    where
        T: std::str::FromStr,
        T::Err: std::fmt::Display;

    /// Set a setting value from any serializable type
    async fn set_setting_from<T>(&self, key: &str, value: &T) -> Result<(), AppError>
    where
        T: serde::Serialize;
}

/// Window manager trait for window operations
#[async_trait]
pub trait WindowManager: Send + Sync {
    /// Show the main window
    async fn show_window(&self) -> Result<(), AppError>;
    
    /// Hide the main window
    async fn hide_window(&self) -> Result<(), AppError>;
    
    /// Toggle window visibility
    async fn toggle_window(&self) -> Result<(), AppError>;
    
    /// Set window layout/positioning
    async fn set_window_layout(&self, layout: &str) -> Result<(), AppError>;
    
    /// Check if window is currently visible
    async fn is_window_visible(&self) -> Result<bool, AppError>;
    
    /// Focus the window
    async fn focus_window(&self) -> Result<(), AppError>;
    
    /// Minimize the window
    async fn minimize_window(&self) -> Result<(), AppError>;
    
    /// Restore window from minimized state
    async fn restore_window(&self) -> Result<(), AppError>;
}

/// Implementation of service traits for existing service structs
/// 
/// These implementations provide trait compatibility for existing services,
/// maintaining exact backward compatibility while enabling dependency injection.

// SearchService trait implementation for the existing SearchService struct
#[async_trait]
impl SearchService for crate::search::SearchService {
    async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.search_notes(query).await
    }

    async fn search_notes_paginated(&self, query: &str, page: usize, page_size: usize) -> Result<(Vec<Note>, usize), AppError> {
        self.search_notes_paginated(query, page, page_size).await
    }

    async fn search_notes_boolean_paginated(
        &self, 
        query: &str, 
        page: usize, 
        page_size: usize
    ) -> Result<(Vec<Note>, usize, QueryComplexity), AppError> {
        self.search_notes_boolean_paginated(query, page, page_size).await
    }

    async fn fuzzy_search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        self.fuzzy_search_notes(query).await
    }

    async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError> {
        self.search_by_path(path_prefix).await
    }

    async fn search_favorites(&self) -> Result<Vec<Note>, AppError> {
        self.search_favorites().await
    }

    async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError> {
        self.search_recent(days).await
    }

    async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError> {
        self.get_search_suggestions(partial_query).await
    }

    async fn advanced_search(
        &self,
        query: Option<&str>,
        path_filter: Option<&str>,
        favorites_only: bool,
        format_filter: Option<NoteFormat>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError> {
        self.advanced_search(query, path_filter, favorites_only, format_filter, date_from, date_to).await
    }

    fn validate_boolean_query(&self, query: &str) -> Result<QueryComplexity, AppError> {
        self.validate_boolean_query(query)
    }

    fn get_boolean_search_examples(&self) -> Vec<(&'static str, &'static str)> {
        crate::search::SearchService::get_boolean_search_examples()
    }
}

// SettingsService trait implementation for the existing SettingsService struct
#[async_trait]
impl SettingsService for crate::settings::SettingsService {
    async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        self.get_setting(key).await
    }

    async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.set_setting(key, value).await
    }

    async fn has_setting(&self, key: &str) -> Result<bool, AppError> {
        self.has_setting(key).await
    }

    async fn get_all_settings(&self) -> Result<HashMap<String, serde_json::Value>, AppError> {
        self.get_all_settings().await
    }

    async fn export_settings(&self, file_path: &str) -> Result<(), AppError> {
        self.export_settings(file_path).await
    }

    async fn import_settings(&self, file_path: &str) -> Result<(), AppError> {
        self.import_settings(file_path).await
    }

    async fn reset_to_defaults(&self) -> Result<(), AppError> {
        self.reset_to_defaults().await
    }

    async fn initialize_defaults(&self) -> Result<(), AppError> {
        self.initialize_defaults().await
    }

    async fn get_bool_setting(&self, key: &str) -> Result<Option<bool>, AppError> {
        self.get_bool_setting(key).await
    }

    async fn set_bool_setting(&self, key: &str, value: bool) -> Result<(), AppError> {
        self.set_bool_setting(key, value).await
    }

    async fn get_int_setting(&self, key: &str) -> Result<Option<i64>, AppError> {
        self.get_int_setting(key).await
    }

    async fn set_int_setting(&self, key: &str, value: i64) -> Result<(), AppError> {
        self.set_int_setting(key, value).await
    }

    async fn get_float_setting(&self, key: &str) -> Result<Option<f64>, AppError> {
        self.get_float_setting(key).await
    }

    async fn set_float_setting(&self, key: &str, value: f64) -> Result<(), AppError> {
        self.set_float_setting(key, value).await
    }

    async fn delete_setting(&self, key: &str) -> Result<(), AppError> {
        self.delete_setting(key).await
    }

    async fn get_setting_or_default(&self, key: &str, default: &str) -> Result<String, AppError> {
        self.get_setting_or_default(key, default).await
    }

    fn parse_numeric_setting(&self, key: &str, value: &str) -> Result<f64, AppError> {
        self.parse_numeric_setting(key, value)
    }

    async fn flush_pending_changes(&self) -> Result<(), AppError> {
        self.flush_pending_changes().await
    }
}

// Extended settings service implementation with generic methods
impl SettingsServiceExt for crate::settings::SettingsService {
    async fn get_setting_as<T>(&self, key: &str) -> Result<Option<T>, AppError>
    where
        T: std::str::FromStr,
        T::Err: std::fmt::Display,
    {
        self.get_setting_as(key).await
    }

    async fn set_setting_from<T>(&self, key: &str, value: &T) -> Result<(), AppError>
    where
        T: serde::Serialize,
    {
        self.set_setting_from(key, value).await
    }
}

// WindowManager trait implementation for the existing WindowManager struct
#[async_trait]
impl WindowManager for crate::window_manager::WindowManager {
    async fn show_window(&self) -> Result<(), AppError> {
        self.show_window().await
    }
    
    async fn hide_window(&self) -> Result<(), AppError> {
        self.hide_window().await
    }
    
    async fn toggle_window(&self) -> Result<(), AppError> {
        self.toggle_window().await
    }
    
    async fn set_window_layout(&self, layout: &str) -> Result<(), AppError> {
        self.set_window_layout(layout).await
    }
    
    async fn is_window_visible(&self) -> Result<bool, AppError> {
        self.is_window_visible().await
    }
    
    async fn focus_window(&self) -> Result<(), AppError> {
        self.focus_window().await
    }
    
    async fn minimize_window(&self) -> Result<(), AppError> {
        self.minimize_window().await
    }
    
    async fn restore_window(&self) -> Result<(), AppError> {
        self.restore_window().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    async fn create_test_services() -> Result<(Arc<crate::search::SearchService>, Arc<crate::settings::SettingsService>), AppError> {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_string_lossy().to_string();
        let db_service = Arc::new(DbService::new(&db_path)?);
        
        let search_service = Arc::new(crate::search::SearchService::new(db_service.clone()));
        let settings_service = Arc::new(crate::settings::SettingsService::new(db_service));
        
        Ok((search_service, settings_service))
    }

    #[tokio::test]
    async fn test_search_service_trait() {
        let (search_service, _) = create_test_services().await.unwrap();
        let service: &dyn SearchService = search_service.as_ref();

        // Test basic search
        let results = service.search_notes("test").await.unwrap();
        assert!(results.is_empty()); // Empty database

        // Test paginated search
        let (results, count) = service.search_notes_paginated("test", 0, 10).await.unwrap();
        assert!(results.is_empty());
        assert_eq!(count, 0);

        // Test Boolean query validation
        let complexity = service.validate_boolean_query("rust AND programming").unwrap();
        assert!(complexity.term_count >= 2);
        assert!(complexity.operator_count >= 1);

        // Test search examples
        let examples = service.get_boolean_search_examples();
        assert!(!examples.is_empty());
    }

    #[tokio::test]
    async fn test_settings_service_trait() {
        let (_, settings_service) = create_test_services().await.unwrap();
        let service: &dyn SettingsService = settings_service.as_ref();

        // Test setting operations
        service.set_setting("test_key", "test_value").await.unwrap();
        let value = service.get_setting("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // Test has_setting
        assert!(service.has_setting("test_key").await.unwrap());
        assert!(!service.has_setting("nonexistent").await.unwrap());

        // Test typed settings
        service.set_bool_setting("test_bool", true).await.unwrap();
        let bool_value = service.get_bool_setting("test_bool").await.unwrap();
        assert_eq!(bool_value, Some(true));

        service.set_int_setting("test_int", 42).await.unwrap();
        let int_value = service.get_int_setting("test_int").await.unwrap();
        assert_eq!(int_value, Some(42));

        // Test delete
        service.delete_setting("test_key").await.unwrap();
        let deleted_value = service.get_setting("test_key").await.unwrap();
        assert!(deleted_value.is_none());
    }

    #[tokio::test]
    async fn test_settings_service_ext_trait() {
        let (_, settings_service) = create_test_services().await.unwrap();
        let service: &crate::settings::SettingsService = settings_service.as_ref();

        // Test generic methods (these use static dispatch)
        let result: Result<Option<i32>, AppError> = service.get_setting_as("nonexistent").await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        // Test set_setting_from
        let test_value = 42i32;
        service.set_setting_from("test_generic", &test_value).await.unwrap();
        let retrieved: Option<i32> = service.get_setting_as("test_generic").await.unwrap();
        assert_eq!(retrieved, Some(42));
    }
}