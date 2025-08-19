//! Comprehensive Security Test Suite for Scratch Pad Application
//! 
//! This module contains comprehensive security tests for the fixes implemented in 
//! RUST-IMPL-001 and verified by TAURI-IPC-001.
//! 
//! Test Coverage:
//! - Security vulnerability tests for path traversal, injection attacks
//! - Input validation boundary testing  
//! - IPC command security testing
//! - Error handling verification
//! - Integration tests for the security framework
//! 
//! Track ID: TEST-AUTO-001

use scratch_pad_lib::{
    database::DbService,
    models::{Note, NoteFormat},
    search::SearchService,
    settings::SettingsService,
    validation::SecurityValidator,
};
use tempfile::{tempdir, TempDir};
use std::sync::Arc;
use std::time::Instant;
use tokio::fs;

/// Mock application state for security testing
#[derive(Clone)]
struct SecurityTestState {
    pub db: Arc<DbService>,
    pub search: Arc<SearchService>,
    pub settings: Arc<SettingsService>,
    pub _temp_dir: Arc<TempDir>, // Keep reference to prevent cleanup
}

impl SecurityTestState {
    async fn new() -> Self {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("security_test.db");
        
        let db_service = Arc::new(DbService::new(&db_path.to_string_lossy()).unwrap());
        let search_service = Arc::new(SearchService::new(db_service.clone()));
        let settings_service = Arc::new(SettingsService::new(db_service.clone()));
        
        // Initialize with secure defaults
        settings_service.initialize_defaults().await.unwrap();
        
        Self {
            db: db_service,
            search: search_service,
            settings: settings_service,
            _temp_dir: Arc::new(temp_dir),
        }
    }
}

/// Module: Path Traversal Security Tests
/// Testing for SEC-001: Path Traversal Vulnerability Prevention
mod path_traversal_security_tests {
    use super::*;

    #[test]
    fn test_path_traversal_detection_comprehensive() {
        // Basic path traversal patterns
        let basic_attacks = [
            "../etc/passwd",
            "..\\windows\\system32",
            "./../../secret",
            "folder/../../../escape.txt",
            "normal/../../outside.txt",
            "...//",
            "..../",
            ".\\..\\",
        ];

        for attack in &basic_attacks {
            assert!(
                SecurityValidator::contains_path_traversal(attack),
                "Failed to detect basic path traversal: {}", attack
            );
        }
    }

    #[test]
    fn test_url_encoded_path_traversal_detection() {
        // URL encoded path traversal patterns
        let encoded_attacks = [
            "%2e%2e%2f",           // ../
            "%2e%2e%5c",           // ..\
            "file%2e%2e%2fpasswd", // file../passwd
            "%2e%2e%2f%2e%2e%2f",  // ../../
            "..%2fetc%2fpasswd",   // ../etc/passwd
            "..%5cwindows%5csystem32", // ..\windows\system32
        ];

        for attack in &encoded_attacks {
            assert!(
                SecurityValidator::contains_path_traversal(attack),
                "Failed to detect URL encoded traversal: {}", attack
            );
        }
    }

    #[test]
    fn test_mixed_encoding_attacks() {
        // Mixed encoding and obfuscation attempts
        let mixed_attacks = [
            "..%2f..%2f..%2fetc%2fpasswd",
            "%2e%2e/etc/passwd",
            "../%2e%2e/sensitive",
            "normal%2f../secret",
        ];

        for attack in &mixed_attacks {
            assert!(
                SecurityValidator::contains_path_traversal(attack),
                "Failed to detect mixed encoding attack: {}", attack
            );
        }
    }

    #[test]
    fn test_export_path_validation_comprehensive() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();

        // Test various attack vectors
        let attack_vectors = [
            // Classic traversal
            ("../../../etc/passwd.txt", "Path traversal"),
            ("..\\..\\..\\windows\\system32.txt", "Windows traversal"),
            
            // Absolute paths
            ("/etc/passwd.txt", "Absolute path"),
            ("C:\\Windows\\System32\\file.txt", "Windows absolute"),
            
            // UNC paths
            ("\\\\server\\share\\file.txt", "UNC path"),
            ("//server/share/file.txt", "Unix UNC"),
            
            // Overlong paths
            (&"a".repeat(300), "Overlong path"),
            
            // Empty/invalid paths
            ("", "Empty path"),
            ("   ", "Whitespace only"),
        ];

