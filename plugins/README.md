# Scratch Pad Plugins

This directory contains plugins for the scratch-pad application. Plugins extend the functionality of scratch-pad by providing new note formats, processing capabilities, and integrations.

## Quick Start

- **New to plugin development?** Start with the [Plugin Development Guide](../docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- **Need API reference?** Check the [Plugin API Documentation](../docs/PLUGIN_API.md)
- **Want examples?** Look at the plugins in the `examples/` directory

## Plugin Architecture

The scratch-pad plugin system is built around the `Plugin` trait, which provides a standardized interface for extending the application's functionality.

### Plugin Trait

All plugins must implement the `Plugin` trait:

```rust
pub trait Plugin: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn initialize(&mut self) -> Result<(), AppError>;
    fn register_note_format(&self) -> Option<NoteFormat>;

    // Optional methods
    fn description(&self) -> Option<&str> { None }
    fn author(&self) -> Option<&str> { None }
}
```

### Required Methods

- **`name()`**: Returns the plugin name (used for identification)
- **`version()`**: Returns the plugin version (semantic versioning recommended)
- **`initialize()`**: Called when the plugin is loaded. Perform setup here.
- **`register_note_format()`**: Return a `NoteFormat` if your plugin provides one, or `None`

### Optional Methods

- **`description()`**: Provide a brief description of the plugin's functionality
- **`author()`**: Plugin author information

## Plugin Development

### 1. Basic Plugin Structure

Create a new Rust file in the `plugins/` directory or subdirectory:

```rust
use scratch_pad_lib::error::AppError;
use scratch_pad_lib::models::NoteFormat;
use scratch_pad_lib::plugin::Plugin;

pub struct MyPlugin {
    name: String,
    version: String,
    initialized: bool,
}

impl MyPlugin {
    pub fn new() -> Self {
        Self {
            name: "My Plugin".to_string(),
            version: "1.0.0".to_string(),
            initialized: false,
        }
    }
}

impl Plugin for MyPlugin {
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

        // Your initialization logic here
        println!("Initializing {} v{}", self.name, self.version);

        self.initialized = true;
        Ok(())
    }

    fn register_note_format(&self) -> Option<NoteFormat> {
        // Return None if no custom format, or Some(format) if providing one
        None
    }

    fn description(&self) -> Option<&str> {
        Some("Description of what your plugin does")
    }

    fn author(&self) -> Option<&str> {
        Some("Your Name")
    }
}
```

### 2. Plugin Registration

Currently, plugins are registered as built-in plugins in the `PluginManager`. In future versions, dynamic loading will be supported.

To register your plugin, add it to the `register_builtin_plugins()` method in `src/plugin.rs`:

```rust
fn register_builtin_plugins(&mut self) -> Result<(), AppError> {
    // Register existing plugins
    let hello_plugin = Box::new(HelloWorldPlugin::new());
    self.register_plugin(hello_plugin)?;

    // Register your plugin
    let my_plugin = Box::new(MyPlugin::new());
    self.register_plugin(my_plugin)?;

    Ok(())
}
```

### 3. Error Handling

Use the `AppError` type for error handling:

```rust
fn initialize(&mut self) -> Result<(), AppError> {
    // For custom errors
    if some_condition_fails {
        return Err(AppError::Plugin {
            message: "Specific error description".to_string(),
        });
    }

    // For IO errors (automatically converted)
    std::fs::create_dir_all("/some/path")?;

    Ok(())
}
```

### 4. Testing

Include tests for your plugin:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_creation() {
        let plugin = MyPlugin::new();
        assert_eq!(plugin.name(), "My Plugin");
        assert_eq!(plugin.version(), "1.0.0");
    }

    #[test]
    fn test_plugin_initialization() {
        let mut plugin = MyPlugin::new();
        assert!(plugin.initialize().is_ok());
    }
}
```

## Plugin Types

### 1. Note Format Plugins

Plugins that provide new note formats should return the appropriate `NoteFormat` from `register_note_format()`:

```rust
fn register_note_format(&self) -> Option<NoteFormat> {
    // Currently supported formats:
    Some(NoteFormat::PlainText)  // or
    Some(NoteFormat::Markdown)

    // Future: Custom formats will be supported
    // Some(NoteFormat::Custom("json".to_string()))
}
```

### 2. Processing Plugins

Plugins that process notes or provide additional functionality without new formats:

```rust
fn register_note_format(&self) -> Option<NoteFormat> {
    None  // No new format provided
}

