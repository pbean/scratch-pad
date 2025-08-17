# Installation Guide

This guide provides detailed installation instructions for Scratch Pad across all supported platforms.

## System Requirements

### Windows

- **Operating System**: Windows 10 (version 1903) or later
- **Architecture**: x64 (64-bit)
- **Runtime**: WebView2 (automatically installed if not present)
- **Disk Space**: ~50 MB for installation
- **Memory**: Minimum 4 GB RAM recommended

### macOS

- **Operating System**: macOS 10.13 (High Sierra) or later
- **Architecture**: Intel x64 or Apple Silicon (ARM64)
- **Disk Space**: ~50 MB for installation
- **Memory**: Minimum 4 GB RAM recommended

### Linux

- **Operating System**: Modern Linux distribution (Ubuntu 18.04+, Fedora 30+, etc.)
- **Architecture**: x64 (64-bit)
- **Dependencies**: GTK3, WebKit2GTK, AppIndicator3
- **Disk Space**: ~50 MB for installation
- **Memory**: Minimum 4 GB RAM recommended

## Download

Visit the [Releases page](https://github.com/pinkydprojects/scratch-pad/releases) to download the latest version for your platform.

### Available Downloads

| Platform              | File Format    | File Name Pattern                  |
| --------------------- | -------------- | ---------------------------------- |
| Windows               | MSI Installer  | `scratch-pad_X.X.X_x64_en-US.msi`  |
| Windows               | NSIS Installer | `scratch-pad_X.X.X_x64-setup.exe`  |
| macOS (Intel)         | DMG            | `scratch-pad_X.X.X_x64.dmg`        |
| macOS (Apple Silicon) | DMG            | `scratch-pad_X.X.X_aarch64.dmg`    |
| macOS (Universal)     | DMG            | `scratch-pad_X.X.X_universal.dmg`  |
| Linux                 | DEB Package    | `scratch-pad_X.X.X_amd64.deb`      |
| Linux                 | AppImage       | `scratch-pad_X.X.X_amd64.AppImage` |

## Installation Instructions

### Windows Installation

#### Option 1: MSI Installer (Recommended)

1. **Download** the MSI installer from the releases page
2. **Run** the installer by double-clicking the `.msi` file
3. **Follow** the installation wizard:
   - Accept the license agreement
   - Choose installation directory (default recommended)
   - Select additional tasks (desktop shortcut, etc.)
4. **Complete** the installation
5. **Launch** from Start Menu or desktop shortcut

#### Option 2: NSIS Installer

1. **Download** the NSIS installer (`.exe` file)
2. **Run** the installer as administrator if prompted
3. **Follow** the installation steps
4. **Launch** the application

#### Windows-Specific Notes

- **WebView2**: If not already installed, the installer will download and install Microsoft WebView2
- **User vs System Install**: The MSI installer supports both per-user and system-wide installation
- **Uninstall**: Use "Add or Remove Programs" in Windows Settings

### macOS Installation

#### Standard Installation

1. **Download** the appropriate DMG file:
   - Intel Macs: `x64.dmg`
   - Apple Silicon Macs: `aarch64.dmg`
   - Universal (both): `universal.dmg` (recommended)

2. **Open** the DMG file by double-clicking

3. **Drag** Scratch Pad to the Applications folder

4. **Launch** from Applications folder or Spotlight search

#### First Launch on macOS

1. **Security Prompt**: macOS may show a security warning for unsigned applications
2. **Allow the App**:
   - Go to System Preferences → Security & Privacy
   - Click "Open Anyway" next to the Scratch Pad warning
   - Or right-click the app and select "Open"

#### macOS-Specific Notes

- **Gatekeeper**: The app is notarized but may still require manual approval
- **Permissions**: The app may request permissions for accessibility features (for global shortcuts)
- **Uninstall**: Simply drag the app from Applications to Trash

### Linux Installation

#### Option 1: DEB Package (Debian/Ubuntu)

```bash
# Download the DEB package
wget https://github.com/pinkydprojects/scratch-pad/releases/latest/download/scratch-pad_0.1.0_amd64.deb

# Install the package
sudo dpkg -i scratch-pad_0.1.0_amd64.deb

# Install any missing dependencies
sudo apt-get install -f

# Launch the application
scratch-pad
```

#### Option 2: AppImage (Universal Linux)

```bash
# Download the AppImage
wget https://github.com/pinkydprojects/scratch-pad/releases/latest/download/scratch-pad_0.1.0_amd64.AppImage

# Make it executable
chmod +x scratch-pad_0.1.0_amd64.AppImage

# Run the application
./scratch-pad_0.1.0_amd64.AppImage

# Optional: Move to a directory in your PATH
sudo mv scratch-pad_0.1.0_amd64.AppImage /usr/local/bin/scratch-pad
```

#### Option 3: Arch Linux (AUR)

```bash
# Using yay AUR helper
yay -S scratch-pad

# Using paru AUR helper
paru -S scratch-pad

# Manual installation
git clone https://aur.archlinux.org/scratch-pad.git
cd scratch-pad
makepkg -si
```

#### Linux Dependencies

Most modern distributions include these dependencies, but you may need to install them manually:

**Ubuntu/Debian:**

```bash
sudo apt-get install libwebkit2gtk-4.0-37 libgtk-3-0 libayatana-appindicator3-1
```

**Fedora:**

```bash
sudo dnf install webkit2gtk3 gtk3 libappindicator-gtk3
```

**Arch Linux:**

```bash
sudo pacman -S webkit2gtk gtk3 libappindicator-gtk3
```

#### Linux-Specific Notes

- **Desktop Integration**: The DEB package includes a `.desktop` file for menu integration
- **Global Shortcuts**: May require additional permissions on some desktop environments
- **Wayland**: Fully supported on Wayland-based desktop environments
- **Uninstall**: Use your package manager or delete the AppImage file

## Post-Installation Setup

### First Launch Configuration

1. **Launch** Scratch Pad using your preferred method
2. **Set Global Shortcut**:
   - Default is `Ctrl+Shift+N` (Windows/Linux) or `Cmd+Shift+N` (macOS)
   - Change in Settings if needed
3. **Test Global Shortcut**: Press the shortcut to ensure it works
4. **Start Using**: The text area is automatically focused - start typing!

### Recommended Settings

After installation, consider configuring these settings:

1. **Global Shortcut**: Choose a combination that doesn't conflict with other apps
2. **Font Preferences**: Set your preferred UI and editor fonts
3. **Default Note Format**: Choose between Plain Text and Markdown
4. **Layout Mode**: Select your preferred window size/position

## Verification

### Verify Installation

To verify your installation is working correctly:

1. **Launch Test**: Open the application normally
2. **Global Shortcut Test**: Use the global shortcut to show/hide the window
3. **Note Creation Test**: Create a test note and verify it saves
4. **Search Test**: Create multiple notes and test the search functionality

### Version Check

To check your installed version:

1. Open Scratch Pad
2. Use the Command Palette (`Ctrl+P` or `Cmd+P`)
3. Look for version information in the settings or about section

## Troubleshooting Installation

### Windows Issues

**"Windows protected your PC" warning:**

- Click "More info" then "Run anyway"
- The app is safe but not code-signed with an expensive certificate

**WebView2 installation fails:**

- Download WebView2 manually from Microsoft's website
- Ensure you have administrator privileges

**MSI installation fails:**

- Run as administrator
- Check Windows Installer service is running
- Ensure sufficient disk space

### macOS Issues

**"App can't be opened because it is from an unidentified developer":**

- Right-click the app and select "Open"
- Or go to System Preferences → Security & Privacy → General → "Open Anyway"

**Global shortcuts not working:**

- Go to System Preferences → Security & Privacy → Privacy → Accessibility
- Add Scratch Pad to the list of allowed apps

### Linux Issues

**Missing dependencies:**

```bash
# Check what's missing
ldd /usr/bin/scratch-pad

# Install missing packages using your distribution's package manager
```

**AppImage won't run:**

```bash
# Ensure it's executable
chmod +x scratch-pad*.AppImage

# Check for FUSE (required for AppImage)
sudo apt-get install fuse  # Ubuntu/Debian
sudo dnf install fuse      # Fedora
```

**Global shortcuts not working:**

- Ensure your desktop environment supports global shortcuts
- Check for conflicting shortcuts in system settings

## Updating

### Automatic Updates

Currently, Scratch Pad requires manual updates. Automatic update functionality is planned for future releases.

### Manual Updates

1. **Download** the latest version from the releases page
2. **Uninstall** the current version (optional - new version can install over old)
3. **Install** the new version using the same method as initial installation
4. **Launch** and verify your notes are preserved

### Data Preservation

Your notes and settings are preserved during updates as they're stored separately from the application files.

## Uninstallation

### Windows

- Use "Add or Remove Programs" in Windows Settings
- Or run the uninstaller from the Start Menu

### macOS

- Drag Scratch Pad from Applications to Trash
- Optionally remove user data from `~/Library/Application Support/scratch-pad`

### Linux

```bash
# DEB package
sudo apt-get remove scratch-pad

# AppImage
rm /path/to/scratch-pad.AppImage

# AUR (Arch Linux)
yay -R scratch-pad
```

## Support

If you encounter installation issues:

1. Check the [Troubleshooting section](#troubleshooting-installation) above
2. Visit our [GitHub Issues](https://github.com/pinkydprojects/scratch-pad/issues) page
3. Create a new issue with:
   - Your operating system and version
   - Installation method attempted
   - Error messages received
   - Steps you've already tried

---

**Need Help?** Visit our [GitHub repository](https://github.com/pinkydprojects/scratch-pad) for support and documentation.
