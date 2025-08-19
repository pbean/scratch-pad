use crate::error::AppError;
use regex::Regex;
use std::path::{Path, PathBuf};
use std::ffi::OsStr;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::fs;

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
    /// Optional frequency limit (operations per minute)
    pub frequency_limit: Option<u32>,
    /// Timestamp for frequency tracking
    pub timestamp: std::time::Instant,
}

impl OperationContext {
    /// Creates a new operation context for CLI operations
    pub fn new_cli(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::CLI,
            capabilities,
            frequency_limit: Some(10), // CLI operations limited to 10/minute
            timestamp: std::time::Instant::now(),
        }
    }
    
    /// Creates a new operation context for IPC operations
    pub fn new_ipc(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::IPC,
            capabilities,
            frequency_limit: Some(15), // IPC slightly higher limit
            timestamp: std::time::Instant::now(),
        }
    }
    
    /// Creates a new operation context for direct operations
    pub fn new_direct(capabilities: Vec<OperationCapability>) -> Self {
        Self {
            source: OperationSource::Direct,
            capabilities,
            frequency_limit: Some(100), // Direct operations have higher limit
            timestamp: std::time::Instant::now(),
        }
    }
    
    /// Creates a new operation context for plugin operations
    pub fn new_plugin(capabilities: Vec<OperationCapability>, frequency_limit: Option<u32>) -> Self {
        Self {
            source: OperationSource::Plugin,
            capabilities,
            frequency_limit,
            timestamp: std::time::Instant::now(),
        }
    }
}

/// Frequency tracking for operation abuse prevention
#[derive(Debug)]
struct FrequencyTracker {
    /// Operation count per source in current time window
    operation_counts: HashMap<OperationSource, Vec<Instant>>,
}

impl FrequencyTracker {
    fn new() -> Self {
        Self {
            operation_counts: HashMap::new(),
        }
    }
    
    /// Check if operation is within frequency limits
    fn check_frequency(&mut self, context: &OperationContext) -> Result<(), AppError> {
        if let Some(limit) = context.frequency_limit {
            let now = Instant::now();
            let window_start = now - Duration::from_secs(60); // 1-minute window
            
            // Get or create entry for this source
            let timestamps = self.operation_counts.entry(context.source.clone()).or_insert_with(Vec::new);
            
            // Remove old timestamps outside the window
            timestamps.retain(|&timestamp| timestamp > window_start);
            
            // Check if we're within limits
            if timestamps.len() >= limit as usize {
                return Err(AppError::Validation {
                    field: "frequency_limit".to_string(),
                    message: format!("Operation frequency limit exceeded for {:?}: {} operations per minute", context.source, limit),
                });
            }
            
            // Add current operation timestamp
            timestamps.push(now);
        }
        Ok(())
    }
}

/// Security validation utilities for input sanitization and path safety
pub struct SecurityValidator {
    /// Frequency tracker for abuse prevention
    frequency_tracker: Arc<Mutex<FrequencyTracker>>,
}

impl SecurityValidator {
    /// Create a new SecurityValidator instance
    pub fn new() -> Self {
        Self {
            frequency_tracker: Arc::new(Mutex::new(FrequencyTracker::new())),
        }
    }
    
    /// Validate operation context and check frequency limits
    pub fn validate_operation_context(&self, context: &OperationContext) -> Result<(), AppError> {
        // Check frequency limits
        if let Ok(mut tracker) = self.frequency_tracker.lock() {
            tracker.check_frequency(context)?;
        } else {
            return Err(AppError::Validation {
                field: "frequency_tracker".to_string(),
                message: "Failed to acquire frequency tracker lock".to_string(),
            });
        }
        
        // Validate capabilities based on source
        Self::validate_capabilities(context)?;
        
        Ok(())
    }
    
