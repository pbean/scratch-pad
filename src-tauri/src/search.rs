use crate::database::DbService;
use crate::error::AppError;
use crate::models::{Note, NoteFormat};
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use rusqlite::params;
use std::sync::Arc;

pub struct SearchService {
    db_service: Arc<DbService>,
    fuzzy_matcher: SkimMatcherV2,
}

impl SearchService {
    /// Create a new SearchService
    pub fn new(db_service: Arc<DbService>) -> Self {
        Self {
            db_service,
            fuzzy_matcher: SkimMatcherV2::default(),
        }
    }

    /// Perform full-text search using FTS5
    pub async fn search_notes(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            return self.db_service.get_all_notes().await;
        }

        let conn = self.db_service.get_connection()?;
        
        // Use FTS5 for full-text search across content, nickname, and path
        let mut stmt = conn.prepare(
            "SELECT n.id, n.content, n.format, n.nickname, n.path, n.is_favorite, n.created_at, n.updated_at
             FROM notes n
             JOIN notes_fts fts ON n.id = fts.rowid
             WHERE notes_fts MATCH ?1
             ORDER BY rank"
        )?;

        // Escape special FTS5 characters and prepare query
        let fts_query = self.prepare_fts_query(query);
        
        let note_iter = stmt.query_map(params![fts_query], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in note_iter {
            notes.push(note?);
        }

        Ok(notes)
    }

    /// Perform fuzzy search across all notes
    pub async fn fuzzy_search(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            return self.db_service.get_all_notes().await;
        }

        // Get all notes first
        let all_notes = self.db_service.get_all_notes().await?;
        
        // Score each note using fuzzy matching
        let mut scored_notes: Vec<(Note, i64)> = Vec::new();
        
        for note in all_notes {
            let mut best_score = 0i64;
            
            // Check content
            if let Some(score) = self.fuzzy_matcher.fuzzy_match(&note.content, query) {
                best_score = best_score.max(score);
            }
            
            // Check nickname if it exists
            if let Some(nickname) = &note.nickname {
                if let Some(score) = self.fuzzy_matcher.fuzzy_match(nickname, query) {
                    best_score = best_score.max(score);
                }
            }
            
            // Check path
            if let Some(score) = self.fuzzy_matcher.fuzzy_match(&note.path, query) {
                best_score = best_score.max(score);
            }
            
            // Only include notes with a positive score
            if best_score > 0 {
                scored_notes.push((note, best_score));
            }
        }
        
        // Sort by score (highest first)
        scored_notes.sort_by(|a, b| b.1.cmp(&a.1));
        
