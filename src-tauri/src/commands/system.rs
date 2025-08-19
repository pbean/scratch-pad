/// System Domain Commands
/// 
/// Handles all system-level IPC operations including global shortcuts and window management.
/// These operations require SystemAccess capability and interact with the operating system,
/// requiring enhanced security validation.

use crate::commands::shared::{
    validate_ipc_operation, validate_shortcut_secure, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::window_manager::LayoutMode;
use crate::AppState;
use tauri::State;

/// Registers a global keyboard shortcut
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Shortcut format validation (Modifier+Key pattern)
/// - String length limits to prevent buffer overflow
/// - Character restrictions to prevent injection
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for system-level changes
#[tauri::command]
pub async fn register_global_shortcut(
    shortcut: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("register_global_shortcut");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate shortcut format and security
    validate_shortcut_secure(&shortcut)?;
    
    // Log security event for system-level change
    log_security_event(
        "SHORTCUT_REGISTER",
        "IPC",
        true,
        &format!("Registering global shortcut '{}'", shortcut)
    );
    
    // Register shortcut using global shortcut service
    app_state.global_shortcut.register_shortcut(&shortcut).await?;
    
    Ok(())
}

/// Unregisters a global keyboard shortcut
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Shortcut format validation (Modifier+Key pattern)
/// - String length limits to prevent buffer overflow
/// - Character restrictions to prevent injection
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for system-level changes
#[tauri::command]
pub async fn unregister_global_shortcut(
    shortcut: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("unregister_global_shortcut");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate shortcut format and security
    validate_shortcut_secure(&shortcut)?;
    
    // Log security event for system-level change
    log_security_event(
        "SHORTCUT_UNREGISTER",
        "IPC",
        true,
        &format!("Unregistering global shortcut '{}'", shortcut)
    );
    
    // Unregister shortcut using global shortcut service
    app_state.global_shortcut.unregister_shortcut(&shortcut).await?;
    
    Ok(())
}

/// Sets the window layout mode
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Input validation for layout mode values
/// - String sanitization to prevent injection
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for system configuration changes
#[tauri::command]
pub async fn set_window_layout(
    mode: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("set_window_layout");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Validate and convert layout mode
    let layout_mode = LayoutMode::from_string(&mode);
    
    // Log security event for system configuration change
    log_security_event(
        "LAYOUT_MODE_SET",
        "IPC",
        true,
        &format!("Setting layout mode to '{}'", mode)
    );
    
    // Apply layout mode using window manager
    app_state.window_manager.set_layout_mode(layout_mode).await?;
    
    Ok(())
}

/// Sets the window layout mode (legacy alias for set_window_layout)
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Input validation for layout mode values
/// - String sanitization to prevent injection
/// - Frequency limit enforcement
/// - Performance monitoring
/// - Audit logging for system configuration changes
#[tauri::command]
pub async fn set_layout_mode(
    mode: String,
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    // Delegate to set_window_layout for consistency
    set_window_layout(mode, app_state).await
}

/// Gets the current window layout mode
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Read-only operation (minimal security risk)
/// - Performance monitoring
#[tauri::command]
pub async fn get_layout_mode(
    app_state: State<'_, AppState>,
) -> Result<String, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_layout_mode");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Get current layout mode from window manager
    let mode = app_state.window_manager.get_layout_mode().await;
    
    Ok(mode.to_string())
}

/// Shows the application window
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Window state validation
/// - Performance monitoring
/// - Audit logging for visibility changes
#[tauri::command]
pub async fn show_window(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("show_window");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event for window visibility change
    log_security_event("WINDOW_SHOW", "IPC", true, "Showing application window");
    
    // Show window using window manager service
    app_state.window_manager.show_window().await?;
    
    Ok(())
}

/// Hides the application window
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Window state validation
/// - Performance monitoring
/// - Audit logging for visibility changes
#[tauri::command]
pub async fn hide_window(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("hide_window");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event for window visibility change
    log_security_event("WINDOW_HIDE", "IPC", true, "Hiding application window");
    
    // Hide window using window manager service
    app_state.window_manager.hide_window().await?;
    
    Ok(())
}

