// Markdown Enhancer Plugin - Demonstrates a plugin that enhances note format support
// This plugin provides enhanced markdown processing capabilities and registers
// support for the Markdown note format.

use scratch_pad_lib::error::AppError;
use scratch_pad_lib::models::NoteFormat;
use scratch_pad_lib::plugin::Plugin;
use std::collections::HashMap;

/// Markdown enhancer plugin that provides advanced markdown processing
/// This demonstrates how to create a plugin that enhances support for
/// an existing note format.
pub struct MarkdownEnhancerPlugin {
    name: String,
    version: String,
    initialized: bool,
    syntax_rules: HashMap<String, SyntaxRule>,
    extensions_enabled: Vec<MarkdownExtension>,
}

#[derive(Debug, Clone)]
struct SyntaxRule {
    pattern: String,
    replacement: String,
    description: String,
}

#[derive(Debug, Clone)]
enum MarkdownExtension {
    Tables,
    TaskLists,
    Strikethrough,
    Footnotes,
    MathExpressions,
    CodeHighlighting,
    Emoji,
}

impl MarkdownEnhancerPlugin {
    pub fn new() -> Self {
        Self {
            name: "Markdown Enhancer".to_string(),
            version: "1.2.0".to_string(),
            initialized: false,
            syntax_rules: HashMap::new(),
            extensions_enabled: Vec::new(),
        }
    }
    
    /// Initialize markdown syntax rules
    fn initialize_syntax_rules(&mut self) {
        // Basic markdown syntax rules
        self.syntax_rules.insert(
            "bold".to_string(),
            SyntaxRule {
                pattern: r"\*\*(.*?)\*\*".to_string(),
                replacement: "<strong>$1</strong>".to_string(),
                description: "Bold text formatting".to_string(),
            }
        );
        
        self.syntax_rules.insert(
            "italic".to_string(),
            SyntaxRule {
                pattern: r"\*(.*?)\*".to_string(),
                replacement: "<em>$1</em>".to_string(),
                description: "Italic text formatting".to_string(),
            }
        );
        
        self.syntax_rules.insert(
            "code_inline".to_string(),
            SyntaxRule {
                pattern: r"`(.*?)`".to_string(),
                replacement: "<code>$1</code>".to_string(),
                description: "Inline code formatting".to_string(),
            }
        );
        
        self.syntax_rules.insert(
            "strikethrough".to_string(),
            SyntaxRule {
                pattern: r"~~(.*?)~~".to_string(),
                replacement: "<del>$1</del>".to_string(),
                description: "Strikethrough text formatting".to_string(),
            }
        );
        
        // Task list syntax
        self.syntax_rules.insert(
            "task_checked".to_string(),
            SyntaxRule {
                pattern: r"- \[x\] (.*)".to_string(),
                replacement: "☑ $1".to_string(),
                description: "Completed task item".to_string(),
            }
        );
        
        self.syntax_rules.insert(
            "task_unchecked".to_string(),
            SyntaxRule {
                pattern: r"- \[ \] (.*)".to_string(),
                replacement: "☐ $1".to_string(),
                description: "Uncompleted task item".to_string(),
            }
        );
    }
    
    /// Enable markdown extensions
    fn enable_extensions(&mut self) {
        self.extensions_enabled = vec![
            MarkdownExtension::Tables,
            MarkdownExtension::TaskLists,
            MarkdownExtension::Strikethrough,
            MarkdownExtension::CodeHighlighting,
            MarkdownExtension::Emoji,
        ];
    }
    
    /// Process markdown text with enhanced features
    pub fn process_markdown(&self, text: &str) -> ProcessedMarkdown {
        let mut processed_text = text.to_string();
        let mut applied_rules = Vec::new();
        
        // Apply syntax rules (simplified - in real implementation would use proper regex)
        for (rule_name, rule) in &self.syntax_rules {
            if text.contains(&rule.pattern.replace(r"\*\*(.*?)\*\*", "**")) ||
               text.contains(&rule.pattern.replace(r"\*(.*?)\*", "*")) ||
               text.contains(&rule.pattern.replace(r"`(.*?)`", "`")) ||
               text.contains(&rule.pattern.replace(r"~~(.*?)~~", "~~")) ||
               text.contains("- [x]") ||
               text.contains("- [ ]") {
                applied_rules.push(rule_name.clone());
            }
        }
        
        // Analyze markdown structure
        let structure = self.analyze_structure(text);
        
        ProcessedMarkdown {
            original_text: text.to_string(),
            processed_text,
            applied_rules,
            structure,
            extensions_used: self.get_used_extensions(text),
        }
    }
    
