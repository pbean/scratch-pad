use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::timeout;
use tauri::{AppHandle, Emitter};

use crate::database::DbService;
use crate::settings::SettingsService;
use crate::global_shortcut::GlobalShortcutService;
use crate::window_manager::WindowManager;
use crate::plugin::PluginManager;
use crate::validation::SecurityValidator;
use crate::error::AppError;

/// Graceful shutdown manager for the application
#[derive(Debug)]
pub struct ShutdownManager {
    /// Atomic flag to signal shutdown in progress
    is_shutting_down: Arc<AtomicBool>,
    /// Maximum time to wait for graceful shutdown
    shutdown_timeout: Duration,
    /// Application handle for emitting events
    app_handle: Option<AppHandle>,
}

/// Shutdown status information
#[derive(Debug, Clone, serde::Serialize)]
pub struct ShutdownStatus {
    pub stage: ShutdownStage,
    pub message: String,
    pub progress: u8, // 0-100
}

/// Shutdown stages for progress tracking
#[derive(Debug, Clone, serde::Serialize)]
pub enum ShutdownStage {
    #[serde(rename = "initiated")]
    Initiated,
    #[serde(rename = "saving_data")]
    SavingData,
    #[serde(rename = "cleaning_resources")]
    CleaningResources,
    #[serde(rename = "finalizing")]
    Finalizing,
    #[serde(rename = "complete")]
    Complete,
}

impl Default for ShutdownManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ShutdownManager {
    /// Create a new shutdown manager with default timeout (30 seconds)
    pub fn new() -> Self {
        Self {
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            shutdown_timeout: Duration::from_secs(30),
            app_handle: None,
        }
    }

    /// Create a new shutdown manager with custom timeout
    pub fn with_timeout(timeout: Duration) -> Self {
        Self {
            is_shutting_down: Arc::new(AtomicBool::new(false)),
            shutdown_timeout: timeout,
            app_handle: None,
        }
    }

