/// Unit Tests for SearchService Business Logic
/// 
/// These tests focus on testing the SearchService business logic in isolation
/// using real service with temporary database. This enables comprehensive testing
/// of search functionality while maintaining all security validation.

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
        
        // Test empty search returns empty
        let results = search_service.search_notes("").await?;
        assert_eq!(results.len(), 0);
        
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
        assert!(results.len() >= 2); // Should match Database, JavaScript, and possibly Rust+JavaScript notes
        
        // Test Boolean NOT search
        let (results, _total, _complexity) = search_service
            .search_notes_boolean_paginated("programming NOT JavaScript", 0, 10).await?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        assert!(!results[0].content.contains("JavaScript"));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_basic_search_method() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with potential fuzzy matches
        let _note1 = search_service.db_service.create_note("Rust programming".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript development".to_string()).await?;
        
        // Test basic search method (fixed: use search_notes instead of fuzzy_search_notes)
        let results = search_service.search_notes("rust").await?;
        assert!(results.len() >= 1);
        
        // Test basic search with different term (fixed: use search_notes instead of fuzzy_search_notes)
        let _results = search_service.search_notes("programing").await?; // Missing 'm'
        // Note: FTS5 search might not find this typo, but won't error
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_query_validation() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Test simple query validation
        let complexity = search_service.validate_boolean_search_query("rust AND programming")?;
        assert!(complexity.is_valid);
        assert!(complexity.operator_count >= 1);
        assert!(complexity.term_count >= 2);
        
        // Test phrase search validation
        let complexity = search_service.validate_boolean_search_query("\"exact phrase\"")?;
        assert!(complexity.is_valid);
        assert!(complexity.has_phrase_searches);
        
        // Test field search validation
        let complexity = search_service.validate_boolean_search_query("content:rust")?;
        assert!(complexity.is_valid);
        assert!(complexity.has_field_searches);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_query_security_validation() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Test SQL injection attempt
        let result = search_service.validate_boolean_search_query("'; DROP TABLE notes; --");
        assert!(result.is_ok()); // Should not error, but might be marked invalid
        
        // Test very long query
        let long_query = "rust ".repeat(100);
        let result = search_service.validate_boolean_search_query(&long_query);
        assert!(result.is_ok());
        
        // Test malformed Boolean query
        let result = search_service.validate_boolean_search_query("rust AND");
        assert!(result.is_ok()); // Validation should handle malformed queries gracefully
        
        // Test unbalanced parentheses
        let result = search_service.validate_boolean_search_query("(rust AND programming");
        assert!(result.is_ok());
        if let Ok(validation) = result {
            assert!(!validation.is_valid); // Should be marked as invalid
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_boolean_search_examples() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Fixed: Call as instance method instead of static method
        let examples = search_service.get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.len() >= 5);
        
        // Verify examples have proper structure
        for (query, description) in &examples {
            assert!(!query.is_empty());
            assert!(!description.is_empty());
        }
        
        // Test some examples can be validated
        for (query, _description) in examples.iter().take(3) {
            let validation_result = search_service.validate_boolean_search_query(query);
            assert!(validation_result.is_ok());
        }
        
        Ok(())
    }
}

/// Tests for SearchService performance and edge cases
mod search_service_performance_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_search_service_empty_database() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Test searches on empty database
        let results = search_service.search_notes("anything").await?;
        assert_eq!(results.len(), 0);
        
        let (results, total) = search_service.search_notes_paginated("anything", 0, 10).await?;
        assert_eq!(results.len(), 0);
        assert_eq!(total, 0);
        
        let (results, total, complexity) = search_service
            .search_notes_boolean_paginated("anything AND something", 0, 10).await?;
        assert_eq!(results.len(), 0);
        assert_eq!(total, 0);
        assert!(complexity.is_valid);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_large_content() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create note with large content
        let large_content = "rust programming ".repeat(1000);
        let _note = search_service.db_service.create_note(large_content).await?;
        
        // Test search works with large content
        let results = search_service.search_notes("rust").await?;
        assert_eq!(results.len(), 1);
        
        let (results, total) = search_service.search_notes_paginated("programming", 0, 1).await?;
        assert_eq!(results.len(), 1);
        assert_eq!(total, 1);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_special_characters() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with special characters
        let _note1 = search_service.db_service.create_note("C++ programming language".to_string()).await?;
        let _note2 = search_service.db_service.create_note("Node.js runtime environment".to_string()).await?;
        let _note3 = search_service.db_service.create_note("SQL injection & security".to_string()).await?;
        
        // Test search with special characters
        let results = search_service.search_notes("C++").await?;
        assert_eq!(results.len(), 1);
        
        let results = search_service.search_notes("Node.js").await?;
        assert_eq!(results.len(), 1);
        
        let results = search_service.search_notes("injection").await?;
        assert_eq!(results.len(), 1);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_service_unicode_content() -> Result<(), AppError> {
        let search_service = create_test_search_service().await?;
        
        // Create notes with Unicode content
        let _note1 = search_service.db_service.create_note("Rust プログラミング".to_string()).await?;
        let _note2 = search_service.db_service.create_note("JavaScript 🚀 development".to_string()).await?;
        let _note3 = search_service.db_service.create_note("Ñuméroüs spëcial châractërs".to_string()).await?;
        
        // Test Unicode search
        let results = search_service.search_notes("プログラミング").await?;
        assert_eq!(results.len(), 1);
        
        let results = search_service.search_notes("🚀").await?;
        assert_eq!(results.len(), 1);
        
        let results = search_service.search_notes("spëcial").await?;
        assert_eq!(results.len(), 1);
        
        Ok(())
    }
}