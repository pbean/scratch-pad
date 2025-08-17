use clap::{Arg, ArgMatches, Command};
use std::env;
use std::process;
use std::path::PathBuf;
use crate::database::DbService;
use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct CliArgs {
    pub content: Option<String>,
    pub should_show_gui: bool,
}

impl CliArgs {
    pub fn new() -> Self {
        Self {
            content: None,
            should_show_gui: true,
        }
    }
}

pub fn parse_cli_args() -> CliArgs {
    let args: Vec<String> = env::args().collect();
    
    // If no arguments provided, show GUI
    if args.len() <= 1 {
        return CliArgs::new();
    }

    let app = Command::new("scratch-pad")
        .version("0.1.0")
        .about("A floating notepad for developers")
        .long_about("scratch-pad is a keyboard-driven floating notepad designed for developers to capture quick thoughts and code snippets without breaking their flow state.")
        .arg(
            Arg::new("content")
                .help("Create a new note with the provided content")
                .value_name("TEXT")
                .num_args(1..)
                .action(clap::ArgAction::Append)
        )
        .subcommand(
            Command::new("create")
                .about("Create a new note")
                .arg(
                    Arg::new("content")
                        .help("The content of the note to create")
                        .value_name("TEXT")
                        .required(true)
                        .num_args(1..)
                        .action(clap::ArgAction::Append)
                )
        );

    let matches = app.try_get_matches().unwrap_or_else(|e| {
        // Handle help and version commands gracefully
        match e.kind() {
            clap::error::ErrorKind::DisplayHelp | clap::error::ErrorKind::DisplayVersion => {
                print!("{}", e);
                process::exit(0);
            }
            _ => {
                eprintln!("Error parsing arguments: {}", e);
                process::exit(1);
            }
        }
    });

    parse_matches(matches)
}

fn parse_matches(matches: ArgMatches) -> CliArgs {
    let mut cli_args = CliArgs::new();

    // Handle subcommands
    if let Some(create_matches) = matches.subcommand_matches("create") {
        if let Some(content_values) = create_matches.get_many::<String>("content") {
            let content: Vec<String> = content_values.cloned().collect();
            cli_args.content = Some(content.join(" "));
            cli_args.should_show_gui = false;
        }
    }
    // Handle direct content argument
    else if let Some(content_values) = matches.get_many::<String>("content") {
        let content: Vec<String> = content_values.cloned().collect();
        cli_args.content = Some(content.join(" "));
        cli_args.should_show_gui = false;
    }

    cli_args
}

pub async fn handle_cli_args(cli_args: &CliArgs, db_service: &DbService) -> Result<(), AppError> {
    if let Some(content) = &cli_args.content {
        // Create a new note with the provided content
        let note = db_service.create_note(content.clone()).await?;
        
        // Provide feedback to the user
        println!("✓ Note created successfully!");
        println!("  ID: {}", note.id);
        println!("  Content: {}", if content.len() > 50 {
            format!("{}...", &content[..50])
        } else {
            content.clone()
        });
        println!("  Created: {}", note.created_at);
        
        Ok(())
    } else {
        Ok(())
    }
}

pub async fn try_send_to_existing_instance(content: &str) -> Result<(), AppError> {
    // For now, we'll use a simple file-based communication
    // In a more sophisticated implementation, we could use named pipes or sockets
    use std::fs;
    use tokio::time::{sleep, Duration};
    
    let ipc_path = get_ipc_file_path();
    
    // Write the content to the IPC file
    let ipc_data = serde_json::json!({
        "action": "create_note",
        "content": content,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    fs::write(&ipc_path, ipc_data.to_string()).map_err(|e| AppError::Io(e))?;
    
    // Wait a bit for the existing instance to process the request
    sleep(Duration::from_millis(500)).await;
    
    // Check if the file was processed (removed by the existing instance)
    if !ipc_path.exists() {
        println!("✓ Note sent to existing scratch-pad instance!");
        Ok(())
    } else {
        // Clean up the file if it wasn't processed
        let _ = fs::remove_file(&ipc_path);
        Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Failed to communicate with existing instance"
        )))
    }
}

