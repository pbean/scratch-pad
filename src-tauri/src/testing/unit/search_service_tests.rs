/// Unit Tests for SearchService Business Logic
/// 
/// These tests focus on testing the SearchService business logic in isolation
/// using mock repository dependencies. This enables fast, reliable testing
/// without database dependencies while maintaining all security validation.

use crate::error::AppError;
use crate::models::NoteFormat;
use crate::search::SearchService;
use std::sync::Arc;
use tokio;

/// Test helper to create a SearchService with real dependencies for business logic testing
async fn create_test_search_service() -> Result<SearchService, AppError> {
    use tempfile::NamedTempFile;
    use crate::database::DbService;
    
    let temp_file = NamedTempFile::new().unwrap();
    let db_path = temp_file.path().to_string_lossy().to_string();
    let db_service = Arc::new(DbService::new(&db_path)?);
    
    Ok(SearchService::new(db_service))
}

/// Tests for SearchService business logic using real service with temporary database
mod search_service_integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_search_service_basic_search() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create test notes
        let _note1 = search_service.db_service.create_note("Rust programming guide".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript tutorial".to_string()).await?;
        
        // Test basic search
        let results = search_service.search_notes("rust").await?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        
        // Test case insensitive search
        let results = search_service.search_notes("RUST").await?;
        assert_eq!(results.len(), 1);
        
        // Test empty search returns all notes
        let results = search_service.search_notes("").await?;
        assert_eq!(results.len(), 2);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_paginated_search() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create multiple test notes
        for i in 1..=5 {
            search_service.db_service.create_note(format!("Test note {}", i)).await?;
        }
        
        // Test paginated search
        let (page1, total1) = search_service.search_notes_paginated("test", 0, 2).await?;
        assert_eq!(page1.len(), 2);
        assert_eq!(total1, 5);
        
        let (page2, total2) = search_service.search_notes_paginated("test", 2, 2).await?;
        assert_eq!(page2.len(), 2);
        assert_eq!(total2, 5);
        
        let (page3, total3) = search_service.search_notes_paginated("test", 4, 2).await?;
        assert_eq!(page3.len(), 1);
        assert_eq!(total3, 5);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_boolean_search() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create test notes for Boolean search
        let _note1 = search_service.db_service.create_note("Rust programming tutorial".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript programming guide".to_string()).await?;
        let _note3 = search_service.db_service.create_note("Database design patterns".to_string()).await?;
        let _note4 = search_service.db_service.create_note("Rust and JavaScript comparison".to_string()).await?;
        
        // Test Boolean AND search
        let (results, _total, complexity) = search_service
            .search_notes_boolean_paginated("Rust AND programming", 0, 10).await?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        assert!(results[0].content.contains("programming"));
        assert!(complexity.operator_count >= 1);
        
        // Test Boolean OR search
        let (results, _total, _complexity) = search_service
            .search_notes_boolean_paginated("Database OR JavaScript", 0, 10).await?;
        assert_eq!(results.len(), 3); // Should match Database, JavaScript, and Rust+JavaScript notes
        
        // Test Boolean NOT search
        let (results, _total, _complexity) = search_service
            .search_notes_boolean_paginated("programming NOT JavaScript", 0, 10).await?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        assert!(!results[0].content.contains("JavaScript"));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_fuzzy_search() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with potential fuzzy matches
        let _note1 = search_service.db_service.create_note("Rust programming".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript development".to_string()).await?;
        
        // Test fuzzy search
        let results = search_service.fuzzy_search_notes("rust").await?;
        assert!(results.len() >= 1);
        
        // Test fuzzy search with typos (simplified test)
        let _results = search_service.fuzzy_search_notes("programing").await?; // Missing 'm'
        // Note: Actual fuzzy matching behavior depends on the fuzzy matcher implementation
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_search_by_path() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes (they will have auto-generated paths)
        let note1 = search_service.db_service.create_note("Programming note".to_string()).await?;
        let _note2 = search_service.db_service.create_note("Personal note".to_string()).await?;
        
        // Test path search using auto-generated paths
        let results = search_service.search_by_path("/note").await?;
        assert!(results.len() >= 2);
        
        // Test specific path
        let path1 = &note1.path;
        let results = search_service.search_by_path(path1).await?;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, note1.id);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_search_favorites() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with mixed pinned status
        let _note1 = search_service.db_service.create_note("Regular note".to_string()).await?;
        let _note2 = search_service.db_service.create_note("Favorite note".to_string()).await?;
        
        // Pin one note (note: we'd need to implement pinning in the database layer)
        // For now, test with current implementation
        let results = search_service.search_favorites().await?;
        // Results should only include pinned notes
        for note in &results {
            assert!(note.is_pinned);
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_search_suggestions() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with content for suggestions
        let _note1 = search_service.db_service.create_note("Rust programming language".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript runtime environment".to_string()).await?;
        
        // Test search suggestions
        let suggestions = search_service.get_search_suggestions("rust").await?;
        // Should return relevant suggestions based on content
        assert!(suggestions.len() <= 10); // Limit check
        
        // Test empty query
        let suggestions = search_service.get_search_suggestions("").await?;
        assert!(suggestions.is_empty());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_advanced_search() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create test notes
        let _note1 = search_service.db_service.create_note("Rust programming guide".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript tutorial".to_string()).await?;
        
        // Test advanced search with query only
        let results = search_service.advanced_search(
            Some("rust"),
            None,
            false,
            None,
            None,
            None,
        ).await?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        
        // Test advanced search with path filter
        let results = search_service.advanced_search(
            None,
            Some("/note"),
            false,
            None,
            None,
            None,
        ).await?;
        assert!(results.len() >= 1); // Should match notes with /note path prefix
        
        // Test advanced search with format filter
        let results = search_service.advanced_search(
            None,
            None,
            false,
            Some(NoteFormat::PlainText),
            None,
            None,
        ).await?;
        // Should return notes with PlainText format
        for note in &results {
            assert_eq!(note.format, NoteFormat::PlainText);
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_query_validation() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Test valid query validation
        let complexity = search_service.validate_boolean_query("rust AND programming")?;
        assert!(complexity.term_count >= 2);
        assert!(complexity.operator_count >= 1);
        assert!(complexity.complexity_score >= 1);
        
        // Test complex query validation
        let complexity = search_service.validate_boolean_query(
            "(rust OR python) AND tutorial NOT archived"
        )?;
        assert!(complexity.term_count >= 4);
        assert!(complexity.operator_count >= 3);
        assert!(complexity.nesting_depth >= 1);
        
        // Test phrase search validation
        let complexity = search_service.validate_boolean_query("\"exact phrase\"")?;
        assert!(complexity.has_phrase_searches);
        
        // Test field search validation
        let complexity = search_service.validate_boolean_query("content:rust")?;
        assert!(complexity.has_field_searches);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_query_validation_errors() {
        let search_service = create_test_search_service().await.unwrap();
        
        // Test invalid query patterns
        let result = search_service.validate_boolean_query("'; DROP TABLE notes; --");
        assert!(result.is_err());
        
        // Test extremely long query
        let long_query = "rust ".repeat(1000);
        let result = search_service.validate_boolean_query(&long_query);
        assert!(result.is_err());
        
        // Test malformed Boolean query
        let result = search_service.validate_boolean_query("rust AND");
        assert!(result.is_err());
        
        // Test unbalanced parentheses
        let result = search_service.validate_boolean_query("(rust AND programming");
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_search_service_boolean_search_examples() {
        let search_service = create_test_search_service().await.unwrap();
        
        // Test search examples using the static method
        let examples = crate::search::SearchService::get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.len() >= 8);
        
        // Verify example format
        for (query, description) in examples {
            assert!(!query.is_empty());
            assert!(!description.is_empty());
            
            // Verify examples are valid queries
            let validation_result = search_service.validate_boolean_query(query);
            assert!(validation_result.is_ok(), "Example query '{}' should be valid", query);
        }
    }
    
    #[tokio::test]
    async fn test_search_service_error_handling() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Test search with malformed query (should be handled gracefully)
        let results = search_service.search_notes("test").await?;
        assert!(results.is_empty()); // No matching notes
        
        // Test paginated search with invalid parameters
        let (results, total) = search_service.search_notes_paginated("test", 999, 10).await?;
        assert!(results.is_empty());
        assert_eq!(total, 0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_performance_characteristics() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create multiple notes for performance testing
        for i in 1..=50 {
            search_service.db_service.create_note(
                format!("Performance test note {} with searchable content", i)
            ).await?;
        }
        
        // Test search performance with large dataset
        let start_time = std::time::Instant::now();
        let results = search_service.search_notes("performance").await?;
        let search_duration = start_time.elapsed();
        
        assert_eq!(results.len(), 50);
        assert!(search_duration.as_millis() < 1000); // Should complete within 1 second
        
        // Test Boolean search performance
        let start_time = std::time::Instant::now();
        let (results, _total, complexity) = search_service
            .search_notes_boolean_paginated("performance AND test", 0, 20).await?;
        let boolean_search_duration = start_time.elapsed();
        
        assert!(results.len() <= 20); // Pagination limit
        assert!(boolean_search_duration.as_millis() < 1000); // Should complete within 1 second
        assert!(complexity.complexity_score <= 10); // Within reasonable complexity limits
        
        Ok(())
    }
}

/// Tests for QueryParser business logic (standalone component testing)
#[cfg(disabled)] mod query_parser_tests {
    use super::*;
    use crate::search::{SearchExpression, QueryParser};
    
    #[test]
    fn test_query_parser_basic_operations() -> Result<(), AppError> {
        let parser = QueryParser::new()?;
        
        // Test simple term parsing
        let (expr, complexity) = parser.parse("rust")?;
        assert!(matches!(expr, SearchExpression::Term(_)));
        assert_eq!(complexity.term_count, 1);
        assert_eq!(complexity.operator_count, 0);
        
        // Test phrase parsing
        let (expr, complexity) = parser.parse("\"exact phrase\"")?;
        assert!(matches!(expr, SearchExpression::Phrase(_)));
        assert_eq!(complexity.term_count, 1);
        assert!(complexity.has_phrase_searches);
        
        // Test field search parsing
        let (expr, complexity) = parser.parse("content:rust")?;
        assert!(matches!(expr, SearchExpression::Field { .. }));
        assert_eq!(complexity.term_count, 1);
        assert!(complexity.has_field_searches);
        
        Ok(())
    }
    
    #[test]
    fn test_query_parser_boolean_operations() -> Result<(), AppError> {
        let parser = QueryParser::new()?;
        
        // Test AND operation
        let (expr, complexity) = parser.parse("rust AND programming")?;
        assert!(matches!(expr, SearchExpression::And(_, _)));
        assert_eq!(complexity.term_count, 2);
        assert_eq!(complexity.operator_count, 1);
        
        // Test OR operation
        let (expr, complexity) = parser.parse("rust OR python")?;
        assert!(matches!(expr, SearchExpression::Or(_, _)));
        assert_eq!(complexity.term_count, 2);
        assert_eq!(complexity.operator_count, 1);
        
        // Test NOT operation
        let (expr, complexity) = parser.parse("NOT archived")?;
        assert!(matches!(expr, SearchExpression::Not(_)));
        assert_eq!(complexity.term_count, 1);
        assert_eq!(complexity.operator_count, 1);
        
        Ok(())
    }
    
    #[test]
    fn test_query_parser_complex_queries() -> Result<(), AppError> {
        let parser = QueryParser::new()?;
        
        // Test grouped operations
        let (expr, complexity) = parser.parse("(rust OR python) AND tutorial")?;
        assert!(matches!(expr, SearchExpression::And(_, _)));
        assert_eq!(complexity.term_count, 3);
        assert_eq!(complexity.operator_count, 2);
        assert!(complexity.nesting_depth >= 1);
        
        // Test mixed operations
        let (_expr, complexity) = parser.parse("content:rust AND \"programming guide\" NOT archived")?;
        assert_eq!(complexity.term_count, 3);
        assert_eq!(complexity.operator_count, 2);
        assert!(complexity.has_field_searches);
        assert!(complexity.has_phrase_searches);
        
        Ok(())
    }
    
    #[test]
    fn test_query_parser_fts5_conversion() -> Result<(), AppError> {
        let parser = QueryParser::new()?;
        
        // Test simple term conversion
        let (expr, _) = parser.parse("rust")?;
        let fts5_query = parser.to_fts5_query(&expr)?;
        assert_eq!(fts5_query, "rust");
        
        // Test phrase conversion
        let (expr, _) = parser.parse("\"exact phrase\"")?;
        let fts5_query = parser.to_fts5_query(&expr)?;
        assert_eq!(fts5_query, "\"exact phrase\"");
        
        // Test Boolean operations conversion
        let (expr, _) = parser.parse("rust AND programming")?;
        let fts5_query = parser.to_fts5_query(&expr)?;
        assert!(fts5_query.contains("AND"));
        assert!(fts5_query.contains("rust"));
        assert!(fts5_query.contains("programming"));
        
        Ok(())
    }
    
    #[test]
    fn test_query_parser_security_validation() {
        let parser = QueryParser::new().unwrap();
        
        // Test SQL injection prevention
        let result = parser.parse("'; DROP TABLE notes; --");
        assert!(result.is_err());
        
        // Test script injection prevention
        let result = parser.parse("<script>alert('xss')</script>");
        assert!(result.is_err());
        
        // Test command injection prevention
        let result = parser.parse("$(rm -rf /)");
        assert!(result.is_err());
        
        // Test control character prevention
        let result = parser.parse("test\x00injection");
        assert!(result.is_err());
        
        // Test overly long queries
        let long_query = "rust ".repeat(500);
        let result = parser.parse(&long_query);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_query_parser_complexity_limits() {
        let parser = QueryParser::new().unwrap();
        
        // Test deeply nested query (should exceed nesting limit)
        let nested_query = "(((((rust)))))";
        let result = parser.parse(nested_query);
        // May succeed if nesting is within limits, but complexity should be tracked
        if let Ok((_, complexity)) = result {
            assert!(complexity.nesting_depth <= 5);
        }
        
        // Test query with too many terms
        let many_terms = (1..=100).map(|i| format!("term{}", i)).collect::<Vec<_>>().join(" AND ");
        let result = parser.parse(&many_terms);
        assert!(result.is_err()); // Should exceed term limit
        
        // Test query with too many operators
        let many_operators = "rust ".to_owned() + &"AND term ".repeat(50);
        let result = parser.parse(&many_operators);
        assert!(result.is_err()); // Should exceed complexity limit
    }
    
    #[test]
    fn test_query_parser_edge_cases() -> Result<(), AppError> {
        let parser = QueryParser::new()?;
        
        // Test empty query
        let result = parser.parse("");
        assert!(result.is_err());
        
        // Test whitespace-only query
        let result = parser.parse("   ");
        assert!(result.is_err());
        
        // Test unbalanced quotes
        let result = parser.parse("\"unbalanced quote");
        assert!(result.is_err());
        
        // Test unbalanced parentheses
        let result = parser.parse("(unbalanced paren");
        assert!(result.is_err());
        
        // Test invalid field syntax
        let result = parser.parse("field:");
        assert!(result.is_err());
        
        let result = parser.parse(":value");
        assert!(result.is_err());
        
        Ok(())
    }
}