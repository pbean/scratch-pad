# Changelog

All notable changes to Scratch Pad will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cleaned up commited locks
- Comprehensive user documentation
- Installation guides for all platforms
- PKGBUILD for Arch Linux AUR distribution

## [0.1.0] - 2025-08-17

### Added

- **Core Features**
  - Floating notepad window with global keyboard shortcut access
  - Real-time auto-save with visual feedback
  - Full-text search across all notes with fuzzy matching
  - Multi-tab note editing support
  - Command palette for keyboard-driven navigation
  - Support for plain text and Markdown formats

- **User Interface**
  - Clean, distraction-free interface design
  - Tab bar for managing multiple open notes
  - Status bar with word/character/line counts
  - Search/browse view with tree navigation
  - Settings panel for customization

- **Keyboard Shortcuts**
  - Configurable global shortcut (default: Ctrl+Shift+N)
  - Complete keyboard navigation support
  - Command palette (Ctrl+P)
  - Tab navigation and management shortcuts
  - Search and browse shortcuts

- **Cross-Platform Support**
  - Windows 10+ with MSI and NSIS installers
  - macOS 10.13+ with Universal Binary DMG
  - Linux with DEB packages and AppImage
  - Platform-appropriate keyboard shortcuts

- **Developer Features**
  - Terminal integration for creating notes from command line
  - Monospace font support (SauceCodePro Nerd Font)
  - Syntax highlighting for Markdown
  - Plugin architecture foundation

- **Data Management**
  - SQLite database with FTS5 full-text search
  - Automatic database migrations
  - Note export functionality
  - Settings import/export

- **Performance & Quality**
  - Instant application launch (<100ms target)
  - Minimal memory footprint (<50MB idle)
  - List virtualization for large note collections
  - Comprehensive test coverage (95%+ frontend, full backend)

- **Build & Distribution**
  - Cross-platform GitHub Actions CI/CD
  - Automated testing on Windows, macOS, and Linux
  - Security scanning and dependency auditing
  - Nightly builds and release automation

### Technical Details

- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Rust, Tauri 2.0, SQLite with rusqlite
- **Build System**: Vite, pnpm workspaces, GitHub Actions
- **Testing**: Vitest (frontend), cargo test (backend), integration tests

### Known Issues

- Global shortcuts may require manual permission on some macOS versions
- Some Linux desktop environments may need additional configuration for global shortcuts
- Plugin system is foundational - full plugin support planned for future releases

### Breaking Changes

- None (initial release)

### Security

- Local-only data storage (no cloud sync)
- Input sanitization for all user inputs
- Secure IPC communication between frontend and backend
- No telemetry or data collection

---

## Release Notes Format

Each release includes:

- **Added**: New features and capabilities
- **Changed**: Changes to existing functionality
- **Deprecated**: Features that will be removed in future versions
- **Removed**: Features that have been removed
- **Fixed**: Bug fixes and corrections
- **Security**: Security-related changes and fixes

## Version Numbering

Scratch Pad follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Support

For questions about releases or to report issues:

- 📖 [User Guide](docs/USER_GUIDE.md)
- 🐛 [Report Issues](https://github.com/pinkydprojects/scratch-pad/issues)
- 💬 [Discussions](https://github.com/pinkydprojects/scratch-pad/discussions)