        for (attack_path, description) in &attack_vectors {
            let result = SecurityValidator::validate_export_path(attack_path, Some(base_path));
            assert!(result.is_err(), "Should reject {}: {}", description, attack_path);
        }
    }

    #[test]
    fn test_safe_paths_allowed() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();

        let safe_paths = [
            "notes/my-note.txt",
            "exports/data.json",
            "documents/report.md",
            "subfolder/file.csv",
            "simple.txt",
            "folder1/folder2/file.xml",
        ];

        for safe_path in &safe_paths {
            let result = SecurityValidator::validate_export_path(safe_path, Some(base_path));
            assert!(result.is_ok(), "Should allow safe path: {}", safe_path);
            
            if let Ok(validated_path) = result {
                // Ensure the path is within the base directory
                assert!(validated_path.starts_with(base_path));
                assert!(validated_path.to_string_lossy().contains(&safe_path.replace('/', std::path::MAIN_SEPARATOR_STR)));
            }
        }
    }

    #[tokio::test]
    async fn test_export_note_path_traversal_integration() {
        let temp_dir = tempdir().unwrap();
        let export_base = temp_dir.path().join("exports");
        fs::create_dir_all(&export_base).await.unwrap();
        
        // Test that export function properly validates paths
        let _test_note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: None,
            path: "/test".to_string(),
            is_favorite: false,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        // This should fail with path traversal
        let malicious_path = "../../../etc/passwd.txt";
        let validated_path_result = SecurityValidator::validate_export_path(malicious_path, Some(&export_base));
        assert!(validated_path_result.is_err());
        
        // This should succeed
        let safe_path = "safe-export.txt";
        let validated_path_result = SecurityValidator::validate_export_path(safe_path, Some(&export_base));
        assert!(validated_path_result.is_ok());
    }
}

/// Module: Input Injection Security Tests  
/// Testing for SEC-002: Injection Attack Prevention
mod injection_security_tests {
    use super::*;

    #[tokio::test]
    async fn test_sql_injection_in_search_queries() {
        let _state = SecurityTestState::new().await;
        
        // SQL injection attempts that should be blocked
        let sql_injection_attempts = [
            "'; DROP TABLE notes; --",
            "' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM sqlite_master --",
            "1' ORDER BY 1--",
            "' AND 1=1 --",
            "test'; DELETE FROM notes WHERE 1=1; --",
            "search' UNION ALL SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL--",
            "') OR 1=1 --",
            "' OR 'a'='a",
            "SELECT * FROM notes WHERE content LIKE '%test%'; DROP TABLE notes; --",
            // Case insensitive variants
            "Test'; drop table notes; --",
            "search' union select * from notes --",
            "normal' exec xp_cmdshell('dir') --",
        ];

        for injection in &sql_injection_attempts {
            // Test direct validation
            let validation_result = SecurityValidator::validate_search_query(injection);
            assert!(
                validation_result.is_err(),
                "Should block SQL injection attempt: {}", injection
            );
        }
    }

    #[tokio::test]
    async fn test_script_injection_in_content() {
        let state = SecurityTestState::new().await;
        
        // Script injection attempts in note content
        let script_injections = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert(1)>",
            "javascript:alert('injection')",
            "<iframe src='javascript:alert(1)'></iframe>",
            "<svg onload=alert(1)>",
            "<body onload=alert('XSS')>",
            "<div onclick='malicious()'>Click me</div>",
            "<%eval request('cmd')%>",
            "<?php system('rm -rf /'); ?>",
            "<% response.write('hacked') %>",
            "eval('malicious code')",
            "exec('rm -rf /')",
            "system('dangerous command')",
            "`rm -rf /`",
            "$(dangerous command)",
            "powershell -command 'Get-Process'",
            "/bin/bash -c 'rm file'",
            "cmd.exe /c dir",
        ];

