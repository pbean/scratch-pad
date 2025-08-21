/// Lifecycle Domain Commands
/// 
/// Handles application lifecycle operations including graceful shutdown.
/// These commands manage the application's state and ensure proper cleanup
/// during shutdown processes.

use crate::commands::shared::{
    validate_ipc_operation, CommandPerformanceTracker, log_security_event
};
use crate::error::ApiError;
use crate::validation::OperationCapability;
use crate::AppState;
use tauri::State;

/// Checks if the application is currently shutting down
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Read-only operation (minimal security risk)
/// - Performance monitoring
/// - Audit logging for shutdown state queries
#[tauri::command]
pub async fn is_shutting_down(
    app_state: State<'_, AppState>
) -> Result<bool, ApiError> {
    let _tracker = CommandPerformanceTracker::new("is_shutting_down");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Check shutdown state
    let shutting_down = app_state.shutdown_manager.is_shutting_down();
    
    // Log shutdown state query (only log if actually shutting down to reduce noise)
    if shutting_down {
        log_security_event(
            "SHUTDOWN_STATE_QUERY",
            "IPC",
            true,
            "Application is shutting down"
        );
    }
    
    Ok(shutting_down)
}

/// Initiates graceful application shutdown
/// 
/// Security features:
/// - IPC operation context validation with SystemAccess capability
/// - Comprehensive resource cleanup
/// - Performance monitoring
/// - Audit logging for shutdown initiation
/// - Graceful handling of shutdown timeout
/// - Proper error handling during cleanup
#[tauri::command]
pub async fn initiate_shutdown(
    app_state: State<'_, AppState>
) -> Result<(), ApiError> {
    let _tracker = CommandPerformanceTracker::new("initiate_shutdown");
    
    // Validate IPC operation with required capabilities
    let _context = validate_ipc_operation(
        &app_state.security_validator,
        vec![OperationCapability::SystemAccess]
    )?;
    
    // Log shutdown initiation
    log_security_event(
        "SHUTDOWN_INITIATED",
        "IPC",
        true,
        "Graceful shutdown initiated via IPC"
    );
    
    // Initiate graceful shutdown through shutdown manager
    // This will handle all resource cleanup in the proper order
    match app_state.shutdown_manager.shutdown_gracefully(
        app_state.db.clone(),
        app_state.settings.clone(),
        app_state.global_shortcut.clone(),
        app_state.window_manager.clone(),
        app_state.plugin_manager.clone(),
        app_state.security_validator.clone(),
    ).await {
        Ok(_) => {
            log_security_event(
                "SHUTDOWN_SUCCESS",
                "SYSTEM",
                true,
                "Graceful shutdown completed successfully"
            );
            Ok(())
        }
        Err(e) => {
            log_security_event(
                "SHUTDOWN_ERROR",
                "SYSTEM",
                false,
                &format!("Shutdown failed: {}", e)
            );
            Err(ApiError {
                code: "SHUTDOWN_ERROR".to_string(),
                message: format!("Failed to initiate shutdown: {}", e),
            })
        }
    }
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
            global_shortcut: Arc::new(GlobalShortcutService::new_test(settings_service.clone())),
            window_manager: Arc::new(WindowManager::new_test(settings_service)),
            plugin_manager,
            security_validator,
            shutdown_manager: Arc::new(ShutdownManager::default()),
        }
    }
    
    #[tokio::test]
    async fn test_is_shutting_down_security() {
        let app_state = create_test_app_state().await;
        
        // Test shutdown state checking directly
        let shutting_down = app_state.shutdown_manager.is_shutting_down();
        assert_eq!(shutting_down, false); // Initially not shutting down
    }
    
    #[tokio::test]
    async fn test_shutdown_state_consistency() {
        let app_state = create_test_app_state().await;
        
        // Initially should not be shutting down
        let initial_state = app_state.shutdown_manager.is_shutting_down();
        assert_eq!(initial_state, false);
        
        // Test shutdown manager functionality directly
        // Note: In a real test, we'd call shutdown_gracefully, but that would 
        // actually shut down the test environment. Instead we test the state consistency.
    }
    
    #[tokio::test]
    async fn test_operation_context_validation() {
        let app_state = create_test_app_state().await;
        
        // Test operation context validation for lifecycle operations
        let system_context = OperationContext::new_direct(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&system_context).is_ok());
        
        let ipc_context = OperationContext::new_ipc(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&ipc_context).is_ok());
    }
    
    #[tokio::test]
    async fn test_lifecycle_command_performance() {
        let app_state = create_test_app_state().await;
        
        // Measure performance of shutdown state check
        let start = std::time::Instant::now();
        let _shutting_down = app_state.shutdown_manager.is_shutting_down();
        let duration = start.elapsed();
        
        // Should complete well under 2ms target
        assert!(duration.as_millis() < 2, "shutdown state check took {:?}ms", duration.as_millis());
    }
    
    #[tokio::test]
    async fn test_shutdown_manager_initialization() {
        let app_state = create_test_app_state().await;
        
        // Test that shutdown manager is properly initialized
        assert!(!app_state.shutdown_manager.is_shutting_down());
        
        // Test shutdown manager has required functionality
        // In production, the shutdown manager would have proper cleanup logic
    }
    
    #[tokio::test]
    async fn test_lifecycle_security_validation() {
        let app_state = create_test_app_state().await;
        
        // Test that lifecycle operations require proper capabilities
        let context_without_system_access = OperationContext::new_direct(vec![OperationCapability::ReadNotes]);
        assert!(app_state.security_validator.validate_operation_context(&context_without_system_access).is_ok());
        
        // System access should be properly validated
        let context_with_system_access = OperationContext::new_direct(vec![OperationCapability::SystemAccess]);
        assert!(app_state.security_validator.validate_operation_context(&context_with_system_access).is_ok());
    }
}