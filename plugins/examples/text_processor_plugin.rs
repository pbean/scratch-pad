// Text Processor Plugin - Demonstrates a plugin that processes note content
// This plugin provides text analysis and processing capabilities without
// registering a new note format.

use scratch_pad_lib::error::AppError;
use scratch_pad_lib::models::NoteFormat;
use scratch_pad_lib::plugin::Plugin;
use std::collections::HashMap;

/// Text processing plugin that provides various text analysis features
/// This demonstrates how to create a plugin that processes content
/// without providing a new note format.
pub struct TextProcessorPlugin {
    name: String,
    version: String,
    initialized: bool,
    statistics: TextStatistics,
}

#[derive(Debug, Default)]
struct TextStatistics {
    total_words_processed: usize,
    total_characters_processed: usize,
    total_lines_processed: usize,
}

impl TextProcessorPlugin {
    pub fn new() -> Self {
        Self {
            name: "Text Processor".to_string(),
            version: "1.0.0".to_string(),
            initialized: false,
            statistics: TextStatistics::default(),
        }
    }
    
    /// Analyze text and return detailed statistics
    pub fn analyze_text(&mut self, text: &str) -> TextAnalysis {
        let words: Vec<&str> = text.split_whitespace().collect();
        let lines: Vec<&str> = text.lines().collect();
        let characters = text.chars().count();
        
        // Update internal statistics
        self.statistics.total_words_processed += words.len();
        self.statistics.total_characters_processed += characters;
        self.statistics.total_lines_processed += lines.len();
        
        // Calculate word frequency
        let mut word_frequency = HashMap::new();
        for word in &words {
            let word_lower = word.to_lowercase();
            *word_frequency.entry(word_lower).or_insert(0) += 1;
        }
        
        // Find most common words
        let mut word_freq_vec: Vec<_> = word_frequency.iter().collect();
        word_freq_vec.sort_by(|a, b| b.1.cmp(a.1));
        let top_words: Vec<(String, usize)> = word_freq_vec
            .into_iter()
            .take(5)
            .map(|(word, count)| (word.clone(), *count))
            .collect();
        
        TextAnalysis {
            word_count: words.len(),
            character_count: characters,
            line_count: lines.len(),
            paragraph_count: text.split("\n\n").filter(|p| !p.trim().is_empty()).count(),
            average_words_per_line: if lines.len() > 0 { words.len() as f64 / lines.len() as f64 } else { 0.0 },
            top_words,
            reading_time_minutes: (words.len() as f64 / 200.0).ceil() as usize, // Assuming 200 WPM
        }
    }
    
