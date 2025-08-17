# Release Template

Use this template when creating releases for Scratch Pad.

## Pre-Release Checklist

### Version Preparation

- [ ] Update version in `package.json`
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update version in `src-tauri/Cargo.toml`
- [ ] Update `CHANGELOG.md` with new version and changes
- [ ] Update documentation if needed

### Testing

- [ ] All tests pass locally (`pnpm test` and `cargo test`)
- [ ] Manual testing on primary development platform
- [ ] Cross-platform testing (if possible)
- [ ] Integration tests pass
- [ ] Performance regression testing

### Documentation

- [ ] User documentation is up to date
- [ ] Installation instructions are current
- [ ] Breaking changes are documented
- [ ] Migration guide (if needed)

## Release Process

### 1. Create Release Tag

```bash
# Ensure you're on main branch and up to date
git checkout main
git pull origin main

# Create and push tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

### 2. Monitor Build Process

- [ ] GitHub Actions build completes successfully
- [ ] All platform builds succeed
- [ ] Release assets are uploaded
- [ ] Checksums are generated

### 3. Post-Release Tasks

- [ ] Test download links work
- [ ] Verify installation on different platforms
- [ ] Update AUR package (if applicable)
- [ ] Announce release (if applicable)
- [ ] Close related issues and milestones

## Release Notes Template

````markdown
# Scratch Pad v0.1.0

Brief description of this release and its significance.

## 🎉 Highlights

- Major new feature or improvement
- Important bug fix
- Performance enhancement

## ✨ New Features

- Feature 1: Description
- Feature 2: Description

## 🐛 Bug Fixes

- Fix 1: Description
- Fix 2: Description

## 🔧 Improvements

- Improvement 1: Description
- Improvement 2: Description

## ⚠️ Breaking Changes

- Breaking change 1: Description and migration steps
- Breaking change 2: Description and migration steps

## 📥 Installation

### Windows

- **MSI Installer**: `scratch-pad_v0.1.0_x64_en-US.msi`
- **NSIS Installer**: `scratch-pad_v0.1.0_x64-setup.exe`

### macOS

- **Universal Binary**: `scratch-pad_v0.1.0_universal.dmg` (Intel + Apple Silicon)
- **Intel**: `scratch-pad_v0.1.0_x64.dmg`
- **Apple Silicon**: `scratch-pad_v0.1.0_aarch64.dmg`

### Linux

- **DEB Package**: `scratch-pad_v0.1.0_amd64.deb`
- **AppImage**: `scratch-pad_v0.1.0_amd64.AppImage`

## 🔐 Verification

All binaries can be verified using the provided `checksums.txt` file:

```bash
sha256sum -c checksums.txt
```
````

## 📖 Documentation

- [User Guide](https://github.com/pinkydprojects/scratch-pad/blob/main/docs/USER_GUIDE.md)
- [Installation Guide](https://github.com/pinkydprojects/scratch-pad/blob/main/docs/INSTALLATION.md)
- [Contributing Guide](https://github.com/pinkydprojects/scratch-pad/blob/main/CONTRIBUTING.md)

## 🙏 Contributors

Thanks to all contributors who made this release possible:

- @contributor1
- @contributor2

## 🐛 Known Issues

- Issue 1: Description and workaround
- Issue 2: Description and workaround

## 📞 Support

- 🐛 [Report Issues](https://github.com/pinkydprojects/scratch-pad/issues)
- 💬 [Discussions](https://github.com/pinkydprojects/scratch-pad/discussions)
- 📖 [Documentation](https://github.com/pinkydprojects/scratch-pad/tree/main/docs)

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

## Release Types

### Major Release (1.0.0, 2.0.0)

- Significant new features
- Breaking changes
- Architecture changes
- Requires comprehensive testing

### Minor Release (0.1.0, 0.2.0)

- New features
- Improvements
- Non-breaking changes
- Regular testing required

### Patch Release (0.1.1, 0.1.2)

- Bug fixes
- Security fixes
- Small improvements
- Minimal testing required

## Emergency Release Process

For critical security fixes or major bugs:

1. **Create hotfix branch** from latest release tag
2. **Apply minimal fix** with tests
3. **Fast-track testing** on critical platforms
4. **Create emergency release** with clear notes
5. **Follow up** with proper testing and documentation

## Rollback Process

If a release has critical issues:

1. **Identify the issue** and impact
2. **Create rollback plan** if needed
3. **Communicate** with users about the issue
4. **Prepare fixed version** as quickly as possible
5. **Test thoroughly** before re-release

## Communication

### Internal

- Update team on release progress
- Document any issues encountered
- Share lessons learned

### External

- Release notes on GitHub
- Update documentation
- Community announcements (if applicable)

## Automation

The release process is largely automated through GitHub Actions:

- **Triggered by**: Git tags matching `v*`
- **Builds**: All supported platforms automatically
- **Uploads**: Release assets to GitHub Releases
- **Generates**: Checksums for verification
- **Creates**: Release notes from changelog

## Troubleshooting

### Build Failures

- Check GitHub Actions logs
- Verify all dependencies are available
- Ensure code compiles on all platforms
- Check for environment-specific issues

### Upload Failures

- Verify GitHub token permissions
- Check network connectivity
- Ensure release was created successfully
- Retry failed uploads if needed

### Verification Issues

- Regenerate checksums if needed
- Verify file integrity
- Test downloads on different networks
- Check file permissions and accessibility
