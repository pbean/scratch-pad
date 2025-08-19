use clap::{Arg, Command, ArgMatches};
use std::fs;
use std::path::PathBuf;
use crate::database::DbService;
use crate::error::AppError;

#[derive(Debug)]
pub struct CliArgs {
    pub content: Option<String>,
    pub should_show_gui: bool,
}

/// Parse command line arguments
pub fn parse_cli_args() -> CliArgs {
    let app = create_cli_app();
    let matches = app.try_get_matches().unwrap_or_else(|_| {
        // If parsing fails, return default (show GUI)
        ArgMatches::default()
    });
    
    parse_matches(matches)
}

fn create_cli_app() -> Command {
    Command::new("scratch-pad")
        .about("A floating, keyboard-driven notepad for developers")
        .version("0.1.0")
        .subcommand(
            Command::new("create")
                .about("Create a new note from command line")
                .arg(
                    Arg::new("content")
                        .help("The content of the note")
                        .required(true)
                        .num_args(1..)
                )
        )
}

fn parse_matches(matches: ArgMatches) -> CliArgs {
    if let Some(create_matches) = matches.subcommand_matches("create") {
        let content_parts: Vec<&str> = create_matches
            .get_many::<String>("content")
            .unwrap_or_default()
            .map(|s| s.as_str())
            .collect();
        
        let content = if content_parts.is_empty() {
            None
        } else {
            Some(content_parts.join(" "))
        };

        CliArgs {
            content,
            should_show_gui: false,
        }
    } else {
        CliArgs {
            content: None,
            should_show_gui: true,
        }
    }
}

/// Handle CLI arguments
pub async fn handle_cli_args(args: &CliArgs, db_service: &DbService) -> Result<(), AppError> {
    if let Some(content) = &args.content {
        // Create the note in the database
        let _note = db_service.create_note(content.clone()).await?;
        println!("Note created successfully!");
        return Ok(());
    }
    
    Ok(())
}

/// Create a lock file to prevent multiple instances
pub fn create_lock_file() -> Result<PathBuf, AppError> {
    let lock_path = get_lock_file_path();
    
    // Check if lock file already exists
    if lock_path.exists() {
        // Try to read the PID from the lock file
        if let Ok(content) = fs::read_to_string(&lock_path) {
            if let Ok(pid) = content.trim().parse::<u32>() {
                // Check if process is still running (Unix only for now)
                #[cfg(unix)]
                {
                    use std::process::Command;
                    let output = Command::new("ps")
                        .args(["-p", &pid.to_string()])
                        .output();
                    
                    if let Ok(output) = output {
                        if output.status.success() && !output.stdout.is_empty() {
                            // Process is still running
                            return Err(AppError::Runtime {
                                message: format!("Another instance is already running (PID: {})", pid)
                            });
                        }
                    }
                }
                
                // On Windows or if process check fails, assume stale lock file
                #[cfg(windows)]
                {
                    // For Windows, we could use tasklist or WMI, but for now just remove stale lock
                    println!("Found potentially stale lock file, removing...");
                }
            }
        }
        
        // Remove stale lock file
        let _ = fs::remove_file(&lock_path);
    }
    
    // Create the lock file with current process ID
    let current_pid = std::process::id();
    fs::write(&lock_path, current_pid.to_string())?;
    
    Ok(lock_path)
}

/// Clean up the lock file
pub fn cleanup_lock_file() {
    let lock_path = get_lock_file_path();
    let _ = fs::remove_file(lock_path);
}

fn get_lock_file_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push("scratch-pad.lock");
    path
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_parse_cli_args_no_subcommand() {
        let app = create_cli_app();
        let matches = app.try_get_matches_from(vec!["test"])
            .expect("Failed to parse CLI arguments in test");
        let cli_args = parse_matches(matches);
        
        assert!(cli_args.content.is_none());
        assert!(cli_args.should_show_gui);
    }

    #[test]
    fn test_parse_cli_args_create_single_word() {
        let app = create_cli_app();
        let matches = app.try_get_matches_from(vec!["test", "create", "Hello"])
            .expect("Failed to parse CLI arguments in test");
        let cli_args = parse_matches(matches);
        
        assert_eq!(cli_args.content, Some("Hello".to_string()));
        assert!(!cli_args.should_show_gui);
    }

    #[test]
    fn test_parse_cli_args_create_multiple_words() {
        let app = create_cli_app();
        let matches = app.try_get_matches_from(vec!["test", "create", "Hello", "World", "Test"])
            .expect("Failed to parse CLI arguments in test");
        let cli_args = parse_matches(matches);
        
        assert_eq!(cli_args.content, Some("Hello World Test".to_string()));
        assert!(!cli_args.should_show_gui);
    }

    #[test]
    fn test_parse_cli_args_create_with_quotes() {
        let app = create_cli_app();
        let matches = app.try_get_matches_from(vec!["test", "create", "Test", "Note"])
            .expect("Failed to parse CLI arguments in test");
        let cli_args = parse_matches(matches);
        
        assert_eq!(cli_args.content, Some("Test Note".to_string()));
        assert!(!cli_args.should_show_gui);
    }

    #[tokio::test]
    async fn test_handle_cli_args() -> Result<(), anyhow::Error> {
        use anyhow::Context;
        
        // Create a temporary database for testing
        let temp_dir = TempDir::new()
            .context("Failed to create temporary directory")?;
        let db_path = temp_dir.path().join("test.db");
        let db_service = DbService::new(
            db_path.to_str()
                .ok_or_else(|| anyhow::anyhow!("Failed to convert path to string"))?
        ).context("Failed to create database service")?;

        let cli_args = CliArgs {
            content: Some("Test note content".to_string()),
            should_show_gui: false,
        };

        let result = handle_cli_args(&cli_args, &db_service).await;
        assert!(result.is_ok());

        // Verify the note was created
        let notes = db_service.get_all_notes().await
            .context("Failed to get notes from database")?;
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].content, "Test note content");
        
        Ok(())
    }

    #[test]
    fn test_lock_file_operations() {
        // Test creating and cleaning up lock file
        let lock_path = create_lock_file().expect("Failed to create lock file");
        assert!(lock_path.exists());
        
        // Try to create another lock file (should fail)
        let result = create_lock_file();
        assert!(result.is_err());
        
        // Clean up
        cleanup_lock_file();
        assert!(!lock_path.exists());
        
        // Should be able to create again after cleanup
        let lock_path2 = create_lock_file().expect("Failed to create lock file after cleanup");
        assert!(lock_path2.exists());
        cleanup_lock_file();
    }

    #[test]
    fn test_get_lock_file_path() {
        let path = get_lock_file_path();
        assert!(path.to_string_lossy().contains("scratch-pad.lock"));
    }
}