fn get_ipc_file_path() -> PathBuf {
    let mut ipc_path = PathBuf::new();
    
    // Use platform-specific temp directory
    #[cfg(target_os = "windows")]
    {
        if let Ok(temp_dir) = env::var("TEMP") {
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
}

pub fn check_single_instance() -> bool {
    // Simple single instance check using a lock file approach
    use std::fs;

    
    let lock_path = get_lock_file_path();
    
    // Check if lock file exists
    if lock_path.exists() {
        // Try to read the PID from the lock file
        if let Ok(pid_str) = fs::read_to_string(&lock_path) {
            if let Ok(pid) = pid_str.trim().parse::<u32>() {
                // Check if the process is still running
                if is_process_running(pid) {
                    return false; // Another instance is running
                }
            }
        }
        // If we can't read the PID or the process isn't running, remove the stale lock file
        let _ = fs::remove_file(&lock_path);
    }
    
    // Create lock file with current PID
    let current_pid = process::id();
    if let Err(e) = fs::write(&lock_path, current_pid.to_string()) {
        eprintln!("Warning: Could not create lock file: {}", e);
    }
    
    true // This is the first instance
}

fn get_lock_file_path() -> PathBuf {
    let mut lock_path = PathBuf::new();
    
    // Use platform-specific temp directory
    #[cfg(target_os = "windows")]
    {
        if let Ok(temp_dir) = env::var("TEMP") {
            lock_path.push(temp_dir);
        } else {
            lock_path.push("C:\\temp");
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        lock_path.push("/tmp");
    }
    
    lock_path.push("scratch-pad.lock");
    lock_path
}

fn is_process_running(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", pid)])
            .output();
        
        if let Ok(output) = output {
            let output_str = String::from_utf8_lossy(&output.stdout);
            return output_str.contains(&pid.to_string());
        }
        false
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("ps")
            .args(&["-p", &pid.to_string()])
            .output();
        
        if let Ok(output) = output {
            return output.status.success();
        }
        false
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::path::Path;
        Path::new(&format!("/proc/{}", pid)).exists()
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        // Fallback for other platforms - assume process is not running
        false
    }
}

pub fn cleanup_lock_file() {
    use std::fs;
    
    let lock_path = get_lock_file_path();
    let _ = fs::remove_file(&lock_path);
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_parse_cli_args_no_args() {
        // Test with no arguments - should show GUI
        let args = CliArgs::new();
        assert!(args.should_show_gui);
        assert!(args.content.is_none());
    }

    #[test]
    fn test_single_instance_check() {
        // This test is basic since we can't easily test the full single instance logic
        // without potentially interfering with running instances
        let result = check_single_instance();
        assert!(result); // Should return true for the first call
        
        // Clean up
        cleanup_lock_file();
    }

    #[test]
    fn test_parse_matches_with_content() {
        let app = Command::new("test")
            .arg(
                Arg::new("content")
                    .help("Create a new note with the provided content")
                    .value_name("TEXT")
                    .num_args(1..)
                    .action(clap::ArgAction::Append)
            )
            .subcommand(
                Command::new("create")
                    .about("Create a new note")
                    .arg(
                        Arg::new("content")
                            .help("The content of the note to create")
                            .value_name("TEXT")
                            .required(true)
                            .num_args(1..)
                            .action(clap::ArgAction::Append)
                    )
            );

        let matches = app.try_get_matches_from(vec!["test", "Hello", "World"]).unwrap();
        let cli_args = parse_matches(matches);
        
        assert_eq!(cli_args.content, Some("Hello World".to_string()));
        assert!(!cli_args.should_show_gui);
    }

    #[test]
    fn test_parse_matches_create_subcommand() {
        let app = Command::new("test")
            .subcommand(
                Command::new("create")
                    .about("Create a new note")
                    .arg(
                        Arg::new("content")
                            .help("The content of the note to create")
                            .value_name("TEXT")
                            .required(true)
                            .num_args(1..)
                            .action(clap::ArgAction::Append)
                    )
            );

        let matches = app.try_get_matches_from(vec!["test", "create", "Test", "Note"]).unwrap();
        let cli_args = parse_matches(matches);
        
        assert_eq!(cli_args.content, Some("Test Note".to_string()));
        assert!(!cli_args.should_show_gui);
    }

    #[tokio::test]
    async fn test_handle_cli_args() {
        // Create a temporary database for testing
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db_service = DbService::new(db_path.to_str().unwrap()).unwrap();

        let cli_args = CliArgs {
            content: Some("Test note content".to_string()),
            should_show_gui: false,
        };

        let result = handle_cli_args(&cli_args, &db_service).await;
        assert!(result.is_ok());

        // Verify the note was created
        let notes = db_service.get_all_notes().await.unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].content, "Test note content");
    }

    #[test]
    fn test_get_lock_file_path() {
        let lock_path = get_lock_file_path();
        assert!(lock_path.to_string_lossy().contains("scratch-pad.lock"));
        
        // Test that it uses the correct temp directory for the platform
        #[cfg(target_os = "windows")]
        {
            assert!(lock_path.to_string_lossy().contains("\\"));
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            assert!(lock_path.to_string_lossy().starts_with("/tmp"));
        }
    }

    #[test]
    fn test_get_ipc_file_path() {
        let ipc_path = get_ipc_file_path();
        assert!(ipc_path.to_string_lossy().contains("scratch-pad-ipc.json"));
        
        // Test that it uses the correct temp directory for the platform
        #[cfg(target_os = "windows")]
        {
            assert!(ipc_path.to_string_lossy().contains("\\"));
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            assert!(ipc_path.to_string_lossy().starts_with("/tmp"));
        }
    }
}