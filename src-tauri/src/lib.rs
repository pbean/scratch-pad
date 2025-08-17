pub mod cli;
pub mod database;
pub mod error;
pub mod global_shortcut;
pub mod models;
pub mod plugin;
pub mod search;
pub mod settings;
pub mod window_manager;

#[cfg(test)]
mod ipc_tests;

#[cfg(test)]
mod plugin_integration_test;


use database::DbService;
use error::ApiError;
use global_shortcut::GlobalShortcutService;
use plugin::PluginManager;
use search::SearchService;
use settings::SettingsService;
use window_manager::{LayoutMode, WindowManager};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Manager, State};

// Application state to hold the database, search, settings, global shortcut, window manager, and plugin services
pub struct AppState {
    pub db: Arc<DbService>,
    pub search: Arc<SearchService>,
    pub settings: Arc<SettingsService>,
    pub global_shortcut: Arc<GlobalShortcutService>,
    pub window_manager: Arc<WindowManager>,
    pub plugin_manager: Arc<tokio::sync::Mutex<PluginManager>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Test command to verify database connection
#[tauri::command]
async fn test_db_connection(state: State<'_, AppState>) -> Result<String, ApiError> {
    // Try to get all notes to test the connection
    let _notes = state.db.get_all_notes().await.map_err(|e| ApiError::from(e))?;
    Ok("Database connection successful".to_string())
}

// Plugin commands
#[tauri::command]
async fn get_plugin_info(state: State<'_, AppState>) -> Result<Vec<HashMap<String, String>>, ApiError> {
    let plugin_manager = state.plugin_manager.lock().await;
    let plugins = plugin_manager.get_plugins();
    
    let mut plugin_info = Vec::new();
    for plugin in plugins {
        let mut info = HashMap::new();
        info.insert("name".to_string(), plugin.name().to_string());
        info.insert("version".to_string(), plugin.version().to_string());
        
        if let Some(description) = plugin.description() {
            info.insert("description".to_string(), description.to_string());
        }
        
        if let Some(author) = plugin.author() {
            info.insert("author".to_string(), author.to_string());
        }
        
        plugin_info.push(info);
    }
    
    Ok(plugin_info)
}

#[tauri::command]
async fn get_plugin_count(state: State<'_, AppState>) -> Result<usize, ApiError> {
    let plugin_manager = state.plugin_manager.lock().await;
    Ok(plugin_manager.plugin_count())
}

#[tauri::command]
async fn get_available_note_formats(state: State<'_, AppState>) -> Result<Vec<String>, ApiError> {
    let plugin_manager = state.plugin_manager.lock().await;
    let formats = plugin_manager.get_note_formats();
    
    let format_names: Vec<String> = formats.iter().map(|format| {
        match format {
            models::NoteFormat::PlainText => "plaintext".to_string(),
            models::NoteFormat::Markdown => "markdown".to_string(),
        }
    }).collect();
    
    Ok(format_names)
}

#[tauri::command]
async fn reload_plugins(state: State<'_, AppState>) -> Result<String, ApiError> {
    let mut plugin_manager = state.plugin_manager.lock().await;
    
    // Get the plugin directory path
    let plugin_dir = std::env::current_dir()
        .map_err(|e| ApiError {
            code: "IO_ERROR".to_string(),
            message: format!("Failed to get current directory: {}", e),
        })?
        .join("plugins");
    
    // Clear existing plugins and reload
    *plugin_manager = PluginManager::new();
    plugin_manager.load_plugins(&plugin_dir).map_err(ApiError::from)?;
    
    let count = plugin_manager.plugin_count();
    Ok(format!("Reloaded {} plugins", count))
}

// CLI command to create note from external process
#[tauri::command]
async fn create_note_from_cli(content: String, state: State<'_, AppState>) -> Result<models::Note, ApiError> {
    let note = state.db.create_note(content).await.map_err(ApiError::from)?;
    
    // Show the window to display the new note
    if let Err(e) = state.window_manager.show_window().await {
        eprintln!("Warning: Failed to show window after CLI note creation: {}", e);
    }
    
    Ok(note)
}

// Performance monitoring command
#[tauri::command]
async fn get_performance_stats(state: State<'_, AppState>) -> Result<std::collections::HashMap<String, String>, ApiError> {
    let mut stats = std::collections::HashMap::new();

    // Database stats
    let notes_count = state.db.get_notes_count().await.map_err(ApiError::from)?;
    stats.insert("notes_count".to_string(), notes_count.to_string());

    // Memory usage (approximate)
    stats.insert("memory_usage".to_string(), "N/A".to_string()); // Would need platform-specific implementation

    // Plugin stats
    let plugin_manager = state.plugin_manager.lock().await;
    stats.insert("plugins_loaded".to_string(), plugin_manager.plugin_count().to_string());
    drop(plugin_manager);

    // Database schema version
    let schema_version = state.db.get_schema_version().map_err(ApiError::from)?;
    stats.insert("schema_version".to_string(), schema_version.to_string());

    Ok(stats)
}

// Search commands
#[tauri::command]
async fn search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    state.search.search_notes(&query).await.map_err(ApiError::from)
}