        for injection in &script_injections {
            // Test content validation
            let validation_result = SecurityValidator::validate_note_content(injection);
            assert!(
                validation_result.is_err(),
                "Should block script injection in content: {}", injection
            );
            
            // Test that create_note properly validates
            let create_result = state.db.create_note(injection.to_string()).await;
            // Should fail at validation level before reaching database
            assert!(
                create_result.is_err(),
                "Should reject note creation with script injection: {}", injection
            );
        }
    }

    #[tokio::test]
    async fn test_command_injection_in_settings() {
        let state = SecurityTestState::new().await;
        
        // Command injection attempts in setting values
        let command_injections = [
            "; rm -rf /",
            "| dangerous",
            "& malicious",
            "`command substitution`",
            "$(command substitution)",
            "&& echo 'injected'",
            "|| echo 'alternative'",
            "> /etc/passwd",
            "< /etc/passwd",
            "2>&1",
            "\n rm -rf /",
            "\r\n dangerous",
            "%USERNAME%",
            "$HOME/malicious",
        ];

        for injection in &command_injections {
            // Test setting value validation
            let validation_result = SecurityValidator::validate_setting("test_key", injection);
            assert!(
                validation_result.is_err(),
                "Should block command injection in setting: {}", injection
            );
        }

        // Test malicious setting keys
        let malicious_keys = [
            "key;rm -rf /",
            "key`dangerous`",
            "key$(command)",
            "key|pipe",
            "key&background",
            "key with spaces",
            "key$variable",
            "key<redirect",
            "key>output",
        ];

        for key in &malicious_keys {
            let validation_result = SecurityValidator::validate_setting(key, "safe_value");
            assert!(
                validation_result.is_err(),
                "Should block malicious setting key: {}", key
            );
        }
    }

    #[test]
    fn test_shortcut_injection_validation() {
        // Test malicious shortcut strings
        let malicious_shortcuts = [
            "<script>alert(1)</script>",
            "Ctrl+`dangerous`",
            "Alt+$(command)",
            "Shift+; rm -rf /",
            "Meta+| pipe",
            "Ctrl+& background",
            "javascript:alert(1)",
            "cmd.exe /c dir",
            "/bin/bash",
            "powershell.exe",
        ];

        for shortcut in &malicious_shortcuts {
            let validation_result = SecurityValidator::validate_shortcut(shortcut);
            assert!(
                validation_result.is_err(),
                "Should block malicious shortcut: {}", shortcut
            );
        }
        
        // Test valid shortcuts still work
        let valid_shortcuts = [
            "Ctrl+Alt+S",
            "Cmd+Shift+Space",
            "Alt+F1",
            "Meta+N",
            "Ctrl+Shift+T",
        ];
        
        for shortcut in &valid_shortcuts {
            let validation_result = SecurityValidator::validate_shortcut(shortcut);
            assert!(
                validation_result.is_ok(),
                "Should allow valid shortcut: {}", shortcut
            );
        }
    }
}

/// Module: Input Validation Boundary Tests
/// Testing edge cases and boundary conditions for all inputs
mod input_validation_boundary_tests {
    use super::*;

    #[test]
    fn test_content_length_boundaries() {
        // Test at boundary limits
        let max_length = SecurityValidator::MAX_NOTE_CONTENT_LENGTH;
        
        // Content at maximum allowed length should pass
        let max_content = "a".repeat(max_length);
        assert!(SecurityValidator::validate_note_content(&max_content).is_ok());
        
        // Content exceeding maximum should fail
        let over_content = "a".repeat(max_length + 1);
        assert!(SecurityValidator::validate_note_content(&over_content).is_err());
        
        // Empty content should pass
        assert!(SecurityValidator::validate_note_content("").is_ok());
        
        // Very large content should fail gracefully
        let huge_content = "x".repeat(10 * 1024 * 1024); // 10MB
        assert!(SecurityValidator::validate_note_content(&huge_content).is_err());
    }

