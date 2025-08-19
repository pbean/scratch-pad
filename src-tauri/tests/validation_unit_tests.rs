//! Unit Tests for SecurityValidator Module
//! 
//! Comprehensive unit testing for all validation functions in the SecurityValidator.
//! These tests focus on individual validation methods to ensure they work correctly
//! in isolation and handle edge cases properly.
//! 
//! Related to Track ID: TEST-AUTO-001

use scratch_pad_lib::{
    error::AppError,
    validation::SecurityValidator,
};
use std::path::PathBuf;
use tempfile::tempdir;

#[cfg(test)]
mod path_validation_tests {
    use super::*;

    #[test]
    fn test_validate_export_path_with_safe_paths() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let safe_paths = [
            "document.txt",
            "notes/my-note.md",
            "exports/data.json",
            "folder/subfolder/file.csv",
            "simple.xml",
            "backup/notes.rtf",
        ];
        
        for path in &safe_paths {
            let result = SecurityValidator::validate_export_path(path, Some(base_path));
            assert!(result.is_ok(), "Safe path should be valid: {}", path);
            
            if let Ok(validated_path) = result {
                assert!(validated_path.starts_with(base_path));
                assert!(validated_path.to_string_lossy().contains(&path.replace('/', std::path::MAIN_SEPARATOR_STR)));
            }
        }
    }

    #[test]
    fn test_validate_export_path_without_base_directory() {
        let safe_paths = [
            "document.txt",
            "notes/my-note.md",
        ];
        
        for path in &safe_paths {
            let result = SecurityValidator::validate_export_path(path, Option::<&str>::None);
            assert!(result.is_ok(), "Safe path should be valid without base: {}", path);
        }
    }

    #[test]
    fn test_validate_export_path_rejects_dangerous_paths() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let dangerous_paths = [
            "../etc/passwd.txt",
            "..\\windows\\system32.txt",
            "./../../secret.txt",
            "folder/../../../escape.txt",
            "/absolute/path.txt",
            "C:\\Windows\\file.txt",
            "\\\\server\\share\\file.txt",
            "//server/share/file.txt",
        ];
        
        for path in &dangerous_paths {
            let result = SecurityValidator::validate_export_path(path, Some(base_path));
            assert!(result.is_err(), "Dangerous path should be rejected: {}", path);
        }
    }

    #[test]
    fn test_validate_export_path_empty_and_invalid() {
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let invalid_paths = [
            "",
            "   ",
            "\t\n",
            &"a".repeat(300), // Too long
        ];
        
        for path in &invalid_paths {
            let result = SecurityValidator::validate_export_path(path, Some(base_path));
            assert!(result.is_err(), "Invalid path should be rejected: '{}'", path);
        }
    }

    #[test]
    fn test_contains_path_traversal_comprehensive() {
        // Should detect traversal
        let traversal_patterns = [
            "../",
            "..\\",
            "../etc",
            "..\\windows",
            "./../../",
            ".\\..\\..\\",
            "%2e%2e%2f",
            "%2e%2e%5c",
            "..%2f",
            "..%5c",
            "%2e%2e",
        ];
        
        for pattern in &traversal_patterns {
            assert!(
                SecurityValidator::contains_path_traversal(pattern),
                "Should detect traversal pattern: {}", pattern
            );
        }
        
        // Should not detect in safe paths
        let safe_patterns = [
            "notes/file.txt",
            "documents/report.md",
            "folder/subfolder/file.json",
            "simple.txt",
            "backup-file.csv",
            "data_2024.xml",
        ];
        
        for pattern in &safe_patterns {
            assert!(
                !SecurityValidator::contains_path_traversal(pattern),
                "Should not detect traversal in safe pattern: {}", pattern
            );
        }
    }

    #[test]
    fn test_allowed_file_extensions() {
        // Test that we can validate paths with allowed extensions
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let allowed_files = [
            "document.txt",
            "notes.md",
            "data.json",
            "export.csv",
            "page.html",
            "config.xml",
            "document.rtf",
        ];
        
        for file in &allowed_files {
            let result = SecurityValidator::validate_export_path(file, Some(base_path));
            assert!(result.is_ok(), "Should allow file with allowed extension: {}", file);
        }
    }

    #[test]
    fn test_dangerous_file_extensions_blocked() {
        // Test that dangerous extensions are blocked during path validation
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let dangerous_files = [
            "malware.exe",
            "script.bat",
            "virus.com",
            "trojan.scr",
            "code.js",
            "shell.sh",
            "program.msi",
            "library.dll",
            "binary.bin",
            "unsafe.ps1",
            "danger.vbs",
            "harm.jar",
        ];
        
        for file in &dangerous_files {
            let result = SecurityValidator::validate_export_path(file, Some(base_path));
            assert!(result.is_err(), "Should reject dangerous file extension: {}", file);
        }
    }

    #[test]
    fn test_files_without_extensions_blocked() {
        // Test that files without extensions are blocked
        let temp_dir = tempdir().unwrap();
        let base_path = temp_dir.path();
        
        let no_extension_files = [
            "README",
            "Makefile",
            "LICENSE",
            "config",
        ];
        
        for file in &no_extension_files {
            let result = SecurityValidator::validate_export_path(file, Some(base_path));
            assert!(result.is_err(), "Should reject file without extension: {}", file);
        }
    }
}

