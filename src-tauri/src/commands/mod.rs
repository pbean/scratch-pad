pub mod diagnostics;
pub mod lifecycle;
/// Command Module Organization
///
/// This module organizes all IPC command handlers by domain with proper exports.
/// Commands are grouped by functionality with security validation and performance monitoring.
pub mod notes;
pub mod search;
pub mod settings;
pub mod shared;
pub mod system;

// Note Management Commands
pub use notes::{
    create_note, delete_note, get_all_notes, get_note, get_notes_paginated, update_note,
};

// Search Commands
pub use search::{
    search_notes, search_notes_boolean_paginated, search_notes_paginated,
    validate_boolean_search_query,
};

pub use settings::{
    delete_setting, get_all_settings, get_setting, load_settings, register_global_shortcut,
    save_settings, set_setting,
};

pub use system::{
    get_current_shortcut, hide_window, is_window_visible, show_window, shutdown_application,
    toggle_window_visibility, unregister_global_shortcut,
};

pub use lifecycle::{initiate_shutdown, is_shutting_down};

pub use diagnostics::{get_backend_error_details, report_frontend_error};

// Shared utilities for command implementations
pub use shared::{
    log_security_event, validate_ipc_operation, validate_setting_secure, validate_shortcut_secure,
    CommandPerformanceTracker,
};

/// Generates the Tauri command handler with all available commands
///
/// This macro generates the complete command handler function that includes:
/// - All note management commands with validation
/// - All search commands with security checks
/// - All settings commands with proper validation
/// - All system commands with capability verification
/// - All lifecycle commands with shutdown coordination
/// - All diagnostic commands with error reporting
/// - Performance monitoring for all commands
/// - Security logging for all operations
#[macro_export]
macro_rules! generate_command_handler {
    () => {
        tauri::generate_handler![
            // Note Management Commands
            crate::commands::notes::create_note,
            crate::commands::notes::update_note,
            crate::commands::notes::delete_note,
            crate::commands::notes::get_note,
            crate::commands::notes::get_notes_paginated,
            crate::commands::notes::get_all_notes,
            // Search Commands
            crate::commands::search::search_notes,
            crate::commands::search::search_notes_paginated,
            crate::commands::search::search_notes_boolean_paginated,
            crate::commands::search::validate_boolean_search_query,
            // Settings Commands
            crate::commands::settings::get_setting,
            crate::commands::settings::set_setting,
            crate::commands::settings::get_all_settings,
            crate::commands::settings::delete_setting,
            crate::commands::settings::save_settings,
            crate::commands::settings::load_settings,
            crate::commands::settings::register_global_shortcut,
            // System Commands
            crate::commands::system::unregister_global_shortcut,
            crate::commands::system::toggle_window_visibility,
            crate::commands::system::show_window,
            crate::commands::system::hide_window,
            crate::commands::system::is_window_visible,
            crate::commands::system::get_current_shortcut,
            crate::commands::system::shutdown_application,
            // Lifecycle Commands
            crate::commands::lifecycle::is_shutting_down,
            crate::commands::lifecycle::initiate_shutdown,
            // Diagnostic Commands
            crate::commands::diagnostics::report_frontend_error,
            crate::commands::diagnostics::get_backend_error_details
        ]
    };
}