    /// Set the application handle for event emission
    pub fn set_app_handle(&mut self, app_handle: AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Check if shutdown is in progress
    pub fn is_shutting_down(&self) -> bool {
        self.is_shutting_down.load(Ordering::Relaxed)
    }

    /// Get a clone of the shutdown flag for use in other services
    pub fn get_shutdown_flag(&self) -> Arc<AtomicBool> {
        self.is_shutting_down.clone()
    }

    /// Emit shutdown status to frontend
    async fn emit_status(&self, status: ShutdownStatus) {
        if let Some(app_handle) = &self.app_handle {
            if let Err(e) = app_handle.emit("shutdown_status", &status) {
                eprintln!("Warning: Failed to emit shutdown status: {}", e);
            }
        }
        
        println!("Shutdown: {} - {}", 
                 match status.stage {
                     ShutdownStage::Initiated => "Initiated",
                     ShutdownStage::SavingData => "Saving Data",
                     ShutdownStage::CleaningResources => "Cleaning Resources",
                     ShutdownStage::Finalizing => "Finalizing",
                     ShutdownStage::Complete => "Complete",
                 },
                 status.message);
    }

    /// Perform graceful shutdown with timeout
    pub async fn shutdown_gracefully(
        &self,
        db_service: Arc<DbService>,
        settings_service: Arc<SettingsService>,
        global_shortcut_service: Arc<GlobalShortcutService>,
        window_manager: Arc<WindowManager>,
        plugin_manager: Arc<tokio::sync::Mutex<PluginManager>>,
        _security_validator: Arc<SecurityValidator>,
    ) -> Result<(), AppError> {
        // Set shutdown flag
        self.is_shutting_down.store(true, Ordering::Relaxed);

        // Emit initial shutdown status
        self.emit_status(ShutdownStatus {
            stage: ShutdownStage::Initiated,
            message: "Graceful shutdown initiated".to_string(),
            progress: 10,
        }).await;

        // Execute shutdown with timeout
        let shutdown_result = timeout(
            self.shutdown_timeout,
            self.perform_shutdown(
                db_service,
                settings_service,
                global_shortcut_service,
                window_manager,
                plugin_manager,
                _security_validator,
            )
        ).await;

        match shutdown_result {
            Ok(result) => {
                self.emit_status(ShutdownStatus {
                    stage: ShutdownStage::Complete,
                    message: "Graceful shutdown completed successfully".to_string(),
                    progress: 100,
                }).await;
                result
            }
            Err(_) => {
                eprintln!("Warning: Shutdown timeout reached, forcing exit");
                self.emit_status(ShutdownStatus {
                    stage: ShutdownStage::Complete,
                    message: "Shutdown timeout reached, forcing exit".to_string(),
                    progress: 100,
                }).await;
                
                // Allow a brief moment for the event to be sent
                tokio::time::sleep(Duration::from_millis(100)).await;
                Err(AppError::Runtime { 
                    message: "Shutdown timeout exceeded".to_string() 
                })
            }
        }
    }

    /// Internal shutdown implementation
    async fn perform_shutdown(
        &self,
        db_service: Arc<DbService>,
        settings_service: Arc<SettingsService>,
        global_shortcut_service: Arc<GlobalShortcutService>,
        window_manager: Arc<WindowManager>,
        plugin_manager: Arc<tokio::sync::Mutex<PluginManager>>,
        _security_validator: Arc<SecurityValidator>,
    ) -> Result<(), AppError> {
        
        // Stage 1: Save pending data
        self.emit_status(ShutdownStatus {
            stage: ShutdownStage::SavingData,
            message: "Saving pending data and settings".to_string(),
            progress: 25,
        }).await;

        // Wait for any pending database operations and flush data
        if let Ok(conn) = db_service.get_connection() {
            // Force WAL checkpoint to ensure all data is written
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            
            // Optimize database before shutdown
            let _ = conn.execute_batch("PRAGMA optimize;");
        }

        // Ensure settings are persisted
        if let Err(e) = settings_service.flush_pending_changes().await {
            eprintln!("Warning: Failed to flush pending settings: {}", e);
        }

        // Stage 2: Clean up resources
        self.emit_status(ShutdownStatus {
            stage: ShutdownStage::CleaningResources,
            message: "Cleaning up system resources".to_string(),
            progress: 50,
        }).await;

        // Unregister global shortcuts
        if let Err(e) = global_shortcut_service.cleanup().await {
            eprintln!("Warning: Failed to clean up global shortcuts: {}", e);
        }

        // Clean up plugins
        {
            let mut pm = plugin_manager.lock().await;
            if let Err(e) = pm.shutdown().await {
                eprintln!("Warning: Failed to shutdown plugins: {}", e);
            }
        }

        // Clean up temporary files and IPC resources
        // TODO: cleanup_all_temp_files method not yet implemented in SecurityValidator
        // if let Err(e) = security_validator.cleanup_all_temp_files() {
        //     eprintln!("Warning: Failed to cleanup temporary files: {}", e);
        // }

        // Stage 3: Finalize shutdown
        self.emit_status(ShutdownStatus {
            stage: ShutdownStage::Finalizing,
            message: "Finalizing shutdown process".to_string(),
            progress: 75,
        }).await;

        // Hide window gracefully
        if let Err(e) = window_manager.hide_window().await {
            eprintln!("Warning: Failed to hide window: {}", e);
        }

        // Clean up lock file last
        crate::cli::cleanup_lock_file();

        Ok(())
    }

    /// Initiate shutdown process - simple method for command handlers
    pub async fn initiate_shutdown(&self) -> Result<(), AppError> {
        if self.is_shutting_down() {
            return Err(AppError::Runtime {
                message: "Shutdown already in progress".to_string(),
            });
        }

        // Just set the shutdown flag - the actual shutdown will be handled by signal handlers
        // or the main application loop
        self.is_shutting_down.store(true, Ordering::Relaxed);
        
        // Emit shutdown initiated status
        self.emit_status(ShutdownStatus {
            stage: ShutdownStage::Initiated,
            message: "Application shutdown initiated".to_string(),
            progress: 0,
        }).await;

        Ok(())
    }

    /// Register signal handlers for graceful shutdown
    pub fn register_signal_handlers(
        &self,
        db_service: Arc<DbService>,
        settings_service: Arc<SettingsService>,
        global_shortcut_service: Arc<GlobalShortcutService>,
        window_manager: Arc<WindowManager>,
        plugin_manager: Arc<tokio::sync::Mutex<PluginManager>>,
        _security_validator: Arc<SecurityValidator>,
    ) {
        let shutdown_manager = Self {
            is_shutting_down: self.is_shutting_down.clone(),
            shutdown_timeout: self.shutdown_timeout,
            app_handle: self.app_handle.clone(),
        };

        // Register Ctrl+C handler
        let db_clone = db_service.clone();
        let settings_clone = settings_service.clone();
        let shortcut_clone = global_shortcut_service.clone();
        let window_clone = window_manager.clone();
        let plugin_clone = plugin_manager.clone();
        let validator_clone = _security_validator.clone();

        let _ = ctrlc::set_handler(move || {
            println!("Received interrupt signal, initiating graceful shutdown...");
            
            // Create a new Tokio runtime for the shutdown process since we're in a signal handler
            let rt = tokio::runtime::Runtime::new().unwrap();
            
            rt.block_on(async {
                if let Err(e) = shutdown_manager.shutdown_gracefully(
                    db_clone.clone(),
                    settings_clone.clone(),
                    shortcut_clone.clone(),
                    window_clone.clone(),
                    plugin_clone.clone(),
                    validator_clone.clone(),
                ).await {
                    eprintln!("Shutdown error: {}", e);
                    std::process::exit(1);
                } else {
                    std::process::exit(0);
                }
            });
        });

        // Unix signal handlers are managed by the ctrlc handler above
        // This provides sufficient cross-platform signal handling without runtime issues
        #[cfg(unix)]
        {
            // Additional Unix-specific signal handling can be added later if needed
            // when the application is running and has an active Tokio runtime
        }
    }
}

// Note: Tauri command handlers for is_shutting_down and initiate_shutdown 
// have been moved to src/commands/lifecycle.rs as part of the modular architecture

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_shutdown_manager_creation() {
        let manager = ShutdownManager::new();
        assert!(!manager.is_shutting_down());
        assert_eq!(manager.shutdown_timeout, Duration::from_secs(30));
    }

