#[cfg(test)]
mod security_tests {
    // Security tests use specific imports
    use crate::validation::SecurityValidator;
    use crate::error::AppError;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Test suite for SEC-001: Path Traversal Vulnerability
    mod path_traversal_tests {
        use super::*;

        #[test]
        fn test_export_note_path_traversal_protection() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            // Test case 1: Basic path traversal attempts
            let dangerous_paths = [
                "../../../etc/passwd",
                "..\\..\\..\\windows\\system32\\config",
                "./../../sensitive/file.txt",
                "folder/../../../escape.txt",
                "normal/../../outside.txt",
            ];

            for dangerous_path in &dangerous_paths {
                let result = SecurityValidator::validate_export_path(dangerous_path, Some(base_path));
                assert!(result.is_err(), "Should reject path traversal: {}", dangerous_path);
                
                if let Err(AppError::Validation { field, message }) = result {
                    assert_eq!(field, "file_path");
                    assert!(message.contains("traversal"));
                }
            }
        }

        #[test]
        fn test_export_note_url_encoded_traversal() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            let encoded_attacks = [
                "file%2e%2e%2fpasswd.txt",
                "%2e%2e%2f%2e%2e%2fconfig.txt",
                "..%2fetc%2fpasswd.txt",
                "normal%2f..%2f..%2fescape.txt",
            ];

