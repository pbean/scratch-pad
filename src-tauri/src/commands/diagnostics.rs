/// Diagnostics Domain Commands
/// 
/// Handles error reporting and system diagnostics with security validation.
/// These commands help with debugging and monitoring while maintaining security.

use crate::commands::shared::{
    validate_ipc_operation, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::AppState;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{State, AppHandle};
use serde::{Deserialize, Serialize};

/// Frontend error report structure
#[derive(Serialize, Deserialize, Debug)]
pub struct FrontendErrorReport {
    pub error_id: String,
    pub message: String,
    pub stack_trace: Option<String>,
    pub component_name: Option<String>,
    pub timestamp: u64,
    pub error_type: String,
    pub additional_context: Option<HashMap<String, serde_json::Value>>,
}

/// Backend error details structure  
#[derive(Serialize, Deserialize, Debug)]
pub struct BackendErrorDetails {
    pub error_id: String,
    pub error_message: String,
    pub error_code: String,
    pub timestamp: u64,
    pub operation_context: Option<String>,
    pub stack_trace: Option<String>,
}

/// Report a frontend error with comprehensive validation
#[tauri::command]
pub async fn report_frontend_error(
    error_report: FrontendErrorReport,
    _app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, ApiError> {
    let _tracker = CommandPerformanceTracker::new("report_frontend_error");
    
    // Validate IPC operation with system access capability for error reporting
    let _context = validate_ipc_operation(
        &state.security_validator, 
        vec![OperationCapability::SystemAccess]
    ).map_err(|e| ApiError {
        code: "IPC_VALIDATION_FAILED".to_string(),
        message: format!("IPC validation failed: {}", e),
    })?;

    // Validate error report content for security
    validate_error_content(&error_report.message, "message")?;
    
    if let Some(ref stack) = error_report.stack_trace {
        validate_error_content(stack, "stack_trace")?;
    }
    
    if let Some(ref component) = error_report.component_name {
        validate_error_content(component, "component_name")?;
    }

    // Log the security-validated error
    log_security_event(
        "frontend_error_reported",
        "IPC",
        true,
        &format!("Error ID: {} | Type: {}", error_report.error_id, error_report.error_type),
    );

    // Create sanitized version for logging
    let sanitized_message = sanitize_for_logging(&error_report.message);
    
    // In a production system, this would be sent to a logging service
    println!(
        "Frontend Error [{}]: {} | Component: {:?} | Type: {}",
        error_report.error_id,
        sanitized_message,
        error_report.component_name,
        error_report.error_type
    );

    Ok(format!("Error report {} processed successfully", error_report.error_id))
}

/// Get backend error details for debugging
#[tauri::command]
pub async fn get_backend_error_details(
    error_id: String,
    _app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BackendErrorDetails, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_backend_error_details");
    
    // Validate IPC operation with system access capability for diagnostics
    let _context = validate_ipc_operation(
        &state.security_validator, 
        vec![OperationCapability::SystemAccess]
    ).map_err(|e| ApiError {
        code: "IPC_VALIDATION_FAILED".to_string(),
        message: format!("IPC validation failed: {}", e),
    })?;

    // Validate error ID for security
    if error_id.len() > 100 || error_id.contains(['<', '>', '"', '\'', '&']) {
        return Err(ApiError {
            code: "INVALID_ERROR_ID".to_string(),
            message: "Error ID contains invalid characters".to_string(),
        });
    }

    // In a real implementation, this would query a database or log store
    // For now, return a mock error details structure
    Ok(BackendErrorDetails {
        error_id: error_id.clone(),
        error_message: "Mock error details for testing".to_string(),
        error_code: "MOCK_ERROR".to_string(),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        operation_context: Some("test_context".to_string()),
        stack_trace: None,
    })
}

/// Validates error content to prevent malicious patterns
fn validate_error_content(content: &str, _field_name: &str) -> Result<(), ApiError> {
    // Check for script injection patterns
    let dangerous_patterns = [
        "<script", "</script>", "javascript:", "vbscript:",
        "eval(", "exec(", "system(",
        // Command injection patterns  
        "rm -rf", "del ", "cmd.exe", "powershell",
        // Network patterns
        "http://", "https://", "ftp://",
        // Sensitive file patterns - handle both escaped and unescaped paths
        "/etc/passwd", "/etc/shadow", "windows\\system32", "windows/system32",
        // Code execution patterns
        "__import__", "require(", "process.env",
    ];
    
    let content_lower = content.to_lowercase();
    
    for pattern in &dangerous_patterns {
        if content_lower.contains(pattern) {
            return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Error content contains potentially dangerous patterns".to_string(),
            });
        }
    }
    
    Ok(())
}

