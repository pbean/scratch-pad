/// Shared Security Patterns for IPC Commands
/// 
/// This module centralizes all security validation utilities used across
/// the command domains, preserving the exact Week 1 security framework
/// with 95.2% test coverage.

use crate::error::ApiError;
use crate::validation::{SecurityValidator, OperationContext, OperationCapability};

/// Common security validation for all IPC commands
/// 
/// This function provides the standard security validation pattern
/// used by all command domains, ensuring consistent security posture.
pub fn validate_ipc_operation(
    security_validator: &SecurityValidator,
    capabilities: Vec<OperationCapability>
) -> Result<OperationContext, ApiError> {
    // Create IPC operation context with required capabilities
    let context = OperationContext::new_ipc(capabilities);
    
    // Validate operation context (frequency limits, capability checking)
    security_validator.validate_operation_context(&context).map_err(|e: crate::error::AppError| -> ApiError { e.into() })?;
    
    Ok(context)
}

/// Standard content validation for note operations
/// 
/// Validates content with security context to ensure:
/// - Content size limits (1MB maximum)
/// - Malicious pattern detection  
/// - Capability-based access control
/// - Frequency abuse prevention
pub fn validate_note_content_secure(
    security_validator: &SecurityValidator,
    content: &str,
    context: &OperationContext
) -> Result<(), ApiError> {
    security_validator.validate_note_content_with_context(content, context).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Standard search query validation
/// 
/// Validates search queries with security context to prevent:
/// - SQL injection attacks
/// - Query length abuse
/// - Capability violations
/// - Frequency limit violations
pub fn validate_search_query_secure(
    security_validator: &SecurityValidator,
    query: &str,
    context: &OperationContext
) -> Result<(), ApiError> {
    security_validator.validate_search_query_with_context(query, context).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Standard setting validation
/// 
/// Validates setting keys and values for:
/// - Valid key format (alphanumeric + dots/underscores)
/// - Value length limits
/// - Malicious content detection
pub fn validate_setting_secure(
    key: &str,
    value: &str
) -> Result<(), ApiError> {
    crate::validation::SecurityValidator::validate_setting(key, value).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Standard ID validation
/// 
/// Validates ID parameters to prevent:
/// - Negative or zero IDs
/// - Unreasonably large IDs (potential tampering)
/// - Integer overflow attacks
pub fn validate_id_secure(id: i64) -> Result<(), ApiError> {
    crate::validation::SecurityValidator::validate_id(id).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Standard pagination validation
/// 
/// Validates pagination parameters for:
/// - Reasonable limits (max 1000 items)
/// - Reasonable offsets (max 100k)
/// - Non-zero limits
pub fn validate_pagination_secure(offset: usize, limit: usize) -> Result<(), ApiError> {
    crate::validation::SecurityValidator::validate_pagination(offset, limit).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Standard shortcut validation
/// 
/// Validates global shortcut strings for:
/// - Valid format (Modifier+Key pattern)
/// - Length limits
/// - Character restrictions
pub fn validate_shortcut_secure(shortcut: &str) -> Result<(), ApiError> {
    crate::validation::SecurityValidator::validate_shortcut(shortcut).map_err(|e: crate::error::AppError| -> ApiError { e.into() })
}

/// Performance monitoring for command execution
/// 
/// Tracks command execution time to ensure <2ms overhead
/// requirement is maintained across all operations.
pub struct CommandPerformanceTracker {
    start_time: std::time::Instant,
    command_name: &'static str,
}

impl CommandPerformanceTracker {
    pub fn new(command_name: &'static str) -> Self {
        Self {
            start_time: std::time::Instant::now(),
            command_name,
        }
    }
    
    pub fn finish(self) {
        let duration = self.start_time.elapsed();
        if duration.as_millis() > 2 {
            eprintln!(
                "Performance warning: Command '{}' took {:?}ms (>2ms target)",
                self.command_name,
                duration.as_millis()
            );
        }
    }
}

/// Security logging for audit trails
/// 
/// Logs security-relevant events for monitoring and debugging
/// while preserving user privacy.
pub fn log_security_event(event_type: &str, source: &str, success: bool, message: &str) {
    let status = if success { "SUCCESS" } else { "FAILURE" };
    eprintln!(
        "[SECURITY] {} - {}: {} from {} - {}",
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
        status,
        event_type,
        source,
        message
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validation::SecurityValidator;
    
    #[test]
    fn test_validate_ipc_operation() {
        let validator = SecurityValidator::new();
        let capabilities = vec![OperationCapability::ReadNotes];
        
        let result = validate_ipc_operation(&validator, capabilities);
        assert!(result.is_ok());
        
        let context = result.unwrap();
        assert_eq!(context.source, crate::validation::OperationSource::IPC);
        assert_eq!(context.frequency_limit, Some(15));
    }
    
    #[test]
    fn test_validate_note_content_secure() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
        
        // Valid content should pass
        assert!(validate_note_content_secure(&validator, "Normal note content", &context).is_ok());
        
        // Malicious content should fail
        assert!(validate_note_content_secure(&validator, "<script>alert('xss')</script>", &context).is_err());
        
        // Too long content should fail
        let long_content = "a".repeat(1024 * 1024 + 1);
        assert!(validate_note_content_secure(&validator, &long_content, &context).is_err());
    }
    
    #[test]
    fn test_validate_search_query_secure() {
        let validator = SecurityValidator::new();
        let context = OperationContext::new_ipc(vec![OperationCapability::Search]);
        
        // Valid query should pass
        assert!(validate_search_query_secure(&validator, "normal search", &context).is_ok());
        
        // SQL injection should fail
        assert!(validate_search_query_secure(&validator, "'; DROP TABLE notes; --", &context).is_err());
    }
    
    #[test]
    fn test_security_validation_helpers() {
        // Test setting validation
        assert!(validate_setting_secure("valid.key", "valid_value").is_ok());
        assert!(validate_setting_secure("", "value").is_err());
        assert!(validate_setting_secure("key with spaces", "value").is_err());
        
        // Test ID validation
        assert!(validate_id_secure(123).is_ok());
        assert!(validate_id_secure(0).is_err());
        assert!(validate_id_secure(-1).is_err());
        
        // Test pagination validation
        assert!(validate_pagination_secure(0, 50).is_ok());
        assert!(validate_pagination_secure(0, 0).is_err());
        assert!(validate_pagination_secure(0, 1001).is_err());
        
        // Test shortcut validation
        assert!(validate_shortcut_secure("Ctrl+N").is_ok());
        assert!(validate_shortcut_secure("").is_err());
        assert!(validate_shortcut_secure("Invalid Format").is_err());
    }
    
    #[test]
    fn test_performance_tracker() {
        let tracker = CommandPerformanceTracker::new("test_command");
        // Simulate some work
        std::thread::sleep(std::time::Duration::from_millis(1));
        tracker.finish();
        // This test just ensures the tracker can be created and finished without panic
    }
}