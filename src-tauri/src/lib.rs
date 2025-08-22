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

pub mod cli;
pub mod commands;
pub mod database;
pub mod error;
pub mod global_shortcut;
#[cfg(test)]
pub mod ipc_tests;
pub mod models;
pub mod performance;
pub mod plugin;
pub mod plugin_integration_test;
pub mod search;
pub mod security_tests;
pub mod settings;
pub mod shutdown;
pub mod traits; // Add traits module
pub mod validation;
pub mod window_manager; // Add performance monitoring module

// Add testing module for comprehensive service testing framework
#[cfg(test)]
pub mod testing;

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
            let db_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap())
                .join("scratch-pad.db");

            // Create database connection with enhanced error handling
            // Fix: Convert Cow<str> to &str properly
            let db_service = DbService::new(db_path.to_string_lossy().as_ref())?;
            let db_service_arc = Arc::new(db_service);

            // Initialize search service
            // Fix: Pass Arc<DbService> instead of DbService
            let search_service = SearchService::new(db_service_arc.clone());

            // Initialize settings service
            // Fix: Pass Arc<DbService> instead of DbService
            let settings_service = SettingsService::new(db_service_arc.clone());
            let settings_service_arc = Arc::new(settings_service);

            // Initialize global shortcut service
            // Fix: Pass both AppHandle and Arc<SettingsService>
            let global_shortcut_service =
                GlobalShortcutService::new(app.handle().clone(), settings_service_arc.clone());

            // Initialize window manager
            // Fix: Pass both AppHandle and Arc<SettingsService>
            let window_manager =
                WindowManager::new(app.handle().clone(), settings_service_arc.clone());

            // Initialize plugin manager
            let plugin_manager = PluginManager::new();

            // Initialize security validator
            let security_validator = SecurityValidator::new();

            // Initialize shutdown manager
            let shutdown_manager = ShutdownManager::new();

            // Set up application state
            let state = AppState {
                db: db_service_arc,
                search: Arc::new(search_service),
                settings: settings_service_arc,
                global_shortcut: Arc::new(global_shortcut_service),
                window_manager: Arc::new(window_manager),
                plugin_manager: Arc::new(tokio::sync::Mutex::new(plugin_manager)),
                security_validator: Arc::new(security_validator),
                shutdown_manager: Arc::new(shutdown_manager),
            };

            // Store state in Tauri's state management
            app.manage(state);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::default()
                .with_handler(|_app, _shortcut, event| {
                    println!("Global shortcut triggered: {:?}", event);
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::get_all_notes, // Fix: Use get_all_notes instead of get_notes
            commands::search::search_notes,
            commands::search::search_notes_paginated,
            commands::search::search_notes_boolean_paginated,
            commands::search::validate_boolean_search_query,
            commands::settings::save_settings,
            commands::settings::register_global_shortcut, // Fix: Use settings module path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
