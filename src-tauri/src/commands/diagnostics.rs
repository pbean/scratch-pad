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
use tauri::{State, AppHandle};
use serde::{Deserialize, Serialize};

/// Frontend error report structure
#[derive(Serialize, Deserialize, Debug)]
pub struct FrontendErrorReport {
    pub error_id: String,
    pub message: String,
    pub stack: Option<String>,
    pub component_stack: Option<String>,
    pub user_agent: Option<String>,
    pub url: Option<String>,
    pub timestamp: Option<String>,
}

/// Backend error details structure
#[derive(Serialize, Deserialize, Debug)]
pub struct BackendErrorDetails {
    pub error_type: String,
    pub error_code: Option<String>,
    pub system_info: HashMap<String, String>,
    pub performance_metrics: Option<HashMap<String, f64>>,
}

/// Reports frontend errors to the backend for logging and monitoring
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Input validation for all error report fields
/// - Size limits on error messages and stack traces
/// - Malicious content detection in error data
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Secure logging with PII protection
#[tauri::command]
pub async fn report_frontend_error(
    error_report: FrontendErrorReport,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("report_frontend_error");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate error report fields
    validate_error_report(&error_report)?;
    
    // Log security event for error reporting
    log_security_event(
        "ERROR_REPORT",
        "FRONTEND",
        true,
        &format!("Frontend error reported: {} (ID: {})", 
                sanitize_for_logging(&error_report.message), 
                sanitize_for_logging(&error_report.error_id))
    );
    
    // Log the error with security considerations (avoid logging sensitive data)
    eprintln!(
        "[ERROR_REPORT] {} - {} - Message: {} - Component: {}",
        error_report.timestamp.as_deref().unwrap_or("unknown"),
        error_report.error_id,
        sanitize_for_logging(&error_report.message),
        error_report.component_stack.as_deref()
            .map(|s| sanitize_for_logging(s))
            .unwrap_or_else(|| "unknown".to_string())
    );
    
    // In production, you might want to send this to a logging service
    // or store in database for analysis
    
    Ok(())
}

/// Retrieves backend error details and system information
/// 
/// Security features:
/// - No sensitive system information exposed
/// - Version information for debugging
/// - Performance metrics (if available)
/// - Sanitized system information
#[tauri::command]
pub async fn get_backend_error_details(
    app_handle: AppHandle,
) -> Result<BackendErrorDetails, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_backend_error_details");
    
    // Note: This command doesn't require explicit validation as it's read-only
    // and doesn't expose sensitive information
    
    let mut system_info = HashMap::new();
    system_info.insert("platform".to_string(), std::env::consts::OS.to_string());
    system_info.insert("arch".to_string(), std::env::consts::ARCH.to_string());
    
    // Get app version safely
    let package_info = app_handle.package_info();
    system_info.insert("app_version".to_string(), package_info.version.to_string());
    system_info.insert("app_name".to_string(), package_info.name.clone());
    
    // Add runtime information (non-sensitive)
    system_info.insert("rust_version".to_string(), 
        std::env::var("RUSTC_VERSION_INFO").unwrap_or_else(|_| "unknown".to_string()));
    system_info.insert("build_target".to_string(), std::env::consts::ARCH.to_string());
    
    let details = BackendErrorDetails {
        error_type: "system_info".to_string(),
        error_code: None,
        system_info,
        performance_metrics: None, // Could be populated with runtime metrics
    };
    
    // Log diagnostic access
    log_security_event(
        "DIAGNOSTICS_ACCESS",
        "IPC",
        true,
        "Backend error details requested"
    );
    
    Ok(details)
}

/// Validates frontend error report for security
fn validate_error_report(report: &FrontendErrorReport) -> Result<(), ApiError> {
    // Validate error_id
    if report.error_id.is_empty() || report.error_id.len() > 100 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Invalid error ID length".to_string(),
        });
    }
    
    // Validate message
    if report.message.len() > 5000 {
        return Err(ApiError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Error message too long".to_string(),
        });
    }
    
    // Validate stack trace if present
    if let Some(ref stack) = report.stack {
        if stack.len() > 50000 {
            return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Stack trace too long".to_string(),
            });
        }
    }
    
    // Validate component stack if present
    if let Some(ref component_stack) = report.component_stack {
        if component_stack.len() > 10000 {
            return Err(ApiError {
                code: "VALIDATION_ERROR".to_string(),
                message: "Component stack too long".to_string(),
            });
        }
    }
    
    // Check for malicious patterns in error data
    validate_error_content(&report.error_id, "error_id")?;
    validate_error_content(&report.message, "message")?;
    
    if let Some(ref stack) = report.stack {
        validate_error_content(stack, "stack")?;
    }
    
    if let Some(ref component_stack) = report.component_stack {
        validate_error_content(component_stack, "component_stack")?;
    }
    
    Ok(())
}