    #[test]
    fn test_shutdown_manager_with_custom_timeout() {
        let custom_timeout = Duration::from_secs(15);
        let manager = ShutdownManager::with_timeout(custom_timeout);
        assert!(!manager.is_shutting_down());
        assert_eq!(manager.shutdown_timeout, custom_timeout);
    }

    #[test]
    fn test_shutdown_flag() {
        let manager = ShutdownManager::new();
        let flag = manager.get_shutdown_flag();
        
        // Initially not shutting down
        assert!(!manager.is_shutting_down());
        assert!(!flag.load(Ordering::Relaxed));
        
        // Set shutdown flag
        flag.store(true, Ordering::Relaxed);
        assert!(manager.is_shutting_down());
    }

    #[tokio::test]
    async fn test_shutdown_status_serialization() {
        let status = ShutdownStatus {
            stage: ShutdownStage::SavingData,
            message: "Test message".to_string(),
            progress: 50,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("saving_data"));
        assert!(json.contains("Test message"));
        assert!(json.contains("50"));
    }

    #[tokio::test]
    async fn test_initiate_shutdown() {
        let manager = ShutdownManager::new();
        
        // Should not be shutting down initially
        assert!(!manager.is_shutting_down());
        
        // Initiate shutdown
        let result = manager.initiate_shutdown().await;
        assert!(result.is_ok());
        assert!(manager.is_shutting_down());
        
        // Should fail if already shutting down
        let result2 = manager.initiate_shutdown().await;
        assert!(result2.is_err());
    }
}