    /// Validate that the operation source has required capabilities
    fn validate_capabilities(context: &OperationContext) -> Result<(), AppError> {
        // Define allowed capabilities per source
        let allowed_capabilities = match context.source {
            OperationSource::CLI => vec![
                OperationCapability::ReadNotes,
                OperationCapability::WriteNotes,
                OperationCapability::Search,
            ],
            OperationSource::IPC => vec![
                OperationCapability::ReadNotes,
                OperationCapability::WriteNotes,
                OperationCapability::Search,
            ],
            OperationSource::Direct => vec![
                OperationCapability::ReadNotes,
                OperationCapability::WriteNotes,
                OperationCapability::DeleteNotes,
                OperationCapability::SystemAccess,
                OperationCapability::FileExport,
                OperationCapability::Search,
                OperationCapability::PluginManagement,
            ],
            OperationSource::Plugin => {
                // Plugin capabilities are determined by their manifest
                // For now, allow basic operations
                vec![
                    OperationCapability::ReadNotes,
                    OperationCapability::WriteNotes,
                    OperationCapability::Search,
                ]
            }
        };
        
        // Check each required capability
        for required_cap in &context.capabilities {
            if !allowed_capabilities.contains(required_cap) {
                return Err(AppError::Validation {
                    field: "capability".to_string(),
                    message: format!("Source {:?} does not have capability {:?}", context.source, required_cap),
                });
            }
        }
        
        Ok(())
    }
    
    /// Validates IPC request for security and integrity
    pub fn validate_ipc_request(&self, content: &str, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context
        self.validate_operation_context(context)?;
        
        // Ensure this is actually an IPC operation
        if context.source != OperationSource::IPC {
            return Err(AppError::Validation {
                field: "source".to_string(),
                message: "IPC validation called for non-IPC operation".to_string(),
            });
        }
        
        // Validate IPC content size (1MB limit)
        if content.len() > 1024 * 1024 {
            return Err(AppError::Validation {
                field: "ipc_content".to_string(),
                message: "IPC content exceeds maximum size limit".to_string(),
            });
        }
        
        // Check for malicious content patterns in IPC data
        Self::validate_no_malicious_content(content, "ipc_content")?;
        
        // Validate JSON structure if it's JSON content
        if content.trim_start().starts_with('{') {
            serde_json::from_str::<serde_json::Value>(content)
                .map_err(|_| AppError::Validation {
                    field: "ipc_json".to_string(),
                    message: "Invalid JSON in IPC content".to_string(),
                })?;
        }
        
        Ok(())
    }
    
