use crate::error::AppError;
use crate::models::NoteFormat;
use crate::validation::OperationCapability;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Plugin manifest defining security capabilities and metadata
#[derive(Debug, Clone)]
pub struct PluginManifest {
    /// Plugin name
    pub name: String,
    /// Plugin version
    pub version: String,
    /// Plugin description
    pub description: Option<String>,
    /// Plugin author
    pub author: Option<String>,
    /// Required capabilities for this plugin
    pub required_capabilities: Vec<OperationCapability>,
    /// Maximum operations per minute for this plugin
    pub max_operations_per_minute: u32,
    /// Minimum application version required
    pub min_app_version: String,
}

impl PluginManifest {
    /// Create a new plugin manifest with default security settings
    pub fn new(name: String, version: String) -> Self {
        Self {
            name,
            version,
            description: None,
            author: None,
            required_capabilities: vec![
                OperationCapability::ReadNotes,
            ], // Conservative default
            max_operations_per_minute: 30, // Reasonable default
            min_app_version: "0.1.0".to_string(),
        }
    }
    
    /// Validate that a plugin operation is allowed based on its manifest
    pub fn validate_operation(&self, capability: &OperationCapability) -> Result<(), AppError> {
        if !self.required_capabilities.contains(capability) {
            return Err(AppError::Plugin {
                message: format!(
                    "Plugin '{}' does not have {} capability",
                    self.name,
                    capability_to_string(capability)
                ),
            });
        }
        Ok(())
    }
}

/// Convert capability enum to string for error messages
fn capability_to_string(capability: &OperationCapability) -> &'static str {
    match capability {
        OperationCapability::ReadNotes => "ReadNotes",
        OperationCapability::WriteNotes => "WriteNotes",
        OperationCapability::DeleteNotes => "DeleteNotes",
        OperationCapability::SystemAccess => "SystemAccess",
        OperationCapability::FileExport => "FileExport",
        OperationCapability::Search => "Search",
        OperationCapability::PluginManagement => "PluginManagement",
    }
}

/// Plugin trait that all plugins must implement
/// Provides the core interface for plugin functionality with security manifest
pub trait Plugin: Send + Sync {
    /// Returns the plugin manifest containing security capabilities
    fn manifest(&self) -> &PluginManifest;
    
    /// Initialize the plugin - called when the plugin is loaded
    fn initialize(&mut self) -> Result<(), AppError>;
    
    /// Register a new note format if the plugin provides one
    /// Returns None if the plugin doesn't provide a note format
    fn register_note_format(&self) -> Option<NoteFormat>;
    
    /// Validate that this plugin can perform an operation
    fn validate_operation(&self, capability: &OperationCapability) -> Result<(), AppError> {
        self.manifest().validate_operation(capability)
    }
    
    /// Convenience method to get plugin name from manifest
    fn name(&self) -> &str {
        &self.manifest().name
    }
    
    /// Convenience method to get plugin version from manifest
    fn version(&self) -> &str {
        &self.manifest().version
    }
    
    /// Convenience method to get plugin description from manifest
    fn description(&self) -> Option<&str> {
        self.manifest().description.as_deref()
    }
    
    /// Convenience method to get plugin author from manifest
    fn author(&self) -> Option<&str> {
        self.manifest().author.as_deref()
    }
}

/// Manages all loaded plugins in the application with security validation
pub struct PluginManager {
    plugins: Vec<Box<dyn Plugin>>,
    note_formats: HashMap<String, NoteFormat>,
    /// Plugin operation frequency tracking
    operation_counts: HashMap<String, Vec<std::time::Instant>>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
            note_formats: HashMap::new(),
            operation_counts: HashMap::new(),
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
    
    /// Validate that a plugin can perform an operation with frequency control
    pub fn validate_plugin_operation(
        &mut self,
        plugin_name: &str,
        capability: OperationCapability,
    ) -> Result<(), AppError> {
        // First validate capability (immutable borrow)
        {
            let plugin = self.plugins.iter()
                .find(|p| p.name() == plugin_name)
                .ok_or_else(|| AppError::Plugin {
                    message: format!("Plugin '{}' not found", plugin_name),
                })?;
                
            plugin.validate_operation(&capability)?;
        }
        
        // Then check frequency limits (mutable borrow after immutable borrow ends)
        self.check_plugin_frequency_by_name(plugin_name)?;
        
        Ok(())
    }
    
    /// Check plugin operation frequency limits by plugin name
    fn check_plugin_frequency_by_name(&mut self, plugin_name: &str) -> Result<(), AppError> {
        let now = std::time::Instant::now();
        let window_start = now - std::time::Duration::from_secs(60); // 1-minute window
        
        // Get the plugin's limit
        let limit = self.plugins.iter()
            .find(|p| p.name() == plugin_name)
            .map(|p| p.manifest().max_operations_per_minute)
            .ok_or_else(|| AppError::Plugin {
                message: format!("Plugin '{}' not found", plugin_name),
            })?;
        
        // Get or create frequency tracking for this plugin
        let timestamps = self.operation_counts.entry(plugin_name.to_string()).or_insert_with(Vec::new);
        
        // Remove old timestamps
        timestamps.retain(|&timestamp| timestamp > window_start);
        
        // Check against plugin's limit
        if timestamps.len() >= limit as usize {
            return Err(AppError::Plugin {
                message: format!(
                    "Plugin '{}' exceeded operation frequency limit: {} operations per minute",
                    plugin_name, limit
                ),
            });
        }
        
        // Record this operation
        timestamps.push(now);
        
        Ok(())
    }
    
