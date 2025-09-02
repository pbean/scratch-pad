# Installation Validation Guide

This guide provides comprehensive instructions for validating Scratch Pad installations across all supported platforms.

## Overview

Installation validation ensures that:

- System requirements are met
- Application is properly installed
- Basic functionality works correctly
- Desktop integration is functional
- Data directories are accessible

## Automated Validation

### Quick Validation

Use the provided validation scripts for automated testing:

#### Linux/macOS

```bash
# Download and run validation script
curl -sSL https://raw.githubusercontent.com/paulb/scratch-pad/main/scripts/validate-installation.sh | bash

# Or if you have the repository cloned
./scripts/validate-installation.sh
```

#### Windows

```powershell
# Download and run validation script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/paulb/scratch-pad/main/scripts/validate-installation.ps1" -OutFile "validate-installation.ps1"
.\validate-installation.ps1

# Or if you have the repository cloned
.\scripts\validate-installation.ps1
```

### Validation Report

The scripts generate a detailed validation report (`scratch-pad-validation-report.txt`) containing:

- System information
- Validation test results
- Overall installation status
- Recommendations for fixing issues

## Manual Validation

### 1. System Requirements Check

#### Windows

- **OS Version**: Windows 10 (1903) or later
- **Architecture**: x64 (64-bit)
- **Runtime**: WebView2 (check in Apps & Features)

```powershell
# Check Windows version
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion

# Check for WebView2
Get-AppxPackage | Where-Object {$_.Name -like "*WebView*"}
```

#### macOS

- **OS Version**: macOS 10.13 (High Sierra) or later
- **Architecture**: Intel x64 or Apple Silicon (ARM64)

```bash
# Check macOS version
sw_vers

# Check architecture
uname -m
```

#### Linux

- **Distribution**: Modern Linux (Ubuntu 18.04+, Fedora 30+, etc.)
- **Architecture**: x64 (64-bit)
- **Dependencies**: GTK3, WebKit2GTK, AppIndicator3

```bash
# Check distribution
lsb_release -a

# Check dependencies (Ubuntu/Debian)
dpkg -l | grep -E "(libwebkit2gtk|libgtk-3|libayatana-appindicator)"

# Check dependencies (Fedora)
rpm -qa | grep -E "(webkit2gtk3|gtk3|libappindicator)"
```

### 2. Installation Verification

#### Check Executable Location

**Windows:**

```powershell
# Check common installation paths
$Paths = @(
    "${env:ProgramFiles}\scratch-pad\scratch-pad.exe",
    "${env:ProgramFiles(x86)}\scratch-pad\scratch-pad.exe",
    "${env:LOCALAPPDATA}\Programs\scratch-pad\scratch-pad.exe"
)

foreach ($Path in $Paths) {
    if (Test-Path $Path) {
        Write-Host "Found: $Path"
    }
}

# Check if in PATH
Get-Command scratch-pad -ErrorAction SilentlyContinue
```

**macOS:**

```bash
# Check application bundle
ls -la "/Applications/scratch-pad.app"

# Check if in PATH
which scratch-pad
```

**Linux:**

```bash
# Check common installation paths
ls -la /usr/bin/scratch-pad
ls -la /usr/local/bin/scratch-pad

# Check if in PATH
which scratch-pad
```

#### Verify File Permissions

```bash
# Linux/macOS - Check executable permissions
ls -la $(which scratch-pad)

# Should show execute permissions (x)
```

```powershell
# Windows - Check file accessibility
Get-Item "C:\Program Files\scratch-pad\scratch-pad.exe" | Select-Object FullName, Length, LastWriteTime
```

### 3. Basic Functionality Test

#### Command Line Interface

```bash
# Test version command (if supported)
scratch-pad --version

# Test help command (if supported)
scratch-pad --help

# Test note creation from command line
scratch-pad "Test note from command line"
```

#### Application Launch

1. **Launch the application** using your preferred method
2. **Verify window appears** and is properly focused
3. **Test text input** by typing in the main text area
4. **Test auto-save** by typing and waiting a few seconds
5. **Test global shortcut** (default: Ctrl+Shift+N)
6. **Test Esc key** to hide the window

### 4. Desktop Integration Check

#### Windows

```powershell
# Check Start Menu shortcut
Test-Path "${env:ProgramData}\Microsoft\Windows\Start Menu\Programs\scratch-pad.lnk"
Test-Path "${env:APPDATA}\Microsoft\Windows\Start Menu\Programs\scratch-pad.lnk"

# Check desktop shortcut (if created)
Test-Path "$env:USERPROFILE\Desktop\scratch-pad.lnk"

# Check registry entry
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object {$_.DisplayName -like "*scratch-pad*"}
```

#### macOS

```bash
# Check application bundle structure
ls -la "/Applications/scratch-pad.app/Contents/"

# Check Info.plist
plutil -p "/Applications/scratch-pad.app/Contents/Info.plist"

# Check if app appears in Spotlight
mdfind "kMDItemDisplayName == 'scratch-pad'"
```

#### Linux

```bash
# Check desktop file
ls -la /usr/share/applications/scratch-pad.desktop

# Validate desktop file
desktop-file-validate /usr/share/applications/scratch-pad.desktop

# Check icons
ls -la /usr/share/icons/hicolor/*/apps/scratch-pad.png

# Check if app appears in application menu
grep -r "scratch-pad" /usr/share/applications/
```

