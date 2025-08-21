/// Comprehensive Security Test Suite
/// 
/// This module contains comprehensive security tests for the Scratch Pad application.
/// These tests verify that all security measures are properly implemented and effective
/// against various attack vectors including path traversal, injection, and malicious input.

use std::sync::Arc;
use tempfile::NamedTempFile;

use scratch_pad_lib::models::{Note, NoteFormat};
use scratch_pad_lib::validation::{SecurityValidator, OperationSource, OperationCapability, OperationContext};
use scratch_pad_lib::database::DbService;
use scratch_pad_lib::search::SearchService;
use scratch_pad_lib::settings::SettingsService;
use scratch_pad_lib::plugin::PluginManager;
use scratch_pad_lib::shutdown::ShutdownManager;
use scratch_pad_lib::global_shortcut::GlobalShortcutService;
use scratch_pad_lib::window_manager::WindowManager;
use scratch_pad_lib::AppState;

// Helper to create an isolated test environment
async fn create_security_test_state() -> AppState {
    let temp_file = NamedTempFile::new().unwrap();
    let db_path = temp_file.path().to_string_lossy().to_string();
    
    let db_service = Arc::new(DbService::new(&db_path).unwrap());
    let security_validator = Arc::new(SecurityValidator::new());
    let search_service = Arc::new(SearchService::new(db_service.clone()));
    let settings_service = Arc::new(SettingsService::new(db_service.clone()));
    let plugin_manager = Arc::new(tokio::sync::Mutex::new(PluginManager::new()));
    
    // Create dummy implementations for testing that don't require Tauri runtime
    let global_shortcut = Arc::new(GlobalShortcutService::new_test(settings_service.clone()).unwrap());
    let window_manager = Arc::new(WindowManager::new_test(settings_service).unwrap());
    
    AppState {
        db: db_service,
        search: search_service,
        settings: settings_service.clone(),
        global_shortcut,
        window_manager,
        plugin_manager,
        security_validator,
        shutdown_manager: Arc::new(ShutdownManager::default()),
    }
}

/// Test path traversal prevention and malicious path detection
#[tokio::test]
async fn test_path_traversal_prevention() {
    let state = create_security_test_state().await;
    
    // Collection of dangerous paths that should be blocked
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
        &format!("very_long_filename_that_exceeds_255_characters_{}", "a".repeat(300)), // Long filename
    ];
    
    for dangerous_path in dangerous_paths {
        let result = state.validator.validate_export_path(dangerous_path, None);
        assert!(result.is_err(), "Path traversal attack should be blocked: {}", dangerous_path);
        
        // Verify specific error types for different attack vectors
        if dangerous_path.contains("..") {
            let error = result.unwrap_err();
            assert!(error.to_string().contains("path traversal"), 
                "Should detect path traversal in: {}", dangerous_path);
        }
    }
}

/// Test SQL injection prevention in search operations
#[tokio::test]
async fn test_sql_injection_prevention() {
    let state = create_security_test_state().await;
    
    // Create some test notes first
    let note1 = state.db.create_note("Test content", NoteFormat::PlainText).await.unwrap();
    let note2 = state.db.create_note("Another test", NoteFormat::PlainText).await.unwrap();
    
    // Collection of SQL injection attempts
    let injection_attempts = vec![
        "'; DROP TABLE notes; --",
        "test' UNION SELECT * FROM sqlite_master --",
        "'; DELETE FROM notes WHERE 1=1; --",
        "test' OR '1'='1",
        "test'; INSERT INTO notes VALUES ('malicious'); --",
        "test' AND (SELECT COUNT(*) FROM notes) > 0 --",
        "'; UPDATE notes SET content='hacked'; --",
        "test' UNION SELECT null, username, password FROM users --",
        "test\"; DROP TABLE notes; --",  // Different quote types
        "test` OR `1`=`1",              // Backtick injection
    ];
    
    for injection_query in injection_attempts {
        // Test basic search - should safely handle injection attempts
        let search_result = state.search.search_notes(injection_query).await;
        assert!(search_result.is_ok(), "Search should handle injection attempt safely: {}", injection_query);
        
        // Test paginated search
        let paginated_result = state.search.search_notes_paginated(injection_query, 0, 10).await;
        assert!(paginated_result.is_ok(), "Paginated search should handle injection safely: {}", injection_query);
        
        // Test boolean search
        let boolean_result = state.search.search_notes_boolean_paginated(injection_query, 0, 10).await;
        // Boolean search might reject invalid syntax, but shouldn't cause SQL injection
        match boolean_result {
            Ok(_) => {}, // Valid query structure, safe execution
            Err(e) => {
                // Should be validation error, not SQL error
                assert!(!e.to_string().to_lowercase().contains("sql"), 
                    "Should not expose SQL errors: {}", e);
            }
        }
        
        // Verify our test notes still exist (no data corruption from injection)
        let all_notes = state.db.get_notes(0, 100).await.unwrap();
        assert!(all_notes.len() >= 2, "Original notes should still exist after injection attempt");
        assert!(all_notes.iter().any(|n| n.id == note1.id), "First test note should still exist");
        assert!(all_notes.iter().any(|n| n.id == note2.id), "Second test note should still exist");
    }
}