    /// Get plugin by name for capability checks
    pub fn get_plugin(&self, name: &str) -> Option<&Box<dyn Plugin>> {
        self.plugins.iter().find(|p| p.name() == name)
    }
    
    /// Get all plugin manifests for security auditing
    pub fn get_plugin_manifests(&self) -> Vec<&PluginManifest> {
        self.plugins.iter().map(|p| p.manifest()).collect()
    }

    /// Gracefully shutdown all plugins
    pub async fn shutdown(&mut self) -> Result<(), AppError> {
        println!("Shutting down {} plugins...", self.plugins.len());
        
        // Clear plugin resources
        self.plugins.clear();
        self.note_formats.clear();
        self.operation_counts.clear();
        
        println!("Plugin shutdown completed successfully");
        Ok(())
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
    manifest: PluginManifest,
    initialized: bool,
}

impl HelloWorldPlugin {
    pub fn new() -> Self {
        let mut manifest = PluginManifest::new(
            "Hello World Plugin".to_string(),
            "1.0.0".to_string(),
        );
        manifest.description = Some("A simple example plugin that demonstrates the plugin architecture".to_string());
        manifest.author = Some("Scratch Pad Team".to_string());
        manifest.max_operations_per_minute = 60; // Higher limit for example plugin
        
        Self {
            manifest,
            initialized: false,
        }
    }
}

impl Plugin for HelloWorldPlugin {
    fn manifest(&self) -> &PluginManifest {
        &self.manifest
    }
    
    fn initialize(&mut self) -> Result<(), AppError> {
        if self.initialized {
            return Ok(());
        }
        
        println!("Initializing Hello World Plugin v{}", self.version());
        self.initialized = true;
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This plugin doesn't provide a new note format
        None
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
    
    // Plugin Security Tests - Day 2 Implementation
    
    #[test]
    fn test_plugin_manifest_creation() {
        let manifest = PluginManifest::new(
            "Test Plugin".to_string(),
            "1.0.0".to_string()
        );
        
        assert_eq!(manifest.name, "Test Plugin");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.max_operations_per_minute, 30);
        assert!(manifest.required_capabilities.contains(&OperationCapability::ReadNotes));
    }
    
    #[test]
    fn test_plugin_capability_validation() {
        let mut manifest = PluginManifest::new(
            "Test Plugin".to_string(),
            "1.0.0".to_string()
        );
        
        // Allow WriteNotes capability
        manifest.required_capabilities.push(OperationCapability::WriteNotes);
        
        // Should allow ReadNotes (default capability)
        assert!(manifest.validate_operation(&OperationCapability::ReadNotes).is_ok());
        
        // Should allow WriteNotes (explicitly added)
        assert!(manifest.validate_operation(&OperationCapability::WriteNotes).is_ok());
        
        // Should reject DeleteNotes (not in manifest)
        assert!(manifest.validate_operation(&OperationCapability::DeleteNotes).is_err());
    }
    
    #[test]
    fn test_plugin_frequency_validation() {
        let mut manager = PluginManager::new();
        let plugin = Box::new(HelloWorldPlugin::new());
        let plugin_name = plugin.name().to_string();
        
        // Register the plugin
        assert!(manager.register_plugin(plugin).is_ok());
        
        // Test frequency limits (HelloWorld plugin has 60 ops/minute limit)
        for i in 0..30 {
            let result = manager.validate_plugin_operation(&plugin_name, OperationCapability::ReadNotes);
            assert!(result.is_ok(), "Operation {} should succeed", i);
        }
    }
    
    #[test]
    fn test_plugin_security_integration() {
        let mut manager = PluginManager::new();
        let plugin = Box::new(HelloWorldPlugin::new());
        
        // Verify plugin uses new manifest system
        assert!(plugin.manifest().required_capabilities.contains(&OperationCapability::ReadNotes));
        assert_eq!(plugin.manifest().max_operations_per_minute, 60);
        
        // Register and validate
        assert!(manager.register_plugin(plugin).is_ok());
        assert_eq!(manager.plugin_count(), 1);
        
        // Get plugin manifests for security auditing
        let manifests = manager.get_plugin_manifests();
        assert_eq!(manifests.len(), 1);
        assert_eq!(manifests[0].name, "Hello World Plugin");
    }
    
    #[test]
    fn test_plugin_not_found_error() {
        let mut manager = PluginManager::new();
        
        let result = manager.validate_plugin_operation(
            "NonExistentPlugin", 
            OperationCapability::ReadNotes
        );
        
        assert!(result.is_err());
        if let Err(AppError::Plugin { message }) = result {
            assert!(message.contains("not found"));
        } else {
            panic!("Expected Plugin error");
        }
    }

    #[tokio::test]
    async fn test_plugin_shutdown() {
        let mut manager = PluginManager::new();
        let plugin = Box::new(HelloWorldPlugin::new());
        
        assert!(manager.register_plugin(plugin).is_ok());
        assert_eq!(manager.plugin_count(), 1);
        
        // Test shutdown
        assert!(manager.shutdown().await.is_ok());
        assert_eq!(manager.plugin_count(), 0);
        assert!(manager.get_note_formats().is_empty());
    }
}