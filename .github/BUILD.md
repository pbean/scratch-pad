# Build System Documentation

This document describes the cross-platform build system for Scratch Pad.

## Overview

The build system uses GitHub Actions to automatically build, test, and release the application across multiple platforms:

- **Windows**: x64 (MSI and NSIS installers)
- **macOS**: x64, ARM64, and Universal binaries (DMG)
- **Linux**: x64 (DEB and AppImage)

## Workflows

### 1. Build and Release (`build.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Git tags starting with `v*`

**Jobs:**

- **test**: Runs comprehensive test suite
- **build**: Builds for all platforms
- **build-universal-macos**: Creates Universal macOS binary (tags only)

### 2. Cross-Platform Tests (`test.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Daily at 6 AM UTC

**Jobs:**

- **test-matrix**: Tests on Ubuntu, Windows, and macOS
- **coverage**: Generates code coverage reports

### 3. Nightly Builds (`nightly.yml`)

**Triggers:**

- Daily at 2 AM UTC (if changes detected)
- Manual workflow dispatch

**Jobs:**

- **check-changes**: Checks for commits in last 24 hours
- **nightly-build**: Creates development builds

### 4. Release (`release.yml`)

**Triggers:**

- Git tags starting with `v*`

**Jobs:**

- **create-release**: Creates GitHub release with changelog
- **build-release**: Builds all platform variants
- **generate-checksums**: Creates SHA256 checksums

### 5. Security Scan (`security.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Daily at 3 AM UTC

**Jobs:**

- **audit**: Runs npm audit and cargo audit
- **codeql**: Performs CodeQL security analysis
- **dependency-review**: Reviews dependency changes in PRs

## Platform-Specific Details

### Windows

**Installers:**

- MSI (Windows Installer)
- NSIS (Nullsoft Scriptable Install System)

**Requirements:**

- Windows 10 or later
- WebView2 runtime (automatically installed)

### macOS

**Formats:**

- DMG (Disk Image)
- Universal Binary (Intel + Apple Silicon)

**Requirements:**

- macOS 10.13 or later
- Code signing (optional, requires certificates)

### Linux

**Formats:**

- DEB (Debian/Ubuntu package)
- AppImage (Portable application)

**Dependencies:**

- WebKit2GTK
- GTK3
- AppIndicator3

## Environment Variables

### Required for Signing (Optional)

```bash
TAURI_PRIVATE_KEY=<base64-encoded-private-key>
TAURI_KEY_PASSWORD=<private-key-password>
```

### GitHub Secrets

- `GITHUB_TOKEN`: Automatically provided by GitHub
- `TAURI_PRIVATE_KEY`: For code signing (optional)
- `TAURI_KEY_PASSWORD`: For code signing (optional)

## Local Development

### Prerequisites

```bash
# Install Node.js and pnpm
npm install -g pnpm

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli
```

### Platform-Specific Setup

#### Linux

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  pkg-config
```

#### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Windows

```bash
# Install Visual Studio Build Tools or Visual Studio Community
# with C++ development tools
```

### Building Locally

```bash
# Install dependencies
pnpm install

# Development build
pnpm tauri dev

# Production build
pnpm tauri build

# Build for specific target
pnpm tauri build --target x86_64-pc-windows-msvc
```

### Testing

```bash
# Frontend tests
pnpm test

# Backend tests
cd src-tauri && cargo test

# Integration tests
cd src-tauri && ./test_integration.sh  # Unix
cd src-tauri && ./test_integration.ps1 # Windows
```

## Release Process

1. **Update Version**: Update version in `package.json` and `src-tauri/tauri.conf.json`
2. **Create Tag**: `git tag v1.0.0 && git push origin v1.0.0`
3. **Automatic Build**: GitHub Actions will automatically build and create release
4. **Manual Review**: Review and publish the draft release

## Troubleshooting

### Build Failures

1. **Dependency Issues**: Check platform-specific dependencies
2. **Rust Target**: Ensure correct Rust target is installed
3. **Node Version**: Use Node.js 20 or later
4. **Cache Issues**: Clear Rust and pnpm caches

### Code Signing

1. **Generate Key**: Use Tauri's key generation tools
2. **Store Securely**: Add keys to GitHub Secrets
3. **Test Locally**: Verify signing works in development

### Platform Issues

1. **Windows**: Ensure Visual Studio Build Tools are installed
2. **macOS**: Check Xcode Command Line Tools
3. **Linux**: Verify all system dependencies are installed

## Monitoring

- **Build Status**: Check GitHub Actions tab
- **Security**: Review security scan results
- **Coverage**: Monitor code coverage reports
- **Dependencies**: Watch for dependency updates and security advisories