    /// Transform text using various processing methods
    pub fn transform_text(&self, text: &str, transformation: TextTransformation) -> String {
        match transformation {
            TextTransformation::UpperCase => text.to_uppercase(),
            TextTransformation::LowerCase => text.to_lowercase(),
            TextTransformation::TitleCase => {
                text.split_whitespace()
                    .map(|word| {
                        let mut chars = word.chars();
                        match chars.next() {
                            None => String::new(),
                            Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ")
            },
            TextTransformation::RemoveExtraSpaces => {
                text.split_whitespace().collect::<Vec<_>>().join(" ")
            },
            TextTransformation::AddLineNumbers => {
                text.lines()
                    .enumerate()
                    .map(|(i, line)| format!("{:3}: {}", i + 1, line))
                    .collect::<Vec<_>>()
                    .join("\n")
            },
        }
    }
    
    /// Get processing statistics
    pub fn get_statistics(&self) -> &TextStatistics {
        &self.statistics
    }
    
    /// Reset processing statistics
    pub fn reset_statistics(&mut self) {
        self.statistics = TextStatistics::default();
    }
}

#[derive(Debug)]
pub struct TextAnalysis {
    pub word_count: usize,
    pub character_count: usize,
    pub line_count: usize,
    pub paragraph_count: usize,
    pub average_words_per_line: f64,
    pub top_words: Vec<(String, usize)>,
    pub reading_time_minutes: usize,
}

#[derive(Debug, Clone)]
pub enum TextTransformation {
    UpperCase,
    LowerCase,
    TitleCase,
    RemoveExtraSpaces,
    AddLineNumbers,
}

impl Plugin for TextProcessorPlugin {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn version(&self) -> &str {
        &self.version
    }
    
    fn initialize(&mut self) -> Result<(), AppError> {
        if self.initialized {
            return Ok(());
        }
        
        println!("🔌 Initializing Text Processor Plugin v{}", self.version);
        
        // Initialize text processing capabilities
        self.statistics = TextStatistics::default();
        
        // Validate that text processing functions work
        let test_text = "Hello world! This is a test.";
        let analysis = self.analyze_text(test_text);
        
        if analysis.word_count == 0 {
            return Err(AppError::Plugin {
                message: "Text analysis validation failed".to_string(),
            });
        }
        
        self.initialized = true;
        println!("✅ Text Processor Plugin ready for text analysis and processing");
        
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This plugin doesn't provide a new note format
        // It processes existing formats
        None
    }
    
    fn description(&self) -> Option<&str> {
        Some("Provides comprehensive text analysis and processing capabilities for notes")
    }
    
    fn author(&self) -> Option<&str> {
        Some("Scratch Pad Community <community@scratchpad.dev>")
    }
}

impl Default for TextProcessorPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_text_processor_creation() {
        let plugin = TextProcessorPlugin::new();
        assert_eq!(plugin.name(), "Text Processor");
        assert_eq!(plugin.version(), "1.0.0");
        assert!(!plugin.initialized);
    }
    
    #[test]
    fn test_text_processor_initialization() {
        let mut plugin = TextProcessorPlugin::new();
        
        // Test successful initialization
        assert!(plugin.initialize().is_ok());
        assert!(plugin.initialized);
        
        // Test that multiple initializations are safe
        assert!(plugin.initialize().is_ok());
    }
    
    #[test]
    fn test_text_analysis() {
        let mut plugin = TextProcessorPlugin::new();
        plugin.initialize().unwrap();
        
        let test_text = "Hello world! This is a test.\nThis is another line.";
        let analysis = plugin.analyze_text(test_text);
        
        assert_eq!(analysis.word_count, 9);
        assert_eq!(analysis.line_count, 2);
        assert!(analysis.character_count > 0);
        assert!(analysis.reading_time_minutes > 0);
    }
    
    #[test]
    fn test_text_transformations() {
        let plugin = TextProcessorPlugin::new();
        let test_text = "hello world";
        
        assert_eq!(
            plugin.transform_text(test_text, TextTransformation::UpperCase),
            "HELLO WORLD"
        );
        
        assert_eq!(
            plugin.transform_text(test_text, TextTransformation::TitleCase),
            "Hello World"
        );
        
        let spaced_text = "hello    world   test";
        assert_eq!(
            plugin.transform_text(spaced_text, TextTransformation::RemoveExtraSpaces),
            "hello world test"
        );
    }
    
    #[test]
    fn test_statistics_tracking() {
        let mut plugin = TextProcessorPlugin::new();
        plugin.initialize().unwrap();
        
        let initial_stats = plugin.get_statistics();
        assert_eq!(initial_stats.total_words_processed, 0);
        
        plugin.analyze_text("Hello world");
        let updated_stats = plugin.get_statistics();
        assert_eq!(updated_stats.total_words_processed, 2);
        
        plugin.reset_statistics();
        let reset_stats = plugin.get_statistics();
        assert_eq!(reset_stats.total_words_processed, 0);
    }
    
    #[test]
    fn test_plugin_metadata() {
        let plugin = TextProcessorPlugin::new();
        
        assert!(plugin.description().is_some());
        assert!(plugin.author().is_some());
        assert!(plugin.register_note_format().is_none());
    }
    
    #[test]
    fn test_word_frequency_analysis() {
        let mut plugin = TextProcessorPlugin::new();
        plugin.initialize().unwrap();
        
        let test_text = "the quick brown fox jumps over the lazy dog the fox";
        let analysis = plugin.analyze_text(test_text);
        
        // Check that top words are identified
        assert!(!analysis.top_words.is_empty());
        
        // "the" should be the most frequent word (appears 3 times)
        let top_word = &analysis.top_words[0];
        assert_eq!(top_word.0, "the");
        assert_eq!(top_word.1, 3);
    }
    
    #[test]
    fn test_line_numbering() {
        let plugin = TextProcessorPlugin::new();
        let test_text = "Line one\nLine two\nLine three";
        
        let numbered = plugin.transform_text(test_text, TextTransformation::AddLineNumbers);
        let lines: Vec<&str> = numbered.lines().collect();
        
        assert_eq!(lines.len(), 3);
        assert!(lines[0].contains("  1: Line one"));
        assert!(lines[1].contains("  2: Line two"));
        assert!(lines[2].contains("  3: Line three"));
    }
}