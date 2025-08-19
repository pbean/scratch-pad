use crate::database::DbService;
use crate::global_shortcut::GlobalShortcutService;
use crate::plugin::PluginManager;
use crate::search::SearchService;
use crate::settings::SettingsService;
use crate::shutdown::ShutdownManager;
use crate::validation::SecurityValidator;
use crate::window_manager::WindowManager;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub mod commands;
pub mod database;
pub mod error;
pub mod global_shortcut;
pub mod ipc_tests;
pub mod models;
pub mod plugin;
pub mod plugin_integration_test;
pub mod search;
pub mod security_tests;
pub mod settings;
pub mod shutdown;
pub mod validation;
pub mod window_manager;
pub mod cli;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DbService>,
    pub search: Arc<SearchService>,
    pub settings: Arc<SettingsService>,
    pub global_shortcut: Arc<GlobalShortcutService>,
    pub window_manager: Arc<WindowManager>,
    pub plugin_manager: Arc<tokio::sync::Mutex<PluginManager>>,
    pub security_validator: Arc<SecurityValidator>,
    pub shutdown_manager: Arc<ShutdownManager>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database
            let db_path = app.path().app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap())
                .join("scratch-pad.db");
            
            let db_service = Arc::new(DbService::new(&db_path).unwrap());
            
            // Initialize security validator
            let security_validator = Arc::new(SecurityValidator::new());
            
            // Initialize search service
            let search_service = Arc::new(SearchService::new(db_service.clone()));
            
            // Initialize settings service
            let settings_service = Arc::new(SettingsService::new(db_service.clone()));
            
            // Initialize global shortcut service
            let global_shortcut = Arc::new(GlobalShortcutService::new(
                app.handle().clone(), 
                settings_service.clone()
            ));
            
            // Initialize window manager
            let window_manager = Arc::new(WindowManager::new(
                app.handle().clone(), 
                settings_service.clone()
            ));
            
            // Initialize plugin manager
            let plugin_manager = Arc::new(Mutex::new(PluginManager::new()));
            
            // Initialize shutdown manager
            let mut shutdown_manager = ShutdownManager::new();
            shutdown_manager.set_app_handle(app.handle().clone());
            let shutdown_manager = Arc::new(shutdown_manager);
            
            // Compose app state
            let app_state = AppState {
                db: db_service,
                search: search_service,
                settings: settings_service,
                global_shortcut,
                window_manager,
                plugin_manager,
                security_validator,
                shutdown_manager,
            };
            
            // Install the app state
            app.manage(app_state);
            
            Ok(())
        })
        .invoke_handler(crate::generate_command_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn verify_app_setup() {
        // This test ensures the app setup compiles correctly
        // The actual functionality would be tested in integration tests
    }
}