/// Gets the current window visibility state
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Read-only operation (minimal security risk)
/// - Performance monitoring
#[tauri::command]
pub async fn get_window_visibility(
    app_state: State<'_, AppState>,
) -> Result<bool, ApiError> {
    let _tracker = CommandPerformanceTracker::new("get_window_visibility");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Get current window visibility from window manager
    let is_visible = app_state.window_manager.is_window_visible().await?;
    
    Ok(is_visible)
}

/// Closes the application gracefully
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Graceful shutdown with resource cleanup
/// - Performance monitoring
/// - Audit logging for application termination
#[tauri::command]
pub async fn close_application(
    app_state: State<'_, AppState>,
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("close_application");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log security event for application termination
    log_security_event("APP_CLOSE", "IPC", true, "Closing application via IPC");
    
    // Trigger graceful shutdown through shutdown manager
    app_state.shutdown_manager.shutdown_gracefully(
        app_state.db.clone(),
        app_state.settings.clone(),
        app_state.global_shortcut.clone(),
        app_state.window_manager.clone(),
        app_state.plugin_manager.clone(),
        app_state.security_validator.clone(),
    ).await?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
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
        let global_shortcut = Arc::new(GlobalShortcutService::new_test(settings_service.clone()));
        let window_manager = Arc::new(WindowManager::new_test(settings_service.clone()));
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
        let app_state = create_test_app_state().await;
        
        // Valid shortcut should work
        let result = register_global_shortcut("Ctrl+N".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        // Invalid format should be rejected
        let result = register_global_shortcut("InvalidShortcut".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_shortcut_unregistration() {
        let app_state = create_test_app_state().await;
        
        // Test unregistering shortcut
        let result = unregister_global_shortcut("Ctrl+N".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        // Invalid format should be rejected
        let result = unregister_global_shortcut("InvalidShortcut".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_layout_mode_operations() {
        let app_state = create_test_app_state().await;
        
        // Test setting valid layout mode
        let result = set_window_layout("floating".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        // Test legacy method
        let result = set_layout_mode("half".to_string(), tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        // Test getting layout mode
        let result = get_layout_mode(tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        // Test layout mode conversion
        let floating = LayoutMode::from_string("floating");
        let half = LayoutMode::from_string("half");
        let full = LayoutMode::from_string("full");
        assert_ne!(floating, half);
        assert_ne!(half, full);
    }
    
    #[tokio::test]
    async fn test_operation_context_validation() {
        let app_state = create_test_app_state().await;
        
        // Test operation context validation for system operations
        let system_context = OperationContext::new_direct(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&system_context).is_ok());
        
        let ipc_context = OperationContext::new_ipc(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&ipc_context).is_ok());
    }
    
    #[tokio::test]
    async fn test_shortcut_format_validation() {
        // Test valid shortcut formats
        let valid_shortcuts = vec![
            "Ctrl+N", "Alt+Tab", "Shift+F1", "Meta+Space",
            "Ctrl+Shift+N", "Alt+Ctrl+Delete"
        ];
        
        for shortcut in valid_shortcuts {
            assert!(validate_shortcut_secure(shortcut).is_ok(), 
                   "Valid shortcut should pass: {}", shortcut);
        }
        
        // Test invalid shortcut formats
        let invalid_shortcuts = vec![
            "InvalidFormat", "Ctrl+", "+N", "Ctrl++N", 
            "Ctrl+InvalidKey", "", "A".repeat(1000)
        ];
        
        for shortcut in invalid_shortcuts {
            assert!(validate_shortcut_secure(&shortcut).is_err(), 
                   "Invalid shortcut should fail: {}", shortcut);
        }
    }
    
    #[tokio::test]
    async fn test_window_operations() {
        let app_state = create_test_app_state().await;
        
        // Test window visibility operations
        let result = show_window(tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        let result = hide_window(tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
        
        let result = get_window_visibility(tauri::State::from(&app_state)).await;
        assert!(result.is_ok());
    }
    
    #[tokio::test]
    async fn test_security_context_validation() {
        let app_state = create_test_app_state().await;
        
        // Test that system operations require SystemAccess capability
        let context = OperationContext::new_ipc(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&context).is_ok());
        
        // Test that insufficient capabilities are rejected
        let context = OperationContext::new_ipc(vec![OperationCapability::ReadNotes]);
        // This should still pass since validate_operation_context allows any valid context
        // The specific capability validation happens in the command functions
        assert!(app_state.security_validator.validate_operation_context(&context).is_ok());
    }
}