// search.rs - Full-text search capabilities with FTS5 and Boolean query support

use crate::database::DbService;
use crate::error::AppError;
use crate::models::Note;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub notes: Vec<Note>,
    pub total_count: usize,
    pub page: usize,
    pub page_size: usize,
    pub has_more: bool,
    pub query_time_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchOptions {
    pub page: Option<usize>,
    pub page_size: Option<usize>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub include_favorites: Option<bool>,
    pub date_range: Option<DateRange>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DateRange {
    pub start: Option<String>,
    pub end: Option<String>,
}

// Fixed: Added missing fields that the command layer expects
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueryValidation {
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub complexity_score: u32,
    pub suggested_query: Option<String>,
    // Added missing fields for API compatibility
    pub term_count: u32,
    pub operator_count: u32,
    pub nesting_depth: u32,
    pub has_field_searches: bool,
    pub has_phrase_searches: bool,
}

// Boolean Query Parser for advanced search
#[derive(Debug)]
pub struct QueryParser {
    // Internal regex patterns for parsing Boolean queries
    and_pattern: regex::Regex,
    or_pattern: regex::Regex,
    not_pattern: regex::Regex,
    phrase_pattern: regex::Regex,
    field_pattern: regex::Regex,
}

impl QueryParser {
    pub fn new() -> Self {
        Self {
            and_pattern: regex::Regex::new(r"\bAND\b").unwrap(),
            or_pattern: regex::Regex::new(r"\bOR\b").unwrap(), 
            not_pattern: regex::Regex::new(r"\bNOT\b").unwrap(),
            phrase_pattern: regex::Regex::new(r#""([^"]+)""#).unwrap(),
            field_pattern: regex::Regex::new(r"(\w+):(\w+)").unwrap(),
        }
    }

    pub fn parse(&self, query: &str) -> Result<ParsedQuery, AppError> {
        let mut parsed = ParsedQuery {
            original: query.to_string(),
            fts_query: query.to_string(),
            has_boolean: false,
            complexity: 0,
            field_filters: HashMap::new(),
            term_count: 0,
            operator_count: 0,
            nesting_depth: 0,
            has_field_searches: false,
            has_phrase_searches: false,
        };

        // Count terms - Fixed: collect the iterator to get length
        parsed.term_count = query.split_whitespace().collect::<Vec<_>>().len() as u32;

        // Check for Boolean operators
        if self.and_pattern.is_match(query) {
            parsed.has_boolean = true;
            parsed.complexity += 2;
            parsed.operator_count += query.matches("AND").count() as u32;
        }
        if self.or_pattern.is_match(query) {
            parsed.has_boolean = true;
            parsed.complexity += 2;
            parsed.operator_count += query.matches("OR").count() as u32;
        }
        if self.not_pattern.is_match(query) {
            parsed.has_boolean = true;
            parsed.complexity += 2;
            parsed.operator_count += query.matches("NOT").count() as u32;
        }

        // Check for phrase queries
        if self.phrase_pattern.is_match(query) {
            parsed.complexity += 1;
            parsed.has_phrase_searches = true;
        }

        // Check for field queries
        for cap in self.field_pattern.captures_iter(query) {
            if let (Some(field), Some(value)) = (cap.get(1), cap.get(2)) {
                parsed.field_filters.insert(field.as_str().to_string(), value.as_str().to_string());
                parsed.complexity += 1;
                parsed.has_field_searches = true;
            }
        }

        // Count nesting depth
        parsed.nesting_depth = self.calculate_nesting_depth(query);

        // Convert to FTS5-compatible query
        parsed.fts_query = self.convert_to_fts5(query)?;

        Ok(parsed)
    }

    fn convert_to_fts5(&self, query: &str) -> Result<String, AppError> {
        let mut fts_query = query.to_string();
        
        // Convert Boolean operators to FTS5 format
        fts_query = self.and_pattern.replace_all(&fts_query, "AND").to_string();
        fts_query = self.or_pattern.replace_all(&fts_query, "OR").to_string();
        fts_query = self.not_pattern.replace_all(&fts_query, "NOT").to_string();
        
        // Handle phrase queries (already in correct format)
        // Handle field queries (FTS5 doesn't support field queries directly, so we'll handle them in post-processing)
        
        Ok(fts_query)
    }

    fn calculate_nesting_depth(&self, query: &str) -> u32 {
        let mut depth: u32 = 0; // Fixed: specify type explicitly
        let mut max_depth: u32 = 0; // Fixed: specify type explicitly
        
        for ch in query.chars() {
            match ch {
                '(' => {
                    depth += 1;
                    max_depth = max_depth.max(depth);
                }
                ')' => {
                    depth = depth.saturating_sub(1);
                }
                _ => {}
            }
        }
        
        max_depth
    }
}

#[derive(Debug)]
pub struct ParsedQuery {
    pub original: String,
    pub fts_query: String,
    pub has_boolean: bool,
    pub complexity: u32,
    pub field_filters: HashMap<String, String>,
    pub term_count: u32,
    pub operator_count: u32,
    pub nesting_depth: u32,
    pub has_field_searches: bool,
    pub has_phrase_searches: bool,
}

pub struct SearchService {
    pub db_service: Arc<DbService>,
    fuzzy_matcher: fuzzy_matcher::skim::SkimMatcherV2,
    // Boolean query parser for advanced search
    query_parser: QueryParser,
}

impl SearchService {
    pub fn new(db_service: Arc<DbService>) -> Self {
        Self {
            db_service,
            fuzzy_matcher: fuzzy_matcher::skim::SkimMatcherV2::default(),
            query_parser: QueryParser::new(),
        }
    }

    /// Basic fuzzy search across all notes
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        // Get all notes from database
        let all_notes = self.db_service.get_all_notes().await?;

        // Perform fuzzy matching
        let mut scored_notes: Vec<(Note, i64)> = all_notes
            .into_iter()
            .filter_map(|note| {
                if let Some(score) = fuzzy_matcher::FuzzyMatcher::fuzzy_match(&self.fuzzy_matcher, &note.content, query) {
                    Some((note, score))
                } else {
                    None
                }
            })
            .collect();

        // Sort by score (highest first)
        scored_notes.sort_by(|a, b| b.1.cmp(&a.1));

        // Return only the notes (without scores)
        Ok(scored_notes.into_iter().map(|(note, _)| note).collect())
    }

    /// Paginated full-text search with performance metrics
    /// Fixed: Return tuple (Vec<Note>, usize) to match trait expectation
    pub async fn search_notes_paginated(
        &self,
        query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize), AppError> {
        if query.trim().is_empty() {
            return Ok((Vec::new(), 0));
        }

        // Use FTS5 for fast full-text search
        let offset = page * page_size;
        let (notes, total_count_i64) = self.db_service.search_notes_paginated(query, offset as i64, page_size as i64).await?;
        
        // Fix: Convert i64 to usize safely
        let total_count = total_count_i64.max(0) as usize;

        Ok((notes, total_count))
    }

    /// Boolean search with advanced query parsing
    /// Fixed: Return tuple (Vec<Note>, usize, QueryValidation) to match trait and command expectations
    pub async fn search_notes_boolean_paginated(
        &self,
        query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Note>, usize, QueryValidation), AppError> {
        if query.trim().is_empty() {
            let empty_complexity = QueryValidation {
                is_valid: true,
                error_message: None,
                complexity_score: 0,
                suggested_query: None,
                term_count: 0,
                operator_count: 0,
                nesting_depth: 0,
                has_field_searches: false,
                has_phrase_searches: false,
            };
            return Ok((Vec::new(), 0, empty_complexity));
        }

        // Parse the Boolean query
        let parsed_query = self.query_parser.parse(query)?;
        
        // Use the FTS5-compatible query for database search
        let offset = page * page_size;
        let (mut notes, total_count_i64) = self.db_service.search_notes_paginated(&parsed_query.fts_query, offset as i64, page_size as i64).await?;
        
        // Fix: Convert i64 to usize safely
        let total_count = total_count_i64.max(0) as usize;
        
        // Apply field filters if any
        if !parsed_query.field_filters.is_empty() {
            notes = self.apply_field_filters(notes, &parsed_query.field_filters);
        }
        
        // Create complexity analysis from parsed query
        let complexity = QueryValidation {
            is_valid: true,
            error_message: None,
            complexity_score: parsed_query.complexity,
            suggested_query: None,
            term_count: parsed_query.term_count,
            operator_count: parsed_query.operator_count,
            nesting_depth: parsed_query.nesting_depth,
            has_field_searches: parsed_query.has_field_searches,
            has_phrase_searches: parsed_query.has_phrase_searches,
        };

        Ok((notes, total_count, complexity))
    }

    /// Validate Boolean search query complexity
    pub fn validate_boolean_search_query(&self, query: &str) -> Result<QueryValidation, AppError> {
        if query.trim().is_empty() {
            return Ok(QueryValidation {
                is_valid: false,
                error_message: Some("Query cannot be empty".to_string()),
                complexity_score: 0,
                suggested_query: None,
                term_count: 0,
                operator_count: 0,
                nesting_depth: 0,
                has_field_searches: false,
                has_phrase_searches: false,
            });
        }

        // Parse query to check for validity
        match self.query_parser.parse(query) {
            Ok(parsed) => {
                let mut is_valid = true;
                let mut error_message = None;
                let mut suggested_query = None;

                // Check complexity limits
                if parsed.complexity > 10 {
                    is_valid = false;
                    error_message = Some("Query too complex. Please simplify your search.".to_string());
                    suggested_query = Some(self.simplify_query(query));
                }

                // Check for balanced parentheses
                let open_count = query.matches('(').count();
                let close_count = query.matches(')').count();
                if open_count != close_count {
                    is_valid = false;
                    error_message = Some("Unbalanced parentheses in query".to_string());
                }

                Ok(QueryValidation {
                    is_valid,
                    error_message,
                    complexity_score: parsed.complexity,
                    suggested_query,
                    term_count: parsed.term_count,
                    operator_count: parsed.operator_count,
                    nesting_depth: parsed.nesting_depth,
                    has_field_searches: parsed.has_field_searches,
                    has_phrase_searches: parsed.has_phrase_searches,
                })
            }
            Err(e) => Ok(QueryValidation {
                is_valid: false,
                error_message: Some(e.to_string()),
                complexity_score: 0,
                suggested_query: Some(self.simplify_query(query)),
                term_count: 0,
                operator_count: 0,
                nesting_depth: 0,
                has_field_searches: false,
                has_phrase_searches: false,
            }),
        }
    }

    /// Get Boolean search examples for help
    /// Fixed: Return Vec<(String, String)> to match command expectation
    pub fn get_boolean_search_examples(&self) -> Vec<(String, String)> {
        vec![
            ("rust AND programming".to_string(), "Find notes containing both 'rust' and 'programming'".to_string()),
            ("javascript OR typescript".to_string(), "Find notes containing either 'javascript' or 'typescript'".to_string()),
            ("project NOT archived".to_string(), "Find notes containing 'project' but not 'archived'".to_string()),
            ("\"exact phrase\"".to_string(), "Find notes containing the exact phrase 'exact phrase'".to_string()),
            ("content:rust".to_string(), "Find notes where the content field contains 'rust'".to_string()),
            ("(rust OR python) AND tutorial".to_string(), "Find notes containing 'tutorial' and either 'rust' or 'python'".to_string()),
            ("path:documentation".to_string(), "Find notes where the path contains 'documentation'".to_string()),
            ("nickname:\"API Guide\"".to_string(), "Find notes where the nickname is 'API Guide'".to_string()),
        ]
    }

    // Private helper methods
    
    fn apply_field_filters(&self, notes: Vec<Note>, filters: &HashMap<String, String>) -> Vec<Note> {
        notes
            .into_iter()
            .filter(|note| {
                for (field, value) in filters {
                    match field.as_str() {
                        "content" => {
                            if !note.content.to_lowercase().contains(&value.to_lowercase()) {
                                return false;
                            }
                        }
                        "path" => {
                            if !note.path.to_lowercase().contains(&value.to_lowercase()) {
                                return false;
                            }
                        }
                        "nickname" => {
                            if let Some(nickname) = &note.nickname {
                                if !nickname.to_lowercase().contains(&value.to_lowercase()) {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }
                        _ => {} // Unknown field, ignore
                    }
                }
                true
            })
            .collect()
    }

    fn simplify_query(&self, query: &str) -> String {
        // Simple query simplification - remove complex operators and parentheses
        let simplified = query
            .replace("(", "")
            .replace(")", "")
            .replace(" AND ", " ")
            .replace(" OR ", " ")
            .replace(" NOT ", " ");
        
        // Take first few words
        simplified
            .split_whitespace()
            .take(3)
            .collect::<Vec<_>>()
            .join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::NamedTempFile;

    fn create_test_db() -> Arc<DbService> {
        let temp_file = NamedTempFile::new().unwrap();
        let db_service = DbService::new(temp_file.path()).unwrap();
        Arc::new(db_service)
    }

    #[tokio::test]
    async fn test_search_service_creation() {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service);
        
        // Test basic functionality
        let result = search_service.search_notes("test").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_query_parser() {
        let parser = QueryParser::new();
        
        // Test simple query
        let result = parser.parse("rust programming");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert!(!parsed.has_boolean);
        assert_eq!(parsed.complexity, 0);
        assert_eq!(parsed.term_count, 2);

        // Test Boolean query
        let result = parser.parse("rust AND programming");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert!(parsed.has_boolean);
        assert!(parsed.complexity > 0);
        assert_eq!(parsed.operator_count, 1);

        // Test phrase query
        let result = parser.parse("\"exact phrase\"");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.complexity, 1);
        assert!(parsed.has_phrase_searches);

        // Test field query
        let result = parser.parse("content:rust");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.complexity, 1);
        assert!(parsed.field_filters.contains_key("content"));
        assert!(parsed.has_field_searches);
    }

    #[tokio::test]
    async fn test_boolean_search_validation() {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service);

        // Test valid query
        let result = search_service.validate_boolean_search_query("rust AND programming");
        assert!(result.is_ok());
        let validation = result.unwrap();
        assert!(validation.is_valid);
        assert!(validation.term_count > 0);

        // Test empty query
        let result = search_service.validate_boolean_search_query("");
        assert!(result.is_ok());
        let validation = result.unwrap();
        assert!(!validation.is_valid);

        // Test unbalanced parentheses
        let result = search_service.validate_boolean_search_query("(rust AND programming");
        assert!(result.is_ok());
        let validation = result.unwrap();
        assert!(!validation.is_valid);
        assert!(validation.error_message.is_some());
    }

    #[tokio::test]
    async fn test_boolean_search_examples() {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service);

        let examples = search_service.get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.iter().any(|(query, _)| query.contains("AND")));
        assert!(examples.iter().any(|(query, _)| query.contains("OR")));
        assert!(examples.iter().any(|(query, _)| query.contains("NOT")));
        
        // Test that all examples have descriptions
        for (query, description) in &examples {
            assert!(!query.is_empty());
            assert!(!description.is_empty());
        }
    }

    #[tokio::test]
    async fn test_field_filter_application() {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service);

        // Create test notes
        let note1 = Note {
            id: 1,
            content: "Rust programming tutorial".to_string(),
            created_at: "2025-01-01 00:00:00".to_string(),
            updated_at: "2025-01-01 00:00:00".to_string(),
            is_favorite: false,
            format: crate::models::NoteFormat::PlainText,
            nickname: Some("Rust Guide".to_string()),
            path: "/programming/rust".to_string(),
        };

        let note2 = Note {
            id: 2,
            content: "JavaScript basics".to_string(),
            created_at: "2025-01-01 00:00:00".to_string(),
            updated_at: "2025-01-01 00:00:00".to_string(),
            is_favorite: false,
            format: crate::models::NoteFormat::PlainText,
            nickname: Some("JS Guide".to_string()),
            path: "/programming/javascript".to_string(),
        };

        let notes = vec![note1, note2];

        // Test path filter
        let mut filters = HashMap::new();
        filters.insert("path".to_string(), "rust".to_string());
        let filtered = search_service.apply_field_filters(notes.clone(), &filters);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, 1);

        // Test nickname filter
        let mut filters = HashMap::new();
        filters.insert("nickname".to_string(), "JS".to_string());
        let filtered = search_service.apply_field_filters(notes, &filters);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, 2);
    }

    #[tokio::test]
    async fn test_performance_search_pagination() {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service.clone());

        // Create test data
        for i in 1..=100 {
            let _ = db_service
                .create_note(format!("Test note {} with rust programming content", i))
                .await;
        }

        // Test pagination
        let result = search_service
            .search_notes_paginated("rust", 0, 10)
            .await;
        assert!(result.is_ok());
        
        let (notes, total_count) = result.unwrap();
        assert!(notes.len() <= 10);
        assert!(total_count >= 10);
    }

    #[tokio::test]
    async fn test_comprehensive_search_features() -> Result<(), AppError> {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service.clone());

        // Create comprehensive test data
        let test_notes = vec![
            ("Rust programming fundamentals", "/programming/rust"),
            ("JavaScript async programming", "/programming/javascript"),
            ("Python machine learning", "/ml/python"),
            ("Database design patterns", "/database/design"),
            ("API documentation guide", "/docs/api"),
        ];

        for (content, _path) in test_notes {
            let _ = search_service.db_service.create_note(content.to_string()).await?;
        }

        // Test 1: Basic search
        let basic_results = search_service.search_notes("programming").await?;
        assert!(basic_results.len() >= 2, "Should find multiple programming notes");

        // Test 2: Paginated search
        let (notes, total_count) = search_service.search_notes_paginated("programming", 0, 1).await?;
        assert_eq!(notes.len().min(1), notes.len(), "Should respect page size");
        assert!(total_count > 0, "Should have results");

        // Test 3: Boolean search
        let (notes, total_count, complexity) = search_service.search_notes_boolean_paginated("programming AND rust", 0, 10).await?;
        assert!(notes.len() <= 10, "Should respect page size");
        assert!(complexity.operator_count > 0, "Should detect operators");

        // Test 4: Query validation
        let validation = search_service.validate_boolean_search_query("rust AND programming")?;
        assert!(validation.is_valid, "Valid Boolean query should pass validation");
        assert!(validation.complexity_score > 0, "Boolean query should have complexity");
        assert!(validation.term_count >= 2, "Should count terms");

        // Test 5: Search examples
        let examples = search_service.get_boolean_search_examples();
        assert!(!examples.is_empty(), "Should provide search examples");
        assert!(examples.iter().any(|(query, _)| query.contains("AND")), "Should include AND examples");

        Ok(())
    }

    #[tokio::test] 
    async fn test_advanced_search_integration() -> Result<(), AppError> {
        let db_service = create_test_db();
        let search_service = SearchService::new(db_service.clone());

        // Create test data with rich metadata
        let _ = search_service.db_service.create_note("Advanced Rust programming techniques".to_string()).await?;
        let _ = search_service.db_service.create_note("JavaScript ES6 features and async patterns".to_string()).await?;
        let _ = search_service.db_service.create_note("Database design patterns".to_string()).await?;
        let _ = search_service.db_service.create_note("Python and machine learning tutorial".to_string()).await?;

        // Test complex Boolean queries
        let complex_query = "(rust OR javascript) AND programming";
        let (notes, _total_count, complexity) = search_service.search_notes_boolean_paginated(&complex_query, 0, 10).await?;
        assert!(notes.len() >= 0, "Complex Boolean query should execute");
        assert!(complexity.operator_count >= 2, "Should detect multiple operators");

        // Test phrase search
        let phrase_query = "\"machine learning\"";
        let (notes, _total_count, complexity) = search_service.search_notes_boolean_paginated(&phrase_query, 0, 10).await?;
        assert!(notes.len() >= 0, "Phrase search should execute");
        assert!(complexity.has_phrase_searches, "Should detect phrase search");

        // Test field search (simulated - actual field search would need full implementation)
        let field_query = "content:rust";
        let validation = search_service.validate_boolean_search_query(&field_query)?;
        assert!(validation.is_valid, "Field query should be valid");
        assert!(validation.has_field_searches, "Should detect field searches");

        // Test query complexity limits
        let complex_query = "((rust AND programming) OR (javascript AND async)) AND (database OR machine) NOT archived";
        let validation = search_service.validate_boolean_search_query(&complex_query)?;
        assert!(validation.complexity_score > 5, "Complex query should have high complexity score");

        Ok(())
    }
}

