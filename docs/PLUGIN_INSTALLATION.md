# Plugin Installation and Management Guide

## Overview

This guide covers how to install, manage, and troubleshoot plugins in the Scratch Pad application. Currently, plugins are built-in to the application, but this guide also covers the future dynamic plugin loading system.

## Table of Contents

1. [Current Plugin System (Built-in)](#current-plugin-system-built-in)
2. [Plugin Management](#plugin-management)
3. [Available Plugins](#available-plugins)
4. [Troubleshooting](#troubleshooting)
5. [Future Dynamic Plugin System](#future-dynamic-plugin-system)

## Current Plugin System (Built-in)

### How Plugins Work

In the current version, plugins are compiled directly into the application. When you start Scratch Pad:

1. **Automatic Loading**: All built-in plugins are automatically loaded
2. **Initialization**: Each plugin's `initialize()` method is called
3. **Registration**: Plugins register their capabilities (note formats, etc.)
4. **Availability**: Plugin features become available through the application

### Viewing Loaded Plugins

You can check which plugins are loaded through the frontend API:

```typescript
// In the application frontend
const pluginInfo = await invoke("get_plugin_info");
console.log("Loaded plugins:", pluginInfo);

const pluginCount = await invoke("get_plugin_count");
console.log("Total plugins:", pluginCount);

const noteFormats = await invoke("get_available_note_formats");
console.log("Available formats:", noteFormats);
```

### Plugin Status

Check the application logs to see plugin loading status:

```console
Loaded 3 plugins
🔌 Initializing Hello World Plugin v1.0.0
✅ Hello World Plugin initialized successfully
🔌 Initializing Text Processor v1.0.0
✅ Text Processor ready for text analysis and processing
🔌 Initializing Markdown Enhancer v1.2.0
✅ Markdown Enhancer Plugin ready with 6 syntax rules and 5 extensions
```

## Plugin Management

### Built-in Plugin Management

Currently available through IPC commands:

#### Get Plugin Information

```rust
// Backend command
#[tauri::command]
async fn get_plugin_info(state: State<'_, AppState>) -> Result<Vec<PluginInfo>, ApiError>
```

```typescript
// Frontend usage
const plugins = await invoke("get_plugin_info");
plugins.forEach((plugin) => {
  console.log(`${plugin.name} v${plugin.version}`);
  console.log(`Description: ${plugin.description}`);
  console.log(`Author: ${plugin.author}`);
});
```

#### Get Plugin Count

```rust
// Backend command
#[tauri::command]
async fn get_plugin_count(state: State<'_, AppState>) -> Result<usize, ApiError>
```

```typescript
// Frontend usage
const count = await invoke("get_plugin_count");
console.log(`${count} plugins loaded`);
```

#### Get Available Note Formats

```rust
// Backend command
#[tauri::command]
async fn get_available_note_formats(state: State<'_, AppState>) -> Result<Vec<String>, ApiError>
```

```typescript
// Frontend usage
const formats = await invoke("get_available_note_formats");
console.log("Supported formats:", formats);
```

### Plugin Directory Structure

```console
scratch-pad/
├── plugins/
│   ├── README.md                      # Plugin documentation
│   ├── examples/                      # Example implementations
│   │   ├── hello_world_plugin.rs     # Basic example
│   │   ├── text_processor_plugin.rs  # Processing example
│   │   └── markdown_enhancer_plugin.rs # Format example
│   ├── community/                     # Community plugins (future)
│   └── custom/                        # User plugins (future)
├── docs/
│   ├── PLUGIN_API.md                  # API reference
│   ├── PLUGIN_DEVELOPMENT_GUIDE.md   # Development guide
│   └── PLUGIN_INSTALLATION.md        # This guide
└── src-tauri/src/
    ├── plugin.rs                      # Plugin system core
    └── plugin_integration_test.rs     # Integration tests
```

## Available Plugins

### Hello World Plugin

**Purpose**: Demonstrates basic plugin architecture
**Version**: 1.0.0
**Author**: Scratch Pad Team

**Features**:

- Basic plugin initialization
- Metadata demonstration
- Simple error handling example

**Note Format**: None (doesn't register a format)

### Text Processor Plugin

**Purpose**: Advanced text analysis and processing
**Version**: 1.0.0
**Author**: Scratch Pad Community

**Features**:

- **Text Analysis**:
  - Word, character, and line counting
  - Paragraph detection
  - Reading time estimation
  - Word frequency analysis
  - Top word identification

- **Text Transformations**:
  - Case conversions (upper, lower, title)
  - Whitespace normalization
  - Line numbering
  - Custom formatting

- **Statistics Tracking**:
  - Total words processed
  - Total characters processed
  - Processing history

**Note Format**: None (processes existing formats)

**Usage Example**:

```rust
let mut processor = TextProcessorPlugin::new();
processor.initialize()?;

let analysis = processor.analyze_text("Your note content here");
println!("Word count: {}", analysis.word_count);
println!("Reading time: {} minutes", analysis.reading_time_minutes);

let transformed = processor.transform_text(
    "hello world",
    TextTransformation::TitleCase
);
// Result: "Hello World"
```

### Markdown Enhancer Plugin

**Purpose**: Enhanced markdown processing and validation
**Version**: 1.2.0
**Author**: Markdown Team

**Features**:

- **Syntax Processing**:
  - Bold, italic, code formatting
  - Strikethrough support
  - Task list processing
  - Link and image detection

- **Document Analysis**:
  - Header structure analysis
  - Code block counting
  - Table detection
  - List item counting

- **Extensions Support**:
  - Tables
  - Task lists
  - Strikethrough
  - Code highlighting
  - Emoji support

- **Validation**:
  - Syntax error detection
  - Malformed link checking
  - Empty header warnings
  - Unmatched formatting detection

**Note Format**: Markdown (registers enhanced markdown support)

**Usage Example**:

```rust
let mut enhancer = MarkdownEnhancerPlugin::new();
enhancer.initialize()?;

let processed = enhancer.process_markdown("# Header\n\n**Bold** text");
println!("Applied rules: {:?}", processed.applied_rules);
println!("Structure: {:?}", processed.structure);

let validation = enhancer.validate_markdown("# Header\n\n[Bad link(url)");
if !validation.is_valid {
    println!("Errors: {:?}", validation.errors);
}
```

## Troubleshooting

### Common Issues

#### Plugin Not Loading

**Symptoms**:

- Plugin doesn't appear in plugin list
- Expected functionality is missing
- No initialization messages in logs

**Solutions**:

1. **Check Application Logs**:

   ```bash
   # Look for plugin loading messages
   grep -i "plugin" application.log
   ```

2. **Verify Plugin Registration**:
   - Ensure plugin is added to `register_builtin_plugins()` in `src-tauri/src/plugin.rs`
   - Check for compilation errors

3. **Test Plugin Isolation**:

   ```rust
   #[test]
   fn test_plugin_standalone() {
       let mut plugin = MyPlugin::new();
       assert!(plugin.initialize().is_ok());
   }
   ```

#### Initialization Failures

**Symptoms**:

- Plugin appears in list but shows as failed
- Error messages during startup
- Plugin functionality unavailable

**Solutions**:

1. **Check Error Messages**:

   ```console
   🔌 Initializing My Plugin v1.0.0
   ❌ Plugin initialization failed: Configuration file not found
   ```

2. **Verify Dependencies**:
   - Check file permissions
   - Ensure required directories exist
   - Validate configuration files

3. **Debug Initialization**:

   ```rust
   fn initialize(&mut self) -> Result<(), AppError> {
       println!("DEBUG: Starting initialization");

       // Add debug prints for each step
       self.load_config().map_err(|e| {
           println!("ERROR: Config loading failed: {}", e);
           e
       })?;

       println!("DEBUG: Initialization complete");
       Ok(())
   }
   ```

#### Runtime Errors

**Symptoms**:

- Plugin works initially but fails during use
- Intermittent errors
- Performance degradation

**Solutions**:

1. **Check Resource Usage**:
   - Monitor memory consumption
   - Check for file handle leaks
   - Verify thread safety

2. **Add Error Context**:

   ```rust
   pub fn process_data(&mut self, data: &str) -> Result<String, AppError> {
       self.internal_process(data).map_err(|e| AppError::Plugin {
           message: format!("Processing failed for {}: {}", self.name(), e),
       })
   }
   ```

3. **Test Edge Cases**:

   ```rust
   #[test]
   fn test_edge_cases() {
       let mut plugin = MyPlugin::new();
       plugin.initialize().unwrap();

       // Test empty input
       assert!(plugin.process_data("").is_err());

       // Test large input
       let large_input = "x".repeat(1_000_000);
       assert!(plugin.process_data(&large_input).is_ok());

       // Test special characters
       assert!(plugin.process_data("🚀 Unicode test").is_ok());
   }
   ```

### Diagnostic Commands

#### Check Plugin Status

```typescript
// Get detailed plugin information
const plugins = await invoke("get_plugin_info");
plugins.forEach((plugin) => {
  console.log(`Plugin: ${plugin.name}`);
  console.log(`Status: ${plugin.initialized ? "Initialized" : "Failed"}`);
  console.log(`Version: ${plugin.version}`);
  console.log(`Description: ${plugin.description || "None"}`);
  console.log("---");
});
```

#### Test Plugin Functionality

```typescript
// Test note format availability
const formats = await invoke("get_available_note_formats");
console.log("Available formats:", formats);

// Expected formats with plugins:
// - "plaintext" (built-in)
// - "markdown" (from MarkdownEnhancerPlugin)
```

#### Monitor Performance

```rust
// Add performance monitoring to plugins
use std::time::Instant;

pub fn process_data(&mut self, data: &str) -> Result<String, AppError> {
    let start = Instant::now();

    let result = self.internal_process(data)?;

    let duration = start.elapsed();
    if duration.as_millis() > 100 {
        println!("WARNING: Slow processing: {:?}", duration);
    }

    Ok(result)
}
```

### Log Analysis

#### Plugin Loading Logs

```console
INFO: Starting plugin system initialization
DEBUG: Creating plugin directory: ./plugins
DEBUG: Loading built-in plugins
INFO: Registering Hello World Plugin
INFO: Registering Text Processor Plugin
INFO: Registering Markdown Enhancer Plugin
INFO: Loaded 3 plugins successfully
```

#### Error Logs

```console
ERROR: Plugin initialization failed: Text Processor Plugin
ERROR: Cause: Configuration file not readable
ERROR: Path: ./plugins/config/text_processor.json
ERROR: Permission denied (os error 13)
```

#### Performance Logs

```console
DEBUG: Plugin processing time: Hello World Plugin: 0ms
DEBUG: Plugin processing time: Text Processor Plugin: 15ms
DEBUG: Plugin processing time: Markdown Enhancer Plugin: 8ms
WARNING: Total plugin processing time: 23ms (threshold: 20ms)
```

## Future Dynamic Plugin System

### Planned Features

When dynamic plugin loading is implemented, the following features will be available:

#### Dynamic Loading

```bash
# Install a plugin
scratch-pad --install-plugin /path/to/plugin.so

# Uninstall a plugin
scratch-pad --uninstall-plugin my-plugin

# List installed plugins
scratch-pad --list-plugins

# Reload all plugins
scratch-pad --reload-plugins
```

#### Plugin Marketplace

```bash
# Search for plugins
scratch-pad --search-plugins "markdown"

# Install from marketplace
scratch-pad --install-plugin-from-marketplace "advanced-markdown"

# Update plugins
scratch-pad --update-plugins
```

#### Hot Reload

```typescript
// Reload plugins without restarting
await invoke("reload_plugins");

// Install new plugin at runtime
await invoke("install_plugin", { path: "/path/to/plugin.so" });

// Uninstall plugin at runtime
await invoke("uninstall_plugin", { name: "plugin-name" });
```

### Migration Path

When dynamic loading becomes available:

1. **Existing Plugins**: Built-in plugins will continue to work
2. **New Plugins**: Can be installed dynamically
3. **Configuration**: Plugin settings will be preserved
4. **Compatibility**: API will remain backward compatible

### Plugin Distribution

Future plugin distribution will support:

- **Compiled Libraries**: `.so`, `.dll`, `.dylib` files
- **Package Manager**: Centralized plugin repository
- **Version Management**: Automatic updates and dependency resolution
- **Security**: Plugin signing and verification

---

This installation guide covers the current plugin system and provides a roadmap for future enhancements. For development information, see the [Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md).