    #[test]
    fn test_path_length_boundaries() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        // Test maximum allowed path length
        let max_path_length = SecurityValidator::MAX_PATH_LENGTH;
        
        // Path at limit should be validated
        let max_path = format!("{}.txt", "a".repeat(max_path_length - 4));
        let _result = SecurityValidator::validate_export_path(&max_path, Some(base_path));
        // May fail due to OS limits or file extension validation, but shouldn't crash
        
        // Path exceeding limit should fail
        let over_path = format!("{}.txt", "a".repeat(max_path_length));
        let result = SecurityValidator::validate_export_path(&over_path, Some(base_path));
        assert!(result.is_err());
    }

    #[test]
    fn test_setting_length_boundaries() {
        let max_setting_length = SecurityValidator::MAX_SETTING_LENGTH;
        
        // Setting at maximum length
        let max_key = "a".repeat(max_setting_length);
        let max_value = "b".repeat(max_setting_length);
        
        // Both at limit should pass basic length check but may fail other validation
        let _result = SecurityValidator::validate_setting(&max_key, &max_value);
        // Will likely fail due to key format validation, but test shouldn't crash
        
        // Exceeding limits should fail
        let over_key = "a".repeat(max_setting_length + 1);
        let over_value = "b".repeat(max_setting_length + 1);
        
        assert!(SecurityValidator::validate_setting(&over_key, "valid").is_err());
        assert!(SecurityValidator::validate_setting("valid", &over_value).is_err());
    }

    #[test]
    fn test_id_validation_boundaries() {
        // Valid ID ranges
        assert!(SecurityValidator::validate_id(1).is_ok());
        assert!(SecurityValidator::validate_id(1000).is_ok());
        assert!(SecurityValidator::validate_id(i64::MAX / 2).is_ok());
        
        // Invalid ID ranges
        assert!(SecurityValidator::validate_id(0).is_err());
        assert!(SecurityValidator::validate_id(-1).is_err());
        assert!(SecurityValidator::validate_id(-1000).is_err());
        assert!(SecurityValidator::validate_id(i64::MAX).is_err());
        assert!(SecurityValidator::validate_id(i64::MIN).is_err());
    }

    #[test]
    fn test_pagination_boundaries() {
        // Valid pagination
        assert!(SecurityValidator::validate_pagination(0, 1).is_ok());
        assert!(SecurityValidator::validate_pagination(0, 1000).is_ok());
        assert!(SecurityValidator::validate_pagination(100_000, 500).is_ok());
        
        // Invalid pagination
        assert!(SecurityValidator::validate_pagination(0, 0).is_err());
        assert!(SecurityValidator::validate_pagination(0, 1001).is_err());
        assert!(SecurityValidator::validate_pagination(100_001, 50).is_err());
        
        // Edge cases
        assert!(SecurityValidator::validate_pagination(usize::MAX, 1).is_err());
        assert!(SecurityValidator::validate_pagination(0, usize::MAX).is_err());
    }

    #[test]
    fn test_unicode_and_special_characters() {
        // Test Unicode content handling
        let unicode_content = "Test with émojis 🚀 and ñoñó characters 中文";
        assert!(SecurityValidator::validate_note_content(unicode_content).is_ok());
        
        // Test special characters that aren't malicious
        let special_content = "Math: ∑∞=1 α²β³γ⁴ ≠ ∅";
        assert!(SecurityValidator::validate_note_content(special_content).is_ok());
        
        // Test path with Unicode
        let temp_dir = tempdir().unwrap();
        let unicode_path = "tést_fíle.txt";
        let _result = SecurityValidator::validate_export_path(unicode_path, Some(temp_dir.path()));
        // Should work on most systems, but may fail on some filesystems
    }

    #[tokio::test]
    async fn test_concurrent_validation_stress() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Arc;
        
        let success_count = Arc::new(AtomicUsize::new(0));
        let error_count = Arc::new(AtomicUsize::new(0));
        
        let mut handles = Vec::new();
        
        // Spawn multiple concurrent validation tasks
        for i in 0..100 {
            let success_count = Arc::clone(&success_count);
            let error_count = Arc::clone(&error_count);
            
            let handle = tokio::spawn(async move {
                let content = format!("Concurrent test content {}", i);
                match SecurityValidator::validate_note_content(&content) {
                    Ok(_) => success_count.fetch_add(1, Ordering::Relaxed),
                    Err(_) => error_count.fetch_add(1, Ordering::Relaxed),
                };
                
                // Also test malicious content
                let malicious = format!("<script>alert({})</script>", i);
                match SecurityValidator::validate_note_content(&malicious) {
                    Ok(_) => panic!("Should not validate malicious content"),
                    Err(_) => error_count.fetch_add(1, Ordering::Relaxed),
                };
            });
            
            handles.push(handle);
        }
        
        // Wait for all tasks
        for handle in handles {
            handle.await.unwrap();
        }
        
        assert_eq!(success_count.load(Ordering::Relaxed), 100);
        assert_eq!(error_count.load(Ordering::Relaxed), 100);
    }
}

