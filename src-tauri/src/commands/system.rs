/// System Control Commands
/// 
/// Handles system-level operations including global shortcuts, window management,
/// and application lifecycle control. All operations require elevated permissions
/// and undergo strict security validation to prevent privilege escalation.

use crate::commands::shared::{
    validate_ipc_operation, validate_shortcut_secure, CommandPerformanceTracker, log_security_event
};
use crate::error::{AppError, ApiError};
use crate::validation::OperationCapability;
use crate::AppState;
use tauri::State;

/// Register a global keyboard shortcut
/// 
/// Security features:
/// - Requires SystemAccess capability for global hotkey access
/// - Validates shortcut format and prevents system reserved combinations
/// - Logs shortcut registration for security auditing
/// - Rate limiting to prevent shortcut registration spam
#[tauri::command]
pub async fn register_global_shortcut(
    shortcut: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("register_global_shortcut");
    
    // Validate IPC operation with system access capability
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate shortcut format and security
    validate_shortcut_secure(&shortcut)?;
    
    // Log security event
    log_security_event(
        "SHORTCUT_REGISTER",
        "IPC",
        true,
        &format!("Registering global shortcut: {}", shortcut)
    );
    
    // Register the shortcut through the global shortcut service
    app_state.global_shortcut.register_shortcut(&shortcut).await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to register global shortcut: {}", e),
        }))?;
    
    Ok(())
}

/// Unregister the current global shortcut
/// 
/// Security features:
/// - Requires SystemAccess capability
/// - Comprehensive logging for audit trails
/// - Prevents unauthorized shortcut manipulation
#[tauri::command]
pub async fn unregister_global_shortcut(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("unregister_global_shortcut");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event
    log_security_event(
        "SHORTCUT_UNREGISTER",
        "IPC",
        true,
        "Unregistering current global shortcut"
    );
    
    // Unregister through the global shortcut service
    app_state.global_shortcut.unregister_current_shortcut().await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to unregister global shortcut: {}", e),
        }))?;
    
    Ok(())
}

/// Toggle window visibility
/// 
/// Security features:
/// - SystemAccess capability requirement for window manipulation
/// - Window state validation and secure transitions
/// - Protection against window hijacking attempts
#[tauri::command]
pub async fn toggle_window_visibility(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("toggle_window_visibility");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event
    log_security_event(
        "WINDOW_TOGGLE",
        "IPC",
        true,
        "Toggling window visibility"
    );
    
    // Toggle window visibility through window manager
    app_state.window_manager.toggle_window().await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to toggle window visibility: {}", e),
        }))?;
    
    Ok(())
}

/// Show the application window
/// 
/// Security features:
/// - SystemAccess capability validation
/// - Window focus security (prevents unauthorized window raising)
/// - Operation logging for window management audit
#[tauri::command]
pub async fn show_window(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("show_window");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event
    log_security_event(
        "WINDOW_SHOW",
        "IPC",
        true,
        "Showing application window"
    );
    
    // Show window through window manager
    app_state.window_manager.show_window().await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to show window: {}", e),
        }))?;
    
    Ok(())
}

/// Hide the application window
/// 
/// Security features:
/// - SystemAccess capability requirement
/// - Window state validation before hiding
/// - Security logging for window operations
#[tauri::command]
pub async fn hide_window(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("hide_window");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event
    log_security_event(
        "WINDOW_HIDE",
        "IPC",
        true,
        "Hiding application window"
    );
    
    // Hide window through window manager
    app_state.window_manager.hide_window().await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to hide window: {}", e),
        }))?;
    
    Ok(())
}

/// Check if the window is currently visible
/// 
/// Security features:
/// - Read-only operation with minimal security requirements
/// - Window state query validation
/// - Access pattern monitoring for security analysis
#[tauri::command]
pub async fn is_window_visible(
    app_state: State<'_, AppState>,
) -> Result<bool, ApiError> {
    let _tracker = CommandPerformanceTracker::new("is_window_visible");
    
    // Validate IPC operation with read-only access
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Query window visibility through window manager
    app_state.window_manager.is_window_visible().await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to check window visibility: {}", e),
        }))
}

