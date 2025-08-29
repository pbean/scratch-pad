# Scratch Pad User Guide

Welcome to Scratch Pad - a floating, keyboard-driven notepad designed specifically for developers to capture quick thoughts and code snippets without breaking their flow state.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [Command Palette](#command-palette)
- [Search and History](#search-and-history)
- [Terminal Integration](#terminal-integration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Installation

### Windows

1. Download the latest `.msi` installer from the [Releases page](https://github.com/pinkydprojects/scratch-pad/releases)
2. Run the installer and follow the setup wizard
3. Launch Scratch Pad from the Start Menu or desktop shortcut

**System Requirements:**

- Windows 10 or later
- WebView2 (automatically installed if not present)

### macOS

1. Download the latest `.dmg` file from the [Releases page](https://github.com/pinkydprojects/scratch-pad/releases)
2. Open the DMG file and drag Scratch Pad to your Applications folder
3. Launch from Applications or Spotlight search

**System Requirements:**

- macOS 10.13 (High Sierra) or later
- Available for both Intel and Apple Silicon Macs

### Linux

#### Debian/Ubuntu (DEB Package)

```bash
# Download the .deb file from releases
wget https://github.com/pinkydprojects/scratch-pad/releases/latest/download/scratch-pad_0.3.0_amd64.deb

# Install the package
sudo dpkg -i scratch-pad_0.3.0_amd64.deb

# Install dependencies if needed
sudo apt-get install -f
```

#### AppImage (Universal Linux)

```bash
# Download the AppImage
wget https://github.com/pinkydprojects/scratch-pad/releases/latest/download/scratch-pad_0.3.0_amd64.AppImage

# Make it executable
chmod +x scratch-pad_0.3.0_amd64.AppImage

# Run the application
./scratch-pad_0.3.0_amd64.AppImage
```

#### Arch Linux (AUR)

```bash
# Using yay
yay -S scratch-pad

# Using paru
paru -S scratch-pad
```

**System Requirements:**

- Modern Linux distribution
- GTK3 and WebKit2GTK

## Getting Started

### First Launch

1. **Launch the Application**: Use your preferred method (desktop shortcut, Start Menu, Applications folder, or terminal)
2. **Set Global Shortcut**: On first launch, you'll be prompted to set a global keyboard shortcut (default: `Ctrl+Shift+N`)
3. **Start Writing**: The text area will be automatically focused - just start typing!

### Basic Usage

Scratch Pad is designed to be intuitive and keyboard-driven:

1. **Quick Access**: Press your global shortcut from anywhere in your system
2. **Instant Writing**: The cursor is automatically placed in the text area
3. **Auto-Save**: Your notes are automatically saved as you type
4. **Dismiss**: Press `Esc` to hide the window (your work is saved)

## Features

### 🚀 Instant Access

- Global keyboard shortcut for instant access from anywhere
- Floating window that appears instantly
- Auto-focus on text input for immediate typing

### 💾 Automatic Saving

- Real-time auto-save with visual feedback
- All notes are stored locally in SQLite database
- Never lose your thoughts - everything is automatically preserved

### 🔍 Powerful Search

- Full-text search across all your notes
- Fuzzy search for finding notes even with typos
- Real-time search results with content previews

### ⌨️ Keyboard-First Design

- Complete keyboard navigation
- Comprehensive shortcut system
- Command palette for quick actions

### 📝 Note Management

- Support for plain text and Markdown formats
- Multi-tab editing for working with multiple notes
- Organize notes with favorites and folders

### 🎨 Customization

- Configurable global shortcuts
- Font preferences (UI and Editor fonts)
- Layout modes (default, half-screen, full-screen)

### 🖥️ Cross-Platform

- Consistent experience across Windows, macOS, and Linux
- Native installers for each platform
- Platform-appropriate keyboard shortcuts

## Keyboard Shortcuts

### Global Shortcuts

- `Ctrl+Shift+N` (default) - Open/Show Scratch Pad from anywhere
- `Esc` - Hide the Scratch Pad window

### Application Shortcuts

- `Ctrl+P` (`Cmd+P` on macOS) - Open Command Palette
- `Ctrl+Shift+F` (`Cmd+Shift+F` on macOS) - Open Search/Browse view
- `Ctrl+N` (`Cmd+N` on macOS) - Create new note
- `Ctrl+S` (`Cmd+S` on macOS) - Manual save (auto-save is always active)
- `Ctrl+W` (`Cmd+W` on macOS) - Close current tab
- `Ctrl+Tab` / `Ctrl+Shift+Tab` - Navigate between tabs
- `Ctrl+1-9` (`Cmd+1-9` on macOS) - Switch to specific tab number

### Search and Navigation

- `↑` / `↓` - Navigate search results or folder tree
- `Enter` - Open selected note (replaces current tab)
- `Ctrl+Enter` (`Cmd+Enter` on macOS) - Open selected note in new tab
- `←` / `→` - Expand/collapse folders in tree view

## Settings

Access settings through the Command Palette (`Ctrl+P` → "Settings") or the main menu.

### Global Shortcut Configuration

- **Current Shortcut**: View your current global shortcut
- **Change Shortcut**: Click to set a new shortcut combination
- **Validation**: The system prevents invalid or conflicting shortcuts

### Font Preferences

- **UI Font**: Font used for interface elements (default: Inter)
- **Editor Font**: Font used in the text editor (default: SauceCodePro Nerd Font)
- **Font Size**: Adjustable font sizes for both UI and editor

### Note Format

- **Default Format**: Choose between Plain Text (.txt) and Markdown (.md)
- **Syntax Highlighting**: Enable/disable syntax highlighting for Markdown

### Layout Modes

- **Default**: Standard floating window
- **Half**: Takes up half the screen
- **Full**: Full-screen mode for distraction-free writing

## Command Palette

The Command Palette (`Ctrl+P`) provides quick access to all application features:

### Available Commands

- **Search History** - Open the search/browse view
- **New Note** - Create a new note
- **Export Note** - Export current note to file system
- **Settings** - Open application settings
- **Save As** - Save current note with a specific name/location

### Usage Tips

- Type to filter commands with fuzzy matching
- Use `↑`/`↓` arrows to navigate
- Press `Enter` to execute selected command
- Press `Esc` to close the palette

## Search and History

### Browser Mode

- **Recent Notes**: Shows your most recently edited notes
- **All Notes**: Complete list of all your notes
- **Favorites**: Notes you've marked as favorites
- **Folder Navigation**: Organize notes in a tree structure

### Search Mode

- **Real-time Search**: Results update as you type
- **Fuzzy Matching**: Find notes even with typos or partial matches
- **Content Previews**: See snippets of matching content
- **Highlighted Results**: Search terms are highlighted in results

### Navigation

- Use keyboard arrows to navigate results
- `Enter` to open in current tab
- `Ctrl+Enter` to open in new tab
- `←`/`→` to expand/collapse folders

## Terminal Integration

Scratch Pad supports command-line integration for power users:

### Creating Notes from Terminal

```bash
# Create a new note with content
scratch-pad "This is my note content"

# Create a note from file
scratch-pad "$(cat my-file.txt)"

# Pipe content to create a note
echo "Quick note" | scratch-pad
```

### Cross-Platform Commands

The terminal integration works consistently across all platforms:

- **Windows**: Use `scratch-pad.exe` or just `scratch-pad` if in PATH
- **macOS**: Use `scratch-pad` command or the full path to the app bundle
- **Linux**: Use `scratch-pad` command after installation

## Troubleshooting

### Common Issues

#### Global Shortcut Not Working

1. **Check for Conflicts**: Another application might be using the same shortcut
2. **Change Shortcut**: Go to Settings and set a different combination
3. **Restart Application**: Sometimes a restart resolves shortcut registration issues
4. **Run as Administrator** (Windows): Some systems require elevated privileges for global shortcuts

#### Application Won't Start

1. **Check System Requirements**: Ensure your system meets the minimum requirements
2. **Update WebView2** (Windows): Download the latest WebView2 runtime from Microsoft
3. **Check Permissions** (macOS): Go to System Preferences → Security & Privacy and allow the app
4. **Install Dependencies** (Linux): Ensure GTK3 and WebKit2GTK are installed

#### Notes Not Saving

1. **Check Disk Space**: Ensure you have sufficient disk space
2. **Database Permissions**: The app needs write access to its data directory
3. **Antivirus Software**: Some antivirus programs may interfere with database operations

#### Search Not Working

1. **Database Corruption**: Try restarting the application
2. **Large Note Collections**: Search may be slower with thousands of notes
3. **Special Characters**: Some special characters might affect search results

### Getting Help

If you encounter issues not covered here:

1. **Check the Issues**: Visit our [GitHub Issues](https://github.com/pinkydprojects/scratch-pad/issues) page
2. **Create a Bug Report**: Use our issue template to report bugs
3. **Feature Requests**: Suggest new features through GitHub Issues
4. **Community Support**: Join discussions in our GitHub repository

## FAQ

### General Questions

**Q: Is my data stored in the cloud?**
A: No, all your notes are stored locally on your device in a SQLite database. Nothing is sent to external servers.

**Q: Can I sync my notes across devices?**
A: Currently, Scratch Pad stores notes locally only. Cloud sync is planned for a future release.

**Q: What file formats are supported?**
A: Scratch Pad supports plain text (.txt) and Markdown (.md) formats with syntax highlighting.

**Q: How much storage do my notes use?**
A: Notes are stored very efficiently in SQLite. Even thousands of notes typically use less than a few MB of storage.

### Technical Questions

**Q: Can I backup my notes?**
A: Yes, you can export individual notes or use the settings to export all your data. The database file is located in your system's app data directory.

**Q: Is there a plugin system?**
A: Yes, Scratch Pad includes a plugin architecture for extending functionality. Plugin development documentation is available for developers.

**Q: Can I customize the appearance?**
A: Currently, you can customize fonts and layout modes. More theming options are planned for future releases.

**Q: Does it work offline?**
A: Yes, Scratch Pad is completely offline and doesn't require an internet connection.

### Privacy and Security

**Q: What data does Scratch Pad collect?**
A: Scratch Pad doesn't collect any personal data or telemetry. All data stays on your device.

**Q: Is my data encrypted?**
A: Notes are stored in a local SQLite database. Encryption support is planned for a future release.

**Q: Can I delete all my data?**
A: Yes, uninstalling the application will remove all data, or you can manually delete the database file from the app data directory.

---

## Support

For additional support, please visit our [GitHub repository](https://github.com/pinkydprojects/scratch-pad) or check the [documentation](https://github.com/pinkydprojects/scratch-pad/tree/main/docs).

**Version**: 0.3.0  
**Last Updated**: August 2025