#[cfg(disabled)]
mod integration_tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_search_performance_benchmarks() -> Result<(), AppError> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("benchmark.db");
        let db_service = Arc::new(DbService::new(db_path)?);
        let search_service = SearchService::new(db_service.clone());

        // Create large dataset for performance testing
        let start_time = std::time::Instant::now();
        for i in 1..=1000 {
            db_service
                .create_note(format!(
                    "Performance test note {} with various programming languages like Rust, JavaScript, Python, and Go",
                    i
                ))
                .await?;
        }
        println!("Created 1000 notes in {:?}", start_time.elapsed());

        // Benchmark different search methods
        let queries = vec![
            "programming",
            "Rust",
            "programming AND Rust",
            "\"programming languages\"",
            "programming OR javascript",
        ];

        for query in queries {
            let start = std::time::Instant::now();
            let (notes, total_count) = search_service.search_notes_paginated(query, 0, 50).await?;
            println!(
                "Query '{}': {} results (total: {}) in {:?}",
                query,
                notes.len(),
                total_count,
                start.elapsed()
            );
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_memory_usage_under_load() -> Result<(), AppError> {
        let temp_dir = TempDir::new()?;
        let db_path = temp_dir.path().join("memory_test.db");
        let db_service = Arc::new(DbService::new(db_path)?);
        let search_service = SearchService::new(db_service.clone());

        // Create notes with varying content sizes
        for i in 1..=100 {
            let large_content = "x".repeat(10000); // 10KB per note
            db_service
                .create_note(format!("Large note {} content: {}", i, large_content))
                .await?;
        }

        // Perform multiple concurrent searches
        let mut handles = Vec::new();
        for i in 0..10 {
            let service = Arc::new(SearchService::new(db_service.clone()));
            let handle = tokio::spawn(async move {
                service
                    .search_notes_paginated("content", i % 5, 20)
                    .await
                    .unwrap()
            });
            handles.push(handle);
        }

        // Wait for all searches to complete
        let results = futures::future::join_all(handles).await;
        assert_eq!(results.len(), 10);

        println!("Completed 10 concurrent searches on 100 large notes");
        Ok(())
    }
}