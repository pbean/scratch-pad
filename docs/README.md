# Scratch Pad Documentation

Welcome to the comprehensive documentation for Scratch Pad - a floating, keyboard-driven notepad designed for developers.

## 📚 Documentation Index

### For Users

#### Getting Started

- **[User Guide](USER_GUIDE.md)** - Complete guide to using Scratch Pad
- **[Installation Guide](INSTALLATION.md)** - Detailed installation instructions for all platforms
- **[Validation Guide](VALIDATION_GUIDE.md)** - How to verify your installation is working correctly

#### Platform-Specific

- **[AUR Submission Guide](AUR_SUBMISSION.md)** - Information about Arch Linux AUR packages

### For Developers

#### Development

- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to the project
- **[Architecture Documentation](architecture/)** - Technical architecture and design documents
- **[Plugin Development](PLUGIN_DEVELOPMENT_GUIDE.md)** - Guide for developing plugins
- **[Plugin API Reference](PLUGIN_API.md)** - API documentation for plugin developers

#### Project Information

- **[Changelog](../CHANGELOG.md)** - Version history and changes
- **[Cross-Platform Build](../CROSS_PLATFORM_BUILD.md)** - Build system documentation
- **[License](../LICENSE)** - MIT License terms

## 🚀 Quick Links

### Installation

- [Download Latest Release](https://github.com/paulb/scratch-pad/releases/latest)
- [Windows Installation](INSTALLATION.md#windows-installation)
- [macOS Installation](INSTALLATION.md#macos-installation)
- [Linux Installation](INSTALLATION.md#linux-installation)

### Support

- [GitHub Issues](https://github.com/paulb/scratch-pad/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/paulb/scratch-pad/discussions) - Community discussions
- [Validation Scripts](../scripts/) - Automated installation validation

## 📖 Documentation Structure

```text
docs/
├── README.md                    # This file - documentation index
├── USER_GUIDE.md               # Complete user guide
├── INSTALLATION.md             # Installation instructions
├── VALIDATION_GUIDE.md         # Installation validation guide
├── AUR_SUBMISSION.md           # Arch Linux AUR information
├── PLUGIN_DEVELOPMENT_GUIDE.md # Plugin development guide
├── PLUGIN_API.md               # Plugin API reference
├── PLUGIN_INSTALLATION.md      # Plugin installation guide
├── PLUGIN_SYSTEM_INDEX.md      # Plugin system overview
└── architecture/               # Technical architecture docs
    ├── index.md
    ├── high-level-architecture.md
    ├── components.md
    ├── data-models.md
    └── ... (additional architecture docs)
```

## 🎯 Getting Started

### New Users

1. **[Download](https://github.com/paulb/scratch-pad/releases/latest)** the latest release for your platform
2. **[Install](INSTALLATION.md)** following the platform-specific instructions
3. **[Validate](VALIDATION_GUIDE.md)** your installation using the provided scripts
4. **[Learn](USER_GUIDE.md)** how to use all the features

### Developers

1. **[Read](../CONTRIBUTING.md)** the contributing guidelines
2. **[Set up](../CONTRIBUTING.md#development-setup)** your development environment
3. **[Explore](architecture/)** the architecture documentation
4. **[Start](../CONTRIBUTING.md#development-workflow)** contributing!

## 🔧 Features Overview

### Core Features

- **Instant Access**: Global keyboard shortcut for immediate access
- **Auto-Save**: Real-time saving with visual feedback
- **Full-Text Search**: Search across all notes with fuzzy matching
- **Multi-Tab Editing**: Work with multiple notes simultaneously
- **Keyboard-First**: Complete keyboard navigation and shortcuts

### Developer Features

- **Terminal Integration**: Create notes from command line
- **Plugin System**: Extensible architecture for custom functionality
- **Cross-Platform**: Consistent experience on Windows, macOS, and Linux
- **Performance Optimized**: Fast startup and minimal resource usage

### Customization

- **Global Shortcuts**: Configurable keyboard shortcuts
- **Font Preferences**: Customize UI and editor fonts
- **Layout Modes**: Different window sizes and positions
- **Note Formats**: Support for plain text and Markdown

## 🛠️ Technical Information

### System Requirements

- **Windows**: Windows 10+ with WebView2
- **macOS**: macOS 10.13+ (Intel and Apple Silicon)
- **Linux**: Modern distribution with GTK3 and WebKit2GTK

### Architecture

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri framework
- **Database**: SQLite with FTS5 full-text search
- **Build System**: Vite + GitHub Actions CI/CD

### Performance

- **Startup Time**: < 100ms target
- **Memory Usage**: < 50MB idle
- **Storage**: Efficient SQLite database
- **Search**: High-performance FTS5 indexing

## 📊 Project Status

### Current Version: 0.3.0

- ✅ Core functionality complete
- ✅ Cross-platform builds working
- ✅ Comprehensive documentation
- ✅ Automated testing and validation
- ✅ Plugin architecture foundation

### Upcoming Features

- Cloud synchronization
- Advanced plugin system
- Themes and customization
- Mobile companion app
- Team collaboration features

## 🤝 Community

### Contributing

We welcome contributions of all kinds:

- 🐛 **Bug Reports**: Help us identify and fix issues
- ✨ **Feature Requests**: Suggest new functionality
- 📝 **Documentation**: Improve or add documentation
- 💻 **Code**: Contribute features and fixes
- 🎨 **Design**: UI/UX improvements and suggestions

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General discussions and questions
- **Pull Requests**: Code contributions and reviews

## 📄 License

Scratch Pad is open source software licensed under the [MIT License](../LICENSE).

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) framework
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Font: [SauceCodePro Nerd Font](https://www.nerdfonts.com/)

---

**Questions?** Check the [User Guide](USER_GUIDE.md) or create an [issue](https://github.com/paulb/scratch-pad/issues) for support.
