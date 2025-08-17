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