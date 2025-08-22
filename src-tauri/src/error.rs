use serde::{Deserialize, Serialize};

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

    #[error("Migration error: {0}")]
    MigrationError(#[from] rusqlite_migration::Error),

    #[error("General error: {0}")]
    General(String),

    #[error("Global shortcut error: {message}")]
    GlobalShortcut { message: String },

    #[error("Plugin error: {message}")]
    Plugin { message: String },

    #[error("Search error: {message}")]
    Search { message: String },

    #[error("Migration error: {message}")]
    Migration { message: String },

    #[error("Validation error in field '{field}': {message}")]
    Validation { field: String, message: String },

    #[error("Security error: {message}")]
    Security { message: String },

    #[error("Rate limit exceeded: {message}")]
    RateLimit { message: String },

    #[error("Runtime initialization error: {message}")]
    Runtime { message: String },

    #[error("Thread operation failed: {message}")]
    Thread { message: String },

    #[error("Parse error: {message}")]
    Parse { message: String },

    #[error("Path operation failed: {message}")]
    Path { message: String },

    #[error("Directory operation failed: {message}")]
    Directory { message: String },

    #[error("Temporary file operation failed: {message}")]
    TempFile { message: String },

    #[error("Shutdown error: {message}")]
    Shutdown { message: String },

    #[error("Not found: record with id {id}")]
    NotFound { id: i64 }, // Added NotFound variant for database operations
}

// Implement From<anyhow::Error> for AppError
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::General(err.to_string())
    }
}

impl AppError {
    /// Create a copy of this error for mock usage, preserving error information as strings
    /// This is primarily for testing scenarios where error cloning is needed
    pub fn mock_clone(&self) -> Self {
        match self {
            Self::Database(e) => Self::Database(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_MISUSE),
                Some(format!("Mock database error: {}", e)),
            )),
            Self::Io(e) => Self::Io(std::io::Error::new(
                e.kind(),
                format!("Mock IO error: {}", e),
            )),
            Self::Serialization(_) => {
                Self::Serialization(serde_json::from_str::<()>("invalid").unwrap_err())
            }
            Self::Pool(e) => {
                // Convert pool error to IO error for mock purposes
                let io_error = std::io::Error::new(
                    std::io::ErrorKind::ConnectionRefused,
                    format!("Mock pool error: {}", e),
                );
                Self::Io(io_error)
            }
            Self::MigrationError(_) => Self::Migration {
                message: "Mock migration error".to_string(),
            },
            Self::General(message) => Self::General(message.clone()),
            Self::GlobalShortcut { message } => Self::GlobalShortcut {
                message: message.clone(),
            },
            Self::Plugin { message } => Self::Plugin {
                message: message.clone(),
            },
            Self::Search { message } => Self::Search {
                message: message.clone(),
            },
            Self::Migration { message } => Self::Migration {
                message: message.clone(),
            },
            Self::Validation { field, message } => Self::Validation {
                field: field.clone(),
                message: message.clone(),
            },
            Self::Security { message } => Self::Security {
                message: message.clone(),
            },
            Self::RateLimit { message } => Self::RateLimit {
                message: message.clone(),
            },
            Self::Runtime { message } => Self::Runtime {
                message: message.clone(),
            },
            Self::Thread { message } => Self::Thread {
                message: message.clone(),
            },
            Self::Parse { message } => Self::Parse {
                message: message.clone(),
            },
            Self::Path { message } => Self::Path {
                message: message.clone(),
            },
            Self::Directory { message } => Self::Directory {
                message: message.clone(),
            },
            Self::TempFile { message } => Self::TempFile {
                message: message.clone(),
            },
            Self::Shutdown { message } => Self::Shutdown {
                message: message.clone(),
            },
            Self::NotFound { id } => Self::NotFound { id: *id },
        }
    }
}

