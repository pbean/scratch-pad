pub mod database;
pub mod error;
pub mod models;
pub mod search;
pub mod settings;

#[cfg(test)]
mod ipc_tests;

use database::DbService;
use error::ApiError;
use search::SearchService;
use settings::SettingsService;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

// Application state to hold the database, search, and settings services
pub struct AppState {
    pub db: Arc<DbService>,
    pub search: Arc<SearchService>,
    pub settings: Arc<SettingsService>,
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
    state.db.get_all_notes().await.map_err(ApiError::from)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::async_runtime::block_on(async {
        run_async().await
    });
}

async fn run_async() {
    // Initialize the database service
    let db_service = match DbService::new("scratch_pad.db") {
        Ok(service) => Arc::new(service),
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Initialize the search service
    let search_service = Arc::new(SearchService::new(db_service.clone()));

    // Initialize the settings service
    let settings_service = Arc::new(SettingsService::new(db_service.clone()));

    // Initialize default settings on startup
    if let Err(e) = settings_service.initialize_defaults().await {
        eprintln!("Warning: Failed to initialize default settings: {}", e);
    }

    let app_state = AppState { 
        db: db_service,
        search: search_service,
        settings: settings_service,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet, 
            test_db_connection,
            get_all_notes,
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
            export_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