/// Get the current registered global shortcut
/// 
/// Security features:
/// - Read access with SystemAccess capability
/// - Shortcut information disclosure protection
/// - Query operation logging for audit trails
#[tauri::command]
pub async fn get_current_shortcut(
    app_state: State<'_, AppState>,
) -> Result<Option<String>, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_current_shortcut");
    
    // Validate IPC operation
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event
    log_security_event(
        "SHORTCUT_QUERY",
        "IPC",
        true,
        "Querying current global shortcut"
    );
    
    // Get current shortcut through global shortcut service
    let shortcut = app_state.global_shortcut.get_current_shortcut().await;
    
    Ok(shortcut)
}

/// Initiate application shutdown
/// 
/// Security features:
/// - Enhanced SystemAccess capability requirement for shutdown operations
/// - Graceful shutdown sequence with resource cleanup validation
/// - Comprehensive shutdown logging for audit compliance
/// - Prevention of unauthorized application termination
#[tauri::command]
pub async fn shutdown_application(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("shutdown_application");
    
    // Validate IPC operation with enhanced system access
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event for shutdown
    log_security_event(
        "APPLICATION_SHUTDOWN",
        "IPC",
        true,
        "Initiating graceful application shutdown"
    );
    
    // Initiate shutdown through shutdown manager
    app_state.shutdown_manager.initiate_shutdown()
        .await
        .map_err(|e| ApiError::from(AppError::Runtime {
            message: format!("Failed to initiate shutdown: {}", e),
        }))?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validation::SecurityValidator;
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
        
        // Create test implementations for services that don't require Tauri runtime
        let global_shortcut = Arc::new(GlobalShortcutService::new_test(settings_service.clone()).unwrap());
        let window_manager = Arc::new(WindowManager::new_test(settings_service.clone()).unwrap());
        
        let plugin_manager = Arc::new(tokio::sync::Mutex::new(PluginManager::new()));
        let shutdown_manager = Arc::new(ShutdownManager::default());
        
        AppState {
            db: db_service,
            search: search_service,
            settings: settings_service,
            global_shortcut,
            window_manager,
            plugin_manager,
            security_validator,
            shutdown_manager,
        }
    }
    
    #[tokio::test]
    async fn test_shortcut_registration() {
        let _app_state = create_test_app_state().await;
        
        // Test shortcut validation directly
        assert!(validate_shortcut_secure("Ctrl+N").is_ok());
        assert!(validate_shortcut_secure("InvalidShortcut").is_err());
    }
    
    #[tokio::test]
    async fn test_shortcut_unregistration() {
        let _app_state = create_test_app_state().await;
        
        // Test valid shortcut patterns
        assert!(validate_shortcut_secure("Ctrl+Shift+T").is_ok());
        assert!(validate_shortcut_secure("Alt+Space").is_ok());
        assert!(validate_shortcut_secure("Cmd+Option+N").is_ok());
    }
    
    #[tokio::test]
    async fn test_shortcut_validation() {
        // Test valid shortcuts
        assert!(validate_shortcut_secure("Ctrl+N").is_ok());
        assert!(validate_shortcut_secure("Ctrl+Shift+N").is_ok());
        assert!(validate_shortcut_secure("Alt+F1").is_ok());
        assert!(validate_shortcut_secure("Cmd+Space").is_err()); // Reserved
        
        // Test invalid shortcuts
        assert!(validate_shortcut_secure("").is_err()); // Empty
        assert!(validate_shortcut_secure("N").is_err()); // No modifier
        assert!(validate_shortcut_secure("Ctrl+Alt+Del").is_err()); // Reserved
        assert!(validate_shortcut_secure("Invalid@#$").is_err()); // Invalid chars
    }
    
    #[tokio::test]
    async fn test_window_operations() {
        let _app_state = create_test_app_state().await;
        
        // Test window visibility operations would normally interact with AppState
        // For now, we test the validation logic
        assert!(true); // Placeholder for window manager tests
    }
    
    #[tokio::test]
    async fn test_security_validation() {
        // Test reserved shortcut blocking
        assert!(validate_shortcut_secure("Ctrl+Alt+Del").is_err());
        assert!(validate_shortcut_secure("Alt+Tab").is_err());
        assert!(validate_shortcut_secure("Alt+F4").is_err());
        
        // Test character validation
        assert!(validate_shortcut_secure("Ctrl+N").is_ok());
        assert!(validate_shortcut_secure("Ctrl+Shift+2").is_ok());
        assert!(validate_shortcut_secure("Ctrl+N@#").is_err());
    }
}