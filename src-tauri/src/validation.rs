use crate::error::AppError;
use regex::Regex;
use std::path::{Path, PathBuf};
use std::ffi::OsStr;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
// use std::fs;  // Unused import - commented out

/// Represents the source of an operation to enable capability-based access control
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum OperationSource {
    /// Command line interface operations
    CLI,
    /// Inter-process communication operations  
    IPC,
    /// Direct application operations from frontend
    Direct,
    /// Plugin-initiated operations
    Plugin,
    /// Test operations - only available in test builds
    #[cfg(test)]
    Test,
}

/// Defines the capabilities/privileges for different operation types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OperationCapability {
    /// Read access to notes
    ReadNotes,
    /// Write/create new notes
    WriteNotes,
    /// Delete existing notes
    DeleteNotes,
    /// System-level access (file export, settings)
    SystemAccess,
    /// File export operations
    FileExport,
    /// Search operations
    Search,
    /// Plugin management operations
    PluginManagement,
}

/// Context for operation validation with source attribution and capability control
#[derive(Debug, Clone)]
pub struct OperationContext {
    /// The source of the operation
    pub source: OperationSource,
    /// Required capabilities for this operation
    pub capabilities: Vec<OperationCapability>,
    /// Unique identifier for this operation
    pub operation_id: String,
    /// Frequency limit based on source (operations per minute)
    pub frequency_limit: Option<u32>,
}

impl OperationContext {
    /// Create CLI operation context with desktop-appropriate frequency limits
    pub fn new_cli(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::CLI,
            capabilities,
            operation_id: format!("cli_{}", 
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros()),
            frequency_limit: Some(10), // CLI operations are typically batched
        }
    }

    /// Create IPC operation context (frontend to backend communication)
    pub fn new_ipc(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::IPC,
            capabilities,
            operation_id: format!("ipc_{}", 
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros()),
            frequency_limit: Some(15), // IPC has slightly higher frequency tolerance
        }
    }

    /// Create Direct operation context (internal application operations)
    pub fn new_direct(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::Direct,
            capabilities,
            operation_id: format!("direct_{}", 
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros()),
            frequency_limit: Some(100), // Direct UI operations can be frequent
        }
    }

    /// Create Plugin operation context with configurable frequency limits
    pub fn new_plugin(capabilities: Vec<OperationCapability>, frequency_limit: Option<u32>) -> Self {
        Self {
            source: OperationSource::Plugin,
            capabilities,
            operation_id: format!("plugin_{}", 
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros()),
            frequency_limit, // Plugin frequency limits are configurable
        }
    }

    /// Create test operation context for unit testing (no frequency limits)
    #[cfg(test)]
    pub fn new_test(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::Test,
            capabilities,
            operation_id: format!("test_{}", 
                SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros()),
            frequency_limit: None, // No frequency limits for tests
        }
    }
}

/// Frequency tracking for operations by source to prevent abuse
struct FrequencyTracker {
    /// Track operation counts by source with timestamps
    operation_counts: HashMap<OperationSource, Vec<Instant>>,
    /// Cleanup interval
    last_cleanup: Instant,
}

impl FrequencyTracker {
    fn new() -> Self {
        Self {
            operation_counts: HashMap::new(),
            last_cleanup: Instant::now(),
        }
    }

    fn cleanup_old_entries(&mut self) {
        let cutoff = Instant::now() - Duration::from_secs(60);
        
        for (_source, timestamps) in self.operation_counts.iter_mut() {
            timestamps.retain(|&timestamp| timestamp > cutoff);
        }
        
        self.last_cleanup = Instant::now();
    }

    fn check_frequency(&mut self, source: &OperationSource, limit: u32) -> Result<(), AppError> {
        // Cleanup old entries every 10 seconds
        if self.last_cleanup.elapsed() > Duration::from_secs(10) {
            self.cleanup_old_entries();
        }

        let timestamps = self.operation_counts.entry(source.clone()).or_insert_with(Vec::new);
        let current_count = timestamps.len() as u32;

        if current_count >= limit {
            return Err(AppError::Validation {
                field: "frequency".to_string(),
                message: format!("Operation frequency limit exceeded: {} operations in the last minute", current_count),
            });
        }

        timestamps.push(Instant::now());
        Ok(())
    }
}

