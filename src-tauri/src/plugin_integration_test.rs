#[cfg(test)]
mod plugin_integration_tests {
    use crate::plugin::{Plugin, PluginManager, HelloWorldPlugin};
    use std::sync::Arc;
    use tokio::sync::Mutex;
    
    #[tokio::test]
    async fn test_plugin_manager_integration() {
        let mut plugin_manager = PluginManager::new();
        
        // Test loading plugins
        let plugin_dir = std::env::temp_dir().join("test_plugins");
        assert!(plugin_manager.load_plugins(&plugin_dir).is_ok());
        
        // Should have at least the hello world plugin
        assert!(plugin_manager.plugin_count() > 0);
        
        // Test getting plugin info (simulating IPC command)
        let plugins = plugin_manager.get_plugins();
        assert!(!plugins.is_empty());
        
        let first_plugin = &plugins[0];
        assert_eq!(first_plugin.name(), "Hello World Plugin");
        assert_eq!(first_plugin.version(), "1.0.0");
        assert!(first_plugin.description().is_some());
        assert!(first_plugin.author().is_some());
    }
    
    #[tokio::test]
    async fn test_plugin_manager_with_mutex() {
        // Test the plugin manager wrapped in Arc<Mutex<>> as used in AppState
        let plugin_manager = Arc::new(Mutex::new(PluginManager::new()));
        
        {
            let mut manager = plugin_manager.lock().await;
            let plugin_dir = std::env::temp_dir().join("test_plugins_mutex");
            assert!(manager.load_plugins(&plugin_dir).is_ok());
        }
        
        // Test accessing plugin info through the mutex
        {
            let manager = plugin_manager.lock().await;
            assert!(manager.plugin_count() > 0);
            
            let formats = manager.get_note_formats();
            // Hello world plugin doesn't provide formats, so this might be empty
            // but the call should succeed
            let _format_count = formats.len();
        }
    }
    
    #[test]
    fn test_hello_world_plugin_standalone() {
        let mut plugin = HelloWorldPlugin::new();
        
        // Test all the methods that would be called by the plugin manager
        assert_eq!(plugin.name(), "Hello World Plugin");
        assert_eq!(plugin.version(), "1.0.0");
        assert!(plugin.description().is_some());
        assert!(plugin.author().is_some());
        
        // Test initialization
        assert!(plugin.initialize().is_ok());
        
        // Test that it doesn't provide a note format
        assert!(plugin.register_note_format().is_none());
    }
}