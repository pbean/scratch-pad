use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub format: NoteFormat,
    pub nickname: Option<String>,
    pub path: String,
    pub is_favorite: bool,
    pub created_at: String, // ISO 8601 timestamp
    pub updated_at: String, // ISO 8601 timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NoteFormat {
    #[serde(rename = "plaintext")]
    PlainText,
    #[serde(rename = "markdown")]
    Markdown,
}

impl Default for NoteFormat {
    fn default() -> Self {
        NoteFormat::PlainText
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_note_serialization() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&note).unwrap();
        assert!(json.contains("Test content"));
        assert!(json.contains("plaintext"));
        assert!(json.contains("Test Note"));

        // Test deserialization
        let deserialized: Note = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, 1);
        assert_eq!(deserialized.content, "Test content");
        assert_eq!(deserialized.format, NoteFormat::PlainText);
        assert_eq!(deserialized.nickname, Some("Test Note".to_string()));
        assert_eq!(deserialized.path, "/test");
        assert!(deserialized.is_favorite);
    }

    #[test]
    fn test_note_format_serialization() {
        // Test PlainText format
        let plaintext = NoteFormat::PlainText;
        let json = serde_json::to_string(&plaintext).unwrap();
        assert_eq!(json, "\"plaintext\"");

        let deserialized: NoteFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, NoteFormat::PlainText);

        // Test Markdown format
        let markdown = NoteFormat::Markdown;
        let json = serde_json::to_string(&markdown).unwrap();
        assert_eq!(json, "\"markdown\"");

        let deserialized: NoteFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, NoteFormat::Markdown);
    }

    #[test]
    fn test_note_format_default() {
        let default_format = NoteFormat::default();
        assert_eq!(default_format, NoteFormat::PlainText);
    }

    #[test]
    fn test_note_format_equality() {
        assert_eq!(NoteFormat::PlainText, NoteFormat::PlainText);
        assert_eq!(NoteFormat::Markdown, NoteFormat::Markdown);
        assert_ne!(NoteFormat::PlainText, NoteFormat::Markdown);
    }

    #[test]
    fn test_note_format_clone() {
        let format = NoteFormat::Markdown;
        let cloned = format.clone();
        assert_eq!(format, cloned);
    }

    #[test]
    fn test_note_format_debug() {
        let plaintext = NoteFormat::PlainText;
        let debug_str = format!("{:?}", plaintext);
        assert!(debug_str.contains("PlainText"));

        let markdown = NoteFormat::Markdown;
        let debug_str = format!("{:?}", markdown);
        assert!(debug_str.contains("Markdown"));
    }

    #[test]
    fn test_note_clone() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let cloned = note.clone();
        assert_eq!(note.id, cloned.id);
        assert_eq!(note.content, cloned.content);
        assert_eq!(note.format, cloned.format);
        assert_eq!(note.nickname, cloned.nickname);
        assert_eq!(note.path, cloned.path);
        assert_eq!(note.is_favorite, cloned.is_favorite);
        assert_eq!(note.created_at, cloned.created_at);
        assert_eq!(note.updated_at, cloned.updated_at);
    }

    #[test]
    fn test_note_debug() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: Some("Test Note".to_string()),
            path: "/test".to_string(),
            is_favorite: true,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let debug_str = format!("{:?}", note);
        assert!(debug_str.contains("Test content"));
        assert!(debug_str.contains("PlainText"));
        assert!(debug_str.contains("Test Note"));
    }

    #[test]
    fn test_setting_serialization() {
        let setting = Setting {
            key: "test_key".to_string(),
            value: "test_value".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&setting).unwrap();
        assert!(json.contains("test_key"));
        assert!(json.contains("test_value"));

        // Test deserialization
        let deserialized: Setting = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.key, "test_key");
        assert_eq!(deserialized.value, "test_value");
    }

    #[test]
    fn test_setting_clone() {
        let setting = Setting {
            key: "test_key".to_string(),
            value: "test_value".to_string(),
        };

        let cloned = setting.clone();
        assert_eq!(setting.key, cloned.key);
        assert_eq!(setting.value, cloned.value);
    }

    #[test]
    fn test_setting_debug() {
        let setting = Setting {
            key: "test_key".to_string(),
            value: "test_value".to_string(),
        };

        let debug_str = format!("{:?}", setting);
        assert!(debug_str.contains("test_key"));
        assert!(debug_str.contains("test_value"));
    }

    #[test]
    fn test_note_with_none_nickname() {
        let note = Note {
            id: 1,
            content: "Test content".to_string(),
            format: NoteFormat::PlainText,
            nickname: None,
            path: "/test".to_string(),
            is_favorite: false,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        // Test serialization with None nickname
        let json = serde_json::to_string(&note).unwrap();
        assert!(json.contains("null") || json.contains("nickname"));

        // Test deserialization
        let deserialized: Note = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.nickname, None);
    }

    #[test]
    fn test_note_edge_cases() {
        let note = Note {
            id: 0,
            content: "".to_string(),
            format: NoteFormat::Markdown,
            nickname: Some("".to_string()),
            path: "".to_string(),
            is_favorite: false,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        // Should handle empty strings gracefully
        let json = serde_json::to_string(&note).unwrap();
        let deserialized: Note = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, 0);
        assert_eq!(deserialized.content, "");
        assert_eq!(deserialized.nickname, Some("".to_string()));
        assert_eq!(deserialized.path, "");
    }
}