fn initialize(&mut self) -> Result<(), AppError> {
    // Set up processing capabilities
    // Register event handlers (future feature)
    // Initialize external services
    Ok(())
}
```

## Plugin Directory Structure

```console
plugins/
├── README.md                      # This file
├── examples/                      # Example plugin implementations
│   ├── hello_world_plugin.rs     # Basic example plugin
│   ├── text_processor_plugin.rs  # Text processing example
│   └── markdown_enhancer_plugin.rs # Format enhancement example
├── community/                     # Community-contributed plugins
└── custom/                        # Your custom plugins
```

## Example Plugins

### Hello World Plugin

**File**: `examples/hello_world_plugin.rs`
**Purpose**: Demonstrates basic plugin architecture
**Features**:

- Simple initialization
- Plugin metadata
- Basic error handling

### Text Processor Plugin

**File**: `examples/text_processor_plugin.rs`
**Purpose**: Shows how to process note content without adding new formats
**Features**:

- Text analysis (word count, character count, reading time)
- Text transformations (case changes, formatting)
- Statistics tracking
- Performance optimization

### Markdown Enhancer Plugin

**File**: `examples/markdown_enhancer_plugin.rs`
**Purpose**: Demonstrates format enhancement and registration
**Features**:

- Markdown syntax rule processing
- Document structure analysis
- Extension detection (tables, task lists, etc.)
- Validation and error reporting

## Plugin Lifecycle

1. **Discovery**: Plugin manager scans the plugins directory
2. **Loading**: Plugin code is loaded (currently built-in only)
3. **Registration**: Plugin is registered with the manager
4. **Initialization**: `initialize()` method is called
5. **Format Registration**: Note formats are registered if provided
6. **Runtime**: Plugin is available for use

## API Access

Plugins currently have access to:

- **Error Types**: `AppError` for consistent error handling
- **Data Models**: `Note`, `NoteFormat`, `Setting` structures
- **Plugin Interface**: `Plugin` trait and `PluginManager`

Future versions will provide:

- **Database Access**: Direct access to note storage
- **Event System**: React to note creation, modification, deletion
- **UI Integration**: Add custom UI components
- **Settings API**: Plugin-specific configuration

## Best Practices

### 1. Error Handling

- Always handle errors gracefully
- Use descriptive error messages
- Don't panic in plugin code

### 2. Initialization

- Keep initialization fast and lightweight
- Handle multiple initialization calls safely
- Log initialization status for debugging

### 3. Resource Management

- Clean up resources properly
- Don't block the main thread
- Use async operations when appropriate

### 4. Versioning

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Document breaking changes
- Maintain backward compatibility when possible

### 5. Testing

- Write comprehensive tests
- Test error conditions
- Include integration tests

## Debugging

### Plugin Loading Issues

Check the application logs for plugin-related messages:

```console
Loaded 1 plugins
🔌 Initializing Hello World Plugin v1.0.0
✅ Hello World Plugin initialized successfully
```

### Common Issues

1. **Plugin Not Loading**: Check that it's registered in `register_builtin_plugins()`
2. **Initialization Errors**: Check error messages in console output
3. **Format Not Available**: Ensure `register_note_format()` returns the correct format

## Future Roadmap

### Dynamic Plugin Loading

- Load plugins from compiled shared libraries (.so, .dll, .dylib)
- Hot-reload plugins without restarting the application
- Plugin marketplace and distribution

### Enhanced API

- Database access for plugins
- Event system for note lifecycle events
- UI extension points
- Configuration management

### Security

- Plugin sandboxing
- Permission system
- Code signing and verification

## Contributing

To contribute a plugin:

1. Create your plugin following the guidelines above
2. Add comprehensive tests
3. Document your plugin's functionality
4. Submit a pull request with your plugin in the `community/` directory

## Documentation

### Complete Documentation

- **[Plugin API Reference](../docs/PLUGIN_API.md)** - Complete API specification and reference
- **[Plugin Development Guide](../docs/PLUGIN_DEVELOPMENT_GUIDE.md)** - Step-by-step development guide
- **[Plugin System Overview](../PLUGIN_SYSTEM.md)** - Architecture and implementation details

### Quick References

- **Plugin Trait**: All plugins must implement the `Plugin` trait
- **Error Handling**: Use `AppError::Plugin` for plugin-specific errors
- **Thread Safety**: Plugins must be `Send + Sync`
- **Testing**: Include comprehensive unit and integration tests

## Support

For plugin development support:

- **Documentation**: Start with the guides above
- **Examples**: Check the example plugins in `examples/`
- **Source Code**: Review the main application source code
- **Issues**: Open an issue for questions or bug reports
- **Community**: Join the community discussions

## Contributing

To contribute a plugin:

1. **Develop**: Follow the [Plugin Development Guide](../docs/PLUGIN_DEVELOPMENT_GUIDE.md)
2. **Test**: Write comprehensive tests and ensure they pass
3. **Document**: Include clear documentation and examples
4. **Submit**: Create a pull request with your plugin in the `community/` directory

## License

Plugins should be compatible with the main application's license. Check the main repository for license details.
