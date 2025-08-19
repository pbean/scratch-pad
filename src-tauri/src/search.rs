use std::sync::Arc;
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;
use crate::database::DbService;
use crate::models::Note;
use crate::error::AppError;
use regex::Regex;
use std::fmt;

/// Boolean Search Query Parser
/// 
/// Implements advanced search query parsing with Boolean operators for the FTS5 engine.
/// Maintains the Week 1 and Week 2 security standards with comprehensive validation
/// and injection protection.

/// Represents the structure of a parsed search query
#[derive(Debug, Clone, PartialEq)]
pub enum SearchExpression {
    /// Simple term search
    Term(String),
    /// Phrase search with exact matching
    Phrase(String),
    /// Field-specific search (field:value)
    Field { field: String, value: String },
    /// AND operation between two expressions
    And(Box<SearchExpression>, Box<SearchExpression>),
    /// OR operation between two expressions  
    Or(Box<SearchExpression>, Box<SearchExpression>),
    /// NOT operation (negation)
    Not(Box<SearchExpression>),
    /// Grouped expression (parentheses)
    Group(Box<SearchExpression>),
}

impl fmt::Display for SearchExpression {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SearchExpression::Term(term) => write!(f, "{}", term),
            SearchExpression::Phrase(phrase) => write!(f, "\"{}\"", phrase),
            SearchExpression::Field { field, value } => write!(f, "{}:{}", field, value),
            SearchExpression::And(left, right) => write!(f, "({} AND {})", left, right),
            SearchExpression::Or(left, right) => write!(f, "({} OR {})", left, right),
            SearchExpression::Not(expr) => write!(f, "NOT {}", expr),
            SearchExpression::Group(expr) => write!(f, "({})", expr),
        }
    }
}

/// Query complexity metrics for performance monitoring
#[derive(Debug, Clone)]
pub struct QueryComplexity {
    /// Number of terms in the query
    pub term_count: u32,
    /// Number of Boolean operators
    pub operator_count: u32,
    /// Maximum nesting depth
    pub nesting_depth: u32,
    /// Whether query contains field searches
    pub has_field_searches: bool,
    /// Whether query contains phrase searches
    pub has_phrase_searches: bool,
    /// Estimated performance impact (1-5 scale)
    pub complexity_score: u32,
}

impl QueryComplexity {
    fn new() -> Self {
        Self {
            term_count: 0,
            operator_count: 0,
            nesting_depth: 0,
            has_field_searches: false,
            has_phrase_searches: false,
            complexity_score: 1,
        }
    }
    
    /// Calculate final complexity score
    fn calculate_score(&mut self) {
        self.complexity_score = std::cmp::min(5, 
            1 + (self.term_count / 5) + (self.operator_count / 2) + self.nesting_depth +
            if self.has_field_searches { 1 } else { 0 } +
            if self.has_phrase_searches { 1 } else { 0 }
        );
    }
}

/// Advanced query parser with Boolean operators and security validation
pub struct QueryParser {
    /// Regex for detecting SQL injection patterns
    injection_detector: Regex,
    /// Regex for validating field names
    field_validator: Regex,
    /// Maximum query complexity allowed
    max_complexity: u32,
    /// Maximum query length
    max_length: usize,
}

impl QueryParser {
    pub fn new() -> Result<Self, AppError> {
        // Comprehensive SQL injection detection patterns
        let injection_patterns = vec![
            r"(?i)(union|select|insert|update|delete|drop|create|alter)",
            r"(?i)(exec|execute|sp_|xp_|cmdshell)",
            r"(?i)(script|javascript|vbscript|onload|onerror)",
            r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", // Control characters
            r"(--|/\*|\*/|;)",
            r"(?i)(char|ascii|substring)\s*\(",
        ].join("|");
        
        let injection_detector = Regex::new(&injection_patterns)
            .map_err(|e| AppError::Validation {
                field: "injection_detector".to_string(),
                message: format!("Failed to compile injection detection regex: {}", e),
            })?;
        
        // Field name validation (alphanumeric + underscore only)
        let field_validator = Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
            .map_err(|e| AppError::Validation {
                field: "field_validator".to_string(),
                message: format!("Failed to compile field validation regex: {}", e),
            })?;
        
        Ok(Self {
            injection_detector,
            field_validator,
            max_complexity: 10, // Reasonable limit for performance
            max_length: 1000,   // Same as existing query length limit
        })
    }
    