    /// Validates atomic IPC file operations for security
    pub fn validate_ipc_file_operation(&self, file_path: &PathBuf, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context
        self.validate_operation_context(context)?;
        
        // Check file path security
        let path_str = file_path.to_string_lossy();
        
        // Ensure IPC files are in temp directory only
        let allowed_prefixes = [
            "/tmp/", "/var/tmp/", "C:\\temp\\", "C:\\Windows\\temp\\"
        ];
        
        let path_allowed = allowed_prefixes.iter().any(|prefix| path_str.starts_with(prefix));
        if !path_allowed {
            return Err(AppError::Validation {
                field: "ipc_file_path".to_string(),
                message: "IPC file operations restricted to temp directories".to_string(),
            });
        }
        
        // Check for suspicious file names
        let file_name = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
            
        if !file_name.starts_with("scratch-pad-") {
            return Err(AppError::Validation {
                field: "ipc_file_name".to_string(),
                message: "IPC file name must start with 'scratch-pad-'".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Cleanup stale IPC files with security checks
    pub fn cleanup_stale_ipc_files(&self, max_age_seconds: u64) -> Result<usize, AppError> {
        let temp_dirs = [
            "/tmp",
            "/var/tmp", 
            "C:\\temp",
            "C:\\Windows\\temp"
        ];
        
        let mut cleaned_count = 0;
        let cutoff_time = std::time::SystemTime::now() - Duration::from_secs(max_age_seconds);
        
        for temp_dir in &temp_dirs {
            let temp_path = PathBuf::from(temp_dir);
            if !temp_path.exists() {
                continue;
            }
            
            if let Ok(entries) = fs::read_dir(&temp_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    
                    // Only clean our IPC files
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if file_name.starts_with("scratch-pad-") && file_name.ends_with(".json") {
                            // Check file age
                            if let Ok(metadata) = entry.metadata() {
                                if let Ok(modified_time) = metadata.modified() {
                                    if modified_time < cutoff_time {
                                        // Safe to remove stale IPC file
                                        if fs::remove_file(&path).is_ok() {
                                            cleaned_count += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(cleaned_count)
    }

    /// Cleanup all temporary files created by the application for graceful shutdown
    pub fn cleanup_all_temp_files(&self) -> Result<usize, AppError> {
        let temp_dirs = [
            "/tmp",
            "/var/tmp", 
            "C:\\temp",
            "C:\\Windows\\temp"
        ];
        
        let mut cleaned_count = 0;
        
        for temp_dir in &temp_dirs {
            let temp_path = PathBuf::from(temp_dir);
            if !temp_path.exists() {
                continue;
            }
            
            if let Ok(entries) = fs::read_dir(&temp_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    
                    // Clean all our application files
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        if file_name.starts_with("scratch-pad-") {
                            // Remove our temporary files
                            if fs::remove_file(&path).is_ok() {
                                cleaned_count += 1;
                            }
                        }
                    }
                }
            }
        }
        
        println!("Cleaned up {} temporary files during shutdown", cleaned_count);
        Ok(cleaned_count)
    }
    
    /// Maximum allowed content length for notes (1MB)
    pub const MAX_NOTE_CONTENT_LENGTH: usize = 1024 * 1024;
    
    /// Maximum allowed path length
    pub const MAX_PATH_LENGTH: usize = 260;
    
    /// Maximum allowed setting key/value length
    pub const MAX_SETTING_LENGTH: usize = 1024;

    /// Validates export path with operation context and enhanced security
    pub fn validate_export_path_with_context<P: AsRef<Path>, B: AsRef<Path>>(
        &self,
        file_path: P,
        allowed_base_dir: Option<B>,
        context: &OperationContext
    ) -> Result<PathBuf, AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has FileExport capability
        if !context.capabilities.contains(&OperationCapability::FileExport) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "FileExport capability required".to_string(),
            });
        }
        
        // Perform standard path validation
        Self::validate_export_path(file_path, allowed_base_dir)
    }
    
    /// Validates and sanitizes a file path to prevent path traversal attacks (legacy method)
    /// 
    /// # Security Features:
    /// - Prevents directory traversal (.., ./, etc.)
    /// - Rejects absolute paths starting with root
    /// - Ensures path stays within allowed directory
    /// - Validates file extension whitelist
    /// - Normalizes path separators
    pub fn validate_export_path<P: AsRef<Path>, B: AsRef<Path>>(
        file_path: P,
        allowed_base_dir: Option<B>
    ) -> Result<PathBuf, AppError> {
        let path = file_path.as_ref();
        let path_str = path.to_string_lossy();
        
        // Reject paths that are too long
        if path_str.len() > Self::MAX_PATH_LENGTH {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Path too long".to_string(),
            });
        }
        
        // Reject empty paths
        if path_str.trim().is_empty() {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Path cannot be empty".to_string(),
            });
        }
        
        // Check for path traversal patterns
        if Self::contains_path_traversal(&path_str) {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Path traversal detected".to_string(),
            });
        }
        
