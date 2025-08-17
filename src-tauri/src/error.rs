use serde::Serialize;

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

#[derive(Debug, Serialize)]
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