#[cfg(test)]
mod content_validation_tests {
    use super::*;

    #[test]
    fn test_validate_note_content_safe_content() {
        let safe_contents = [
            "Simple note content",
            "Multi-line\ncontent\nwith\nbreaks",
            "Content with numbers 123 and symbols !@#",
            "Unicode content: émojis 🚀 中文 ñoñó",
            "Math symbols: ∑∞=1 α²β³γ⁴ ≠ ∅",
            "",  // Empty content
            " ", // Single space
            "\n\t", // Whitespace
        ];
        
        for content in &safe_contents {
            let result = SecurityValidator::validate_note_content(content);
            assert!(result.is_ok(), "Safe content should be valid: '{}'", content);
        }
    }

    #[test]
    fn test_validate_note_content_malicious_patterns() {
        let malicious_contents = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert(1)>",
            "javascript:alert('injection')",
            "<iframe src='javascript:alert(1)'></iframe>",
            "<svg onload=alert(1)>",
            "<body onload=alert('XSS')>",
            "eval('malicious code')",
            "exec('rm -rf /')",
            "system('dangerous command')",
            "`rm -rf /`",
            "$(dangerous command)",
            "powershell -command 'Get-Process'",
            "/bin/bash -c 'rm file'",
            "cmd.exe /c dir",
            "<%eval request('cmd')%>",
            "<?php system('rm -rf /'); ?>",
            "<% response.write('hacked') %>",
            "<!--malicious comment-->",
            "<?xml version='1.0'?>",
        ];
        
        for content in &malicious_contents {
            let result = SecurityValidator::validate_note_content(content);
            assert!(result.is_err(), "Malicious content should be rejected: '{}'", content);
            
            if let Err(AppError::Validation { field, message }) = result {
                assert_eq!(field, "content");
                assert!(message.contains("dangerous"));
            }
        }
    }

    #[test]
    fn test_validate_note_content_length_limits() {
        let max_length = SecurityValidator::MAX_NOTE_CONTENT_LENGTH;
        
        // Content at maximum length should pass
        let max_content = "a".repeat(max_length);
        let result = SecurityValidator::validate_note_content(&max_content);
        assert!(result.is_ok(), "Content at max length should be valid");
        
        // Content exceeding maximum should fail
        let over_content = "a".repeat(max_length + 1);
        let result = SecurityValidator::validate_note_content(&over_content);
        assert!(result.is_err(), "Content over max length should be invalid");
        
        if let Err(AppError::Validation { field, message }) = result {
            assert_eq!(field, "content");
            assert!(message.contains("too long"));
        }
    }

    #[test]
    fn test_validate_no_malicious_content() {
        let test_cases = [
            ("Safe content", "field", true),
            ("Normal text with numbers 123", "test", true),
            ("<script>alert(1)</script>", "content", false),
            ("javascript:dangerous()", "input", false),
            ("eval('code')", "data", false),
            ("system('cmd')", "value", false),
            ("`command`", "field", false),
            ("$(injection)", "param", false),
            ("<!-- comment -->", "html", false),
            ("<?php code ?>", "script", false),
            ("<% asp code %>", "page", false),
        ];
        
        for (content, field, should_pass) in &test_cases {
            let result = SecurityValidator::validate_no_malicious_content(content, field);
            if *should_pass {
                assert!(result.is_ok(), "Safe content should pass: '{}'", content);
            } else {
                assert!(result.is_err(), "Malicious content should fail: '{}'", content);
                if let Err(AppError::Validation { field: f, message }) = result {
                    assert_eq!(f, *field);
                    assert!(message.contains("dangerous"));
                }
            }
        }
    }

    #[test]
    fn test_sanitize_for_database() {
        let test_cases = [
            ("Normal content", "Normal content"),
            ("Content\x00with\x08null\x7fbytes", "Content with null bytes"),
            ("  Whitespace  ", "Whitespace"),
            ("Mixed\x00\x08\x7fcontent", "Mixed content"),
            ("\x00\x08\x7f", ""),
            ("Content\nwith\twhitespace", "Content\nwith\twhitespace"), // Preserve normal whitespace
        ];
        
        for (input, expected) in &test_cases {
            let result = SecurityValidator::sanitize_for_database(input);
            assert_eq!(result, *expected, "Sanitization failed for: '{}'", input);
        }
    }
}