    /// Parse a search query into a SearchExpression tree
    pub fn parse(&self, query: &str) -> Result<(SearchExpression, QueryComplexity), AppError> {
        // Security validation first
        self.validate_query_security(query)?;
        
        // Initialize complexity tracking
        let mut complexity = QueryComplexity::new();
        
        // Parse the query
        let mut tokens = self.tokenize(query)?;
        let expression = self.parse_expression(&mut tokens, &mut complexity, 0)?;
        
        // Calculate final complexity score
        complexity.calculate_score();
        
        // Validate complexity limits
        self.validate_complexity(&complexity)?;
        
        Ok((expression, complexity))
    }
    
    /// Convert SearchExpression to FTS5-compatible query
    pub fn to_fts5_query(&self, expression: &SearchExpression) -> Result<String, AppError> {
        let fts5_query = self.expression_to_fts5(expression)?;
        
        // Additional FTS5-specific validation
        self.validate_fts5_query(&fts5_query)?;
        
        Ok(fts5_query)
    }
    
    /// Security validation for raw query input
    fn validate_query_security(&self, query: &str) -> Result<(), AppError> {
        // Length validation
        if query.len() > self.max_length {
            return Err(AppError::Validation {
                field: "query_length".to_string(),
                message: format!("Query length {} exceeds maximum {}", query.len(), self.max_length),
            });
        }
        
        // SQL injection detection
        if self.injection_detector.is_match(query) {
            return Err(AppError::Validation {
                field: "query_security".to_string(),
                message: "Query contains potentially malicious patterns".to_string(),
            });
        }
        
        // Additional security checks
        if query.chars().any(|c| c.is_control() && c != '\t' && c != '\n' && c != '\r') {
            return Err(AppError::Validation {
                field: "query_characters".to_string(),
                message: "Query contains invalid control characters".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Validate query complexity to prevent performance issues
    fn validate_complexity(&self, complexity: &QueryComplexity) -> Result<(), AppError> {
        if complexity.complexity_score > self.max_complexity {
            return Err(AppError::Validation {
                field: "query_complexity".to_string(),
                message: format!("Query complexity {} exceeds maximum {}", 
                               complexity.complexity_score, self.max_complexity),
            });
        }
        
        if complexity.nesting_depth > 5 {
            return Err(AppError::Validation {
                field: "query_nesting".to_string(),
                message: format!("Query nesting depth {} exceeds maximum 5", complexity.nesting_depth),
            });
        }
        
        if complexity.term_count > 50 {
            return Err(AppError::Validation {
                field: "query_terms".to_string(),
                message: format!("Query term count {} exceeds maximum 50", complexity.term_count),
            });
        }
        
        Ok(())
    }
    
    /// Tokenize the query string into parseable tokens
    fn tokenize(&self, query: &str) -> Result<Vec<Token>, AppError> {
        let mut tokens = Vec::new();
        let mut chars = query.char_indices().peekable();
        
        while let Some((_i, ch)) = chars.next() {
            match ch {
                ' ' | '\t' | '\n' | '\r' => continue, // Skip whitespace
                '(' => tokens.push(Token::LeftParen),
                ')' => tokens.push(Token::RightParen),
                '"' => {
                    // Parse quoted phrase
                    let mut phrase = String::new();
                    let mut escaped = false;
                    
                    while let Some((_, ch)) = chars.next() {
                        if escaped {
                            phrase.push(ch);
                            escaped = false;
                        } else if ch == '\\' {
                            escaped = true;
                        } else if ch == '"' {
                            break;
                        } else {
                            phrase.push(ch);
                        }
                    }
                    
                    if phrase.is_empty() {
                        return Err(AppError::Validation {
                            field: "query_syntax".to_string(),
                            message: "Empty quoted phrase".to_string(),
                        });
                    }
                    
                    tokens.push(Token::Phrase(phrase));
                }
                _ => {
                    // Parse word or operator
                    let mut word = String::new();
                    // Fixed: removed unused variable j
                    
                    while let Some(&(_, ch)) = chars.peek() {
                        if ch.is_whitespace() || ch == '(' || ch == ')' || ch == '"' {
                            break;
                        }
                        word.push(ch);
                        chars.next();
                    }
                    
                    word.push(ch);
                    
                    // Check if it's an operator
                    match word.to_uppercase().as_str() {
                        "AND" => tokens.push(Token::And),
                        "OR" => tokens.push(Token::Or),
                        "NOT" => tokens.push(Token::Not),
                        _ => {
                            // Check if it's a field search (field:value)
                            if let Some(colon_pos) = word.find(':') {
                                let field = word[..colon_pos].to_string();
                                let value = word[colon_pos + 1..].to_string();
                                
                                if field.is_empty() || value.is_empty() {
                                    return Err(AppError::Validation {
                                        field: "query_field".to_string(),
                                        message: "Invalid field search format".to_string(),
                                    });
                                }
                                
                                // Validate field name
                                if !self.field_validator.is_match(&field) {
                                    return Err(AppError::Validation {
                                        field: "query_field".to_string(),
                                        message: format!("Invalid field name: {}", field),
                                    });
                                }
                                
                                tokens.push(Token::Field { field, value });
                            } else {
                                tokens.push(Token::Term(word));
                            }
                        }
                    }
                }
            }
        }
        
        Ok(tokens)
    }
    
    /// Parse tokens into expression tree
    fn parse_expression(
        &self, 
        tokens: &mut Vec<Token>, 
        complexity: &mut QueryComplexity,
        depth: u32
    ) -> Result<SearchExpression, AppError> {
        complexity.nesting_depth = complexity.nesting_depth.max(depth);
        
        if tokens.is_empty() {
            return Err(AppError::Validation {
                field: "query_syntax".to_string(),
                message: "Unexpected end of query".to_string(),
            });
        }
        
        self.parse_or_expression(tokens, complexity, depth)
    }
    
    /// Parse OR expressions (lowest precedence)
    fn parse_or_expression(
        &self,
        tokens: &mut Vec<Token>,
        complexity: &mut QueryComplexity,
        depth: u32
    ) -> Result<SearchExpression, AppError> {
        let mut left = self.parse_and_expression(tokens, complexity, depth)?;
        
        while !tokens.is_empty() && matches!(tokens[0], Token::Or) {
            tokens.remove(0); // Remove OR token
            complexity.operator_count += 1;
            let right = self.parse_and_expression(tokens, complexity, depth)?;
            left = SearchExpression::Or(Box::new(left), Box::new(right));
        }
        
        Ok(left)
    }
    
    /// Parse AND expressions (higher precedence than OR)
    fn parse_and_expression(
        &self,
        tokens: &mut Vec<Token>,
        complexity: &mut QueryComplexity,
        depth: u32
    ) -> Result<SearchExpression, AppError> {
        let mut left = self.parse_not_expression(tokens, complexity, depth)?;
        
        while !tokens.is_empty() && (matches!(tokens[0], Token::And) || 
                                    matches!(tokens[0], Token::Term(_)) ||
                                    matches!(tokens[0], Token::Phrase(_)) ||
                                    matches!(tokens[0], Token::Field { .. }) ||
                                    matches!(tokens[0], Token::LeftParen)) {
            
            // Handle implicit AND (two terms next to each other)
            if matches!(tokens[0], Token::And) {
                tokens.remove(0); // Remove AND token
                complexity.operator_count += 1;
            } else {
                // Implicit AND
                complexity.operator_count += 1;
            }
            
            let right = self.parse_not_expression(tokens, complexity, depth)?;
            left = SearchExpression::And(Box::new(left), Box::new(right));
        }
        
        Ok(left)
    }
    
    /// Parse NOT expressions (highest precedence)
    fn parse_not_expression(
        &self,
        tokens: &mut Vec<Token>,
        complexity: &mut QueryComplexity,
        depth: u32
    ) -> Result<SearchExpression, AppError> {
        if !tokens.is_empty() && matches!(tokens[0], Token::Not) {
            tokens.remove(0); // Remove NOT token
            complexity.operator_count += 1;
            let expr = self.parse_primary_expression(tokens, complexity, depth)?;
            Ok(SearchExpression::Not(Box::new(expr)))
        } else {
            self.parse_primary_expression(tokens, complexity, depth)
        }
    }
    
    /// Parse primary expressions (terms, phrases, fields, groups)
    fn parse_primary_expression(
        &self,
        tokens: &mut Vec<Token>,
        complexity: &mut QueryComplexity,
        depth: u32
    ) -> Result<SearchExpression, AppError> {
        if tokens.is_empty() {
            return Err(AppError::Validation {
                field: "query_syntax".to_string(),
                message: "Unexpected end of expression".to_string(),
            });
        }
        
        let token = tokens.remove(0);
        
        match token {
            Token::Term(term) => {
                complexity.term_count += 1;
                Ok(SearchExpression::Term(term))
            }
            Token::Phrase(phrase) => {
                complexity.term_count += 1;
                complexity.has_phrase_searches = true;
                Ok(SearchExpression::Phrase(phrase))
            }
            Token::Field { field, value } => {
                complexity.term_count += 1;
                complexity.has_field_searches = true;
                Ok(SearchExpression::Field { field, value })
            }
            Token::LeftParen => {
                let expr = self.parse_expression(tokens, complexity, depth + 1)?;
                
                if tokens.is_empty() || !matches!(tokens[0], Token::RightParen) {
                    return Err(AppError::Validation {
                        field: "query_syntax".to_string(),
                        message: "Missing closing parenthesis".to_string(),
                    });
                }
                
                tokens.remove(0); // Remove right paren
                Ok(SearchExpression::Group(Box::new(expr)))
            }
            _ => Err(AppError::Validation {
                field: "query_syntax".to_string(),
                message: format!("Unexpected token: {:?}", token),
            })
        }
    }
    
    /// Convert SearchExpression to FTS5 query string
    fn expression_to_fts5(&self, expression: &SearchExpression) -> Result<String, AppError> {
        match expression {
            SearchExpression::Term(term) => {
                // Escape FTS5 special characters
                let escaped = self.escape_fts5_term(term)?;
                Ok(escaped)
            }
            SearchExpression::Phrase(phrase) => {
                // FTS5 phrase search
                let escaped = self.escape_fts5_term(phrase)?;
                Ok(format!("\"{}\"", escaped))
            }
            SearchExpression::Field { field, value } => {
                // Map field names to actual database columns
                let column = self.map_field_to_column(field)?;
                let escaped_value = self.escape_fts5_term(value)?;
                Ok(format!("{}: \"{}\"", column, escaped_value))
            }
            SearchExpression::And(left, right) => {
                let left_query = self.expression_to_fts5(left)?;
                let right_query = self.expression_to_fts5(right)?;
                Ok(format!("({} AND {})", left_query, right_query))
            }
            SearchExpression::Or(left, right) => {
                let left_query = self.expression_to_fts5(left)?;
                let right_query = self.expression_to_fts5(right)?;
                Ok(format!("({} OR {})", left_query, right_query))
            }
            SearchExpression::Not(expr) => {
                let sub_query = self.expression_to_fts5(expr)?;
                Ok(format!("NOT {}", sub_query))
            }
            SearchExpression::Group(expr) => {
                let sub_query = self.expression_to_fts5(expr)?;
                Ok(format!("({})", sub_query))
            }
        }
    }
    
    /// Escape special characters for FTS5
    fn escape_fts5_term(&self, term: &str) -> Result<String, AppError> {
        // FTS5 special characters that need escaping
        let mut escaped = String::new();
        
        for ch in term.chars() {
            match ch {
                '"' => escaped.push_str("\"\""), // Escape quotes by doubling
                '\'' => escaped.push_str("''"),  // Escape single quotes
                '\\' => escaped.push_str("\\\\"), // Escape backslashes
                '\x00'..='\x1F' | '\x7F' => {
                    // Remove control characters
                    continue;
                }
                _ => escaped.push(ch),
            }
        }
        
        // Additional validation
        if escaped.is_empty() {
            return Err(AppError::Validation {
                field: "search_term".to_string(),
                message: "Search term cannot be empty after escaping".to_string(),
            });
        }
        
        Ok(escaped)
    }
    
    /// Map user field names to database columns
    fn map_field_to_column(&self, field: &str) -> Result<&'static str, AppError> {
        match field.to_lowercase().as_str() {
            "content" => Ok("content"),
            "path" => Ok("path"),
            "nickname" => Ok("nickname"), 
            "title" => Ok("nickname"), // Alias for nickname
            _ => Err(AppError::Validation {
                field: "search_field".to_string(),
                message: format!("Unknown search field: {}", field),
            })
        }
    }
    
    /// Validate final FTS5 query for safety
    fn validate_fts5_query(&self, query: &str) -> Result<(), AppError> {
        // Check for FTS5-specific injection patterns
        let fts5_patterns = [
            r"(?i)(NEAR|MATCH)",
            r"\*\s*\*", // Multiple wildcards
            r"(\s|^)-{2,}", // Multiple dashes
        ];
        
        for pattern in &fts5_patterns {
            let regex = Regex::new(pattern).map_err(|e| AppError::Validation {
                field: "fts5_validation".to_string(),
                message: format!("Failed to compile FTS5 validation regex: {}", e),
            })?;
            
            if regex.is_match(query) {
                return Err(AppError::Validation {
                    field: "fts5_query".to_string(),
                    message: "Query contains potentially problematic FTS5 patterns".to_string(),
                });
            }
        }
        
        Ok(())
    }
}

/// Internal token types for parsing
#[derive(Debug, Clone)]
enum Token {
    Term(String),
    Phrase(String),
    Field { field: String, value: String },
    And,
    Or,
    Not,
    LeftParen,
    RightParen,
}

impl Default for QueryParser {
    fn default() -> Self {
        Self::new().expect("Failed to create default QueryParser")
    }
}

pub struct SearchService {
    pub db_service: Arc<DbService>,
    fuzzy_matcher: SkimMatcherV2,
    // Boolean query parser for advanced search
    query_parser: QueryParser,
}

impl Clone for SearchService {
    fn clone(&self) -> Self {
        Self {
            db_service: Arc::clone(&self.db_service),
            fuzzy_matcher: SkimMatcherV2::default(),
            query_parser: QueryParser::new().expect("Failed to create query parser"),
        }
    }
}

impl SearchService {
    pub fn new(db_service: Arc<DbService>) -> Self {
        Self {
            db_service,
            fuzzy_matcher: SkimMatcherV2::default(),
            query_parser: QueryParser::new().expect("Failed to create query parser"),
        }
    }

    /// Search notes using FTS5 full-text search
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            // Return all notes if query is empty
            return self.db_service.get_all_notes().await;
        }

        let conn = self.db_service.get_connection()?;
        
        // Use FTS5 for full-text search
        let mut stmt = conn.prepare_cached(
            "SELECT n.id, n.content, n.format, n.nickname, n.path, n.is_favorite, n.created_at, n.updated_at 
             FROM notes n
             JOIN notes_fts f ON n.id = f.rowid
             WHERE notes_fts MATCH ?
             ORDER BY rank"
        )?;

        let note_iter = stmt.query_map([query], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    /// Search notes with pagination using FTS5 for efficient memory usage
    /// Returns (notes, total_count) tuple for pagination metadata
    pub async fn search_notes_paginated(&self, query: &str, page: usize, page_size: usize) -> Result<(Vec<Note>, usize), AppError> {
        let conn = self.db_service.get_connection()?;
        
        // First get total count for pagination metadata
        let total_count = if query.trim().is_empty() {
            // Count all notes if query is empty
            let mut count_stmt = conn.prepare_cached("SELECT COUNT(*) FROM notes")?;
            count_stmt.query_row([], |row| row.get::<_, usize>(0))?
        } else {
            // Count FTS5 search results
            let mut count_stmt = conn.prepare_cached(
                "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?"
            )?;
            count_stmt.query_row([query], |row| row.get::<_, usize>(0))?
        };

        // Calculate offset for pagination
        let offset = page * page_size;
        
        // Get paginated results
        let notes = if query.trim().is_empty() {
            // Return paginated all notes if query is empty
            self.db_service.get_notes_paginated(offset, page_size).await?
        } else {
            // Use FTS5 with LIMIT and OFFSET for efficient pagination
            let mut stmt = conn.prepare_cached(
                "SELECT n.id, n.content, n.format, n.nickname, n.path, n.is_favorite, n.created_at, n.updated_at,
                        bm25(notes_fts) as rank
                 FROM notes n
                 JOIN notes_fts f ON n.id = f.rowid
                 WHERE notes_fts MATCH ?
                 ORDER BY rank
                 LIMIT ? OFFSET ?"
            )?;

            let note_iter = stmt.query_map([query, &page_size.to_string(), &offset.to_string()], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    format: match row.get::<_, String>(2)?.as_str() {
                        "markdown" => crate::models::NoteFormat::Markdown,
                        _ => crate::models::NoteFormat::PlainText,
                    },
                    nickname: row.get(3)?,
                    path: row.get(4)?,
                    is_favorite: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?;

            let mut notes = Vec::new();
            for note_result in note_iter {
                notes.push(note_result?);
            }
            notes
        };

        Ok((notes, total_count))
    }

    /// Advanced Boolean search with pagination and query complexity analytics
    /// 
    /// Supports Boolean operators (AND, OR, NOT), phrase searches ("exact phrase"),
    /// and field-specific searches (content:term, path:folder).
    /// 
    /// Security features:
    /// - Comprehensive query parsing with injection protection
    /// - Query complexity limits to prevent performance issues
    /// - Field validation to ensure only valid columns are searched
    /// - FTS5 query escaping to prevent malformed queries
    pub async fn search_notes_boolean_paginated(
        &self, 
        query: &str, 
        page: usize, 
        page_size: usize
    ) -> Result<(Vec<Note>, usize, QueryComplexity), AppError> {
        if query.trim().is_empty() {
            // Fall back to regular paginated search for empty queries
            let (notes, total_count) = self.search_notes_paginated(query, page, page_size).await?;
            return Ok((notes, total_count, QueryComplexity {
                term_count: 0,
                operator_count: 0,
                nesting_depth: 0,
                has_field_searches: false,
                has_phrase_searches: false,
                complexity_score: 1,
            }));
        }

        // Parse the Boolean query with security validation
        let (parsed_expression, complexity) = self.query_parser.parse(query)?;
        
        // Convert to FTS5-compatible query
        let fts5_query = self.query_parser.to_fts5_query(&parsed_expression)?;
        
        // Execute the search with the parsed FTS5 query
        let (notes, total_count) = self.execute_fts5_search(&fts5_query, page, page_size).await?;
        
        Ok((notes, total_count, complexity))
    }

    /// Execute FTS5 search with pagination
    async fn execute_fts5_search(
        &self, 
        fts5_query: &str, 
        page: usize, 
        page_size: usize
    ) -> Result<(Vec<Note>, usize), AppError> {
        let conn = self.db_service.get_connection()?;
        
        // Get total count for pagination
        let total_count = {
            let mut count_stmt = conn.prepare_cached(
                "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?"
            )?;
            count_stmt.query_row([fts5_query], |row| row.get::<_, usize>(0))?
        };

        // Calculate offset for pagination
        let offset = page * page_size;
        
        // Execute paginated search with BM25 ranking
        let mut stmt = conn.prepare_cached(
            "SELECT n.id, n.content, n.format, n.nickname, n.path, n.is_favorite, n.created_at, n.updated_at,
                    bm25(notes_fts) as rank
             FROM notes n
             JOIN notes_fts f ON n.id = f.rowid
             WHERE notes_fts MATCH ?
             ORDER BY rank
             LIMIT ? OFFSET ?"
        )?;

        let note_iter = stmt.query_map([fts5_query, &page_size.to_string(), &offset.to_string()], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok((notes, total_count))
    }

    /// Search notes using fuzzy matching
    pub async fn fuzzy_search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            return self.db_service.get_all_notes().await;
        }

        let all_notes = self.db_service.get_all_notes().await?;
        let mut scored_notes = Vec::new();

        for note in all_notes {
            let content_score = self.fuzzy_matcher.fuzzy_match(&note.content, query).unwrap_or(0);
            let nickname_score = note.nickname.as_ref()
                .and_then(|nick| self.fuzzy_matcher.fuzzy_match(nick, query))
                .unwrap_or(0);
            let path_score = self.fuzzy_matcher.fuzzy_match(&note.path, query).unwrap_or(0);

            let max_score = content_score.max(nickname_score).max(path_score);
            if max_score > 0 {
                scored_notes.push((note, max_score));
            }
        }

        // Sort by score descending
        scored_notes.sort_by(|a, b| b.1.cmp(&a.1));
        
        Ok(scored_notes.into_iter().map(|(note, _)| note).collect())
    }

    /// Search notes by path prefix
    pub async fn search_by_path(&self, path_prefix: &str) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes WHERE path LIKE ? ORDER BY path, updated_at DESC"
        )?;

        let search_pattern = format!("{}%", path_prefix);
        let note_iter = stmt.query_map([&search_pattern], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    /// Search favorite notes
    pub async fn search_favorites(&self) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes WHERE is_favorite = 1 ORDER BY updated_at DESC"
        )?;

        let note_iter = stmt.query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    /// Search recent notes (created or updated within last N days)
    pub async fn search_recent(&self, days: u32) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days as i64);
        let cutoff_str = cutoff_date.to_rfc3339();
        
        let mut stmt = conn.prepare_cached(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes WHERE updated_at >= ? ORDER BY updated_at DESC"
        )?;

        let note_iter = stmt.query_map([&cutoff_str], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    /// Get search suggestions based on partial query
    pub async fn get_search_suggestions(&self, partial_query: &str) -> Result<Vec<String>, AppError> {
        if partial_query.trim().is_empty() {
            return Ok(vec![]);
        }

        let conn = self.db_service.get_connection()?;
        
        // Get unique words from content that start with the partial query
        let mut stmt = conn.prepare_cached(
            "SELECT DISTINCT substr(content, 1, 50) as snippet
             FROM notes 
             WHERE content LIKE ? 
             ORDER BY updated_at DESC 
             LIMIT 10"
        )?;

        let search_pattern = format!("%{}%", partial_query);
        let snippet_iter = stmt.query_map([&search_pattern], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;

        let mut suggestions = Vec::new();
        for snippet_result in snippet_iter {
            let snippet = snippet_result?;
            // Extract words that contain the partial query
            for word in snippet.split_whitespace() {
                if word.to_lowercase().contains(&partial_query.to_lowercase()) 
                    && !suggestions.contains(&word.to_string()) 
                    && suggestions.len() < 10 {
                    suggestions.push(word.to_string());
                }
            }
        }

        Ok(suggestions)
    }

    /// Advanced search with multiple criteria
    pub async fn advanced_search(
        &self,
        query: Option<&str>,
        path_filter: Option<&str>,
        favorites_only: bool,
        format_filter: Option<crate::models::NoteFormat>,
        date_from: Option<&str>,
        date_to: Option<&str>,
    ) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let mut sql = "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at FROM notes WHERE 1=1".to_string();
        let mut params: Vec<String> = Vec::new();

        // Add FTS search if query is provided
        if let Some(q) = query {
            if !q.trim().is_empty() {
                sql.push_str(" AND id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)");
                params.push(q.to_string());
            }
        }

        // Add path filter
        if let Some(path) = path_filter {
            sql.push_str(" AND path LIKE ?");
            params.push(format!("{}%", path));
        }

        // Add favorites filter
        if favorites_only {
            sql.push_str(" AND is_favorite = 1");
        }

        // Add format filter
        if let Some(format) = format_filter {
            sql.push_str(" AND format = ?");
            match format {
                crate::models::NoteFormat::Markdown => params.push("markdown".to_string()),
                crate::models::NoteFormat::PlainText => params.push("plaintext".to_string()),
            }
        }

        // Add date filters
        if let Some(from_date) = date_from {
            sql.push_str(" AND updated_at >= ?");
            params.push(from_date.to_string());
        }

        if let Some(to_date) = date_to {
            sql.push_str(" AND updated_at <= ?");
            params.push(to_date.to_string());
        }

        sql.push_str(" ORDER BY updated_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let note_iter = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format: match row.get::<_, String>(2)?.as_str() {
                    "markdown" => crate::models::NoteFormat::Markdown,
                    _ => crate::models::NoteFormat::PlainText,
                },
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note_result in note_iter {
            notes.push(note_result?);
        }

        Ok(notes)
    }

    /// Validate Boolean search query without executing it
    /// 
    /// Useful for UI validation and query complexity analysis
    pub fn validate_boolean_query(&self, query: &str) -> Result<QueryComplexity, AppError> {
        let (_, complexity) = self.query_parser.parse(query)?;
        Ok(complexity)
    }

    /// Get Boolean search help examples
    pub fn get_boolean_search_examples() -> Vec<(&'static str, &'static str)> {
        vec![
            ("rust AND programming", "Find notes containing both 'rust' and 'programming'"),
            ("javascript OR typescript", "Find notes containing either 'javascript' or 'typescript'"),
            ("project NOT archived", "Find notes containing 'project' but not 'archived'"),
            ("\"exact phrase\"", "Find notes containing the exact phrase"),
            ("content:rust", "Search only in note content for 'rust'"),
            ("path:projects", "Find notes in paths starting with 'projects'"),
            ("(rust OR python) AND tutorial", "Complex Boolean with grouping"),
            ("content:\"hello world\" AND path:examples", "Combine phrase and field searches"),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::tempdir;

    async fn setup_test_db() -> Result<(Arc<DbService>, SearchService), anyhow::Error> {
        use anyhow::Context;
        
        let temp_dir = tempdir()
            .context("Failed to create temporary directory")?;
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = Arc::new(DbService::new(&db_path.to_string_lossy())
            .context("Failed to create database service")?);
        let search_service = SearchService::new(db_service.clone());
        
        // Create some test notes
        search_service.db_service.create_note("This is a test note about Rust programming".to_string()).await
            .context("Failed to create test note 1")?;
        
        let mut note2 = search_service.db_service.create_note("JavaScript development tips".to_string()).await
            .context("Failed to create test note 2")?;
        note2.nickname = Some("JS Tips".to_string());
        note2.path = "/programming/javascript".to_string();
        search_service.db_service.update_note(note2).await
            .context("Failed to update test note 2")?;
        
        let mut note3 = search_service.db_service.create_note("Database design patterns".to_string()).await
            .context("Failed to create test note 3")?;
        note3.path = "/database/design".to_string();
        note3.is_favorite = true;
        search_service.db_service.update_note(note3).await
            .context("Failed to update test note 3")?;
        
        // Create a note that will help test Boolean search
        search_service.db_service.create_note("Python and machine learning tutorial".to_string()).await
            .context("Failed to create test note 4")?;
        
        Ok((db_service, search_service))
    }

    #[tokio::test]
    async fn test_fts_search() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Search for "Rust"
        let results = search_service.search_notes("Rust").await
            .context("Failed to search for Rust")?;
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        
        // Search for "programming"
        let results = search_service.search_notes("programming").await
            .context("Failed to search for programming")?;
        assert_eq!(results.len(), 2); // Should match both Rust and JavaScript notes
        
        // Empty query should return all notes
        let results = search_service.search_notes("").await
            .context("Failed to search with empty query")?;
        assert_eq!(results.len(), 4);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_boolean_search_and() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test Boolean AND search
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("Python AND machine", 0, 10).await
            .context("Failed to perform Boolean AND search")?;
        
        assert_eq!(results.len(), 1);
        assert_eq!(total_count, 1);
        assert!(results[0].content.contains("Python"));
        assert!(results[0].content.contains("machine"));
        assert!(complexity.operator_count >= 1);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_boolean_search_or() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test Boolean OR search
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("JavaScript OR Python", 0, 10).await
            .context("Failed to perform Boolean OR search")?;
        
        assert_eq!(results.len(), 2);
        assert_eq!(total_count, 2);
        assert!(complexity.operator_count >= 1);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_boolean_search_not() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test Boolean NOT search
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("programming NOT JavaScript", 0, 10).await
            .context("Failed to perform Boolean NOT search")?;
        
        assert_eq!(results.len(), 1);
        assert_eq!(total_count, 1);
        assert!(results[0].content.contains("Rust"));
        assert!(!results[0].content.contains("JavaScript"));
        assert!(complexity.operator_count >= 1);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_phrase_search() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test phrase search
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("\"machine learning\"", 0, 10).await
            .context("Failed to perform phrase search")?;
        
        assert_eq!(results.len(), 1);
        assert_eq!(total_count, 1);
        assert!(results[0].content.contains("machine learning"));
        assert!(complexity.has_phrase_searches);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_field_search() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test field search
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("path:programming", 0, 10).await
            .context("Failed to perform field search")?;
        
        assert_eq!(results.len(), 1);
        assert_eq!(total_count, 1);
        assert!(results[0].path.contains("programming"));
        assert!(complexity.has_field_searches);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_complex_boolean_query() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test complex Boolean query with grouping
        let (results, total_count, complexity) = search_service
            .search_notes_boolean_paginated("(JavaScript OR Python) AND NOT database", 0, 10).await
            .context("Failed to perform complex Boolean search")?;
        
        assert_eq!(results.len(), 2);
        assert_eq!(total_count, 2);
        assert!(complexity.operator_count >= 2); // AND, OR, NOT
        assert!(complexity.nesting_depth >= 1);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_query_validation() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        let (_db, search_service) = setup_test_db().await?;
        
        // Test valid query validation
        let complexity = search_service.validate_boolean_query("rust AND programming")
            .context("Failed to validate valid query")?;
        assert!(complexity.term_count >= 2);
        assert!(complexity.operator_count >= 1);
        
        // Test invalid query validation
        let result = search_service.validate_boolean_query("'; DROP TABLE notes; --");
        assert!(result.is_err());
        
        Ok(())
    }

    #[test]
    fn test_boolean_search_examples() {
        let examples = SearchService::get_boolean_search_examples();
        assert!(!examples.is_empty());
        assert!(examples.len() >= 8);
        
        // Verify example format
        for (query, description) in examples {
            assert!(!query.is_empty());
            assert!(!description.is_empty());
        }
    }
}