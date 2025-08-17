use crate::error::AppError;
use crate::models::NoteFormat;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Plugin trait that all plugins must implement
/// Provides the core interface for plugin functionality
pub trait Plugin: Send + Sync {
    /// Returns the name of the plugin
    fn name(&self) -> &str;
    
    /// Returns the version of the plugin
    fn version(&self) -> &str;
    
    /// Initialize the plugin - called when the plugin is loaded
    fn initialize(&mut self) -> Result<(), AppError>;
    
    /// Register a new note format if the plugin provides one
    /// Returns None if the plugin doesn't provide a note format
    fn register_note_format(&self) -> Option<NoteFormat>;
    
    /// Optional: Get plugin description
    fn description(&self) -> Option<&str> {
        None
    }
    
    /// Optional: Get plugin author
    fn author(&self) -> Option<&str> {
        None
    }
}

/// Manages all loaded plugins in the application
pub struct PluginManager {
    plugins: Vec<Box<dyn Plugin>>,
    note_formats: HashMap<String, NoteFormat>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
            note_formats: HashMap::new(),
        }
    }
    
    /// Load plugins from the specified directory
    /// Currently this is a foundation implementation that will be extended
    /// when dynamic plugin loading is implemented
    pub fn load_plugins(&mut self, plugin_dir: &Path) -> Result<(), AppError> {
        // Check if plugin directory exists
        if !plugin_dir.exists() {
            // Create the plugin directory if it doesn't exist
            fs::create_dir_all(plugin_dir).map_err(|e| AppError::Plugin {
                message: format!("Failed to create plugin directory: {}", e),
            })?;
            
            // Create a README file in the plugin directory
            let readme_path = plugin_dir.join("README.md");
            let readme_content = r#"# Plugins Directory

This directory is for scratch-pad plugins.

## Plugin Development

Plugins extend the functionality of scratch-pad by providing:
- New note formats
- Additional processing capabilities
- Custom integrations

See the documentation for plugin development guidelines.

## Example Plugins

Check the `examples/` subdirectory for sample plugin implementations.
"#;
            fs::write(readme_path, readme_content).map_err(|e| AppError::Plugin {
                message: format!("Failed to create plugin README: {}", e),
            })?;
        }
        
        // For now, we'll register built-in plugins
        // Future versions will scan the directory for dynamic plugins
        self.register_builtin_plugins()?;
        
        Ok(())
    }
    
    /// Register a plugin with the manager
    pub fn register_plugin(&mut self, mut plugin: Box<dyn Plugin>) -> Result<(), AppError> {
        // Initialize the plugin
        plugin.initialize()?;
        
        // Register note format if provided
        if let Some(format) = plugin.register_note_format() {
            let format_name = match format {
                NoteFormat::PlainText => "plaintext".to_string(),
                NoteFormat::Markdown => "markdown".to_string(),
            };
            self.note_formats.insert(format_name, format);
        }
        
        // Store the plugin
        self.plugins.push(plugin);
        
        Ok(())
    }
    
    /// Get all available note formats from plugins
    pub fn get_note_formats(&self) -> Vec<NoteFormat> {
        self.note_formats.values().cloned().collect()
    }
    
    /// Get all loaded plugins
    pub fn get_plugins(&self) -> &[Box<dyn Plugin>] {
        &self.plugins
    }
    
    /// Get plugin count
    pub fn plugin_count(&self) -> usize {
        self.plugins.len()
    }
    
    /// Register built-in plugins
    fn register_builtin_plugins(&mut self) -> Result<(), AppError> {
        // Register the hello world example plugin
        let hello_plugin = Box::new(HelloWorldPlugin::new());
        self.register_plugin(hello_plugin)?;
        
        Ok(())
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Example "Hello World" plugin to validate the plugin architecture
pub struct HelloWorldPlugin {
    name: String,
    version: String,
    initialized: bool,
}

impl HelloWorldPlugin {
    pub fn new() -> Self {
        Self {
            name: "Hello World Plugin".to_string(),
            version: "1.0.0".to_string(),
            initialized: false,
        }
    }
}

impl Plugin for HelloWorldPlugin {
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
        
        println!("Initializing Hello World Plugin v{}", self.version);
        self.initialized = true;
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This plugin doesn't provide a new note format
        None
    }
    
    fn description(&self) -> Option<&str> {
        Some("A simple example plugin that demonstrates the plugin architecture")
    }
    
    fn author(&self) -> Option<&str> {
        Some("Scratch Pad Team")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_plugin_manager_creation() {
        let manager = PluginManager::new();
        assert_eq!(manager.plugin_count(), 0);
        assert!(manager.get_note_formats().is_empty());
    }
    
    #[test]
    fn test_hello_world_plugin() {
        let mut plugin = HelloWorldPlugin::new();
        assert_eq!(plugin.name(), "Hello World Plugin");
        assert_eq!(plugin.version(), "1.0.0");
        assert!(plugin.description().is_some());
        assert!(plugin.author().is_some());
        
        // Test initialization
        assert!(plugin.initialize().is_ok());
        
        // Test that it doesn't provide a note format
        assert!(plugin.register_note_format().is_none());
    }
    
    #[test]
    fn test_plugin_registration() {
        let mut manager = PluginManager::new();
        let plugin = Box::new(HelloWorldPlugin::new());
        
        assert!(manager.register_plugin(plugin).is_ok());
        assert_eq!(manager.plugin_count(), 1);
    }
    
    #[test]
    fn test_load_plugins_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let plugin_dir = temp_dir.path().join("plugins");
        
        let mut manager = PluginManager::new();
        assert!(manager.load_plugins(&plugin_dir).is_ok());
        
        // Check that directory was created
        assert!(plugin_dir.exists());
        
        // Check that README was created
        let readme_path = plugin_dir.join("README.md");
        assert!(readme_path.exists());
        
        // Check that built-in plugins were loaded
        assert!(manager.plugin_count() > 0);
    }
    
    #[test]
    fn test_load_plugins_existing_directory() {
        let temp_dir = TempDir::new().unwrap();
        let plugin_dir = temp_dir.path().join("plugins");
        
        // Create directory first
        fs::create_dir_all(&plugin_dir).unwrap();
        
        let mut manager = PluginManager::new();
        assert!(manager.load_plugins(&plugin_dir).is_ok());
        
        // Should still load built-in plugins
        assert!(manager.plugin_count() > 0);
    }
}