        // Reject absolute paths on Unix-like systems
        #[cfg(unix)]
        if path.is_absolute() {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Absolute paths not allowed".to_string(),
            });
        }
        
        // On Windows, reject paths starting with drive letters or UNC paths
        #[cfg(windows)]
        if path.is_absolute() || Self::is_windows_dangerous_path(&path_str) {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Absolute or UNC paths not allowed".to_string(),
            });
        }
        
        // Cross-platform: Always check for Windows-style dangerous paths
        // This prevents attacks even on Unix systems
        if Self::is_windows_dangerous_path(&path_str) {
            return Err(AppError::Validation {
                field: "file_path".to_string(),
                message: "Windows-style absolute or UNC paths not allowed".to_string(),
            });
        }
        
        // Validate file extension
        Self::validate_file_extension(path)?;
        
        // Build the final path within allowed directory
        let final_path = if let Some(base_dir) = allowed_base_dir {
            let base_path = base_dir.as_ref();
            let full_path = base_path.join(path);
            
            // Verify the path doesn't escape the base directory using canonical paths
            let base_canonical = base_path.canonicalize()
                .map_err(|e| AppError::Validation {
                    field: "base_directory".to_string(),
                    message: format!("Invalid base directory: {}", e),
                })?;
            
            // For validation, we need to check if the path would be within bounds
            // even if the final file doesn't exist yet
            let parent_dir = full_path.parent().unwrap_or(&full_path);
            if let Ok(parent_canonical) = parent_dir.canonicalize() {
                if !parent_canonical.starts_with(&base_canonical) {
                    return Err(AppError::Validation {
                        field: "file_path".to_string(),
                        message: "Path escapes allowed directory".to_string(),
                    });
                }
            }
            
            full_path
        } else {
            // If no base directory specified, use current directory and validate
            let current_dir = std::env::current_dir()
                .map_err(|e| AppError::Validation {
                    field: "current_directory".to_string(),
                    message: format!("Cannot determine current directory: {}", e),
                })?;
            
            current_dir.join(path)
        };
        
        Ok(final_path)
    }
    
    /// Checks for common path traversal patterns
    pub fn contains_path_traversal(path: &str) -> bool {
        // Common path traversal patterns
        let dangerous_patterns = [
            "..", 
            "./", 
            ".\\",
            "%2e%2e",  // URL encoded ..
            "%2f",     // URL encoded /
            "%5c",     // URL encoded \
            "..%2f",   // Mixed encoding
            "..%5c",   // Mixed encoding
        ];
        
        let path_lower = path.to_lowercase();
        dangerous_patterns.iter().any(|pattern| path_lower.contains(pattern))
    }
    
    /// Windows-specific dangerous path detection
    /// Made public and available on all platforms for comprehensive security
    pub fn is_windows_dangerous_path(path: &str) -> bool {
        let path_upper = path.to_uppercase();
        
        // Check for UNC paths (both Windows and Unix style)
        if path_upper.starts_with("\\\\") || path_upper.starts_with("//") {
            return true;
        }
        
        // Check for drive letter patterns (C:, D:, etc.)
        if path.len() >= 2 {
            let chars: Vec<char> = path.chars().collect();
            if chars.len() >= 2 && chars[1] == ':' && chars[0].is_ascii_alphabetic() {
                return true;
            }
        }
        
        // Check for other Windows absolute path indicators
        if path_upper.starts_with("C:\\") || path_upper.starts_with("D:\\") || 
           path_upper.starts_with("C:/") || path_upper.starts_with("D:/") {
            return true;
        }
        
        false
    }
    
    /// Validates file extension against whitelist
    fn validate_file_extension(path: &Path) -> Result<(), AppError> {
        // Allowed file extensions for export
        const ALLOWED_EXTENSIONS: &[&str] = &[
            "txt", "md", "json", "csv", "html", "xml", "rtf"
        ];
        
        let extension = path.extension()
            .and_then(OsStr::to_str)
            .ok_or_else(|| AppError::Validation {
                field: "file_extension".to_string(),
                message: "File must have a valid extension".to_string(),
            })?;
        
        let extension_lower = extension.to_lowercase();
        if !ALLOWED_EXTENSIONS.contains(&extension_lower.as_str()) {
            return Err(AppError::Validation {
                field: "file_extension".to_string(),
                message: format!(
                    "File extension '{}' not allowed. Allowed: {}",
                    extension,
                    ALLOWED_EXTENSIONS.join(", ")
                ),
            });
        }
        
        Ok(())
    }
    
    /// Validates note content for security and length constraints with operation context
    pub fn validate_note_content_with_context(&self, content: &str, context: &OperationContext) -> Result<(), AppError> {
        // Validate operation context first
        self.validate_operation_context(context)?;
        
        // Check that source has WriteNotes capability
        if !context.capabilities.contains(&OperationCapability::WriteNotes) {
            return Err(AppError::Validation {
                field: "capability".to_string(),
                message: "WriteNotes capability required".to_string(),
            });
        }
        
        // Perform standard content validation
        Self::validate_note_content(content)
    }
    
    /// Validates note content for security and length constraints (legacy method)
    pub fn validate_note_content(content: &str) -> Result<(), AppError> {
        // Check length
        if content.len() > Self::MAX_NOTE_CONTENT_LENGTH {
            return Err(AppError::Validation {
                field: "content".to_string(),
                message: format!(
                    "Content too long. Maximum {} characters allowed",
                    Self::MAX_NOTE_CONTENT_LENGTH
                ),
            });
        }
        
        // Check for potentially dangerous content patterns
        Self::validate_no_malicious_content(content, "content")?;
        
        Ok(())
    }
    
    /// Validates setting keys and values
    pub fn validate_setting(key: &str, value: &str) -> Result<(), AppError> {
        // Validate key
        if key.is_empty() {
            return Err(AppError::Validation {
                field: "setting_key".to_string(),
                message: "Setting key cannot be empty".to_string(),
            });
        }
        
        if key.len() > Self::MAX_SETTING_LENGTH {
            return Err(AppError::Validation {
                field: "setting_key".to_string(),
                message: "Setting key too long".to_string(),
            });
        }
        
        // Key should only contain alphanumeric characters, dots, and underscores
        let key_regex = Regex::new(r"^[a-zA-Z0-9._-]+$")
            .map_err(|_| AppError::Validation {
                field: "regex".to_string(),
                message: "Internal validation error".to_string(),
            })?;
        
        if !key_regex.is_match(key) {
            return Err(AppError::Validation {
                field: "setting_key".to_string(),
                message: "Setting key contains invalid characters".to_string(),
            });
        }
        
        // Validate value
        if value.len() > Self::MAX_SETTING_LENGTH {
            return Err(AppError::Validation {
                field: "setting_value".to_string(),
                message: "Setting value too long".to_string(),
            });
        }
        
        Self::validate_no_malicious_content(value, "setting_value")?;
        
        Ok(())
    }
    
    /// Validates search queries with operation context
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
        
        // Check for SQL injection patterns in FTS queries
        let dangerous_sql_patterns = [
            "drop", "delete", "insert", "update", "create", "alter",
            "exec", "execute", "script", "union", "select", "or", "and"
        ];
        
        let query_lower = query.to_lowercase();
        
        // More sophisticated SQL injection detection
        for pattern in &dangerous_sql_patterns {
            // Check for SQL keywords with common injection patterns
            if query_lower.contains(&format!("' {}", pattern)) ||
               query_lower.contains(&format!("'{}", pattern)) ||
               query_lower.contains(&format!("; {}", pattern)) ||
               query_lower.contains(&format!("-- {}", pattern)) ||
               query_lower.contains(&format!(") {}", pattern)) ||
               query_lower.contains(&format!("' or '1'='1")) ||
               query_lower.contains(&format!("admin'--")) {
                return Err(AppError::Validation {
                    field: "search_query".to_string(),
                    message: "Search query contains potentially dangerous content".to_string(),
                });
            }
        }
        
        // Check for basic SQL injection patterns - but allow apostrophes in normal text
        let injection_patterns = [
            "'--", "';", "';--", "/*", "*/", "xp_", "sp_", "union ", "drop ", "delete ",
            "insert ", "update ", "alter ", "create ", "exec ", "1=1", "'='" 
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
    
    /// Validates shortcut strings for global shortcuts
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
        
        // Basic shortcut format validation (modifier+key)
        let shortcut_regex = Regex::new(r"^([A-Za-z]+\+)*[A-Za-z0-9]+$")
            .map_err(|_| AppError::Validation {
                field: "regex".to_string(),
                message: "Internal validation error".to_string(),
            })?;
        
        if !shortcut_regex.is_match(shortcut) {
            return Err(AppError::Validation {
                field: "shortcut".to_string(),
                message: "Invalid shortcut format".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Generic validation for malicious content patterns
    pub fn validate_no_malicious_content(content: &str, field_name: &str) -> Result<(), AppError> {
        // Check for script injection patterns
        let dangerous_patterns = [
            "<script", "</script>", "javascript:", "vbscript:", "onload=", "onerror=",
            "eval(", "exec(", "system(", "cmd(", "powershell", "bash", "/bin/",
            "$(", "`", "<!--", "-->", "<?", "?>", "<%", "%>",
            // Command injection patterns
            ";", "|", "&", "&&", "||", ">>", "<", ">", "rm -rf", "del ",
            // Additional script patterns
            "<img", "<iframe", "<svg", "<body", "<div", "onclick", "onmouseover",
            // Command line execution patterns
            "cmd.exe", "/c ", "/k ", "cmd /c", "cmd /k", ".exe", ".bat", ".cmd",
            "sh -c", "bash -c", "/bin/sh", "/bin/bash", "python -c", "perl -e",
            // Environment variable and special character patterns
            "$home", "$user", "$path", "%username%", "%userprofile%", "~",
            "$(", "${"
        ];
        
        let content_lower = content.to_lowercase();
        
        // Check for dangerous patterns in the content
        for pattern in &dangerous_patterns {
            if content_lower.contains(pattern) {
                return Err(AppError::Validation {
                    field: field_name.to_string(),
                    message: "Content contains potentially dangerous patterns".to_string(),
                });
            }
        }
        
        // Check for dangerous control characters, but allow newlines/tabs in certain contexts
        if field_name != "settings" && field_name != "json_content" {
            if content.contains('\n') || content.contains('\r') || content.contains('\t') {
                return Err(AppError::Validation {
                    field: field_name.to_string(),
                    message: "Content contains control characters".to_string(),
                });
            }
        }
        
        Ok(())
    }
    
    /// Sanitizes user input for safe database storage
    pub fn sanitize_for_database(input: &str) -> String {
        // Remove null bytes and other control characters
        input.chars()
            .filter(|&c| c != '\0' && c != '\x08' && c != '\x7f')
            .collect::<String>()
            .trim()
            .to_string()
    }
    
    /// Validates ID parameters to prevent injection
    pub fn validate_id(id: i64) -> Result<(), AppError> {
        if id <= 0 {
            return Err(AppError::Validation {
                field: "id".to_string(),
                message: "ID must be a positive integer".to_string(),
            });
        }
        
        // Check for unreasonably large IDs that might indicate tampering
        if id > i64::MAX / 2 {
            return Err(AppError::Validation {
                field: "id".to_string(),
                message: "ID value too large".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Validates pagination parameters
    pub fn validate_pagination(offset: usize, limit: usize) -> Result<(), AppError> {
        const MAX_LIMIT: usize = 1000;
        const MAX_OFFSET: usize = 100_000;
        
        if limit == 0 {
            return Err(AppError::Validation {
                field: "limit".to_string(),
                message: "Limit must be greater than 0".to_string(),
            });
        }
        
        if limit > MAX_LIMIT {
            return Err(AppError::Validation {
                field: "limit".to_string(),
                message: format!("Limit cannot exceed {}", MAX_LIMIT),
            });
        }
        
        if offset > MAX_OFFSET {
            return Err(AppError::Validation {
                field: "offset".to_string(),
                message: format!("Offset cannot exceed {}", MAX_OFFSET),
            });
        }
        
        Ok(())
    }
}

impl Default for SecurityValidator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_path_traversal_detection() {
        // Should detect basic traversal
        assert!(SecurityValidator::contains_path_traversal("../etc/passwd"));
        assert!(SecurityValidator::contains_path_traversal("..\\windows\\system32"));
        assert!(SecurityValidator::contains_path_traversal("./../../secret"));
        
        // Should detect URL encoded traversal
        assert!(SecurityValidator::contains_path_traversal("file%2e%2e%2fpasswd"));
        assert!(SecurityValidator::contains_path_traversal("..%2fconfig"));
        
        // Should allow safe paths
        assert!(!SecurityValidator::contains_path_traversal("notes/my-note.txt"));
        assert!(!SecurityValidator::contains_path_traversal("folder/subfolder/file.md"));
    }
    
    #[test]
    fn test_file_extension_validation() {
        // Should allow valid extensions
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("note.txt")).is_ok());
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("data.json")).is_ok());
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("document.md")).is_ok());
        
        // Should reject dangerous extensions
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("script.exe")).is_err());
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("code.js")).is_err());
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("batch.bat")).is_err());
        
        // Should reject files without extensions
        assert!(SecurityValidator::validate_file_extension(&PathBuf::from("noextension")).is_err());
    }
    
    #[test]
    fn test_note_content_validation() {
        // Should allow normal content
        assert!(SecurityValidator::validate_note_content("This is a normal note").is_ok());
        
        // Should reject overly long content
        let long_content = "a".repeat(SecurityValidator::MAX_NOTE_CONTENT_LENGTH + 1);
        assert!(SecurityValidator::validate_note_content(&long_content).is_err());
        
        // Should detect script injection
        assert!(SecurityValidator::validate_note_content("<script>alert('xss')</script>").is_err());
        assert!(SecurityValidator::validate_note_content("javascript:alert(1)").is_err());
    }
    
    #[test]
    fn test_setting_validation() {
        // Should allow valid settings
        assert!(SecurityValidator::validate_setting("theme", "dark").is_ok());
        assert!(SecurityValidator::validate_setting("window.width", "800").is_ok());
        
        // Should reject invalid keys
        assert!(SecurityValidator::validate_setting("", "value").is_err());
        assert!(SecurityValidator::validate_setting("key with spaces", "value").is_err());
        assert!(SecurityValidator::validate_setting("key$pecial", "value").is_err());
        
        // Should reject malicious values
        assert!(SecurityValidator::validate_setting("key", "<script>").is_err());
    }
    
    #[test]
    fn test_search_query_validation() {
        // Should allow normal searches
        assert!(SecurityValidator::validate_search_query("search term").is_ok());
        assert!(SecurityValidator::validate_search_query("project AND task").is_ok());
        
        // Should reject SQL injection attempts
        assert!(SecurityValidator::validate_search_query("'; DROP TABLE notes; --").is_err());
        assert!(SecurityValidator::validate_search_query("UNION SELECT * FROM users").is_err());
        
        // Should reject overly long queries
        let long_query = "a".repeat(1001);
        assert!(SecurityValidator::validate_search_query(&long_query).is_err());
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
    fn test_capability_validation() {
        let validator = SecurityValidator::new();
        
        // Test CLI capabilities
        let cli_context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_operation_context(&cli_context).is_ok());
        
        // Test forbidden capability for CLI
        let cli_forbidden = OperationContext::new_cli(vec![OperationCapability::DeleteNotes]);
        assert!(validator.validate_operation_context(&cli_forbidden).is_err());
        
        // Test Direct capabilities
        let direct_context = OperationContext::new_direct(vec![
            OperationCapability::ReadNotes,
            OperationCapability::FileExport,
            OperationCapability::DeleteNotes
        ]);
        assert!(validator.validate_operation_context(&direct_context).is_ok());
    }
    
    #[test]
    fn test_frequency_controls() {
        let validator = SecurityValidator::new();
        
        // Create multiple CLI operations rapidly
        for i in 0..5 {
            let context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
            let result = validator.validate_operation_context(&context);
            if i < 5 {
                assert!(result.is_ok(), "Operation {} should succeed", i);
            }
        }
        
        // The 11th operation should fail (CLI limit is 10)
        for _ in 0..6 {
            let context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
            let _ = validator.validate_operation_context(&context);
        }
        
        let context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
        let result = validator.validate_operation_context(&context);
        assert!(result.is_err(), "11th CLI operation should fail due to frequency limit");
    }
    
    #[test]
    fn test_ipc_security_validation() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
        
        // Valid IPC content
        let valid_content = r#"{"action": "create_note", "content": "Hello World"}"#;
        assert!(validator.validate_ipc_request(valid_content, &context).is_ok());
        
        // IPC content too large
        let large_content = "x".repeat(1024 * 1024 + 1);
        assert!(validator.validate_ipc_request(&large_content, &context).is_err());
        
        // Malicious IPC content
        let malicious_content = r#"{"action": "<script>alert('xss')</script>"}"#;
        assert!(validator.validate_ipc_request(malicious_content, &context).is_err());
        
        // Wrong context source
        let wrong_context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_ipc_request(valid_content, &wrong_context).is_err());
    }
    
    #[test]
    fn test_ipc_file_validation() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
        
        // Valid IPC file path
        let valid_path = PathBuf::from("/tmp/scratch-pad-ipc.json");
        assert!(validator.validate_ipc_file_operation(&valid_path, &context).is_ok());
        
        // Invalid IPC file path (not in temp)
        let invalid_path = PathBuf::from("/home/user/scratch-pad-ipc.json");
        assert!(validator.validate_ipc_file_operation(&invalid_path, &context).is_err());
        
        // Invalid file name
        let wrong_name = PathBuf::from("/tmp/malicious-file.json");
        assert!(validator.validate_ipc_file_operation(&wrong_name, &context).is_err());
    }
    
    #[test]
    fn test_enhanced_note_validation() {
        let validator = SecurityValidator::new();
        
        // Valid note with proper context
        let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_note_content_with_context("Normal note content", &context).is_ok());
        
        // Note without required capability
        let no_write_context = OperationContext::new_direct(vec![OperationCapability::ReadNotes]);
        assert!(validator.validate_note_content_with_context("Content", &no_write_context).is_err());
        
        // Malicious note content
        assert!(validator.validate_note_content_with_context("<script>alert(1)</script>", &context).is_err());
    }
    
    #[test]
    fn test_enhanced_search_validation() {
        let validator = SecurityValidator::new();
        
        // Valid search with proper context
        let context = OperationContext::new_direct(vec![OperationCapability::Search]);
        assert!(validator.validate_search_query_with_context("normal search", &context).is_ok());
        
        // Search without required capability
        let no_search_context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
        assert!(validator.validate_search_query_with_context("query", &no_search_context).is_err());
        
        // SQL injection attempt
        assert!(validator.validate_search_query_with_context("'; DROP TABLE notes; --", &context).is_err());
    }
    
    #[test]
    fn test_enhanced_export_validation() {
        let validator = SecurityValidator::new();
        let temp_dir = std::env::temp_dir();
        
        // Valid export with proper context
        let context = OperationContext::new_direct(vec![
            OperationCapability::FileExport,
            OperationCapability::ReadNotes
        ]);
        let result = validator.validate_export_path_with_context("test.txt", Some(&temp_dir), &context);
        assert!(result.is_ok());
        
        // Export without required capability
        let no_export_context = OperationContext::new_direct(vec![OperationCapability::ReadNotes]);
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
    fn test_cleanup_all_temp_files() {
        let validator = SecurityValidator::new();
        
        // This test just verifies the method exists and can be called
        // In a real scenario, we'd create temp files first
        let result = validator.cleanup_all_temp_files();
        assert!(result.is_ok());
        
        // Should return number of files cleaned (likely 0 in test)
        let cleaned_count = result.unwrap();
        assert!(cleaned_count >= 0);
    }
}