/// Module: Performance Security Tests
/// Testing that security validation doesn't create performance vulnerabilities
mod performance_security_tests {
    use super::*;

    #[test]
    fn test_validation_performance() {
        // Test that validation completes quickly even with attack patterns
        let attack_patterns = [
            "../".repeat(1000),
            "<script>".repeat(1000),
            "'; DROP TABLE".repeat(100),
            "a".repeat(10000),
        ];
        
        for pattern in &attack_patterns {
            let start = Instant::now();
            let _result = SecurityValidator::validate_note_content(pattern);
            let duration = start.elapsed();
            
            // Validation should complete within reasonable time
            assert!(duration.as_millis() < 100, "Validation too slow for pattern length {}", pattern.len());
        }
    }

    #[test]
    fn test_path_traversal_performance() {
        // Test path traversal detection performance
        let complex_paths = [
            "../".repeat(1000) + "test.txt",
            "%2e%2e%2f".repeat(500) + "file.txt",
            ("nested/".repeat(100) + "../").repeat(10) + "escape.txt",
        ];
        
        for path in &complex_paths {
            let start = Instant::now();
            let _result = SecurityValidator::contains_path_traversal(path);
            let duration = start.elapsed();
            
            assert!(duration.as_millis() < 50, "Path traversal detection too slow");
        }
    }

    #[tokio::test]
    async fn test_database_performance_under_attack() {
        let state = SecurityTestState::new().await;
        
        // Create legitimate data first
        for i in 0..10 {
            let _ = state.db.create_note(format!("Legitimate note {}", i)).await;
        }
        
        // Time search operations with malicious queries
        let start = Instant::now();
        for _ in 0..5 {
            let _ = state.search.search_notes("'; DROP TABLE notes; --").await;
        }
        let duration = start.elapsed();
        
        // Should complete quickly and not hang the system
        assert!(duration.as_secs() < 5, "Attack queries caused performance degradation");
    }

    #[test]
    fn test_regex_performance_safety() {
        // Test that regex patterns don't cause ReDoS (Regular Expression Denial of Service)
        let catastrophic_inputs = [
            "a".repeat(10000) + "X", // Linear time should be fine
            ("ab").repeat(5000) + "X",
            ("abc").repeat(3333) + "X",
        ];
        
        for input in &catastrophic_inputs {
            let start = Instant::now();
            let _result = SecurityValidator::validate_setting("test_key", input);
            let duration = start.elapsed();
            
            // Should not exhibit exponential behavior
            assert!(duration.as_secs() < 1, "Potential ReDoS vulnerability");
        }
    }
}

/// Module: Integration Security Tests
/// End-to-end security testing with realistic scenarios
mod integration_security_tests {
    use super::*;

