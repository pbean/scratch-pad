use serde::{Deserialize, Serialize};
use std::fmt;

/// Represents a note in the database
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub format: NoteFormat,
    pub nickname: Option<String>,
    pub path: String,
    #[serde(alias = "is_pinned")] // Allow both names for backward compatibility
    pub is_favorite: bool,  // Changed back to is_favorite to match integration tests
    pub created_at: String,
    pub updated_at: String,
}

/// Supported note formats
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NoteFormat {
    #[serde(rename = "plaintext")]
    PlainText,
    #[serde(rename = "markdown")]
    Markdown,
}

impl fmt::Display for NoteFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NoteFormat::PlainText => write!(f, "plaintext"),
            NoteFormat::Markdown => write!(f, "markdown"),
        }
    }
}

impl Default for NoteFormat {
    fn default() -> Self {
        NoteFormat::PlainText
    }
}

/// Represents a user setting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Context;

    #[test]
    fn test_note_serialization() -> Result<(), anyhow::Error> {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,  // Updated to match integration tests
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&note)
            .context("Failed to serialize note")?;
        assert!(json.contains("Test content"));
        assert!(json.contains("plaintext"));
        assert!(json.contains("Test Note"));

        // Test deserialization
        let deserialized: Note = serde_json::from_str(&json)
            .context("Failed to deserialize note")?;
        assert_eq!(deserialized.id, 1);
        assert_eq!(deserialized.content, "Test content");
        assert_eq!(deserialized.format, NoteFormat::PlainText);
        assert_eq!(deserialized.nickname, Some("Test Note".to_string()));
        assert_eq!(deserialized.path, "/test");
        assert!(deserialized.is_favorite);  // Updated field name
        
        Ok(())
    }

    #[test]
    fn test_note_format_serialization() -> Result<(), anyhow::Error> {
        use anyhow::Context;

        // Test PlainText format
        let plaintext = NoteFormat::PlainText;
        let json = serde_json::to_string(&plaintext)
            .context("Failed to serialize plaintext format")?;
        assert_eq!(json, "\"plaintext\"");
        
        let deserialized: NoteFormat = serde_json::from_str(&json)
            .context("Failed to deserialize plaintext format")?;
        assert_eq!(deserialized, NoteFormat::PlainText);

        // Test Markdown format
        let markdown = NoteFormat::Markdown;
        let json = serde_json::to_string(&markdown)
            .context("Failed to serialize markdown format")?;
        assert_eq!(json, "\"markdown\"");
        
        let deserialized: NoteFormat = serde_json::from_str(&json)
            .context("Failed to deserialize markdown format")?;
        assert_eq!(deserialized, NoteFormat::Markdown);

        Ok(())
    }

    #[test]
    fn test_note_format_display() {
        assert_eq!(NoteFormat::PlainText.to_string(), "plaintext");
        assert_eq!(NoteFormat::Markdown.to_string(), "markdown");
    }

    #[test]
    fn test_note_format_default() {
        assert_eq!(NoteFormat::default(), NoteFormat::PlainText);
    }

    #[test]
    fn test_setting_serialization() -> Result<(), anyhow::Error> {
        use anyhow::Context;

        let setting = Setting {
            key: "test_key".to_string(),
            value: "test_value".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&setting)
            .context("Failed to serialize setting")?;
        assert!(json.contains("test_key"));
        assert!(json.contains("test_value"));

        // Test deserialization
        let deserialized: Setting = serde_json::from_str(&json)
            .context("Failed to deserialize setting")?;
        assert_eq!(deserialized.key, "test_key");
        assert_eq!(deserialized.value, "test_value");

        Ok(())
    }

    #[test]
    fn test_note_clone() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,  // Updated field name
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let cloned = note.clone();
        assert_eq!(note, cloned);
    }

    #[test]
    fn test_note_debug() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,  // Updated field name
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let debug_str = format!("{:?}", note);
        assert!(debug_str.contains("Test content"));
        assert!(debug_str.contains("PlainText"));
    }
}