    /// Analyze markdown document structure
    fn analyze_structure(&self, text: &str) -> MarkdownStructure {
        let lines: Vec<&str> = text.lines().collect();
        let mut headers = Vec::new();
        let mut code_blocks = 0;
        let mut lists = 0;
        let mut tables = 0;
        let mut links = 0;
        let mut images = 0;
        
        for line in &lines {
            let trimmed = line.trim();
            
            // Count headers
            if trimmed.starts_with('#') {
                let level = trimmed.chars().take_while(|&c| c == '#').count();
                let title = trimmed.trim_start_matches('#').trim().to_string();
                headers.push(MarkdownHeader { level, title });
            }
            
            // Count other elements
            if trimmed.starts_with("```") {
                code_blocks += 1;
            }
            if trimmed.starts_with('-') || trimmed.starts_with('*') || trimmed.starts_with('+') {
                lists += 1;
            }
            if trimmed.contains('|') && trimmed.len() > 3 {
                tables += 1;
            }
            if trimmed.contains("](") {
                links += trimmed.matches("](").count();
            }
            if trimmed.contains("![") {
                images += trimmed.matches("![").count();
            }
        }
        
        MarkdownStructure {
            headers,
            code_blocks: code_blocks / 2, // Pairs of opening/closing
            list_items: lists,
            table_rows: tables,
            links,
            images,
            total_lines: lines.len(),
        }
    }
    
    /// Determine which extensions are used in the text
    fn get_used_extensions(&self, text: &str) -> Vec<MarkdownExtension> {
        let mut used = Vec::new();
        
        if text.contains('|') && text.lines().any(|line| line.matches('|').count() >= 2) {
            used.push(MarkdownExtension::Tables);
        }
        
        if text.contains("- [x]") || text.contains("- [ ]") {
            used.push(MarkdownExtension::TaskLists);
        }
        
        if text.contains("~~") {
            used.push(MarkdownExtension::Strikethrough);
        }
        
        if text.contains("```") {
            used.push(MarkdownExtension::CodeHighlighting);
        }
        
        // Simple emoji detection
        if text.contains(':') && (text.contains(":smile:") || text.contains(":heart:")) {
            used.push(MarkdownExtension::Emoji);
        }
        
        used
    }
    
    /// Get available syntax rules
    pub fn get_syntax_rules(&self) -> &HashMap<String, SyntaxRule> {
        &self.syntax_rules
    }
    
    /// Get enabled extensions
    pub fn get_enabled_extensions(&self) -> &[MarkdownExtension] {
        &self.extensions_enabled
    }
    
    /// Validate markdown syntax
    pub fn validate_markdown(&self, text: &str) -> MarkdownValidation {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        let lines: Vec<&str> = text.lines().collect();
        
        for (line_num, line) in lines.iter().enumerate() {
            // Check for unmatched code blocks
            let backtick_count = line.matches('`').count();
            if backtick_count % 2 != 0 && !line.contains("```") {
                warnings.push(format!("Line {}: Possible unmatched backticks", line_num + 1));
            }
            
            // Check for malformed links
            if line.contains("](") {
                let open_brackets = line.matches('[').count();
                let close_brackets = line.matches(']').count();
                if open_brackets != close_brackets {
                    errors.push(format!("Line {}: Malformed link syntax", line_num + 1));
                }
            }
            
            // Check for empty headers
            if line.trim().starts_with('#') && line.trim().trim_start_matches('#').trim().is_empty() {
                warnings.push(format!("Line {}: Empty header", line_num + 1));
            }
        }
        
        MarkdownValidation {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }
}

#[derive(Debug)]
pub struct ProcessedMarkdown {
    pub original_text: String,
    pub processed_text: String,
    pub applied_rules: Vec<String>,
    pub structure: MarkdownStructure,
    pub extensions_used: Vec<MarkdownExtension>,
}

#[derive(Debug)]
pub struct MarkdownStructure {
    pub headers: Vec<MarkdownHeader>,
    pub code_blocks: usize,
    pub list_items: usize,
    pub table_rows: usize,
    pub links: usize,
    pub images: usize,
    pub total_lines: usize,
}

#[derive(Debug)]
pub struct MarkdownHeader {
    pub level: usize,
    pub title: String,
}

#[derive(Debug)]
pub struct MarkdownValidation {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl Plugin for MarkdownEnhancerPlugin {
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
        
        println!("🔌 Initializing Markdown Enhancer Plugin v{}", self.version);
        
        // Initialize syntax rules and extensions
        self.initialize_syntax_rules();
        self.enable_extensions();
        
        // Validate initialization by testing markdown processing
        let test_markdown = "# Test Header\n\n**Bold text** and *italic text*\n\n- [ ] Task item";
        let processed = self.process_markdown(test_markdown);
        
        if processed.applied_rules.is_empty() {
            return Err(AppError::Plugin {
                message: "Markdown processing validation failed".to_string(),
            });
        }
        
        self.initialized = true;
        println!("✅ Markdown Enhancer Plugin ready with {} syntax rules and {} extensions", 
                 self.syntax_rules.len(), self.extensions_enabled.len());
        
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This plugin enhances markdown support
        Some(NoteFormat::Markdown)
    }
    
