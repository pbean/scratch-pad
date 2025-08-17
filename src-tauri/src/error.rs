use serde::{Serialize, Deserialize};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Connection pool error: {0}")]
    Pool(#[from] r2d2::Error),
    
    #[error("Global shortcut error: {message}")]
    GlobalShortcut { message: String },
    
    #[error("Plugin error: {message}")]
    Plugin { message: String },
    
    #[error("Search error: {message}")]
    Search { message: String },
    
    #[error("Migration error: {message}")]
    Migration { message: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl From<AppError> for ApiError {
    fn from(error: AppError) -> Self {
        match error {
            AppError::Database(e) => ApiError {
                code: "DATABASE_ERROR".to_string(),
                message: e.to_string(),
            },
            AppError::Io(e) => ApiError {
                code: "IO_ERROR".to_string(),
                message: e.to_string(),
            },
            AppError::Serialization(e) => ApiError {
                code: "SERIALIZATION_ERROR".to_string(),
                message: e.to_string(),
            },
            AppError::Pool(e) => ApiError {
                code: "POOL_ERROR".to_string(),
                message: e.to_string(),
            },
            AppError::GlobalShortcut { message } => ApiError {
                code: "GLOBAL_SHORTCUT_ERROR".to_string(),
                message,
            },
            AppError::Plugin { message } => ApiError {
                code: "PLUGIN_ERROR".to_string(),
                message,
            },
            AppError::Search { message } => ApiError {
                code: "SEARCH_ERROR".to_string(),
                message,
            },
            AppError::Migration { message } => ApiError {
                code: "MIGRATION_ERROR".to_string(),
                message,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn test_app_error_display() {
        let db_error = AppError::Database(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            Some("database is locked".to_string())
        ));
        assert!(db_error.to_string().contains("database is locked"));

        let io_error = AppError::Io(io::Error::new(io::ErrorKind::NotFound, "file not found"));
        assert!(io_error.to_string().contains("file not found"));

        let global_shortcut_error = AppError::GlobalShortcut {
            message: "shortcut conflict".to_string(),
        };
        assert_eq!(global_shortcut_error.to_string(), "Global shortcut error: shortcut conflict");

        let plugin_error = AppError::Plugin {
            message: "plugin failed to load".to_string(),
        };
        assert_eq!(plugin_error.to_string(), "Plugin error: plugin failed to load");

        let search_error = AppError::Search {
            message: "search index corrupted".to_string(),
        };
        assert_eq!(search_error.to_string(), "Search error: search index corrupted");

        let migration_error = AppError::Migration {
            message: "migration failed".to_string(),
        };
        assert_eq!(migration_error.to_string(), "Migration error: migration failed");
    }

    #[test]
    fn test_api_error_from_app_error() {
        // Test Database error conversion
        let db_error = AppError::Database(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            Some("database is locked".to_string())
        ));
        let api_error: ApiError = db_error.into();
        assert_eq!(api_error.code, "DATABASE_ERROR");
        assert!(api_error.message.contains("database is locked"));

        // Test IO error conversion
        let io_error = AppError::Io(io::Error::new(io::ErrorKind::NotFound, "file not found"));
        let api_error: ApiError = io_error.into();
        assert_eq!(api_error.code, "IO_ERROR");
        assert!(api_error.message.contains("file not found"));

        // Test Serialization error conversion
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let serialization_error = AppError::Serialization(json_error);
        let api_error: ApiError = serialization_error.into();
        assert_eq!(api_error.code, "SERIALIZATION_ERROR");

        // Test GlobalShortcut error conversion
        let global_shortcut_error = AppError::GlobalShortcut {
            message: "shortcut conflict".to_string(),
        };
        let api_error: ApiError = global_shortcut_error.into();
        assert_eq!(api_error.code, "GLOBAL_SHORTCUT_ERROR");
        assert_eq!(api_error.message, "shortcut conflict");

        // Test Plugin error conversion
        let plugin_error = AppError::Plugin {
            message: "plugin failed to load".to_string(),
        };
        let api_error: ApiError = plugin_error.into();
        assert_eq!(api_error.code, "PLUGIN_ERROR");
        assert_eq!(api_error.message, "plugin failed to load");

        // Test Search error conversion
        let search_error = AppError::Search {
            message: "search index corrupted".to_string(),
        };
        let api_error: ApiError = search_error.into();
        assert_eq!(api_error.code, "SEARCH_ERROR");
        assert_eq!(api_error.message, "search index corrupted");

        // Test Migration error conversion
        let migration_error = AppError::Migration {
            message: "migration failed".to_string(),
        };
        let api_error: ApiError = migration_error.into();
        assert_eq!(api_error.code, "MIGRATION_ERROR");
        assert_eq!(api_error.message, "migration failed");
    }

    #[test]
    fn test_api_error_serialization() {
        let api_error = ApiError {
            code: "TEST_ERROR".to_string(),
            message: "test message".to_string(),
        };

        // Test that ApiError can be serialized
        let json = serde_json::to_string(&api_error).unwrap();
        assert!(json.contains("TEST_ERROR"));
        assert!(json.contains("test message"));

        // Test that it can be deserialized
        let deserialized: ApiError = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.code, "TEST_ERROR");
        assert_eq!(deserialized.message, "test message");
    }

    #[test]
    fn test_app_error_debug() {
        let error = AppError::GlobalShortcut {
            message: "test error".to_string(),
        };
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("GlobalShortcut"));
        assert!(debug_str.contains("test error"));
    }

    #[test]
    fn test_api_error_debug() {
        let error = ApiError {
            code: "TEST_CODE".to_string(),
            message: "test message".to_string(),
        };
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("TEST_CODE"));
        assert!(debug_str.contains("test message"));
    }
}