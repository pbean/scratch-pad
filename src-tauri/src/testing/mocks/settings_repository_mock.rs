/// Mock Settings Repository Implementation
///
/// Provides a mock implementation of the SettingsRepository trait for isolated testing.
/// Includes call tracking, state management, and configurable responses for
/// comprehensive testing scenarios.
use crate::error::AppError;
use crate::models::Setting;
use crate::testing::mocks::MockRepositoryState;
use crate::traits::repository::SettingsRepository;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Mock implementation of SettingsRepository for testing
#[derive(Debug, Clone)]
pub struct MockSettingsRepository {
    state: MockRepositoryState<Setting>,
    error_responses: Arc<Mutex<HashMap<String, AppError>>>,
}

impl MockSettingsRepository {
    /// Create new mock settings repository
    pub fn new() -> Self {
        Self {
            state: MockRepositoryState::new(),
            error_responses: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Configure error response for a specific method
    pub fn set_error_response(&self, method: &str, error: AppError) {
        let mut errors = self.error_responses.lock().unwrap();
        errors.insert(method.to_string(), error);
    }

    /// Clear all error responses
    pub fn clear_error_responses(&self) {
        let mut errors = self.error_responses.lock().unwrap();
        errors.clear();
    }

    /// Get all method calls made to this repository
    pub fn get_calls(&self) -> Vec<String> {
        self.state.get_calls()
    }

    /// Clear all recorded calls
    pub fn clear_calls(&self) {
        self.state.clear_calls();
    }

    /// Get all settings as key-value pairs (helper method)
    pub fn get_all_settings_helper(&self) -> HashMap<String, String> {
        let data = self.state.get_all_data();
        data.iter()
            .map(|(k, v)| (k.clone(), v.value.clone()))
            .collect()
    }

    /// Check if a setting exists by key
    pub fn has_setting(&self, key: &str) -> bool {
        self.state.get(key).is_some()
    }

    /// Manually add a setting to the mock state
    pub fn add_setting(&self, key: String, value: String) {
        let setting = Setting {
            key: key.clone(),
            value,
        };
        self.state.set_data(key, setting);
    }

    /// Clear all data and calls
    pub fn clear_all(&self) {
        self.state.clear();
    }

    /// Check for configured error response
    fn check_error_response(&self, method: &str) -> Result<(), AppError> {
        let errors = self.error_responses.lock().unwrap();
        if let Some(error) = errors.get(method) {
            return Err(error.mock_clone());
        }
        Ok(())
    }
}

impl Default for MockSettingsRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SettingsRepository for MockSettingsRepository {
    async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        self.state.record_call("get_setting".to_string());
        self.check_error_response("get_setting")?;

        Ok(self.state.get(key).map(|setting| setting.value))
    }

    async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        self.state.record_call("set_setting".to_string());
        self.check_error_response("set_setting")?;

        let setting = Setting {
            key: key.to_string(),
            value: value.to_string(),
        };

        self.state.insert(key.to_string(), setting);
        Ok(())
    }

    async fn delete_setting(&self, key: &str) -> Result<(), AppError> {
        self.state.record_call("delete_setting".to_string());
        self.check_error_response("delete_setting")?;

        if self.state.get(key).is_some() {
            self.state.remove(key);
            Ok(())
        } else {
            Err(AppError::NotFound { id: 0 }) // Settings don't have numeric IDs
        }
    }

    async fn get_all_settings(&self) -> Result<Vec<Setting>, AppError> {
        self.state.record_call("get_all_settings".to_string());
        self.check_error_response("get_all_settings")?;

        let data = self.state.get_all_data();
        Ok(data.values().cloned().collect())
    }

    async fn clear_all_settings(&self) -> Result<(), AppError> {
        self.state.record_call("clear_all_settings".to_string());
        self.check_error_response("clear_all_settings")?;

        self.state.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_get_setting() {
        let repo = MockSettingsRepository::new();
        repo.add_setting("test_key".to_string(), "test_value".to_string());

        let value = repo.get_setting("test_key").await.unwrap();
        assert!(value.is_some());
        assert_eq!(value.unwrap(), "test_value");
    }

    #[tokio::test]
    async fn test_set_setting() {
        let repo = MockSettingsRepository::new();

        repo.set_setting("new_key", "new_value").await.unwrap();

        // Verify it was stored
        let retrieved = repo.get_setting("new_key").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), "new_value");
    }

    #[tokio::test]
    async fn test_delete_setting() {
        let repo = MockSettingsRepository::new();
        repo.add_setting("to_delete".to_string(), "value".to_string());

        repo.delete_setting("to_delete").await.unwrap();

        let retrieved = repo.get_setting("to_delete").await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_get_all_settings() {
        let repo = MockSettingsRepository::new();
        repo.add_setting("key1".to_string(), "value1".to_string());
        repo.add_setting("key2".to_string(), "value2".to_string());

        let all_settings = repo.get_all_settings().await.unwrap();
        assert_eq!(all_settings.len(), 2);

        let settings_map: HashMap<String, String> = all_settings
            .into_iter()
            .map(|setting| (setting.key, setting.value))
            .collect();
        assert_eq!(settings_map.get("key1"), Some(&"value1".to_string()));
        assert_eq!(settings_map.get("key2"), Some(&"value2".to_string()));
    }

    #[tokio::test]
    async fn test_error_response() {
        let repo = MockSettingsRepository::new();
        let error = AppError::Database(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            Some("Test error".to_string()),
        ));

        repo.set_error_response("get_setting", error);

        let result = repo.get_setting("test_key").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_call_tracking() {
        let repo = MockSettingsRepository::new();

        let _ = repo.get_setting("test").await;
        let _ = repo.set_setting("test", "value").await;

        let calls = repo.get_calls();
        assert!(calls.contains(&"get_setting".to_string()));
        assert!(calls.contains(&"set_setting".to_string()));
    }

    #[tokio::test]
    async fn test_clear_all_settings() {
        let repo = MockSettingsRepository::new();
        repo.add_setting("key1".to_string(), "value1".to_string());
        repo.add_setting("key2".to_string(), "value2".to_string());

        repo.clear_all_settings().await.unwrap();

        let all_settings = repo.get_all_settings().await.unwrap();
        assert!(all_settings.is_empty());
    }
}