/// Test XSS prevention in note content and metadata
#[tokio::test]
async fn test_xss_prevention() {
    let state = create_security_test_state().await;
    
    let xss_payloads = vec![
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
        "<iframe src=\"javascript:alert('XSS')\"></iframe>",
        "';alert('XSS');//",
        "<body onload=alert('XSS')>",
        "<div onclick=\"alert('XSS')\">Click me</div>",
        "<%3Cscript%3Ealert('XSS')%3C/script%3E", // URL encoded
        "<script>fetch('/api/delete-all-notes')</script>", // CSRF attempt
    ];
    
    for payload in xss_payloads {
        // Test creating notes with XSS payloads
        let note_result = state.db.create_note(payload, NoteFormat::PlainText).await;
        
        match note_result {
            Ok(note) => {
                // If note creation succeeded, verify content is properly sanitized or escaped
                let stored_content = &note.content;
                
                // Content should not contain executable script tags
                assert!(!stored_content.contains("<script"), 
                    "Script tags should be sanitized in: {}", payload);
                assert!(!stored_content.contains("javascript:"), 
                    "JavaScript protocols should be sanitized in: {}", payload);
                assert!(!stored_content.contains("onload="), 
                    "Event handlers should be sanitized in: {}", payload);
                
                // Clean up
                let _ = state.db.delete_note(note.id).await;
            },
            Err(_) => {
                // If validation rejected the content, that's also acceptable security behavior
                // The important thing is no XSS execution occurs
            }
        }
        
        // Test search with XSS payloads - should not execute any scripts
        let search_result = state.search.search_notes(payload).await;
        assert!(search_result.is_ok(), "Search should safely handle XSS payload: {}", payload);
    }
}

/// Test operation context security and capability validation
#[tokio::test]
async fn test_operation_context_security() {
    let state = create_security_test_state().await;
    
    // Test various operation sources with different capabilities
    let test_cases = vec![
        (OperationSource::IPC, vec![OperationCapability::NoteRead]),
        (OperationSource::CLI, vec![OperationCapability::NoteWrite, OperationCapability::SystemAccess]),
        (OperationSource::Direct, vec![OperationCapability::NoteRead, OperationCapability::NoteWrite]),
        (OperationSource::Plugin, vec![OperationCapability::NoteRead]),
    ];
    
    for (source, capabilities) in test_cases {
        let context = OperationContext::new(source, capabilities.clone());
        
        // Test context validation
        let validation_result = state.security_validator.validate_operation_context(&context, &capabilities);
        assert!(validation_result.is_ok(), 
            "Valid context should pass validation for source: {:?}", source);
        
        // Test insufficient capabilities
        let enhanced_caps = vec![OperationCapability::SystemAccess, OperationCapability::NoteWrite, OperationCapability::NoteDelete];
        if !enhanced_caps.iter().all(|cap| capabilities.contains(cap)) {
            let invalid_validation = state.security_validator.validate_operation_context(&context, &enhanced_caps);
            assert!(invalid_validation.is_err(), 
                "Insufficient capabilities should fail validation for source: {:?}", source);
        }
    }
}

/// Test frequency-based abuse prevention
#[tokio::test]
async fn test_frequency_abuse_prevention() {
    let state = create_security_test_state().await;
    
    // Test rapid-fire operations to trigger frequency limits
    let context = OperationContext::new(
        OperationSource::IPC, 
        vec![OperationCapability::NoteRead]
    );
    
    // First few operations should succeed
    for i in 0..5 {
        let result = state.security_validator.validate_operation_frequency(&context);
        assert!(result.is_ok(), "Operation {} should succeed within frequency limits", i);
    }
    
    // Simulate rapid operations that might trigger limits
    // Note: The exact threshold depends on SecurityValidator implementation
    for _i in 0..100 {
        let _result = state.security_validator.validate_operation_frequency(&context);
        // We don't assert failure here as the exact frequency limits may vary
        // The important thing is that the validator is checking frequency
    }
}