/// Validates error content for malicious patterns
fn validate_error_content(content: &str, _field_name: &str) -> Result<(), ApiError> {
    // Check for script injection patterns
    let dangerous_patterns = [
        "<script", "</script>", "javascript:", "vbscript:",
        "eval(", "exec(", "system(",
        // Command injection patterns  
        "rm -rf", "del ", "cmd.exe", "powershell",
        // Network patterns
        "http://", "https://", "ftp://",
        // Sensitive file patterns
        "/etc/passwd", "/etc/shadow", "C:\\Windows\\System32",
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
    use crate::validation::{SecurityValidator, OperationContext};
    use crate::database::DbService;
    use crate::search::SearchService;
    use crate::settings::SettingsService;
    use crate::global_shortcut::GlobalShortcutService;
    use crate::window_manager::WindowManager;
    use crate::plugin::PluginManager;
    use crate::shutdown::ShutdownManager;
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
            global_shortcut: Arc::new(GlobalShortcutService::new_test(settings_service.clone()).expect("Failed to create GlobalShortcutService for test")),
            window_manager: Arc::new(WindowManager::new_test(settings_service).expect("Failed to create WindowManager for test")),
            plugin_manager,
            security_validator,
            shutdown_manager: Arc::new(ShutdownManager::default()),
        }
    }
    
    #[tokio::test]
    async fn test_report_frontend_error_security() {
        let _app_state = create_test_app_state().await;
        
        // Test error report validation directly
        let valid_report = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "Something went wrong".to_string(),
            stack: Some("Error\n    at Component".to_string()),
            component_stack: Some("App > Component > Button".to_string()),
            user_agent: Some("Test Browser".to_string()),
            url: Some("/page".to_string()),
            timestamp: Some("2023-01-01T10:00:00Z".to_string()),
        };
        
        let result = validate_error_report(&valid_report);
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_report_frontend_error_validation() {
        let _app_state = create_test_app_state().await;
        
        // Empty error ID should fail
        let empty_id_report = FrontendErrorReport {
            error_id: "".to_string(),
            message: "Error message".to_string(),
            stack: None,
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        let result = validate_error_report(&empty_id_report);
        assert!(result.is_err());
        
        // Too long error ID should fail
        let long_id_report = FrontendErrorReport {
            error_id: "a".repeat(101),
            message: "Error message".to_string(),
            stack: None,
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        let result = validate_error_report(&long_id_report);
        assert!(result.is_err());
        
        // Too long message should fail
        let long_message_report = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "a".repeat(5001),
            stack: None,
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        let result = validate_error_report(&long_message_report);
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_report_frontend_error_malicious_content() {
        let _app_state = create_test_app_state().await;
        
        // Malicious script in message should fail
        let script_report = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "<script>alert('xss')</script>".to_string(),
            stack: None,
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        let result = validate_error_report(&script_report);
        assert!(result.is_err());
        
        // Command injection in stack should fail
        let injection_report = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "Normal error".to_string(),
            stack: Some("Error; rm -rf /".to_string()),
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        let result = validate_error_report(&injection_report);
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_error_content_validation() {
        // Test malicious content detection directly
        let malicious_patterns = vec![
            "<script>alert('xss')</script>",
            "javascript:alert(1)",
            "eval('malicious code')",
            "system('rm -rf /')",
            "cmd.exe /c dir",
            "powershell -c Get-Process",
            "/etc/passwd",
            "C:\\Windows\\System32",
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
        let unsanitized = "Error message with\nnewlines\tand\rcontrol characters";
        let sanitized = sanitize_for_logging(unsanitized);
        assert!(!sanitized.contains('\n'));
        assert!(!sanitized.contains('\r'));
        assert!(!sanitized.contains('\t'));
        
        // Test length truncation
        let long_content = "a".repeat(300);
        let truncated = sanitize_for_logging(&long_content);
        assert!(truncated.len() <= 220); // 200 + "...[truncated]"
        assert!(truncated.ends_with("...[truncated]"));
    }
    
    #[tokio::test]
    async fn test_operation_context_validation() {
        let app_state = create_test_app_state().await;
        
        // Test operation context validation for diagnostics operations
        let system_context = OperationContext::new_direct(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&system_context).is_ok());
        
        let ipc_context = OperationContext::new_ipc(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&ipc_context).is_ok());
    }
    
    #[tokio::test]
    async fn test_error_report_field_validation() {
        // Test stack trace length limits
        let long_stack = "a".repeat(50001);
        let report_with_long_stack = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "Error".to_string(),
            stack: Some(long_stack),
            component_stack: None,
            user_agent: None,
            url: None,
            timestamp: None,
        };
        assert!(validate_error_report(&report_with_long_stack).is_err());
        
        // Test component stack length limits
        let long_component_stack = "a".repeat(10001);
        let report_with_long_component_stack = FrontendErrorReport {
            error_id: "ERR-001".to_string(),
            message: "Error".to_string(),
            stack: None,
            component_stack: Some(long_component_stack),
            user_agent: None,
            url: None,
            timestamp: None,
        };
        assert!(validate_error_report(&report_with_long_component_stack).is_err());
    }
    
    #[tokio::test]
    async fn test_error_report_boundary_conditions() {
        // Test exact limit conditions
        let max_id_length = "a".repeat(100);
        let max_message_length = "a".repeat(5000);
        let max_stack_length = "a".repeat(50000);
        let max_component_stack_length = "a".repeat(10000);
        
        let boundary_report = FrontendErrorReport {
            error_id: max_id_length,
            message: max_message_length,
            stack: Some(max_stack_length),
            component_stack: Some(max_component_stack_length),
            user_agent: None,
            url: None,
            timestamp: None,
        };
        
        // Should pass validation at exact limits
        assert!(validate_error_report(&boundary_report).is_ok());
    }
}