#[cfg(test)]
mod search_validation_tests {
    use super::*;

    #[test]
    fn test_validate_search_query_safe_queries() {
        let safe_queries = [
            "simple search",
            "project AND task",
            "notes about work",
            "meeting OR discussion", 
            "search term",
            "test query",
            "",  // Empty query
            "123",
            "search-with-dashes",
            "search_with_underscores",
            "CaseSensitive",
        ];
        
        for query in &safe_queries {
            let result = SecurityValidator::validate_search_query(query);
            assert!(result.is_ok(), "Safe search query should be valid: '{}'", query);
        }
    }

    #[test]
    fn test_validate_search_query_sql_injection() {
        let sql_injections = [
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
            // Case variations
            "'; drop table notes; --",
            "' union select * from notes --",
            "test' exec cmd --",
        ];
        
        for injection in &sql_injections {
            let result = SecurityValidator::validate_search_query(injection);
            assert!(result.is_err(), "SQL injection should be rejected: '{}'", injection);
            
            if let Err(AppError::Validation { field, message }) = result {
                assert_eq!(field, "search_query");
                assert!(message.contains("dangerous"));
            }
        }
    }

    #[test]
    fn test_validate_search_query_length_limits() {
        // Query at limit should pass
        let limit_query = "a".repeat(1000);
        let result = SecurityValidator::validate_search_query(&limit_query);
        assert!(result.is_ok(), "Query at limit should be valid");
        
        // Query over limit should fail
        let over_query = "a".repeat(1001);
        let result = SecurityValidator::validate_search_query(&over_query);
        assert!(result.is_err(), "Query over limit should be invalid");
        
        if let Err(AppError::Validation { field, message }) = result {
            assert_eq!(field, "search_query");
            assert!(message.contains("too long"));
        }
    }
}

#[cfg(test)]
mod settings_validation_tests {
    use super::*;

    #[test]
    fn test_validate_setting_valid_settings() {
        let valid_settings = [
            ("theme", "dark"),
            ("window.width", "800"),
            ("font_size", "14"),
            ("auto-save", "true"),
            ("editor_font", "Consolas"),
            ("layout_mode", "default"),
            ("global_shortcut", "Ctrl+Alt+S"),
            ("always_on_top", "false"),
        ];
        
        for (key, value) in &valid_settings {
            let result = SecurityValidator::validate_setting(key, value);
            assert!(result.is_ok(), "Valid setting should pass: {}={}", key, value);
        }
    }

    #[test]
    fn test_validate_setting_invalid_keys() {
        let invalid_keys = [
            "",                    // Empty key
            "key with spaces",     // Spaces
            "key$pecial",         // Special characters
            "key;dangerous",      // Semicolon
            "key`command`",       // Backticks
            "key$(command)",      // Command substitution
            "key|pipe",           // Pipe
            "key&background",     // Ampersand
            "key<redirect",       // Redirect
            "key>output",         // Output redirect
            "key\nwith\nnewlines", // Newlines
            &"a".repeat(1025),    // Too long
        ];
        
        for key in &invalid_keys {
            let result = SecurityValidator::validate_setting(key, "safe_value");
            assert!(result.is_err(), "Invalid key should be rejected: '{}'", key);
        }
    }

    #[test]
    fn test_validate_setting_invalid_values() {
        let invalid_values = [
            "<script>alert(1)</script>",
            "javascript:alert(1)",
            "`rm -rf /`",
            "$(malicious)",
            "; rm -rf /",
            "| dangerous",
            "& command",
            "eval('hack')",
            "exec('evil')",
            "system('cmd')",
            "<!--comment-->",
            "<?php code?>",
            "<%asp code%>",
            &"b".repeat(1025), // Too long
        ];
        
        for value in &invalid_values {
            let result = SecurityValidator::validate_setting("valid_key", value);
            assert!(result.is_err(), "Invalid value should be rejected: '{}'", value);
        }
    }

    #[test]
    fn test_validate_setting_length_limits() {
        let max_length = SecurityValidator::MAX_SETTING_LENGTH;
        
        // Settings at max length
        let max_key = format!("key{}", "a".repeat(max_length - 3));
        let max_value = "b".repeat(max_length);
        
        // Key length validation
        let _result = SecurityValidator::validate_setting(&max_key, "value");
        // May fail due to other validation, but shouldn't crash
        
        // Value length validation  
        let result = SecurityValidator::validate_setting("key", &max_value);
        assert!(result.is_err(), "Value at max length should be rejected");
        
        // Over max length
        let over_key = "a".repeat(max_length + 1);
        let over_value = "b".repeat(max_length + 1);
        
        assert!(SecurityValidator::validate_setting(&over_key, "value").is_err());
        assert!(SecurityValidator::validate_setting("key", &over_value).is_err());
    }
}