    fn description(&self) -> Option<&str> {
        Some("Enhances markdown support with advanced syntax highlighting, extensions, and validation")
    }
    
    fn author(&self) -> Option<&str> {
        Some("Markdown Team <markdown@scratchpad.dev>")
    }
}

impl Default for MarkdownEnhancerPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_markdown_enhancer_creation() {
        let plugin = MarkdownEnhancerPlugin::new();
        assert_eq!(plugin.name(), "Markdown Enhancer");
        assert_eq!(plugin.version(), "1.2.0");
        assert!(!plugin.initialized);
    }
    
    #[test]
    fn test_markdown_enhancer_initialization() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        
        // Test successful initialization
        assert!(plugin.initialize().is_ok());
        assert!(plugin.initialized);
        
        // Check that syntax rules were loaded
        assert!(!plugin.get_syntax_rules().is_empty());
        assert!(!plugin.get_enabled_extensions().is_empty());
        
        // Test that multiple initializations are safe
        assert!(plugin.initialize().is_ok());
    }
    
    #[test]
    fn test_markdown_processing() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        plugin.initialize().unwrap();
        
        let test_markdown = "# Header\n\n**Bold** and *italic* text\n\n- [x] Completed task";
        let processed = plugin.process_markdown(test_markdown);
        
        assert_eq!(processed.original_text, test_markdown);
        assert!(!processed.applied_rules.is_empty());
        assert!(!processed.extensions_used.is_empty());
    }
    
    #[test]
    fn test_structure_analysis() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        plugin.initialize().unwrap();
        
        let test_markdown = r#"# Main Header
## Sub Header
### Sub-sub Header

Some text with **bold** and *italic*.

- List item 1
- List item 2

```rust
let code = "example";
```

[Link](http://example.com)
![Image](image.png)

| Table | Header |
|-------|--------|
| Cell  | Data   |
"#;
        
        let processed = plugin.process_markdown(test_markdown);
        let structure = &processed.structure;
        
        assert_eq!(structure.headers.len(), 3);
        assert_eq!(structure.headers[0].level, 1);
        assert_eq!(structure.headers[0].title, "Main Header");
        assert_eq!(structure.code_blocks, 1);
        assert!(structure.list_items >= 2);
        assert!(structure.links >= 1);
        assert!(structure.images >= 1);
    }
    
    #[test]
    fn test_extension_detection() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        plugin.initialize().unwrap();
        
        let test_markdown = r#"
- [x] Completed task
- [ ] Incomplete task

~~Strikethrough text~~

```rust
code block
```

| Table | Header |
|-------|--------|
| Data  | Value  |
"#;
        
        let processed = plugin.process_markdown(test_markdown);
        let extensions = &processed.extensions_used;
        
        assert!(extensions.iter().any(|ext| matches!(ext, MarkdownExtension::TaskLists)));
        assert!(extensions.iter().any(|ext| matches!(ext, MarkdownExtension::Strikethrough)));
        assert!(extensions.iter().any(|ext| matches!(ext, MarkdownExtension::CodeHighlighting)));
        assert!(extensions.iter().any(|ext| matches!(ext, MarkdownExtension::Tables)));
    }
    
    #[test]
    fn test_markdown_validation() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        plugin.initialize().unwrap();
        
        // Valid markdown
        let valid_markdown = "# Header\n\n**Bold** text and [link](http://example.com)";
        let validation = plugin.validate_markdown(valid_markdown);
        assert!(validation.is_valid);
        assert!(validation.errors.is_empty());
        
        // Invalid markdown with malformed link
        let invalid_markdown = "# Header\n\n[Malformed link(http://example.com)";
        let validation = plugin.validate_markdown(invalid_markdown);
        assert!(!validation.is_valid);
        assert!(!validation.errors.is_empty());
    }
    
    #[test]
    fn test_plugin_metadata() {
        let plugin = MarkdownEnhancerPlugin::new();
        
        assert!(plugin.description().is_some());
        assert!(plugin.author().is_some());
        
        // This plugin should register markdown format
        assert_eq!(plugin.register_note_format(), Some(NoteFormat::Markdown));
    }
    
    #[test]
    fn test_syntax_rules() {
        let mut plugin = MarkdownEnhancerPlugin::new();
        plugin.initialize().unwrap();
        
        let rules = plugin.get_syntax_rules();
        
        // Check that essential rules are present
        assert!(rules.contains_key("bold"));
        assert!(rules.contains_key("italic"));
        assert!(rules.contains_key("code_inline"));
        assert!(rules.contains_key("task_checked"));
        assert!(rules.contains_key("task_unchecked"));
        
        // Check rule structure
        let bold_rule = &rules["bold"];
        assert!(!bold_rule.pattern.is_empty());
        assert!(!bold_rule.replacement.is_empty());
        assert!(!bold_rule.description.is_empty());
    }
}