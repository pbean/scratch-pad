/// Database Test Isolation Framework
/// 
/// This module provides comprehensive database test isolation for all backend tests.
/// It ensures each test gets its own isolated database instance with proper cleanup,
/// preventing test interference and race conditions during parallel execution.

use crate::database::DbService;
use crate::error::AppError;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tempfile::{TempDir, NamedTempFile};
use tokio::sync::Mutex;
use std::path::PathBuf;

/// Global test counter for unique database instances
static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Test database isolation strategies
#[derive(Debug, Clone)]
pub enum IsolationStrategy {
    /// Each test gets a unique temporary file-based database
    TempFile,
    /// Each test gets an in-memory database (fastest, but no persistence)
    InMemory,
    /// Each test gets a unique named database file in temp directory
    UniqueFile,
}

/// Test database wrapper that manages isolation and cleanup
pub struct TestDatabase {
    pub service: Arc<DbService>,
    _temp_dir: Option<TempDir>, // Keep alive for cleanup
    _temp_file: Option<NamedTempFile>, // Keep alive for cleanup
    pub db_path: PathBuf,
    pub test_id: u64,
}

impl TestDatabase {
    /// Create a new isolated test database with specified strategy
    pub async fn new(strategy: IsolationStrategy) -> Result<Self, AppError> {
        let test_id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        
        match strategy {
            IsolationStrategy::InMemory => Self::create_in_memory(test_id).await,
            IsolationStrategy::TempFile => Self::create_temp_file(test_id).await,
            IsolationStrategy::UniqueFile => Self::create_unique_file(test_id).await,
        }
    }
    
    /// Create an in-memory database (fastest for unit tests)
    async fn create_in_memory(test_id: u64) -> Result<Self, AppError> {
        let db_path = PathBuf::from(format!(":memory:test_{}", test_id));
        let service = Arc::new(DbService::new(&db_path)?);
        
        Ok(TestDatabase {
            service,
            _temp_dir: None,
            _temp_file: None,
            db_path,
            test_id,
        })
    }
    
    /// Create a temporary file-based database (good for integration tests)
    async fn create_temp_file(test_id: u64) -> Result<Self, AppError> {
        let temp_file = NamedTempFile::with_prefix(&format!("test_db_{}_", test_id))
            .map_err(|e| AppError::Database(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                Some(format!("Failed to create temp file: {}", e))
            )))?;
        
        let db_path = temp_file.path().to_path_buf();
        let service = Arc::new(DbService::new(&db_path)?);
        
        Ok(TestDatabase {
            service,
            _temp_dir: None,
            _temp_file: Some(temp_file), // Keep alive for cleanup
            db_path,
            test_id,
        })
    }
    
    /// Create a unique named file in temp directory (best for debugging)
    async fn create_unique_file(test_id: u64) -> Result<Self, AppError> {
        let temp_dir = TempDir::new()
            .map_err(|e| AppError::Database(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                Some(format!("Failed to create temp dir: {}", e))
            )))?;
        
        let db_path = temp_dir.path().join(format!("test_db_{}.sqlite", test_id));
        let service = Arc::new(DbService::new(&db_path)?);
        
        Ok(TestDatabase {
            service,
            _temp_dir: Some(temp_dir), // Keep alive for cleanup
            _temp_file: None,
            db_path,
            test_id,
        })
    }
    
    /// Get the database service for testing
    pub fn db(&self) -> Arc<DbService> {
        self.service.clone()
    }
    
    /// Get test-specific high-resolution timestamp
    pub fn get_test_timestamp(&self) -> String {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();
        
        // Include test_id and nanoseconds for uniqueness during parallel tests
        let nanos = now.as_nanos();
        let timestamp = chrono::DateTime::from_timestamp(
            (nanos / 1_000_000_000) as i64,
            (nanos % 1_000_000_000) as u32,
        ).unwrap_or_else(|| chrono::Utc::now());
        
        format!("{}.{:06}", 
            timestamp.format("%Y-%m-%d %H:%M:%S"),
            (nanos % 1_000_000_000) as u64 / 1000 + self.test_id % 1000000
        )
    }
    
    /// Populate test database with sample data
    pub async fn populate_test_data(&self) -> Result<(), AppError> {
        let db = &self.service;
        
        // Create sample notes with unique content per test
        let test_notes = vec![
            format!("Test note 1 for test {}", self.test_id),
            format!("Rust programming guide {}", self.test_id),
            format!("JavaScript tutorial {}", self.test_id),
            format!("Database design patterns {}", self.test_id),
            format!("API documentation {}", self.test_id),
        ];
        
        for content in test_notes {
            db.create_note(content).await?;
        }
        
        // Create sample settings
        db.set_setting(&format!("test_setting_{}", self.test_id), "test_value").await?;
        db.set_setting("theme", "dark").await?;
        db.set_setting("font_size", "14").await?;
        
        Ok(())
    }
    
    /// Verify database schema integrity
    pub async fn verify_schema(&self) -> Result<(), AppError> {
        let db = &self.service;
        
        // Test basic operations to ensure schema is correct
        let health = db.health_check().await?;
        if !health {
            return Err(AppError::Database(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CORRUPT),
                Some("Database health check failed".to_string())
            )));
        }
        
        // Verify tables exist by performing operations
        let _notes = db.get_all_notes().await?;
        let _settings = db.get_all_settings().await?;
        
        // Test FTS search functionality
        let _search_results = db.search_notes("test").await?;
        
        Ok(())
    }
    
    /// Clear all test data (useful for test cleanup within same instance)
    pub async fn clear_data(&self) -> Result<(), AppError> {
        let conn = self.service.get_connection()?;
        
        // Clear in reverse dependency order
        conn.execute("DELETE FROM notes_fts", [])?;
        conn.execute("DELETE FROM notes", [])?;
        conn.execute("DELETE FROM settings", [])?;
        
        Ok(())
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        // Automatic cleanup handled by TempDir and NamedTempFile Drop implementations
        // No explicit cleanup needed as temp files/dirs are cleaned up automatically
    }
}