/// Security validator with comprehensive validation capabilities for desktop applications
pub struct SecurityValidator {
    /// Frequency tracker for operation abuse prevention
    frequency_tracker: Arc<Mutex<FrequencyTracker>>,
}

impl SecurityValidator {
    /// Maximum allowed note content length (1MB)
    pub const MAX_NOTE_CONTENT_LENGTH: usize = 1_000_000;
    
    /// Maximum allowed setting value length
    pub const MAX_SETTING_LENGTH: usize = 10_000;
    
    /// Create a new security validator
    pub fn new() -> Self {
        Self {
            frequency_tracker: Arc::new(Mutex::new(FrequencyTracker::new())),
        }
    }

    /// Validate operation context including frequency limits and capability requirements
    pub fn validate_operation_context(&self, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation ID format
        if context.operation_id.is_empty() || context.operation_id.len() > 100 {
            return Err(AppError::Validation {
                field: "operation_id".to_string(),
                message: "Invalid operation ID format".to_string(),
            });
        }

        // Check frequency limits if specified
        if let Some(limit) = context.frequency_limit {
            let mut tracker = self.frequency_tracker.lock().unwrap();
            tracker.check_frequency(&context.source, limit)?;
        }

        Ok(())
    }

    /// Validate note content to prevent malicious patterns
    pub fn validate_note_content(&self, content: &str, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has WriteNotes capability
        if !context.capabilities.contains(&OperationCapability::WriteNotes) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "Write notes capability required".to_string(),
            });
        }

        // Perform standard content validation
        Self::validate_note_content_static(content)
    }

    /// Static note content validation (legacy method for backwards compatibility)
    pub fn validate_note_content_static(content: &str) -> Result<(), AppError> {
        if content.len() > 1_000_000 { // 1MB limit
            return Err(AppError::Validation {
                field: "content".to_string(),
                message: "Note content too large".to_string(),
            });
        }

        // Check for potentially dangerous patterns
        let dangerous_patterns = [
            "<script", "javascript:", "vbscript:", 
            "eval(", "exec(", "system(",
        ];

        let content_lower = content.to_lowercase();
        for pattern in &dangerous_patterns {
            if content_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: "content".to_string(),
                    message: "Note content contains potentially dangerous patterns".to_string(),
                });
            }
        }

        Ok(())
    }

    /// Validate search query with operation context
    pub fn validate_search_query_with_context(&self, query: &str, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has Search capability
        if !context.capabilities.contains(&OperationCapability::Search) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "Search capability required".to_string(),
            });
        }
        
        // Perform standard search validation
        Self::validate_search_query(query)
    }
    
    /// Validates search queries to prevent injection attacks (legacy method)
    pub fn validate_search_query(query: &str) -> Result<(), AppError> {
        if query.len() > 1000 {
            return Err(AppError::Validation {
                field: "search_query".to_string(),
                message: "Search query too long".to_string(),
            });
        }
        
        let query_lower = query.to_lowercase();
        
        // Check for XSS and script injection patterns first
        let dangerous_xss_patterns = [
            "<script", "</script>", "javascript:", "vbscript:",
            "<img", "<iframe", "<object", "<embed",
            "onerror=", "onload=", "onclick=", "onmouseover=",
            "eval(", "exec(", "system(",
        ];
        
        for pattern in &dangerous_xss_patterns {
            if query_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: "search_query".to_string(),
                    message: "Search query contains potentially dangerous content".to_string(),
                });
            }
        }
        
        // Check for SQL injection patterns in FTS queries
        let dangerous_sql_patterns = [
            "drop", "delete", "insert", "update", "create", "alter",
            "exec", "execute", "union", "select"
        ];
        
        // Check for SQL keywords with common injection patterns
        for pattern in &dangerous_sql_patterns {
            // Check various SQL injection combinations using simple string operations
            if query_lower.contains(&format!("' {}", pattern)) ||
               query_lower.contains(&format!("'{}", pattern)) ||
               query_lower.contains(&format!("; {}", pattern)) ||
               query_lower.contains(&format!("-- {}", pattern)) ||
               query_lower.contains(&format!(") {}", pattern)) {
                return Err(AppError::Validation {
                    field: "search_query".to_string(),
                    message: "Search query contains potentially dangerous content".to_string(),
                });
            }
        }
        
        // Check for specific SQL injection patterns
        let injection_patterns = [
            "'--", "';", "';--", "/*", "*/", "xp_", "sp_", "union ", "drop ", "delete ",
            "insert ", "update ", "alter ", "create ", "exec ", "1=1", "'='", 
            "' or '1'='1", "admin'--"
        ];
        
        for pattern in &injection_patterns {
            if query_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: "search_query".to_string(),
                    message: "Search query contains potentially dangerous content".to_string(),
                });
            }
        }
        
        Ok(())
    }

    /// Validate export path to prevent path traversal attacks
    pub fn validate_export_path_with_context(&self, path: &str, base_path: Option<&Path>, context: &OperationContext) -> Result<PathBuf, AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has FileExport capability
        if !context.capabilities.contains(&OperationCapability::FileExport) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "File export capability required".to_string(),
            });
        }
        
        // Perform path validation
        Self::validate_export_path(path, base_path)
    }

    /// Static export path validation (legacy method)
    pub fn validate_export_path(path: &str, base_path: Option<&Path>) -> Result<PathBuf, AppError> {
        // Check for path traversal attempts
        if path.contains("..") {
            return Err(AppError::Validation {
                field: "export_path".to_string(),
                message: "Path traversal attempts are not allowed".to_string(),
            });
        }

        // Check for absolute paths (Windows and Unix)
        if path.starts_with('/') || path.contains(':') {
            return Err(AppError::Validation {
                field: "export_path".to_string(),
                message: "Absolute paths are not allowed".to_string(),
            });
        }

        // Validate filename contains only safe characters
        let safe_filename_regex = Regex::new(r"^[a-zA-Z0-9._-]+$").unwrap();
        let filename = Path::new(path).file_name()
            .and_then(OsStr::to_str)
            .ok_or_else(|| AppError::Validation {
                field: "export_path".to_string(),
                message: "Invalid filename format".to_string(),
            })?;

        if !safe_filename_regex.is_match(filename) {
            return Err(AppError::Validation {
                field: "export_path".to_string(),
                message: "Filename contains invalid characters".to_string(),
            });
        }

        // Construct full path and validate it stays within base directory
        let full_path = if let Some(base) = base_path {
            base.join(path)
        } else {
            PathBuf::from(path)
        };

        // Canonical path validation if base path is provided
        if let Some(base) = base_path {
            let canonical_base = base.canonicalize().map_err(|_| AppError::Validation {
                field: "base_path".to_string(),
                message: "Invalid base directory".to_string(),
            })?;

            // For validation purposes, we check if the path would escape the base directory
            let parent_dir = full_path.parent().unwrap_or(&full_path);
            if !parent_dir.starts_with(&canonical_base) {
                return Err(AppError::Validation {
                    field: "export_path".to_string(),
                    message: "Path escapes base directory".to_string(),
                });
            }
        }

        Ok(full_path)
    }

    /// Validate shortcut strings for security
    pub fn validate_shortcut(shortcut: &str) -> Result<(), AppError> {
        if shortcut.is_empty() {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Shortcut cannot be empty".to_string(),
            });
        }
        
        if shortcut.len() > 50 {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Shortcut string too long".to_string(),
            });
        }
        
        // Basic format validation (modifier keys + main key)
        let shortcut_regex = Regex::new(r"^([A-Za-z]+\+)*[A-Za-z0-9]+$").unwrap();
        if !shortcut_regex.is_match(shortcut) {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Invalid shortcut format".to_string(),
            });
        }
        
        // Check for potentially dangerous patterns
        let dangerous_patterns = ["<script", "javascript:", "eval("];
        let shortcut_lower = shortcut.to_lowercase();
        for pattern in &dangerous_patterns {
            if shortcut_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: "shortcut".to_string(),
                    message: "Shortcut contains dangerous patterns".to_string(),
                });
            }
        }
        
        Ok(())
    }

    /// Validate note IDs
    pub fn validate_id(id: i64) -> Result<(), AppError> {
        if id <= 0 {
            return Err(AppError::Validation {
                field: "id".to_string(),
                message: "ID must be positive".to_string(),
            });
        }
        
        // Reasonable upper bound check
        if id > 1_000_000_000_000 {
            return Err(AppError::Validation {
                field: "id".to_string(),
                message: "ID too large".to_string(),
            });
        }
        
        Ok(())
    }

    /// Validate pagination parameters
    pub fn validate_pagination(offset: i64, limit: i64) -> Result<(), AppError> {
        if offset < 0 {
            return Err(AppError::Validation {
                field: "offset".to_string(),
                message: "Offset cannot be negative".to_string(),
            });
        }
        
        if limit <= 0 {
            return Err(AppError::Validation {
                field: "limit".to_string(),
                message: "Limit must be positive".to_string(),
            });
        }
        
        if limit > 1000 {
            return Err(AppError::Validation {
                field: "limit".to_string(),
                message: "Limit too large (maximum 1000)".to_string(),
            });
        }
        
        if offset > 100_000 {
            return Err(AppError::Validation {
                field: "offset".to_string(),
                message: "Offset too large (maximum 100,000)".to_string(),
            });
        }
        
        Ok(())
    }

    /// Enhanced setting validation with operation context
    pub fn validate_setting_with_context(&self, key: &str, value: &str, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has SystemAccess capability
        if !context.capabilities.contains(&OperationCapability::SystemAccess) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "System access capability required".to_string(),
            });
        }
        
        // Perform standard setting validation
        Self::validate_setting(key, value)
    }

    /// Static setting validation (legacy method)
    pub fn validate_setting(key: &str, value: &str) -> Result<(), AppError> {
        // Key validation
        if key.is_empty() || key.len() > 100 {
            return Err(AppError::Validation {
                field: "setting_key".to_string(),
                message: "Setting key length invalid".to_string(),
            });
        }
        
        // Key should be alphanumeric with dots and underscores
        let key_regex = Regex::new(r"^[a-zA-Z0-9_.]+$").unwrap();
        if !key_regex.is_match(key) {
            return Err(AppError::Validation {
                field: "setting_key".to_string(),
                message: "Setting key contains invalid characters".to_string(),
            });
        }
        
        // Value validation
        if value.len() > 10_000 {
            return Err(AppError::Validation {
                field: "setting_value".to_string(),
                message: "Setting value too long".to_string(),
            });
        }
        
        // Check for dangerous patterns in value
        let dangerous_patterns = ["<script", "javascript:", "eval("];
        let value_lower = value.to_lowercase();
        for pattern in &dangerous_patterns {
            if value_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: "setting_value".to_string(),
                    message: "Setting value contains dangerous patterns".to_string(),
                });
            }
        }
        
        Ok(())
    }

    /// Comprehensive content sanitization for safe display
    pub fn sanitize_content(content: &str) -> String {
        // Replace dangerous HTML/JS patterns
        let mut sanitized = content.to_string();
        
        // Replace script tags
        sanitized = sanitized.replace("<script", "&lt;script");
        sanitized = sanitized.replace("</script", "&lt;/script");
        
        // Replace javascript URLs
        sanitized = sanitized.replace("javascript:", "data:");
        
        // Replace dangerous event handlers
        let event_handlers = [
            "onload=", "onerror=", "onclick=", "onmouseover=", "onmouseout=",
            "onfocus=", "onblur=", "onchange=", "onsubmit=", "onkeypress=",
        ];
        
        for handler in &event_handlers {
            sanitized = sanitized.replace(handler, &format!("data-{}", handler));
        }
        
        sanitized
    }

    /// Clean content by removing dangerous patterns (more aggressive than sanitize)
    pub fn clean_dangerous_content(content: &str) -> (String, i32) {
        let mut cleaned = content.to_string();
        let mut cleaned_count = 0;
        
        // Remove script tags entirely using simple string replacement
        if cleaned.to_lowercase().contains("<script") {
            cleaned = cleaned.to_lowercase().replace("<script", "").replace("</script", "");
            cleaned_count += 1;
        }
        
        // Remove javascript: URLs
        if cleaned.to_lowercase().contains("javascript:") {
            cleaned = cleaned.to_lowercase().replace("javascript:", "");
            cleaned_count += 1;
        }
        
        // Remove basic event handlers
        let event_handlers = ["onerror=", "onload=", "onclick="];
        for handler in &event_handlers {
            if cleaned.to_lowercase().contains(handler) {
                cleaned = cleaned.to_lowercase().replace(handler, "");
                cleaned_count += 1;
            }
        }
        
        (cleaned, cleaned_count)
    }

    /// Check if a path contains path traversal patterns
    pub fn contains_path_traversal(path: &str) -> bool {
        // Check for common path traversal patterns
        let patterns = [
            "..",
            "../",
            "..\\",
            "%2e%2e",
            "%2e%2e/",
            "%2e%2e\\",
            "..%2f",
            "..%5c",
            "%252e%252e",
            "..;",
            "..%00",
            "..%0d",
            "..%0a",
        ];
        
        let path_lower = path.to_lowercase();
        for pattern in &patterns {
            if path_lower.contains(pattern) {
                return true;
            }
        }
        
        // Check for encoded variations by manually decoding common patterns
        if path.contains("%") {
            // Simple URL decode for common patterns
            let decoded = path
                .replace("%2e", ".")
                .replace("%2E", ".")
                .replace("%2f", "/")
                .replace("%2F", "/")
                .replace("%5c", "\\")
                .replace("%5C", "\\")
                .replace("%00", "\0");
                
            if decoded != path {
                return Self::contains_path_traversal(&decoded);
            }
        }
        
        false
    }
    
    /// Sanitize content for safe database storage
    pub fn sanitize_for_database(content: &str) -> String {
        let mut sanitized = content.to_string();
        
        // Remove null bytes
        sanitized = sanitized.replace('\0', "");
        
        // Escape single quotes for SQL (basic protection)
        sanitized = sanitized.replace("'", "''");
        
        // Remove control characters except newlines and tabs
        sanitized = sanitized.chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t' || *c == '\r')
            .collect();
        
        sanitized
    }
    
    /// Validate file extension for allowed types
    pub fn validate_file_extension(path: &str) -> Result<(), String> {
        let allowed_extensions = [
            "txt", "md", "json", "yaml", "yml", "toml", "csv", "log"
        ];
        
        let path_lower = path.to_lowercase();
        let extension = path_lower.rsplit('.').next().unwrap_or("");
        
        if extension.is_empty() {
            return Err("No file extension found".to_string());
        }
        
        if !allowed_extensions.contains(&extension) {
            return Err(format!("File extension '{}' not allowed", extension));
        }
        
        Ok(())
    }
    
    /// Validate IPC request structure and content
    pub fn validate_ipc_request(request: &str) -> Result<(), String> {
        // Check request size
        if request.len() > 1024 * 1024 {  // 1MB limit
            return Err("IPC request too large".to_string());
        }
        
        // Check for null bytes
        if request.contains('\0') {
            return Err("IPC request contains null bytes".to_string());
        }
        
        // Basic structure validation (could be expanded based on actual IPC format)
        if request.trim().is_empty() {
            return Err("IPC request is empty".to_string());
        }
        
        Ok(())
    }
    
    /// Validate IPC file operation requests
    pub fn validate_ipc_file_operation(operation: &str, path: &str) -> Result<(), String> {
        // Validate operation type
        let valid_operations = ["read", "write", "create", "delete", "list"];
        if !valid_operations.contains(&operation) {
            return Err(format!("Invalid file operation: {}", operation));
        }
        
        // Check for path traversal
        if Self::contains_path_traversal(path) {
            return Err("Path traversal detected in file operation".to_string());
        }
        
        // Validate path format - use None for base_path as we don't have context here
        Self::validate_export_path(path, None).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    /// Validate content for malicious patterns
    pub fn validate_no_malicious_content(content: &str) -> Result<(), String> {
        // Check for script tags
        if content.to_lowercase().contains("<script") {
            return Err("Content contains script tags".to_string());
        }
        
        // Check for javascript: URLs
        if content.to_lowercase().contains("javascript:") {
            return Err("Content contains javascript: URLs".to_string());
        }
        
        // Check for event handlers
        let event_handlers = ["onerror=", "onload=", "onclick=", "onmouseover=", "onfocus="];
        for handler in &event_handlers {
            if content.to_lowercase().contains(handler) {
                return Err(format!("Content contains event handler: {}", handler));
            }
        }
        
        // Check for iframe tags
        if content.to_lowercase().contains("<iframe") {
            return Err("Content contains iframe tags".to_string());
        }
        
        Ok(())
    }
    
    /// Clean up all temporary files (placeholder for actual implementation)
    pub fn cleanup_all_temp_files() -> Result<(), String> {
        // This would typically clean up temp files created during operations
        // For now, it's a placeholder that always succeeds
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_operation_context_creation() {
        let cli_context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        assert_eq!(cli_context.source, OperationSource::CLI);
        assert_eq!(cli_context.frequency_limit, Some(10));
        
        let direct_context = OperationContext::new_direct(vec![OperationCapability::ReadNotes]);
        assert_eq!(direct_context.source, OperationSource::Direct);
        assert_eq!(direct_context.frequency_limit, Some(100));
    }

    #[test]
    fn test_security_validator_creation() {
        let validator = SecurityValidator::new();
        
        // Test basic functionality
        let context = OperationContext::new_test(vec![OperationCapability::ReadNotes]);
        assert!(validator.validate_operation_context(&context).is_ok());
    }

    #[test]
    fn test_note_content_validation() {
        // Should allow normal content
        assert!(SecurityValidator::validate_note_content_static("This is a normal note").is_ok());
        
        // Should reject dangerous content
        assert!(SecurityValidator::validate_note_content_static("<script>alert('xss')</script>").is_err());
        assert!(SecurityValidator::validate_note_content_static("javascript:alert(1)").is_err());
        assert!(SecurityValidator::validate_note_content_static("eval(maliciousCode)").is_err());
    }

    #[test]
    fn test_search_query_validation() {
        // Should allow normal search queries
        assert!(SecurityValidator::validate_search_query("normal search").is_ok());
        assert!(SecurityValidator::validate_search_query("project management").is_ok());
        
        // Should reject SQL injection attempts
        assert!(SecurityValidator::validate_search_query("'; DROP TABLE notes; --").is_err());
        assert!(SecurityValidator::validate_search_query("UNION SELECT * FROM users").is_err());
        
        // Should reject XSS attempts
        assert!(SecurityValidator::validate_search_query("<script>alert(1)</script>").is_err());
        assert!(SecurityValidator::validate_search_query("javascript:alert(1)").is_err());
        
        // Should reject overly long queries
        let long_query = "a".repeat(1001);
        assert!(SecurityValidator::validate_search_query(&long_query).is_err());
    }

    #[test]
    fn test_context_capability_validation() {
        let validator = SecurityValidator::new();
        
        // Test with valid capability
        let context = OperationContext::new_test(vec![OperationCapability::Search]);
        assert!(validator.validate_search_query_with_context("normal search", &context).is_ok());
        
        // Search without required capability
        let no_search_context = OperationContext::new_test(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_search_query_with_context("query", &no_search_context).is_err());
        
        // SQL injection attempt
        assert!(validator.validate_search_query_with_context("'; DROP TABLE notes; --", &context).is_err());
    }

    #[test]
    fn test_shortcut_validation() {
        // Should allow valid shortcuts
        assert!(SecurityValidator::validate_shortcut("Ctrl+N").is_ok());
        assert!(SecurityValidator::validate_shortcut("Alt+Shift+F1").is_ok());
        
        // Should reject invalid shortcuts
        assert!(SecurityValidator::validate_shortcut("").is_err());
        assert!(SecurityValidator::validate_shortcut("Invalid Shortcut").is_err());
        assert!(SecurityValidator::validate_shortcut("Ctrl+<script>").is_err());
    }

    #[test]
    fn test_id_validation() {
        // Should allow valid IDs
        assert!(SecurityValidator::validate_id(1).is_ok());
        assert!(SecurityValidator::validate_id(12345).is_ok());
        
        // Should reject invalid IDs
        assert!(SecurityValidator::validate_id(0).is_err());
        assert!(SecurityValidator::validate_id(-1).is_err());
        assert!(SecurityValidator::validate_id(i64::MAX).is_err());
    }

    #[test]
    fn test_pagination_validation() {
        // Should allow valid pagination
        assert!(SecurityValidator::validate_pagination(0, 50).is_ok());
        assert!(SecurityValidator::validate_pagination(100, 100).is_ok());
        
        // Should reject invalid pagination
        assert!(SecurityValidator::validate_pagination(0, 0).is_err());
        assert!(SecurityValidator::validate_pagination(0, 1001).is_err());
        assert!(SecurityValidator::validate_pagination(100_001, 50).is_err());
    }

    // Desktop Security Tests - Day 2 Implementation
    
    #[test]
    fn test_operation_source_attribution() {
        let context_cli = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        assert_eq!(context_cli.source, OperationSource::CLI);
        assert_eq!(context_cli.frequency_limit, Some(10));
        
        let context_direct = OperationContext::new_direct(vec![OperationCapability::ReadNotes]);
        assert_eq!(context_direct.source, OperationSource::Direct);
        assert_eq!(context_direct.frequency_limit, Some(100));
        
        let context_ipc = OperationContext::new_ipc(vec![OperationCapability::Search]);
        assert_eq!(context_ipc.source, OperationSource::IPC);
        assert_eq!(context_ipc.frequency_limit, Some(15));
    }

    #[test]
    fn test_enhanced_content_validation() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_test(vec![OperationCapability::WriteNotes]);
        
        // Valid content with context
        assert!(validator.validate_note_content("Normal note content", &context).is_ok());
        
        // Content without required capability
        let no_write_context = OperationContext::new_test(vec![OperationCapability::ReadNotes]);
        assert!(validator.validate_note_content("content", &no_write_context).is_err());
        
        // Malicious content
        assert!(validator.validate_note_content("<script>alert(1)</script>", &context).is_err());
    }

    #[test]
    fn test_enhanced_search_validation() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_test(vec![OperationCapability::Search]);
        
        // Valid search with context
        assert!(validator.validate_search_query_with_context("normal search", &context).is_ok());
        
        // Search without required capability
        let no_search_context = OperationContext::new_test(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_search_query_with_context("query", &no_search_context).is_err());
        
        // SQL injection attempt
        assert!(validator.validate_search_query_with_context("'; DROP TABLE notes; --", &context).is_err());
    }

    #[test]
    fn test_enhanced_export_validation() {
        let validator = SecurityValidator::new();
        let temp_dir = std::env::temp_dir();
        
        // Valid export with proper context
        let context = OperationContext::new_test(vec![
            OperationCapability::FileExport,
            OperationCapability::ReadNotes
        ]);
        let result = validator.validate_export_path_with_context("test.txt", Some(&temp_dir), &context);
        assert!(result.is_ok());
        
        // Export without required capability
        let no_export_context = OperationContext::new_test(vec![OperationCapability::ReadNotes]);
        let result = validator.validate_export_path_with_context("test.txt", Some(&temp_dir), &no_export_context);
        assert!(result.is_err());
        
        // Path traversal attempt
        let result = validator.validate_export_path_with_context("../../../etc/passwd", Some(&temp_dir), &context);
        assert!(result.is_err());
    }

    #[test]
    fn test_desktop_specific_security_patterns() {
        // Test that web anti-patterns are not used
        let validator = SecurityValidator::new();
        
        // Verify frequency control is desktop-appropriate (not web-style rate limiting)
        let cli_context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        assert_eq!(cli_context.frequency_limit, Some(10)); // Desktop-appropriate limit
        
        let ipc_context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
        assert_eq!(ipc_context.frequency_limit, Some(15)); // IPC-appropriate limit
        
        let direct_context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
        assert_eq!(direct_context.frequency_limit, Some(100)); // Direct UI operations
        
        // Verify capability-based access control (not JWT tokens)
        assert!(validator.validate_operation_context(&cli_context).is_ok());
        assert!(validator.validate_operation_context(&ipc_context).is_ok());
        assert!(validator.validate_operation_context(&direct_context).is_ok());
    }

    #[test]
    fn test_test_operation_context() {
        let validator = SecurityValidator::new();
        
        // Test context should work without frequency limits
        let test_context = OperationContext::new_test(vec![
            OperationCapability::ReadNotes,
            OperationCapability::WriteNotes,
            OperationCapability::Search,
            OperationCapability::FileExport,
            OperationCapability::SystemAccess
        ]);
        
        assert_eq!(test_context.source, OperationSource::Test);
        assert_eq!(test_context.frequency_limit, None);
        assert!(validator.validate_operation_context(&test_context).is_ok());
        
        // Test all capabilities work with test context
        assert!(validator.validate_note_content("test content", &test_context).is_ok());
        assert!(validator.validate_search_query_with_context("test query", &test_context).is_ok());
        
        // Test export validation with test context
        let temp_dir = std::env::temp_dir();
        let result = validator.validate_export_path_with_context("test.txt", Some(&temp_dir), &test_context);
        assert!(result.is_ok());
    }
}