// Enable seamless conversion from API layer to internal layer
impl From<ApiError> for AppError {
    fn from(api_error: ApiError) -> Self {
        AppError::General(format!(
            "API Error {}: {}",
            api_error.code, api_error.message
        ))
    }
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
            AppError::MigrationError(e) => ApiError {
                code: "MIGRATION_ERROR".to_string(),
                message: e.to_string(),
            },
            AppError::General(message) => ApiError {
                code: "GENERAL_ERROR".to_string(),
                message,
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
            AppError::Validation { field, message } => ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed for '{}': {}", field, message),
            },
            AppError::Security { message } => ApiError {
                code: "SECURITY_ERROR".to_string(),
                message,
            },
            AppError::RateLimit { message } => ApiError {
                code: "RATE_LIMIT_ERROR".to_string(),
                message,
            },
            AppError::Runtime { message } => ApiError {
                code: "RUNTIME_ERROR".to_string(),
                message,
            },
            AppError::Thread { message } => ApiError {
                code: "THREAD_ERROR".to_string(),
                message,
            },
            AppError::Parse { message } => ApiError {
                code: "PARSE_ERROR".to_string(),
                message,
            },
            AppError::Path { message } => ApiError {
                code: "PATH_ERROR".to_string(),
                message,
            },
            AppError::Directory { message } => ApiError {
                code: "DIRECTORY_ERROR".to_string(),
                message,
            },
            AppError::TempFile { message } => ApiError {
                code: "TEMP_FILE_ERROR".to_string(),
                message,
            },
            AppError::Shutdown { message } => ApiError {
                code: "SHUTDOWN_ERROR".to_string(),
                message,
            },
            AppError::NotFound { id } => ApiError {
                code: "NOT_FOUND_ERROR".to_string(),
                message: format!("Record with id {} not found", id),
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
            Some("database is locked".to_string()),
        ));
        assert!(db_error.to_string().contains("database is locked"));

        let io_error = AppError::Io(io::Error::new(io::ErrorKind::NotFound, "file not found"));
        assert!(io_error.to_string().contains("file not found"));

        let global_shortcut_error = AppError::GlobalShortcut {
            message: "shortcut conflict".to_string(),
        };
        assert_eq!(
            global_shortcut_error.to_string(),
            "Global shortcut error: shortcut conflict"
        );

        let plugin_error = AppError::Plugin {
            message: "plugin failed to load".to_string(),
        };
        assert_eq!(
            plugin_error.to_string(),
            "Plugin error: plugin failed to load"
        );

        let search_error = AppError::Search {
            message: "search index corrupted".to_string(),
        };
        assert_eq!(
            search_error.to_string(),
            "Search error: search index corrupted"
        );

        let migration_error = AppError::Migration {
            message: "migration failed".to_string(),
        };
        assert_eq!(
            migration_error.to_string(),
            "Migration error: migration failed"
        );

        let validation_error = AppError::Validation {
            field: "email".to_string(),
            message: "invalid format".to_string(),
        };
        assert_eq!(
            validation_error.to_string(),
            "Validation error in field 'email': invalid format"
        );

        let security_error = AppError::Security {
            message: "unauthorized access".to_string(),
        };
        assert_eq!(
            security_error.to_string(),
            "Security error: unauthorized access"
        );

        let rate_limit_error = AppError::RateLimit {
            message: "too many requests".to_string(),
        };
        assert_eq!(
            rate_limit_error.to_string(),
            "Rate limit exceeded: too many requests"
        );

        let runtime_error = AppError::Runtime {
            message: "failed to initialize tokio runtime".to_string(),
        };
        assert_eq!(
            runtime_error.to_string(),
            "Runtime initialization error: failed to initialize tokio runtime"
        );

        let thread_error = AppError::Thread {
            message: "thread join failed".to_string(),
        };
        assert_eq!(
            thread_error.to_string(),
            "Thread operation failed: thread join failed"
        );

        let parse_error = AppError::Parse {
            message: "invalid configuration format".to_string(),
        };
        assert_eq!(
            parse_error.to_string(),
            "Parse error: invalid configuration format"
        );

        let path_error = AppError::Path {
            message: "invalid path format".to_string(),
        };
        assert_eq!(
            path_error.to_string(),
            "Path operation failed: invalid path format"
        );

        let directory_error = AppError::Directory {
            message: "failed to create directory".to_string(),
        };
        assert_eq!(
            directory_error.to_string(),
            "Directory operation failed: failed to create directory"
        );

        let temp_file_error = AppError::TempFile {
            message: "failed to create temporary directory".to_string(),
        };
        assert_eq!(
            temp_file_error.to_string(),
            "Temporary file operation failed: failed to create temporary directory"
        );

        let shutdown_error = AppError::Shutdown {
            message: "graceful shutdown failed".to_string(),
        };
        assert_eq!(
            shutdown_error.to_string(),
            "Shutdown error: graceful shutdown failed"
        );

        let not_found_error = AppError::NotFound { id: 42 };
        assert_eq!(not_found_error.to_string(), "Not found: record with id 42");
    }

    #[test]
    fn test_mock_clone() {
        // Test that mock_clone preserves error information as strings
        let original_error = AppError::GlobalShortcut {
            message: "shortcut conflict".to_string(),
        };
        let cloned_error = original_error.mock_clone();

        match (original_error, cloned_error) {
            (
                AppError::GlobalShortcut { message: orig },
                AppError::GlobalShortcut { message: cloned },
            ) => {
                assert_eq!(orig, cloned);
            }
            _ => panic!("mock_clone should preserve error variant"),
        }

        // Test NotFound variant
        let not_found = AppError::NotFound { id: 123 };
        let cloned_not_found = not_found.mock_clone();
        match (not_found, cloned_not_found) {
            (AppError::NotFound { id: orig }, AppError::NotFound { id: cloned }) => {
                assert_eq!(orig, cloned);
            }
            _ => panic!("mock_clone should preserve NotFound variant"),
        }
    }

    #[test]
    fn test_api_error_from_app_error() {
        // Test Database error conversion
        let db_error = AppError::Database(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            Some("database is locked".to_string()),
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
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json")
            .expect_err("Should be an error");
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

        // Test Validation error conversion
        let validation_error = AppError::Validation {
            field: "password".to_string(),
            message: "too short".to_string(),
        };
        let api_error: ApiError = validation_error.into();
        assert_eq!(api_error.code, "VALIDATION_ERROR");
        assert!(api_error.message.contains("password"));
        assert!(api_error.message.contains("too short"));

        // Test Security error conversion
        let security_error = AppError::Security {
            message: "access denied".to_string(),
        };
        let api_error: ApiError = security_error.into();
        assert_eq!(api_error.code, "SECURITY_ERROR");
        assert_eq!(api_error.message, "access denied");

        // Test RateLimit error conversion
        let rate_limit_error = AppError::RateLimit {
            message: "quota exceeded".to_string(),
        };
        let api_error: ApiError = rate_limit_error.into();
        assert_eq!(api_error.code, "RATE_LIMIT_ERROR");
        assert_eq!(api_error.message, "quota exceeded");

        // Test Runtime error conversion
        let runtime_error = AppError::Runtime {
            message: "tokio initialization failed".to_string(),
        };
        let api_error: ApiError = runtime_error.into();
        assert_eq!(api_error.code, "RUNTIME_ERROR");
        assert_eq!(api_error.message, "tokio initialization failed");

        // Test Thread error conversion
        let thread_error = AppError::Thread {
            message: "thread panic".to_string(),
        };
        let api_error: ApiError = thread_error.into();
        assert_eq!(api_error.code, "THREAD_ERROR");
        assert_eq!(api_error.message, "thread panic");

        // Test Parse error conversion
        let parse_error = AppError::Parse {
            message: "malformed config".to_string(),
        };
        let api_error: ApiError = parse_error.into();
        assert_eq!(api_error.code, "PARSE_ERROR");
        assert_eq!(api_error.message, "malformed config");

        // Test Path error conversion
        let path_error = AppError::Path {
            message: "path not found".to_string(),
        };
        let api_error: ApiError = path_error.into();
        assert_eq!(api_error.code, "PATH_ERROR");
        assert_eq!(api_error.message, "path not found");

        // Test Directory error conversion
        let directory_error = AppError::Directory {
            message: "mkdir failed".to_string(),
        };
        let api_error: ApiError = directory_error.into();
        assert_eq!(api_error.code, "DIRECTORY_ERROR");
        assert_eq!(api_error.message, "mkdir failed");

        // Test TempFile error conversion
        let temp_file_error = AppError::TempFile {
            message: "tempdir creation failed".to_string(),
        };
        let api_error: ApiError = temp_file_error.into();
        assert_eq!(api_error.code, "TEMP_FILE_ERROR");
        assert_eq!(api_error.message, "tempdir creation failed");

        // Test Shutdown error conversion
        let shutdown_error = AppError::Shutdown {
            message: "shutdown timeout".to_string(),
        };
        let api_error: ApiError = shutdown_error.into();
        assert_eq!(api_error.code, "SHUTDOWN_ERROR");
        assert_eq!(api_error.message, "shutdown timeout");

        // Test NotFound error conversion
        let not_found_error = AppError::NotFound { id: 123 };
        let api_error: ApiError = not_found_error.into();
        assert_eq!(api_error.code, "NOT_FOUND_ERROR");
        assert_eq!(api_error.message, "Record with id 123 not found");
    }

    #[test]
    fn test_api_error_serialization() {
        let api_error = ApiError {
            code: "TEST_ERROR".to_string(),
            message: "test message".to_string(),
        };

        // Test that ApiError can be serialized
        let json = serde_json::to_string(&api_error).expect("Failed to serialize");
        assert!(json.contains("TEST_ERROR"));
        assert!(json.contains("test message"));

        // Test that it can be deserialized
        let deserialized: ApiError = serde_json::from_str(&json).expect("Failed to deserialize");
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

    #[test]
    fn test_not_found_error() {
        let error = AppError::NotFound { id: 42 };
        assert_eq!(error.to_string(), "Not found: record with id 42");

        let api_error: ApiError = error.into();
        assert_eq!(api_error.code, "NOT_FOUND_ERROR");
        assert_eq!(api_error.message, "Record with id 42 not found");
    }
}