/// Factory for creating test databases with different isolation strategies
pub struct TestDatabaseFactory;

impl TestDatabaseFactory {
    /// Create a fast in-memory database for unit tests
    pub async fn create_memory_db() -> Result<TestDatabase, AppError> {
        TestDatabase::new(IsolationStrategy::InMemory).await
    }
    
    /// Create a file-based database for integration tests
    pub async fn create_file_db() -> Result<TestDatabase, AppError> {
        TestDatabase::new(IsolationStrategy::TempFile).await
    }
    
    /// Create a persistent file database for debugging tests
    pub async fn create_debug_db() -> Result<TestDatabase, AppError> {
        TestDatabase::new(IsolationStrategy::UniqueFile).await
    }
    
    /// Create a database with test data already populated
    pub async fn create_populated_db(strategy: IsolationStrategy) -> Result<TestDatabase, AppError> {
        let test_db = TestDatabase::new(strategy).await?;
        test_db.verify_schema().await?;
        test_db.populate_test_data().await?;
        Ok(test_db)
    }
}

/// Test helper macros for common test database patterns
#[macro_export]
macro_rules! test_db {
    () => {{
        crate::testing::database::TestDatabaseFactory::create_memory_db().await.unwrap()
    }};
    (file) => {{
        crate::testing::database::TestDatabaseFactory::create_file_db().await.unwrap()
    }};
    (debug) => {{
        crate::testing::database::TestDatabaseFactory::create_debug_db().await.unwrap()
    }};
    (populated) => {{
        crate::testing::database::TestDatabaseFactory::create_populated_db(
            crate::testing::database::IsolationStrategy::InMemory
        ).await.unwrap()
    }};
}

/// Mutex for coordinating parallel database tests when needed
static TEST_COORDINATION: Mutex<()> = Mutex::const_new(());

/// Coordinate access for tests that cannot run in parallel
pub async fn with_test_coordination<F, R>(test_fn: F) -> R
where
    F: std::future::Future<Output = R>,
{
    let _guard = TEST_COORDINATION.lock().await;
    test_fn.await
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_database_isolation() {
        // Create multiple isolated databases
        let db1 = TestDatabaseFactory::create_memory_db().await.unwrap();
        let db2 = TestDatabaseFactory::create_memory_db().await.unwrap();
        
        // Verify they have different test IDs
        assert_ne!(db1.test_id, db2.test_id);
        
        // Verify schema integrity
        db1.verify_schema().await.unwrap();
        db2.verify_schema().await.unwrap();
        
        // Add data to one database
        db1.db().create_note("Test note 1".to_string()).await.unwrap();
        
        // Verify isolation
        let notes1 = db1.db().get_all_notes().await.unwrap();
        let notes2 = db2.db().get_all_notes().await.unwrap();
        
        assert_eq!(notes1.len(), 1);
        assert_eq!(notes2.len(), 0);
    }
    
    #[tokio::test]
    async fn test_populated_database() {
        let test_db = TestDatabaseFactory::create_populated_db(
            IsolationStrategy::InMemory
        ).await.unwrap();
        
        // Verify test data exists
        let notes = test_db.db().get_all_notes().await.unwrap();
        assert!(!notes.is_empty());
        
        let settings = test_db.db().get_all_settings().await.unwrap();
        assert!(!settings.is_empty());
        
        // Verify search works
        let search_results = test_db.db().search_notes("programming").await.unwrap();
        assert!(!search_results.is_empty());
    }
    
    #[tokio::test]
    async fn test_unique_timestamps() {
        let test_db = TestDatabaseFactory::create_memory_db().await.unwrap();
        
        let ts1 = test_db.get_test_timestamp();
        tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
        let ts2 = test_db.get_test_timestamp();
        
        assert_ne!(ts1, ts2, "Timestamps should be unique even in rapid succession");
    }
    
    #[tokio::test]
    async fn test_parallel_database_creation() {
        // Test that multiple databases can be created in parallel
        let handles: Vec<_> = (0..5).map(|_| {
            tokio::spawn(async {
                let db = TestDatabaseFactory::create_memory_db().await.unwrap();
                db.verify_schema().await.unwrap();
                db.test_id
            })
        }).collect();
        
        let mut test_ids = Vec::new();
        for handle in handles {
            test_ids.push(handle.await.unwrap());
        }
        
        // Verify all test IDs are unique
        test_ids.sort();
        test_ids.dedup();
        assert_eq!(test_ids.len(), 5, "All test databases should have unique IDs");
    }
}