#[tauri::command]
async fn fuzzy_search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    state.search.fuzzy_search(&query).await.map_err(ApiError::from)
}

#[tauri::command]
async fn combined_search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    state.search.combined_search(&query).await.map_err(ApiError::from)
}

#[tauri::command]
async fn search_notes_by_path(path_pattern: String, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    state.search.search_by_path(&path_pattern).await.map_err(ApiError::from)
}

#[tauri::command]
async fn search_favorite_notes(query: Option<String>, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    let query_ref = query.as_deref();
    state.search.search_favorites(query_ref).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_search_suggestions(partial_query: String, limit: usize, state: State<'_, AppState>) -> Result<Vec<String>, ApiError> {
    state.search.get_search_suggestions(&partial_query, limit).await.map_err(ApiError::from)
}

// Note commands
#[tauri::command]
async fn get_all_notes(state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    // For initial load, limit to first 100 notes for performance
    state.db.get_notes_with_limit(Some(100)).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_notes_paginated(offset: usize, limit: usize, state: State<'_, AppState>) -> Result<Vec<models::Note>, ApiError> {
    state.db.get_notes_paginated(offset, limit).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_notes_count(state: State<'_, AppState>) -> Result<usize, ApiError> {
    state.db.get_notes_count().await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_latest_note(state: State<'_, AppState>) -> Result<Option<models::Note>, ApiError> {
    state.db.get_latest_note().await.map_err(ApiError::from)
}

#[tauri::command]
async fn create_note(content: String, state: State<'_, AppState>) -> Result<models::Note, ApiError> {
    state.db.create_note(content).await.map_err(ApiError::from)
}

#[tauri::command]
async fn update_note(note: models::Note, state: State<'_, AppState>) -> Result<models::Note, ApiError> {
    state.db.update_note(note).await.map_err(ApiError::from)
}

#[tauri::command]
async fn delete_note(id: i64, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.db.delete_note(id).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_all_paths(state: State<'_, AppState>) -> Result<Vec<String>, ApiError> {
    state.db.get_all_paths().await.map_err(ApiError::from)
}

// Settings commands
#[tauri::command]
async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, ApiError> {
    state.settings.get_setting(&key).await.map_err(ApiError::from)
}

#[tauri::command]
async fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.settings.set_setting_validated(&key, &value).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_all_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, ApiError> {
    state.settings.get_all_settings().await.map_err(ApiError::from)
}

#[tauri::command]
async fn export_settings(state: State<'_, AppState>) -> Result<String, ApiError> {
    state.settings.export_settings().await.map_err(ApiError::from)
}

#[tauri::command]
async fn import_settings(json_content: String, state: State<'_, AppState>) -> Result<usize, ApiError> {
    state.settings.import_settings(json_content).await.map_err(ApiError::from)
}

#[tauri::command]
async fn reset_settings_to_defaults(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.settings.reset_to_defaults().await.map_err(ApiError::from)
}

#[tauri::command]
async fn initialize_default_settings(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.settings.initialize_defaults().await.map_err(ApiError::from)
}

#[tauri::command]
async fn export_note(note: models::Note, file_path: String) -> Result<(), ApiError> {
    use tokio::fs;
    
    // Write the note content to the specified file path
    fs::write(&file_path, &note.content).await.map_err(|e| ApiError {
        code: "IO_ERROR".to_string(),
        message: format!("Failed to export note to {}: {}", file_path, e),
    })?;
    
    Ok(())
}

// Global shortcut commands
#[tauri::command]
async fn register_global_shortcut(shortcut: String, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.global_shortcut.register_shortcut(&shortcut).await.map_err(ApiError::from)
}

#[tauri::command]
async fn unregister_global_shortcut(shortcut: String, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.global_shortcut.unregister_shortcut(&shortcut).await.map_err(ApiError::from)
}

#[tauri::command]
async fn update_global_shortcut(old_shortcut: String, new_shortcut: String, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.global_shortcut.update_shortcut(&old_shortcut, &new_shortcut).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_current_global_shortcut(state: State<'_, AppState>) -> Result<Option<String>, ApiError> {
    Ok(state.global_shortcut.get_current_shortcut().await)
}

#[tauri::command]
async fn test_global_shortcut(shortcut: String, state: State<'_, AppState>) -> Result<bool, ApiError> {
    state.global_shortcut.test_shortcut(&shortcut).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_suggested_global_shortcuts(state: State<'_, AppState>) -> Result<Vec<String>, ApiError> {
    Ok(state.global_shortcut.get_suggested_shortcuts())
}

#[tauri::command]
async fn is_global_shortcut_registered(shortcut: String, state: State<'_, AppState>) -> Result<bool, ApiError> {
    state.global_shortcut.is_shortcut_registered(&shortcut).await.map_err(ApiError::from)
}

// Window management commands
#[tauri::command]
async fn show_window(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.window_manager.show_window().await.map_err(ApiError::from)
}

#[tauri::command]
async fn hide_window(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.window_manager.hide_window().await.map_err(ApiError::from)
}

#[tauri::command]
async fn toggle_window(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.window_manager.toggle_window().await.map_err(ApiError::from)
}

#[tauri::command]
async fn set_layout_mode(mode: String, state: State<'_, AppState>) -> Result<(), ApiError> {
    let layout_mode = LayoutMode::from_string(&mode);
    state.window_manager.set_layout_mode(layout_mode).await.map_err(ApiError::from)
}

#[tauri::command]
async fn get_layout_mode(state: State<'_, AppState>) -> Result<String, ApiError> {
    let mode = state.window_manager.get_layout_mode().await;
    Ok(mode.to_string())
}

#[tauri::command]
async fn center_window(state: State<'_, AppState>) -> Result<(), ApiError> {
    state.window_manager.center_window().await.map_err(ApiError::from)
}

#[tauri::command]
async fn set_always_on_top(always_on_top: bool, state: State<'_, AppState>) -> Result<(), ApiError> {
    state.window_manager.set_always_on_top(always_on_top).await.map_err(ApiError::from)
}

#[tauri::command]
async fn is_window_visible(state: State<'_, AppState>) -> Result<bool, ApiError> {
    state.window_manager.is_window_visible().await.map_err(ApiError::from)
}

#[tauri::command]
async fn is_window_focused(state: State<'_, AppState>) -> Result<bool, ApiError> {
    state.window_manager.is_window_focused().await.map_err(ApiError::from)
}

#[tauri::command]
async fn test_window_management(state: State<'_, AppState>) -> Result<String, ApiError> {
    let mut results = Vec::new();
    
    // Test layout mode functionality
    let current_mode = state.window_manager.get_layout_mode().await;
    results.push(format!("Current layout mode: {}", current_mode.to_string()));
    
    // Test window visibility
    let is_visible = state.window_manager.is_window_visible().await.map_err(ApiError::from)?;
    results.push(format!("Window visible: {}", is_visible));
    
    // Test window focus
    let is_focused = state.window_manager.is_window_focused().await.map_err(ApiError::from)?;
    results.push(format!("Window focused: {}", is_focused));
    
    Ok(results.join(", "))
}

async fn monitor_cli_ipc(db_service: Arc<DbService>, window_manager: Arc<WindowManager>) {
    use tokio::time::{Duration, interval};
    use std::fs;
    
    let get_ipc_file_path = || {
        let mut ipc_path = std::path::PathBuf::new();
        
        #[cfg(target_os = "windows")]
        {
            if let Ok(temp_dir) = std::env::var("TEMP") {
                ipc_path.push(temp_dir);
            } else {
                ipc_path.push("C:\\temp");
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            ipc_path.push("/tmp");
        }
        
        ipc_path.push("scratch-pad-ipc.json");
        ipc_path
    };

    // Use longer intervals for better performance
    let mut ipc_interval = interval(Duration::from_millis(200)); // Reduced frequency
    let mut cleanup_interval = interval(Duration::from_secs(600)); // Cleanup every 10 minutes
    
    loop {
        tokio::select! {
            _ = ipc_interval.tick() => {
                let ipc_path = get_ipc_file_path();

                if ipc_path.exists() {
                    // Try to read and process the IPC request
                    if let Ok(content) = fs::read_to_string(&ipc_path) {
                        if let Ok(request) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let (Some(action), Some(note_content)) = (
                                request.get("action").and_then(|v| v.as_str()),
                                request.get("content").and_then(|v| v.as_str())
                            ) {
                                if action == "create_note" {
                                    // Create the note
                                    if let Ok(note) = db_service.create_note(note_content.to_string()).await {
                                        println!("✓ Note created from CLI: ID {}", note.id);

                                        // Show the window
                                        if let Err(e) = window_manager.show_window().await {
                                            eprintln!("Warning: Failed to show window: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Remove the processed IPC file
                    let _ = fs::remove_file(&ipc_path);
                }
            }
            _ = cleanup_interval.tick() => {
                // Periodic cleanup - force SQLite to optimize and vacuum if needed
                if let Ok(conn) = db_service.get_connection() {
                    let _ = conn.execute_batch("PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);");
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::async_runtime::block_on(async {
        run_async().await
    });
}

async fn run_async() {
    // Initialize the database service with optimized settings for faster startup
    let db_service = match DbService::new("scratch_pad.db") {
        Ok(service) => Arc::new(service),
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize only critical services immediately (needed for basic functionality)
    let settings_service = Arc::new(SettingsService::new(db_service.clone()));

    // Initialize default settings on startup (critical for app functionality)
    if let Err(e) = settings_service.initialize_defaults().await {
        eprintln!("Warning: Failed to initialize default settings: {}", e);
    }

    // Lazy initialize search service (will be created on first use)
    let search_service = Arc::new(SearchService::new(db_service.clone()));
    
    // Lazy initialize plugin manager (non-critical for startup)
    let plugin_manager = Arc::new(tokio::sync::Mutex::new(PluginManager::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            // Initialize the global shortcut service after the app is set up
            let app_handle = app.handle().clone();
            let global_shortcut_service = Arc::new(GlobalShortcutService::new(app_handle.clone(), settings_service.clone()));

            // Initialize the window manager
            let window_manager = Arc::new(WindowManager::new(app_handle, settings_service.clone()));

            // Initialize services with their current settings
            let global_shortcut_clone = global_shortcut_service.clone();
            let window_manager_clone = window_manager.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = global_shortcut_clone.initialize().await {
                    eprintln!("Warning: Failed to initialize global shortcut: {}", e);
                }
                if let Err(e) = window_manager_clone.initialize().await {
                    eprintln!("Warning: Failed to initialize window manager: {}", e);
                }
            });

            let app_state = AppState {
                db: db_service.clone(),
                search: search_service,
                settings: settings_service,
                global_shortcut: global_shortcut_service,
                window_manager: window_manager.clone(),
                plugin_manager: plugin_manager.clone(),
            };

            app.manage(app_state);

            // Start IPC monitoring for CLI requests
            let db_clone = db_service.clone();
            let window_manager_clone = window_manager.clone();
            tauri::async_runtime::spawn(async move {
                monitor_cli_ipc(db_clone, window_manager_clone).await;
            });

            // Lazy load plugins in background after app startup
            let plugin_manager_clone = plugin_manager.clone();
            tauri::async_runtime::spawn(async move {
                let plugin_dir = std::env::current_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."))
                    .join("plugins");

                let mut pm = plugin_manager_clone.lock().await;
                if let Err(e) = pm.load_plugins(&plugin_dir) {
                    eprintln!("Warning: Failed to load plugins: {}", e);
                } else {
                    println!("Loaded {} plugins", pm.plugin_count());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, 
            test_db_connection,
            get_plugin_info,
            get_plugin_count,
            get_available_note_formats,
            reload_plugins,
            create_note_from_cli,
            get_performance_stats,
            get_all_notes,
            get_notes_paginated,
            get_notes_count,
            get_latest_note,
            create_note,
            update_note,
            delete_note,
            get_all_paths,
            search_notes,
            fuzzy_search_notes,
            combined_search_notes,
            search_notes_by_path,
            search_favorite_notes,
            get_search_suggestions,
            get_setting,
            set_setting,
            get_all_settings,
            export_settings,
            import_settings,
            reset_settings_to_defaults,
            initialize_default_settings,
            export_note,
            register_global_shortcut,
            unregister_global_shortcut,
            update_global_shortcut,
            get_current_global_shortcut,
            test_global_shortcut,
            get_suggested_global_shortcuts,
            is_global_shortcut_registered,
            show_window,
            hide_window,
            toggle_window,
            set_layout_mode,
            get_layout_mode,
            center_window,
            set_always_on_top,
            is_window_visible,
            is_window_focused,
            test_window_management
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
