// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use scratch_pad_lib::cli::{parse_cli_args, handle_cli_args, check_single_instance, cleanup_lock_file, try_send_to_existing_instance};
use scratch_pad_lib::database::DbService;
use std::process;

fn main() {
    // Parse CLI arguments first
    let cli_args = parse_cli_args();
    
    // If we have content to create a note, handle it in CLI mode
    if cli_args.content.is_some() {
        handle_cli_mode(cli_args);
        return;
    }
    
    // For GUI mode, check single instance
    if !check_single_instance() {
        eprintln!("Another instance of scratch-pad is already running.");
        process::exit(1);
    }
    
    // Set up cleanup on exit
    let _ = ctrlc::set_handler(move || {
        cleanup_lock_file();
        process::exit(0);
    });
    
    // Run the GUI application
    scratch_pad_lib::run()
}

fn handle_cli_mode(cli_args: scratch_pad_lib::cli::CliArgs) {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        if let Some(content) = &cli_args.content {
            // First, try to send to existing instance if one is running
            if !check_single_instance() {
                // Another instance is running, try to send the content to it
                if let Ok(()) = try_send_to_existing_instance(content).await {
                    return; // Successfully sent to existing instance
                }
                // If sending failed, fall back to direct database access
                eprintln!("Warning: Could not communicate with existing instance, creating note directly...");
            }
            
            // Initialize database service for direct access
            let db_service = match DbService::new("scratch_pad.db") {
                Ok(service) => service,
                Err(e) => {
                    eprintln!("Error: Failed to initialize database: {}", e);
                    process::exit(1);
                }
            };
            
            // Handle the CLI arguments
            if let Err(e) = handle_cli_args(&cli_args, &db_service).await {
                eprintln!("Error: Failed to create note: {}", e);
                process::exit(1);
            }
            
            // Clean up lock file if we created one
            cleanup_lock_file();
        }
    });
}