        // Extract just the notes
        Ok(scored_notes.into_iter().map(|(note, _)| note).collect())
    }

    /// Combined search that uses both FTS5 and fuzzy matching
    pub async fn combined_search(&self, query: &str) -> Result<Vec<Note>, AppError> {
        if query.trim().is_empty() {
            return self.db_service.get_all_notes().await;
        }

        // First try FTS5 search for exact matches
        let fts_results = self.search_notes(query).await?;
        
        // If FTS5 returns good results, use those
        if !fts_results.is_empty() {
            return Ok(fts_results);
        }
        
        // Otherwise, fall back to fuzzy search
        self.fuzzy_search(query).await
    }

    /// Search notes by path pattern
    pub async fn search_by_path(&self, path_pattern: &str) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let mut stmt = conn.prepare(
            "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
             FROM notes 
             WHERE path LIKE ?1 
             ORDER BY updated_at DESC"
        )?;

        let pattern = format!("%{}%", path_pattern);
        
        let note_iter = stmt.query_map(params![pattern], |row| {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in note_iter {
            notes.push(note?);
        }

        Ok(notes)
    }

    /// Search favorite notes
    pub async fn search_favorites(&self, query: Option<&str>) -> Result<Vec<Note>, AppError> {
        let conn = self.db_service.get_connection()?;
        
        let (sql, params): (String, Vec<String>) = match query {
            Some(q) if !q.trim().is_empty() => {
                let fts_query = self.prepare_fts_query(q);
                (
                    "SELECT n.id, n.content, n.format, n.nickname, n.path, n.is_favorite, n.created_at, n.updated_at
                     FROM notes n
                     JOIN notes_fts fts ON n.id = fts.rowid
                     WHERE n.is_favorite = 1 AND notes_fts MATCH ?1
                     ORDER BY rank".to_string(),
                    vec![fts_query]
                )
            }
            _ => (
                "SELECT id, content, format, nickname, path, is_favorite, created_at, updated_at 
                 FROM notes 
                 WHERE is_favorite = 1 
                 ORDER BY updated_at DESC".to_string(),
                vec![]
            )
        };

        let mut stmt = conn.prepare(&sql)?;
        
        // Helper closure to map rows to Note structs
        let map_row = |row: &rusqlite::Row| -> Result<Note, rusqlite::Error> {
            let format_str: String = row.get(2)?;
            let format = match format_str.as_str() {
                "markdown" => NoteFormat::Markdown,
                _ => NoteFormat::PlainText,
            };

            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                format,
                nickname: row.get(3)?,
                path: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        };

        let note_iter = if params.is_empty() {
            stmt.query_map([], map_row)?
        } else {
            stmt.query_map(params![params[0]], map_row)?
        };

        let mut notes = Vec::new();
        for note in note_iter {
            notes.push(note?);
        }

        Ok(notes)
    }

    /// Get search suggestions based on partial query
    pub async fn get_search_suggestions(&self, partial_query: &str, limit: usize) -> Result<Vec<String>, AppError> {
        if partial_query.trim().is_empty() {
            return Ok(vec![]);
        }

        let conn = self.db_service.get_connection()?;
        
        // Get unique terms from content, nickname, and path that start with the partial query
        let mut suggestions = Vec::new();
        
        // Search in nicknames
        let mut stmt = conn.prepare(
            "SELECT DISTINCT nickname FROM notes 
             WHERE nickname IS NOT NULL AND nickname LIKE ?1 
             ORDER BY nickname 
             LIMIT ?2"
        )?;
        
        let pattern = format!("{}%", partial_query);
        let nickname_iter = stmt.query_map(params![pattern, limit], |row| {
            Ok(row.get::<_, String>(0)?)
        })?;
        
        for nickname in nickname_iter {
            suggestions.push(nickname?);
        }
        
        // Search in paths if we haven't reached the limit
        if suggestions.len() < limit {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT path FROM notes 
                 WHERE path LIKE ?1 
                 ORDER BY path 
                 LIMIT ?2"
            )?;
            
            let remaining_limit = limit - suggestions.len();
            let path_iter = stmt.query_map(params![pattern, remaining_limit], |row| {
                Ok(row.get::<_, String>(0)?)
            })?;
            
            for path in path_iter {
                let path_str = path?;
                if !suggestions.contains(&path_str) {
                    suggestions.push(path_str);
                }
            }
        }
        
        Ok(suggestions)
    }

    /// Prepare FTS5 query by escaping special characters
    fn prepare_fts_query(&self, query: &str) -> String {
        // Escape FTS5 special characters: " * ( ) [ ] { } ^ ~ \
        let escaped = query
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('*', "\\*")
            .replace('(', "\\(")
            .replace(')', "\\)")
            .replace('[', "\\[")
            .replace(']', "\\]")
            .replace('{', "\\{")
            .replace('}', "\\}")
            .replace('^', "\\^")
            .replace('~', "\\~");
        
        // Split into words and join with OR for better matching
        let words: Vec<&str> = escaped.split_whitespace().collect();
        if words.len() > 1 {
            format!("({})", words.join(" OR "))
        } else {
            escaped
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbService;
    use tempfile::tempdir;

    async fn setup_test_db() -> (Arc<DbService>, SearchService) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db_service = Arc::new(DbService::new(&db_path).unwrap());
        let search_service = SearchService::new(db_service.clone());
        
        // Create some test notes
        search_service.db_service.create_note("This is a test note about Rust programming".to_string()).await.unwrap();
        
        let mut note2 = search_service.db_service.create_note("JavaScript development tips".to_string()).await.unwrap();
        note2.nickname = Some("JS Tips".to_string());
        note2.path = "/programming/javascript".to_string();
        search_service.db_service.update_note(note2).await.unwrap();
        
        let mut note3 = search_service.db_service.create_note("Database design patterns".to_string()).await.unwrap();
        note3.path = "/database/design".to_string();
        note3.is_favorite = true;
        search_service.db_service.update_note(note3).await.unwrap();
        
        (db_service, search_service)
    }

    #[tokio::test]
    async fn test_fts_search() {
        let (_db, search_service) = setup_test_db().await;
        
        // Search for "Rust"
        let results = search_service.search_notes("Rust").await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Rust"));
        
        // Search for "programming"
        let results = search_service.search_notes("programming").await.unwrap();
        assert_eq!(results.len(), 2); // Should match both Rust and JavaScript notes
        
        // Empty query should return all notes
        let results = search_service.search_notes("").await.unwrap();
        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn test_fuzzy_search() {
        let (_db, search_service) = setup_test_db().await;
        
        // Fuzzy search for "Rst" (missing 'u')
        let results = search_service.fuzzy_search("Rst").await.unwrap();
        assert!(!results.is_empty());
        
        // Fuzzy search for "JS" should match nickname
        let results = search_service.fuzzy_search("JS").await.unwrap();
        assert!(!results.is_empty());
        
        // Fuzzy search for path
        let results = search_service.fuzzy_search("javascript").await.unwrap();
        assert!(!results.is_empty());
    }

    #[tokio::test]
    async fn test_combined_search() {
        let (_db, search_service) = setup_test_db().await;
        
        // Exact match should use FTS5
        let results = search_service.combined_search("Rust").await.unwrap();
        assert!(!results.is_empty());
        
        // Fuzzy match should fall back to fuzzy search
        let results = search_service.combined_search("Rst").await.unwrap();
        assert!(!results.is_empty());
    }

    #[tokio::test]
    async fn test_search_by_path() {
        let (_db, search_service) = setup_test_db().await;
        
        // Search for notes in programming path
        let results = search_service.search_by_path("programming").await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].path.contains("programming"));
        
        // Search for database path
        let results = search_service.search_by_path("database").await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].path.contains("database"));
    }

    #[tokio::test]
    async fn test_search_favorites() {
        let (_db, search_service) = setup_test_db().await;
        
        // Search all favorites
        let results = search_service.search_favorites(None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].is_favorite);
        
        // Search favorites with query
        let results = search_service.search_favorites(Some("database")).await.unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].content.contains("Database"));
        assert!(results[0].is_favorite);
        
        // Search favorites with non-matching query
        let results = search_service.search_favorites(Some("nonexistent")).await.unwrap();
        assert_eq!(results.len(), 0);
    }

    #[tokio::test]
    async fn test_search_suggestions() {
        let (_db, search_service) = setup_test_db().await;
        
        // Get suggestions for "J"
        let suggestions = search_service.get_search_suggestions("J", 5).await.unwrap();
        assert!(suggestions.contains(&"JS Tips".to_string()));
        
        // Get suggestions for "/p"
        let suggestions = search_service.get_search_suggestions("/p", 5).await.unwrap();
        assert!(suggestions.iter().any(|s| s.contains("programming")));
    }

    #[tokio::test]
    async fn test_fts_query_escaping() {
        let (_db, search_service) = setup_test_db().await;
        
        // Test that special characters are properly escaped
        let escaped = search_service.prepare_fts_query("test\"query*with(special)chars");
        assert!(escaped.contains("\\\""));
        assert!(escaped.contains("\\*"));
        assert!(escaped.contains("\\("));
        assert!(escaped.contains("\\)"));
        
        // Test multi-word query
        let escaped = search_service.prepare_fts_query("multiple words query");
        assert!(escaped.contains(" OR "));
    }
}