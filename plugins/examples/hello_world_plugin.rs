// Example plugin implementation for the scratch-pad application
// This demonstrates the basic plugin architecture and serves as a template
// for developing custom plugins.

use scratch_pad_lib::error::AppError;
use scratch_pad_lib::models::NoteFormat;
use scratch_pad_lib::plugin::Plugin;

/// Example plugin that demonstrates the plugin architecture
/// This plugin doesn't provide any new functionality but shows
/// how to implement the Plugin trait correctly.
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
        
        println!("🔌 Initializing Hello World Plugin v{}", self.version);
        
        // Perform any initialization logic here
        // For example:
        // - Load configuration files
        // - Initialize external resources
        // - Set up internal state
        
        self.initialized = true;
        println!("✅ Hello World Plugin initialized successfully");
        
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This plugin doesn't provide a new note format
        // If it did, it would return Some(NoteFormat::CustomFormat)
        None
    }
    
    fn description(&self) -> Option<&str> {
        Some("A simple example plugin that demonstrates the plugin architecture")
    }
    
    fn author(&self) -> Option<&str> {
        Some("Scratch Pad Team")
    }
}

impl Default for HelloWorldPlugin {
    fn default() -> Self {
        Self::new()
    }
}

// Example of how to create a plugin that provides a custom note format
// (This would require extending the NoteFormat enum in the main application)
/*
pub struct CustomFormatPlugin {
    name: String,
    version: String,
    initialized: bool,
}

impl CustomFormatPlugin {
    pub fn new() -> Self {
        Self {
            name: "Custom Format Plugin".to_string(),
            version: "1.0.0".to_string(),
            initialized: false,
        }
    }
}

impl Plugin for CustomFormatPlugin {
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
        
        println!("🔌 Initializing Custom Format Plugin v{}", self.version);
        
        // Initialize custom format handling
        self.initialized = true;
        
        Ok(())
    }
    
    fn register_note_format(&self) -> Option<NoteFormat> {
        // This would return a custom format if the enum was extended
        // Some(NoteFormat::Custom("json".to_string()))
        None
    }
    
    fn description(&self) -> Option<&str> {
        Some("Provides support for custom note formats")
    }
    
    fn author(&self) -> Option<&str> {
        Some("Community Developer")
    }
}
*/

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hello_world_plugin_creation() {
        let plugin = HelloWorldPlugin::new();
        assert_eq!(plugin.name(), "Hello World Plugin");
        assert_eq!(plugin.version(), "1.0.0");
        assert!(!plugin.initialized);
    }
    
    #[test]
    fn test_hello_world_plugin_initialization() {
        let mut plugin = HelloWorldPlugin::new();
        assert!(plugin.initialize().is_ok());
        assert!(plugin.initialized);
        
        // Test that multiple initializations are safe
        assert!(plugin.initialize().is_ok());
    }
    
    #[test]
    fn test_hello_world_plugin_metadata() {
        let plugin = HelloWorldPlugin::new();
        assert!(plugin.description().is_some());
        assert!(plugin.author().is_some());
        assert!(plugin.register_note_format().is_none());
    }
}