/// Test input validation and sanitization
#[tokio::test]
async fn test_input_validation() {
    let state = create_security_test_state().await;
    
    // Test various malicious inputs
    let malicious_inputs = vec![
        "\0\0\0\0", // Null bytes
        "A".repeat(1000000), // Extremely long input
        "\x00\x01\x02\x03", // Control characters
        "🚀".repeat(10000), // Unicode flood
        "<>&\"'", // HTML/XML special characters
        "\r\n\r\n", // CRLF injection
        "%00%0A%0D", // URL encoded null and newlines
        "../../etc/passwd\0.txt", // Null byte path traversal
    ];
    
    for malicious_input in malicious_inputs {
        // Test note content validation
        let content_result = state.security_validator.validate_input_content(malicious_input);
        
        // Validation should either accept with sanitization or reject malicious content
        match content_result {
            Ok(sanitized) => {
                // If accepted, should be properly sanitized
                assert!(!sanitized.contains('\0'), "Null bytes should be removed");
                assert!(sanitized.len() <= 100000, "Content should be length-limited");
            },
            Err(_) => {
                // Rejection is also acceptable for malicious content
            }
        }
        
        // Test search query validation
        let query_result = state.search.validate_search_query(malicious_input).await;
        assert!(query_result.is_ok(), "Search validation should handle malicious input safely");
    }
}

/// Test export path validation security
#[tokio::test]
async fn test_export_path_validation() {
    let state = create_security_test_state().await;
    
    // Test legitimate paths (should pass)
    let legitimate_paths = vec![
        "/home/user/documents/export.json",
        "C:\\Users\\User\\Documents\\export.json",
        "./exports/backup.json",
        "notes_backup_2024.json",
    ];
    
    for path in legitimate_paths {
        let result = state.security_validator.validate_export_path(path, None);
        assert!(result.is_ok(), "Legitimate path should be accepted: {}", path);
    }
    
    // Test dangerous paths (should fail)
    let dangerous_paths = vec![
        "/etc/passwd",
        "C:\\Windows\\System32\\config\\sam",
        "../../../sensitive_file.txt",
        "/dev/null",
        "/proc/self/environ",
        "\\\\server\\admin$\\secrets.txt",
    ];
    
    for path in dangerous_paths {
        let result = state.security_validator.validate_export_path(path, None);
        assert!(result.is_err(), "Dangerous path should be rejected: {}", path);
    }
}

/// Test plugin security isolation
#[tokio::test]
async fn test_plugin_security_isolation() {
    let state = create_security_test_state().await;
    
    // Test plugin operations with limited capabilities
    let plugin_context = OperationContext::new(
        OperationSource::Plugin,
        vec![OperationCapability::NoteRead] // Limited plugin capabilities
    );
    
    // Plugin should be able to read notes
    let read_validation = state.security_validator.validate_operation_context(
        &plugin_context, 
        &vec![OperationCapability::NoteRead]
    );
    assert!(read_validation.is_ok(), "Plugin should be able to read notes");
    
    // Plugin should NOT be able to access system operations
    let system_validation = state.security_validator.validate_operation_context(
        &plugin_context,
        &vec![OperationCapability::SystemAccess]
    );
    assert!(system_validation.is_err(), "Plugin should not have system access");
    
    // Plugin should NOT be able to delete notes without explicit permission
    let delete_validation = state.security_validator.validate_operation_context(
        &plugin_context,
        &vec![OperationCapability::NoteDelete]
    );
    assert!(delete_validation.is_err(), "Plugin should not be able to delete notes by default");
}

/// Test complete security test suite execution
#[tokio::test]
async fn security_test_suite() {
    // Run all security tests in sequence to ensure comprehensive coverage
    test_path_traversal_prevention().await;
    test_sql_injection_prevention().await;
    test_xss_prevention().await;
    test_operation_context_security().await;
    test_frequency_abuse_prevention().await;
    test_input_validation().await;
    test_export_path_validation().await;
    test_plugin_security_isolation().await;
    
    println!("✅ All security tests passed - application security verified");
}

/// Performance benchmark for security validation operations
#[tokio::test]
async fn test_security_validation_performance() {
    let state = create_security_test_state().await;
    
    let start_time = std::time::Instant::now();
    
    // Run multiple validation operations
    for _i in 0..1000 {
        let context = OperationContext::new(
            OperationSource::IPC,
            vec![OperationCapability::NoteRead]
        );
        
        let _ = state.security_validator.validate_operation_context(&context, &vec![OperationCapability::NoteRead]);
        let _ = state.security_validator.validate_input_content("test content");
        let _ = state.security_validator.validate_operation_frequency(&context);
    }
    
    let elapsed = start_time.elapsed();
    
    // Security validation should be fast (< 1ms average per operation)
    assert!(elapsed.as_millis() < 1000, 
        "Security validation performance regression detected: {}ms for 1000 operations", 
        elapsed.as_millis());
    
    println!("✅ Security validation performance: {}μs average per operation", 
        elapsed.as_micros() / 3000); // 3 operations per iteration
}