            for attack in &encoded_attacks {
                let result = SecurityValidator::validate_export_path(attack, Some(base_path));
                assert!(result.is_err(), "Should reject URL encoded traversal: {}", attack);
            }
        }

        #[test]
        fn test_export_note_absolute_path_rejection() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            let absolute_paths = [
                "/etc/passwd.txt",
                "/home/user/secret.txt",
                "/var/log/sensitive.txt",
            ];

            for abs_path in &absolute_paths {
                let result = SecurityValidator::validate_export_path(abs_path, Some(base_path));
                assert!(result.is_err(), "Should reject absolute path: {}", abs_path);
            }
        }

        #[test]
        fn test_export_note_windows_dangerous_paths() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            let windows_paths = [
                "C:\\Windows\\System32\\file.txt",
                "D:\\Users\\admin\\secret.txt",
                "\\\\server\\share\\file.txt",
                "//server/share/file.txt",
            ];

            for win_path in &windows_paths {
                let result = SecurityValidator::validate_export_path(win_path, Some(base_path));
                // This should fail on Windows, may succeed on Unix (which is fine)
                #[cfg(windows)]
                assert!(result.is_err(), "Should reject Windows dangerous path: {}", win_path);
            }
        }

        #[test]
        fn test_export_note_safe_paths_allowed() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            let safe_paths = [
                "notes/my-note.txt",
                "exports/data.json",
                "documents/report.md",
                "subfolder/file.csv",
            ];

            for safe_path in &safe_paths {
                let result = SecurityValidator::validate_export_path(safe_path, Some(base_path));
                assert!(result.is_ok(), "Should allow safe path: {}", safe_path);
                
                if let Ok(validated_path) = result {
                    // Ensure the path is within the base directory
                    assert!(validated_path.starts_with(base_path));
                }
            }
        }
    }

    /// Test suite for SEC-002: IPC Security
    mod ipc_security_tests {
        use super::*;

        #[test]
        fn test_note_content_validation() {
            // Test normal content
            assert!(SecurityValidator::validate_note_content("Normal note content").is_ok());

            // Test script injection attempts
            let malicious_content = [
                "<script>alert('xss')</script>",
                "javascript:alert(1)",
                "<img src=x onerror=alert(1)>",
                "eval('malicious code')",
                "exec('rm -rf /')",
                "system('cmd.exe')",
                "`rm -rf /`",
                "$(dangerous command)",
                "<!-- malicious comment -->",
                "<?php echo 'hack'; ?>",
                "<% malicious asp %>",
            ];

            for content in &malicious_content {
                let result = SecurityValidator::validate_note_content(content);
                assert!(result.is_err(), "Should reject malicious content: {}", content);
            }
        }

        #[test]
        fn test_content_length_limits() {
            // Test content that's too long
            let long_content = "a".repeat(SecurityValidator::MAX_NOTE_CONTENT_LENGTH + 1);
            assert!(SecurityValidator::validate_note_content(&long_content).is_err());

            // Test content at the limit
            let max_content = "a".repeat(SecurityValidator::MAX_NOTE_CONTENT_LENGTH);
            assert!(SecurityValidator::validate_note_content(&max_content).is_ok());
        }

        #[test]
        fn test_search_query_injection_protection() {
            // Test normal queries
            let safe_queries = [
                "search term",
                "project AND task",
                "notes about work",
                "meeting OR discussion",
            ];

            for query in &safe_queries {
                assert!(SecurityValidator::validate_search_query(query).is_ok());
            }

            // Test SQL injection attempts
            let malicious_queries = [
                "'; DROP TABLE notes; --",
                "' UNION SELECT * FROM users --",
                "admin'--",
                "' OR '1'='1",
                "SELECT * FROM sqlite_master",
                "DELETE FROM notes WHERE 1=1",
                "INSERT INTO notes VALUES('evil')",
                "UPDATE notes SET content='hacked'",
                "CREATE TABLE evil AS SELECT *",
                "ALTER TABLE notes ADD COLUMN hacked",
                "EXEC xp_cmdshell('dir')",
                "EXECUTE sp_who",
            ];

            for query in &malicious_queries {
                let result = SecurityValidator::validate_search_query(query);
                assert!(result.is_err(), "Should reject SQL injection: {}", query);
            }
        }
    }

    /// Test suite for SEC-003: Command Injection Protection
    mod command_injection_tests {
        use super::*;

        #[test]
        fn test_setting_validation() {
            // Test valid settings
            let valid_settings = [
                ("theme", "dark"),
                ("window.width", "800"),
                ("font_size", "14"),
                ("auto-save", "true"),
            ];

            for (key, value) in &valid_settings {
                assert!(SecurityValidator::validate_setting(key, value).is_ok());
            }

            // Test malicious setting keys
            let malicious_keys = [
                "key with spaces",
                "key$pecial",
                "key;rm -rf /",
                "key`command`",
                "key$(command)",
                "key|command",
                "key&command",
                "key<script>",
            ];

            for key in &malicious_keys {
                let result = SecurityValidator::validate_setting(key, "value");
                assert!(result.is_err(), "Should reject malicious key: {}", key);
            }

            // Test malicious setting values
            let malicious_values = [
                "<script>alert(1)</script>",
                "javascript:alert(1)",
                "`rm -rf /`",
                "$(malicious)",
                "; rm -rf /",
                "| dangerous",
                "& command",
                "eval('hack')",
            ];

            for value in &malicious_values {
                let result = SecurityValidator::validate_setting("valid_key", value);
                assert!(result.is_err(), "Should reject malicious value: {}", value);
            }
        }

        #[test]
        fn test_shortcut_validation() {
            // Test valid shortcuts
            let valid_shortcuts = [
                "Ctrl+N",
                "Alt+Shift+F1",
                "Meta+Space",
                "Ctrl+Alt+Delete",
            ];

            for shortcut in &valid_shortcuts {
                assert!(SecurityValidator::validate_shortcut(shortcut).is_ok());
            }

            // Test malicious shortcuts
            let malicious_shortcuts = [
                "",
                "Invalid Shortcut",
                "Ctrl+<script>",
                "Alt+`command`",
                "Shift+$(evil)",
                "Meta+; rm -rf /",
                "Ctrl+|dangerous",
                "Alt+&command",
            ];

            for shortcut in &malicious_shortcuts {
                let result = SecurityValidator::validate_shortcut(shortcut);
                assert!(result.is_err(), "Should reject malicious shortcut: {}", shortcut);
            }
        }
    }

    /// Test suite for SEC-004: Input Validation Framework
    mod input_validation_tests {
        use super::*;

        #[test]
        fn test_id_validation() {
            // Test valid IDs
            let valid_ids = [1, 42, 1000, 999999];
            for id in &valid_ids {
                assert!(SecurityValidator::validate_id(*id).is_ok());
            }

            // Test invalid IDs
            let invalid_ids = [0, -1, -999, i64::MAX];
            for id in &invalid_ids {
                assert!(SecurityValidator::validate_id(*id).is_err());
            }
        }

        #[test]
        fn test_pagination_validation() {
            // Test valid pagination
            let valid_params = [(0, 50), (100, 100), (500, 250)];
            for (offset, limit) in &valid_params {
                assert!(SecurityValidator::validate_pagination(*offset, *limit).is_ok());
            }

            // Test invalid pagination
            let invalid_params = [
                (0, 0),        // Zero limit
                (0, 1001),     // Limit too large
                (100_001, 50), // Offset too large
            ];
            for (offset, limit) in &invalid_params {
                assert!(SecurityValidator::validate_pagination(*offset, *limit).is_err());
            }
        }

        #[test]
        fn test_file_extension_whitelist() {
            // Test allowed extensions
            let allowed_files = [
                "note.txt",
                "data.json",
                "document.md",
                "export.csv",
                "page.html",
                "config.xml",
                "doc.rtf",
            ];

            for file in &allowed_files {
                let path = PathBuf::from(file);
                assert!(SecurityValidator::validate_file_extension(&path).is_ok());
            }

            // Test dangerous extensions
            let dangerous_files = [
                "script.exe",
                "virus.bat",
                "malware.com",
                "trojan.scr",
                "code.js",
                "shell.sh",
                "binary.bin",
                "library.dll",
                "program.msi",
            ];

            for file in &dangerous_files {
                let path = PathBuf::from(file);
                assert!(SecurityValidator::validate_file_extension(&path).is_err());
            }
        }

        #[test]
        fn test_content_sanitization() {
            let test_cases = [
                ("Normal content", "Normal content"),
                ("Content\x00with\x08null\x7fbytes", "Content with null bytes"),
                ("  Whitespace  ", "Whitespace"),
                ("Mixed\x00\x08\x7fcontent", "Mixed content"),
            ];

            for (input, expected) in &test_cases {
                let sanitized = SecurityValidator::sanitize_for_database(input);
                assert_eq!(&sanitized, expected);
            }
        }
    }

    /// Integration tests for complete security workflow
    mod integration_tests {
        use super::*;

        #[test]
        fn test_secure_export_workflow() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            // Create a mock note
            let note_content = "This is a test note\nwith multiple lines";
            
            // Test complete validation workflow
            assert!(SecurityValidator::validate_note_content(note_content).is_ok());
            
            let sanitized = SecurityValidator::sanitize_for_database(note_content);
            assert_eq!(sanitized, note_content);
            
            let export_path = "exports/test-note.txt";
            let validated_path = SecurityValidator::validate_export_path(export_path, Some(base_path));
            assert!(validated_path.is_ok());
            
            if let Ok(path) = validated_path {
                assert!(path.starts_with(base_path));
                assert!(path.to_string_lossy().contains("test-note.txt"));
            }
        }

        #[test]
        fn test_malicious_export_blocked() {
            let temp_dir = TempDir::new().unwrap();
            let base_path = temp_dir.path();

            // Malicious note content
            let malicious_content = "<script>alert('xss')</script>";
            assert!(SecurityValidator::validate_note_content(malicious_content).is_err());

            // Malicious export path
            let malicious_path = "../../../etc/passwd.txt";
            let result = SecurityValidator::validate_export_path(malicious_path, Some(base_path));
            assert!(result.is_err());
        }

        #[test]
        fn test_search_and_pagination_security() {
            // Test combined search and pagination validation
            let search_query = "normal search";
            assert!(SecurityValidator::validate_search_query(search_query).is_ok());
            assert!(SecurityValidator::validate_pagination(0, 50).is_ok());

            // Test malicious combinations
            let malicious_query = "'; DROP TABLE notes; --";
            assert!(SecurityValidator::validate_search_query(malicious_query).is_err());
            
            let invalid_pagination = (100_001, 1001);
            assert!(SecurityValidator::validate_pagination(invalid_pagination.0, invalid_pagination.1).is_err());
        }
    }

    /// Performance and stress tests for validation
    mod performance_tests {
        use super::*;

        #[test]
        fn test_validation_performance() {
            use std::time::Instant;

            // Test path traversal detection performance
            let start = Instant::now();
            for _ in 0..1000 {
                SecurityValidator::contains_path_traversal("../../../etc/passwd");
            }
            let duration = start.elapsed();
            assert!(duration.as_millis() < 100, "Path traversal detection too slow: {:?}", duration);

            // Test content validation performance
            let test_content = "Normal content ".repeat(1000);
            let start = Instant::now();
            for _ in 0..100 {
                let _ = SecurityValidator::validate_note_content(&test_content);
            }
            let duration = start.elapsed();
            assert!(duration.as_millis() < 100, "Content validation too slow: {:?}", duration);
        }

        #[test]
        fn test_large_content_handling() {
            // Test with large but valid content
            let large_content = "a".repeat(500_000); // 500KB
            let result = SecurityValidator::validate_note_content(&large_content);
            assert!(result.is_ok());

            // Test with content exceeding limit
            let oversized_content = "a".repeat(SecurityValidator::MAX_NOTE_CONTENT_LENGTH + 1);
            let result = SecurityValidator::validate_note_content(&oversized_content);
            assert!(result.is_err());
        }
    }
}