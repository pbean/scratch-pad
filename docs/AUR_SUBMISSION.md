# AUR Submission Guide

This guide explains how to submit and maintain Scratch Pad packages on the Arch User Repository (AUR).

## Overview

We provide three AUR packages for different use cases:

1. **scratch-pad** - Build from source (stable releases)
2. **scratch-pad-bin** - Binary package (pre-built releases)
3. **scratch-pad-git** - Build from git (development version)

## Prerequisites

### For Maintainers

- Arch Linux system or Arch-based distribution
- AUR account with SSH key configured
- `base-devel` package group installed
- `git`, `pnpm`, and `rust` for building from source

### Setup AUR Account

1. Create account at <https://aur.archlinux.org/register>
2. Add your SSH public key to your AUR account
3. Configure git with your AUR credentials

## Package Descriptions

### scratch-pad (Source Package)

**File**: `PKGBUILD`

- Builds from source code of stable releases
- Downloads source tarball from GitHub releases
- Compiles using Rust and Node.js toolchain
- Recommended for most users who want stable versions

### scratch-pad-bin (Binary Package)

**File**: `PKGBUILD-bin`

- Uses pre-built DEB package from GitHub releases
- Faster installation (no compilation required)
- Good for users who want quick installation
- Automatically updated with each release

### scratch-pad-git (Development Package)

**File**: `PKGBUILD-git`

- Builds from latest git commit
- For users who want cutting-edge features
- Version number includes git revision
- May be unstable

## Submission Process

### Initial Submission

1. **Clone AUR repository**:

   ```bash
   git clone ssh://aur@aur.archlinux.org/scratch-pad.git
   cd scratch-pad
   ```

2. **Copy PKGBUILD**:

   ```bash
   cp /path/to/scratch-pad/PKGBUILD .
   ```

3. **Update checksums**:

   ```bash
   updpkgsums
   ```

4. **Test build**:

   ```bash
   makepkg -si
   ```

5. **Generate .SRCINFO**:

   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```

6. **Commit and push**:

   ```bash
   git add PKGBUILD .SRCINFO
   git commit -m "Initial import of scratch-pad"
   git push origin master
   ```

### For Each Package Type

Repeat the above process for each package:

- `scratch-pad` (main package)
- `scratch-pad-bin` (binary package)
- `scratch-pad-git` (git package)

## Maintenance

### Updating for New Releases

1. **Update version numbers**:

   ```bash
   # Edit PKGBUILD
   pkgver=0.2.0
   pkgrel=1
   ```

2. **Update checksums**:

   ```bash
   updpkgsums
   ```

3. **Test build**:

   ```bash
   makepkg -si
   ```

4. **Update .SRCINFO**:

   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```

5. **Commit changes**:

   ```bash
   git add PKGBUILD .SRCINFO
   git commit -m "Update to version 0.2.0"
   git push origin master
   ```

### Automated Updates

Consider setting up automation for binary package updates:

```bash
#!/bin/bash
# update-aur.sh - Script to update AUR packages

LATEST_VERSION=$(curl -s https://api.github.com/repos/paulb/scratch-pad/releases/latest | jq -r .tag_name | sed 's/v//')
CURRENT_VERSION=$(grep pkgver PKGBUILD | cut -d'=' -f2)

if [ "$LATEST_VERSION" != "$CURRENT_VERSION" ]; then
    sed -i "s/pkgver=.*/pkgver=$LATEST_VERSION/" PKGBUILD
    sed -i "s/pkgrel=.*/pkgrel=1/" PKGBUILD
    updpkgsums
    makepkg --printsrcinfo > .SRCINFO
    git add PKGBUILD .SRCINFO
    git commit -m "Update to version $LATEST_VERSION"
    git push origin master
fi
```

## Testing

### Local Testing

Before submitting updates:

1. **Clean build**:

   ```bash
   makepkg -sc
   ```

2. **Install and test**:

   ```bash
   makepkg -si
   scratch-pad --version
   ```

3. **Test functionality**:
   - Launch application
   - Test global shortcuts
   - Create and save notes
   - Test search functionality

### Validation

Use `namcap` to check package quality:

```bash
namcap PKGBUILD
namcap scratch-pad-*.pkg.tar.xz
```

## Package Guidelines

### PKGBUILD Best Practices

- Follow [Arch packaging standards](https://wiki.archlinux.org/title/PKGBUILD)
- Use proper dependency declarations
- Include all required files
- Set correct permissions
- Validate checksums

### Dependencies

**Runtime Dependencies**:

- `webkit2gtk` - Web rendering engine
- `gtk3` - GUI toolkit
- `libayatana-appindicator` - System tray support

**Build Dependencies**:

- `rust` - Rust compiler
- `nodejs` - Node.js runtime
- `pnpm` - Package manager
- `git` - Version control (for git package)

### File Installation

Ensure all necessary files are installed:

- Binary: `/usr/bin/scratch-pad`
- Desktop file: `/usr/share/applications/scratch-pad.desktop`
- Icons: `/usr/share/icons/hicolor/*/apps/scratch-pad.png`
- License: `/usr/share/licenses/scratch-pad/LICENSE`
- Documentation: `/usr/share/doc/scratch-pad/`

## Troubleshooting

### Common Issues

**Build failures**:

- Check Rust toolchain is up to date
- Verify Node.js and pnpm versions
- Ensure all dependencies are installed

**Missing dependencies**:

- Update dependency list in PKGBUILD
- Check for new runtime requirements

**Permission issues**:

- Verify file permissions in package()
- Check desktop file installation

### Getting Help

- [AUR Guidelines](https://wiki.archlinux.org/title/AUR_submission_guidelines)
- [PKGBUILD Manual](https://wiki.archlinux.org/title/PKGBUILD)
- [Arch Forums](https://bbs.archlinux.org/)

## Maintenance Schedule

### Regular Tasks

- **Weekly**: Check for new releases
- **Monthly**: Verify packages still build correctly
- **As needed**: Respond to user comments and bug reports

### Release Process

1. **Monitor releases**: Watch GitHub for new releases
2. **Update packages**: Update all three package variants
3. **Test thoroughly**: Ensure packages work correctly
4. **Respond to feedback**: Address user issues promptly

## Contact

For AUR-specific issues:

- Comment on the AUR package page
- Email the package maintainer
- Create issues on the main GitHub repository

## Automation

### GitHub Actions Integration

Consider adding AUR update automation to the main repository:

```yaml
name: Update AUR
on:
  release:
    types: [published]

jobs:
  update-aur:
    runs-on: ubuntu-latest
    steps:
      - name: Update AUR packages
        # Script to automatically update AUR packages
        # when new releases are published
```

This ensures AUR packages stay synchronized with releases.

---

**Note**: This guide assumes familiarity with Arch Linux packaging. Consult the official AUR documentation for detailed guidelines.
