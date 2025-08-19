/// Modular IPC Command Architecture
/// 
/// This module organizes all Tauri IPC commands into domain-specific modules
/// while preserving the comprehensive Week 1 security framework.
/// 
/// Architecture:
/// - Each domain has its own module with focused responsibility
/// - Shared security patterns are centralized in the shared module
/// - All commands maintain identical IPC interface for frontend compatibility
/// - Security validation is preserved exactly as implemented in Week 1

pub mod shared;
pub mod notes;
pub mod settings;
pub mod system;
pub mod search;
pub mod diagnostics;
pub mod lifecycle;


/// Re-export all command functions for centralized registration
pub use notes::{
    create_note, get_note, get_all_notes, get_notes_paginated,
    update_note, delete_note
};

pub use settings::{
    get_setting, set_setting, get_all_settings
};

pub use system::{
    register_global_shortcut, unregister_global_shortcut,
    set_window_layout, show_window, hide_window
};

pub use search::{
    search_notes, search_notes_paginated, SearchResult,
    search_notes_boolean_paginated, validate_boolean_search_query,
    get_boolean_search_examples, BooleanSearchResult, QueryComplexity
};

pub use diagnostics::{
    report_frontend_error, get_backend_error_details
};

pub use lifecycle::{
    is_shutting_down, initiate_shutdown
};

/// Generate the complete command handler for Tauri
/// 
/// This macro maintains the exact same registration as the monolithic version
/// ensuring zero breaking changes for the frontend.
#[macro_export]
macro_rules! generate_command_handler {
    () => {
        tauri::generate_handler![
            // Error reporting (diagnostics domain)
            crate::commands::diagnostics::report_frontend_error,
            crate::commands::diagnostics::get_backend_error_details,
            
            // Note operations (notes domain)
            crate::commands::notes::create_note,
            crate::commands::notes::update_note,
            crate::commands::notes::delete_note,
            crate::commands::notes::get_note,
            crate::commands::notes::get_all_notes,
            crate::commands::notes::get_notes_paginated,
            
            // Search operations (search domain)
            crate::commands::search::search_notes,
            crate::commands::search::search_notes_paginated,
            
            // Boolean search operations (Week 2 Day 4 - Advanced Search)
            crate::commands::search::search_notes_boolean_paginated,
            crate::commands::search::validate_boolean_search_query,
            crate::commands::search::get_boolean_search_examples,
            
            // Settings operations (settings domain)
            crate::commands::settings::get_setting,
            crate::commands::settings::set_setting,
            crate::commands::settings::get_all_settings,
            
            // Global shortcut operations (system domain)
            crate::commands::system::register_global_shortcut,
            crate::commands::system::unregister_global_shortcut,
            
            // Window management (system domain)
            crate::commands::system::set_window_layout,
            crate::commands::system::show_window,
            crate::commands::system::hide_window,
            
            // Shutdown operations (lifecycle domain)
            crate::commands::lifecycle::is_shutting_down,
            crate::commands::lifecycle::initiate_shutdown,
        ]
    };
}