/// Sanitizes content for secure logging
fn sanitize_for_logging(content: &str) -> String {
    // Remove potential sensitive patterns and limit length
    let max_length = 200;
    let content = if content.len() > max_length {
        format!("{}...[truncated]", &content[..max_length])
    } else {
        content.to_string()
    };
    
    // Remove newlines and control characters
    content
        .chars()
        .filter(|&c| c != '\n' && c != '\r' && c != '\t' && c.is_control() == false)
        .collect::<String>()
}

#[cfg(test)]
#[allow(unused)]
mod tests_disabled {
    use super::*;

    #[test]
    fn test_error_field_validation() {
        // Test valid content
        let valid_content = "TypeError: Cannot read property 'length' of undefined";
        let result = validate_error_content(valid_content, "message");
        assert!(result.is_ok(), "Valid error content should be accepted");

        // Test malicious content
        let malicious_content = "<script>alert('xss')</script>";
        let result = validate_error_content(malicious_content, "message");
        assert!(result.is_err(), "Malicious content should be rejected");
    }

    #[test]
    fn test_error_content_validation() {
        // Test malicious patterns that should be rejected
        let malicious_patterns = vec![
            "<script>alert('xss')</script>",
            "javascript:alert(1)",
            "eval('malicious code')",
            "system('rm -rf /')",
            "cmd.exe /c dir",
            "powershell -c Get-Process",
            "/etc/passwd",
            "C:\\Windows\\System32",  // Single backslash version
            "C:/Windows/System32",   // Forward slash version  
            "windows\\system32",     // Lower case versions
            "windows/system32",
        ];
        
        for pattern in malicious_patterns {
            let result = validate_error_content(pattern, "test");
            assert!(result.is_err(), "Malicious pattern should be rejected: {}", pattern);
        }
        
        // Test valid content
        let valid_content = vec![
            "TypeError: Cannot read property 'length' of undefined",
            "ReferenceError: variable is not defined",
            "Error at Component.render (app.js:123:45)",
            "Network request failed with status 404",
        ];
        
        for content in valid_content {
            let result = validate_error_content(content, "test");
            assert!(result.is_ok(), "Valid content should be accepted: {}", content);
        }
    }
    
    #[tokio::test]
    async fn test_sanitization_for_logging() {
        // Test content sanitization
        let test_content = "Error\nwith\ttabs\rand\rcarriage\nreturns";
        let sanitized = sanitize_for_logging(test_content);
        
        // Should remove newlines, tabs, and carriage returns
        assert!(!sanitized.contains('\n'));
        assert!(!sanitized.contains('\t'));
        assert!(!sanitized.contains('\r'));
        
        // Test length truncation
        let long_content = "a".repeat(300);
        let sanitized_long = sanitize_for_logging(&long_content);
        assert!(sanitized_long.len() <= 215); // 200 + "[truncated]"
        assert!(sanitized_long.ends_with("...[truncated]"));
    }

    #[test]
    fn test_error_report_boundary_conditions() {
        // Test empty content
        let result = validate_error_content("", "test");
        assert!(result.is_ok(), "Empty content should be accepted");
        
        // Test very long content (but not malicious)
        let long_content = "a".repeat(1000);
        let result = validate_error_content(&long_content, "test");
        assert!(result.is_ok(), "Long but safe content should be accepted");
    }
}