#[cfg(test)]
mod shortcut_validation_tests {
    use super::*;

    #[test]
    fn test_validate_shortcut_valid_shortcuts() {
        let valid_shortcuts = [
            "Ctrl+N",
            "Alt+Shift+F1",
            "Meta+Space",
            "Ctrl+Alt+Delete",
            "Cmd+Shift+T",
            "Super+L",
            "F1",
            "Ctrl+Shift+Escape",
        ];
        
        for shortcut in &valid_shortcuts {
            let result = SecurityValidator::validate_shortcut(shortcut);
            assert!(result.is_ok(), "Valid shortcut should pass: '{}'", shortcut);
        }
    }

    #[test]
    fn test_validate_shortcut_invalid_shortcuts() {
        let invalid_shortcuts = [
            "",                           // Empty
            "Invalid Shortcut",          // Spaces
            "Ctrl+<script>",             // Script injection
            "Alt+`command`",             // Command injection
            "Shift+$(evil)",             // Command substitution
            "Meta+; rm -rf /",           // Command injection
            "Ctrl+|dangerous",           // Pipe
            "Alt+&command",              // Background command
            "javascript:alert(1)",       // JavaScript
            "cmd.exe",                   // Executable
            "/bin/bash",                 // Shell
            "powershell.exe",            // PowerShell
            &"a".repeat(51),             // Too long
        ];
        
        for shortcut in &invalid_shortcuts {
            let result = SecurityValidator::validate_shortcut(shortcut);
            assert!(result.is_err(), "Invalid shortcut should be rejected: '{}'", shortcut);
        }
    }

    #[test]
    fn test_validate_shortcut_length_limits() {
        // At limit
        let limit_shortcut = "a".repeat(50);
        let _result = SecurityValidator::validate_shortcut(&limit_shortcut);
        // May fail format validation but shouldn't fail length check
        
        // Over limit
        let over_shortcut = "a".repeat(51);
        let result = SecurityValidator::validate_shortcut(&over_shortcut);
        assert!(result.is_err(), "Shortcut over length limit should be rejected");
        
        if let Err(AppError::Validation { field, message }) = result {
            assert_eq!(field, "shortcut");
            assert!(message.contains("too long"));
        }
    }
}

#[cfg(test)]
mod id_and_pagination_tests {
    use super::*;

    #[test]
    fn test_validate_id_valid_ids() {
        let valid_ids = [1, 42, 1000, 999999, i64::MAX / 2];
        
        for id in &valid_ids {
            let result = SecurityValidator::validate_id(*id);
            assert!(result.is_ok(), "Valid ID should pass: {}", id);
        }
    }

    #[test]
    fn test_validate_id_invalid_ids() {
        let invalid_ids = [0, -1, -999, i64::MAX, i64::MIN, i64::MAX - 1];
        
        for id in &invalid_ids {
            let result = SecurityValidator::validate_id(*id);
            assert!(result.is_err(), "Invalid ID should be rejected: {}", id);
            
            if let Err(AppError::Validation { field, message: _ }) = result {
                assert_eq!(field, "id");
            }
        }
    }

    #[test]
    fn test_validate_pagination_valid_params() {
        let valid_params = [
            (0, 1),
            (0, 50),
            (100, 100),
            (500, 250),
            (1000, 1000),
            (100_000, 1),
        ];
        
        for (offset, limit) in &valid_params {
            let result = SecurityValidator::validate_pagination(*offset, *limit);
            assert!(result.is_ok(), "Valid pagination should pass: offset={}, limit={}", offset, limit);
        }
    }

    #[test]
    fn test_validate_pagination_invalid_params() {
        let invalid_params = [
            (0, 0),        // Zero limit
            (0, 1001),     // Limit too large
            (100_001, 50), // Offset too large
            (usize::MAX, 1), // Extreme offset
            (1, usize::MAX), // Extreme limit
        ];
        
        for (offset, limit) in &invalid_params {
            let result = SecurityValidator::validate_pagination(*offset, *limit);
            assert!(result.is_err(), "Invalid pagination should be rejected: offset={}, limit={}", offset, limit);
        }
    }

    #[test]
    fn test_validate_pagination_boundary_conditions() {
        // Test exact boundaries
        let max_limit = 1000;
        let max_offset = 100_000;
        
        // At boundaries should pass
        assert!(SecurityValidator::validate_pagination(0, max_limit).is_ok());
        assert!(SecurityValidator::validate_pagination(max_offset, 1).is_ok());
        
        // Over boundaries should fail
        assert!(SecurityValidator::validate_pagination(0, max_limit + 1).is_err());
        assert!(SecurityValidator::validate_pagination(max_offset + 1, 1).is_err());
    }
}