### 5. Data Directory Validation

#### Check Data Directory Location

**Windows:**

```powershell
$DataDir = "${env:APPDATA}\scratch-pad"
Write-Host "Data directory: $DataDir"
Test-Path $DataDir
```

**macOS:**

```bash
DATA_DIR="$HOME/Library/Application Support/scratch-pad"
echo "Data directory: $DATA_DIR"
ls -la "$DATA_DIR"
```

**Linux:**

```bash
DATA_DIR="$HOME/.local/share/scratch-pad"
echo "Data directory: $DATA_DIR"
ls -la "$DATA_DIR"
```

#### Test Write Permissions

```bash
# Create test file in data directory
echo "test" > "$DATA_DIR/test_permissions.txt"

# Verify file was created
ls -la "$DATA_DIR/test_permissions.txt"

# Clean up
rm "$DATA_DIR/test_permissions.txt"
```

### 6. Advanced Validation

#### Database Functionality

1. **Create multiple notes** with different content
2. **Test search functionality** with various queries
3. **Test note editing** and auto-save
4. **Test note deletion** (if supported)
5. **Verify data persistence** by restarting the application

#### Performance Validation

1. **Measure startup time** (should be < 2 seconds)
2. **Test with large notes** (> 10,000 characters)
3. **Test with many notes** (> 100 notes)
4. **Monitor memory usage** during operation

#### Cross-Platform Specific Tests

**Windows:**

- Test with different user account types (standard vs. administrator)
- Test on different Windows versions (10, 11)
- Test with Windows Defender and other antivirus software

**macOS:**

- Test on both Intel and Apple Silicon Macs
- Test with different macOS versions
- Test with System Integrity Protection (SIP) enabled

**Linux:**

- Test on different distributions (Ubuntu, Fedora, Arch, etc.)
- Test with different desktop environments (GNOME, KDE, XFCE)
- Test with different display servers (X11, Wayland)

## Troubleshooting Common Issues

### Installation Issues

#### "Application won't start"

1. Check system requirements
2. Verify all dependencies are installed
3. Check file permissions
4. Try running from command line for error messages

#### "Global shortcut not working"

1. Check for conflicting applications
2. Try different shortcut combination
3. Restart application after changing shortcut
4. Check system permissions (macOS/Linux)

#### "Notes not saving"

1. Check data directory permissions
2. Verify sufficient disk space
3. Check for antivirus interference
4. Try running as administrator (Windows)

### Platform-Specific Issues

#### Windows

- **WebView2 issues**: Download and install WebView2 runtime manually
- **Permission errors**: Run as administrator or check UAC settings
- **Antivirus blocking**: Add exception for Scratch Pad executable

#### macOS

- **"App can't be opened"**: Right-click and select "Open" to bypass Gatekeeper
- **Global shortcuts not working**: Grant accessibility permissions in System Preferences
- **App not in Applications**: Drag from DMG to Applications folder

#### Linux

- **Missing dependencies**: Install required packages using package manager
- **AppImage won't run**: Install FUSE and make file executable
- **Desktop integration issues**: Update desktop database and icon cache

## Validation Checklist

Use this checklist for manual validation:

### Pre-Installation

- [ ] System meets minimum requirements
- [ ] No conflicting software installed
- [ ] Sufficient disk space available
- [ ] User has appropriate permissions

### Installation

- [ ] Installer runs without errors
- [ ] Application files are in correct location
- [ ] Desktop integration is set up
- [ ] Uninstaller is available (Windows/macOS)

### Post-Installation

- [ ] Application launches successfully
- [ ] Main window appears and is functional
- [ ] Text input works correctly
- [ ] Auto-save functionality works
- [ ] Global shortcut is functional
- [ ] Search functionality works
- [ ] Settings can be accessed and modified
- [ ] Data persists between sessions

### Integration

- [ ] Application appears in system menus
- [ ] Icons are displayed correctly
- [ ] File associations work (if applicable)
- [ ] Command line interface works
- [ ] Data directory is accessible

### Performance

- [ ] Startup time is acceptable (< 2 seconds)
- [ ] Memory usage is reasonable (< 100MB)
- [ ] No memory leaks during extended use
- [ ] Responsive user interface

## Reporting Issues

If validation fails, please report issues with:

1. **System Information**:
   - Operating system and version
   - Architecture (x64, ARM64)
   - Installation method used

2. **Error Details**:
   - Exact error messages
   - Steps to reproduce
   - Expected vs. actual behavior

3. **Validation Results**:
   - Attach validation report if available
   - Include relevant log files
   - Screenshots of error dialogs

4. **Environment Details**:
   - Antivirus software
   - Other security software
   - Virtual machine (if applicable)

Submit issues at: <https://github.com/paulb/scratch-pad/issues>

## Automated Testing

For developers and maintainers, consider setting up automated validation:

### CI/CD Integration

```yaml
# Example GitHub Actions workflow for validation
name: Installation Validation
on: [push, pull_request]

jobs:
  validate:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - name: Run validation script
        run: |
          if [ "$RUNNER_OS" == "Windows" ]; then
            .\scripts\validate-installation.ps1
          else
            ./scripts/validate-installation.sh
          fi
```

### Continuous Monitoring

Set up monitoring to validate installations across different environments:

- Virtual machines with different OS versions
- Different hardware configurations
- Various software environments

This ensures compatibility and catches regressions early in the development process.
