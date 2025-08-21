/// Command Module Organization
/// 
/// This module organizes all IPC command handlers by domain, providing a clean
/// interface for the main application to import and register commands.
/// Each domain module handles its own security validation and business logic.

pub mod notes;
pub mod search;
pub mod settings;
pub mod system;
pub mod lifecycle;
pub mod diagnostics;
pub mod shared;

// Re-export all public command functions for easy access
pub use notes::{
    create_note, get_note, update_note, delete_note,
    get_all_notes, get_notes_paginated
};

pub use search::{
    search_notes, search_notes_paginated, SearchResult,
    search_notes_boolean_paginated, validate_boolean_search_query,
    get_boolean_search_examples, QueryComplexity
};

pub use settings::{
    get_setting, set_setting, get_all_settings, delete_setting
};

pub use system::{
    register_global_shortcut, unregister_global_shortcut,
    toggle_window_visibility, show_window, hide_window, 
    is_window_visible, get_current_shortcut, shutdown_application
};

pub use lifecycle::{
    is_shutting_down, initiate_shutdown
};

pub use diagnostics::{
    report_frontend_error, get_backend_error_details
};

// Shared utilities for command implementations
pub use shared::{
    validate_ipc_operation, validate_setting_secure,
    validate_shortcut_secure, CommandPerformanceTracker,
    log_security_event
};

/// Generate the Tauri command handler with all registered commands
#[macro_export]
macro_rules! generate_command_handler {
    () => {
        tauri::generate_handler![
            // Note management commands
            crate::commands::notes::create_note,
            crate::commands::notes::get_note,
            crate::commands::notes::update_note,
            crate::commands::notes::delete_note,
            crate::commands::notes::get_all_notes,
            crate::commands::notes::get_notes_paginated,
            
            // Search commands
            crate::commands::search::search_notes,
            crate::commands::search::search_notes_paginated,
            crate::commands::search::search_notes_boolean_paginated,
            crate::commands::search::validate_boolean_search_query,
            crate::commands::search::get_boolean_search_examples,
            
            // Settings commands
            crate::commands::settings::get_setting,
            crate::commands::settings::set_setting,
            crate::commands::settings::get_all_settings,
            crate::commands::settings::delete_setting,
            
            // System control commands
            crate::commands::system::register_global_shortcut,
            crate::commands::system::unregister_global_shortcut,
            crate::commands::system::toggle_window_visibility,
            crate::commands::system::show_window,
            crate::commands::system::hide_window,
            crate::commands::system::is_window_visible,
            crate::commands::system::get_current_shortcut,
            crate::commands::system::shutdown_application,
            
            // Application lifecycle commands
            crate::commands::lifecycle::is_shutting_down,
            crate::commands::lifecycle::initiate_shutdown,
            
            // Diagnostic commands
            crate::commands::diagnostics::report_frontend_error,
            crate::commands::diagnostics::get_backend_error_details
        ]
    };
}