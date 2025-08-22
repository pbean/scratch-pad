// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use scratch_pad_lib::cli::{cleanup_lock_file, create_lock_file, handle_cli_args, parse_cli_args};
use scratch_pad_lib::database::DbService;
use scratch_pad_lib::error::AppError;
use std::process;

fn main() {
    // Parse CLI arguments first
    let cli_args = parse_cli_args();

    // If we have content to create a note, handle it in CLI mode
    if cli_args.content.is_some() {
        if let Err(e) = handle_cli_mode(cli_args) {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
        return;
    }

    // For GUI mode, check single instance
    if let Err(e) = create_lock_file() {
        eprintln!("Another instance of scratch-pad is already running: {}", e);
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

fn handle_cli_mode(cli_args: scratch_pad_lib::cli::CliArgs) -> Result<(), AppError> {
    let runtime = tokio::runtime::Runtime::new().map_err(|e| AppError::Runtime {
        message: format!("Failed to create tokio runtime: {}", e),
    })?;

    runtime.block_on(async {
        if let Some(_content) = &cli_args.content {
            // For CLI mode, we bypass the lock check and create notes directly
            // This allows CLI to work even when GUI is running

            // Initialize database service for direct access
            let db_service = DbService::new("scratch_pad.db")?;

            // Handle the CLI arguments
            handle_cli_args(&cli_args, &db_service).await?;

            // Clean up lock file if we created one
            cleanup_lock_file();
        }
        Ok(())
    })
}