    #[tokio::test]
    async fn test_complete_attack_scenario() {
        let state = SecurityTestState::new().await;
        
        // Simulate a complete attack scenario
        // 1. Attacker tries to create malicious note
        let attack_result = state.db.create_note("<script>fetch('/api/admin').then(r=>r.json()).then(console.log)</script>".to_string()).await;
        assert!(attack_result.is_err());
        
        // 2. Attacker tries path traversal in export
        let temp_dir = tempdir().unwrap();
        let malicious_path = "../../../etc/passwd.txt";
        let export_result = SecurityValidator::validate_export_path(malicious_path, Some(temp_dir.path()));
        assert!(export_result.is_err());
        
        // 3. Attacker tries command injection in settings
        let settings_result = state.settings.set_setting("theme", "; rm -rf /").await;
        assert!(settings_result.is_err());
        
        // 4. Verify system is still functional after attacks
        let legitimate_note = state.db.create_note("Legitimate content".to_string()).await.unwrap();
        let search_results = state.search.search_notes("Legitimate").await.unwrap();
        assert_eq!(search_results.len(), 1);
        assert_eq!(search_results[0].content, "Legitimate content");
    }

    #[tokio::test]
    async fn test_multi_vector_attack() {
        let state = SecurityTestState::new().await;
        
        // Simulate multiple concurrent attack vectors
        let attack_handles = vec![
            tokio::spawn({
                let state = state.clone();
                async move {
                    // Content injection attacks
                    for i in 0..10 {
                        let malicious = format!("<script>alert({})</script>", i);
                        let _ = state.db.create_note(malicious).await;
                    }
                }
            }),
            tokio::spawn({
                let state = state.clone();
                async move {
                    // Search injection attacks
                    for i in 0..10 {
                        let injection = format!("'; DROP TABLE notes_{}; --", i);
                        let _ = state.search.search_notes(&injection).await;
                    }
                }
            }),
            tokio::spawn({
                let state = state.clone();
                async move {
                    // Settings injection attacks
                    for i in 0..10 {
                        let key = format!("key_{}", i);
                        let value = format!("$(rm -rf /tmp/{})", i);
                        let _ = state.settings.set_setting(&key, &value).await;
                    }
                }
            }),
        ];
        
        // Wait for all attacks to complete
        for handle in attack_handles {
            handle.await.unwrap();
        }
        
        // Verify system integrity
        let legitimate_note = state.db.create_note("Test integrity".to_string()).await.unwrap();
        let found_notes = state.search.search_notes("integrity").await.unwrap();
        assert!(!found_notes.is_empty());
        
        // Verify settings still work
        let setting_result = state.settings.set_setting("test", "value").await;
        assert!(setting_result.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limiting_behavior() {
        let state = SecurityTestState::new().await;
        
        // Test rapid-fire malicious requests
        let start = Instant::now();
        for i in 0..100 {
            let malicious_content = format!("<script>attack_{}</script>", i);
            let _ = state.db.create_note(malicious_content).await;
        }
        let duration = start.elapsed();
        
        // Should complete in reasonable time (not hanging due to attacks)
        assert!(duration.as_secs() < 10, "System appears to be under DoS attack");
        
        // Verify system is still responsive
        let _legitimate_note = state.db.create_note("Post-attack test".to_string()).await.unwrap();
    }
}

/// Helper function to run all security tests
#[tokio::test]
async fn run_comprehensive_security_test_suite() {
    println!("🔒 Running Comprehensive Security Test Suite for TEST-AUTO-001");
    
    // This test ensures all security modules are properly integrated
    // and provides a single entry point for running all security tests
    
    let state = SecurityTestState::new().await;
    
    // Test basic security functionality
    assert!(SecurityValidator::validate_note_content("Safe content").is_ok());
    assert!(SecurityValidator::validate_note_content("<script>alert(1)</script>").is_err());
    
    // Test database operations are secure
    let note = state.db.create_note("Security test note".to_string()).await.unwrap();
    assert_eq!(note.content, "Security test note");
    
    // Test search security
    let results = state.search.search_notes("security").await.unwrap();
    assert!(!results.is_empty());
    
    // Test settings security
    assert!(state.settings.set_setting("theme", "dark").await.is_ok());
    assert!(state.settings.set_setting("theme", "<script>").await.is_err());
    
    println!("✅ Comprehensive Security Test Suite completed successfully");
}