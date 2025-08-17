# Contributing to Scratch Pad

Thank you for your interest in contributing to Scratch Pad! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful, inclusive, and constructive in all interactions.

### Our Standards

- **Be respectful**: Treat everyone with respect and kindness
- **Be inclusive**: Welcome newcomers and help them get started
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Remember that everyone has different experience levels
- **Be collaborative**: Work together towards common goals

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** (v18 or later)
- **pnpm** package manager
- **Rust** (latest stable)
- **Git** for version control
- **Code editor** (VS Code recommended)

### Development Environment

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/scratch-pad.git
   cd scratch-pad
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   ```

4. **Start development server**:

   ```bash
   pnpm tauri:dev
   ```

## Development Setup

### Project Structure

```text
scratch-pad/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries and store
│   └── types/             # TypeScript type definitions
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   └── tests/             # Rust tests
├── docs/                  # Documentation
├── .github/workflows/     # CI/CD workflows
└── .kiro/specs/          # Feature specifications
```

### Available Scripts

```bash
# Development
pnpm tauri:dev          # Start development server
pnpm dev                # Start Vite dev server only

# Building
pnpm build              # Build frontend
pnpm tauri:build        # Build complete application

# Testing
pnpm test               # Run frontend tests
pnpm test:watch         # Run tests in watch mode
cd src-tauri && cargo test  # Run backend tests

# Code Quality
pnpm lint               # Run ESLint
pnpm type-check         # TypeScript type checking
pnpm format             # Format code with Prettier
```

### Environment Configuration

Create a `.env.local` file for local development settings:

```bash
# Optional: Custom development settings
VITE_DEV_MODE=true
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes**: Fix issues and improve stability
- ✨ **New features**: Add new functionality
- 📚 **Documentation**: Improve or add documentation
- 🎨 **UI/UX improvements**: Enhance user interface and experience
- ⚡ **Performance**: Optimize performance and resource usage
- 🧪 **Tests**: Add or improve test coverage
- 🔧 **Tooling**: Improve development tools and processes

### Before You Start

1. **Check existing issues**: Look for existing issues or discussions
2. **Create an issue**: For significant changes, create an issue first to discuss
3. **Get feedback**: Engage with maintainers and community for guidance
4. **Start small**: Begin with small contributions to get familiar with the codebase

### Coding Standards

#### Frontend (TypeScript/React)

- **TypeScript**: Use strict TypeScript with proper typing
- **React**: Follow React best practices and hooks patterns
- **Styling**: Use Tailwind CSS classes, avoid custom CSS when possible
- **Components**: Create reusable, well-documented components
- **State**: Use Zustand for state management following established patterns

#### Backend (Rust)

- **Rust**: Follow Rust best practices and idioms
- **Error Handling**: Use proper error types and handling
- **Documentation**: Document public APIs with rustdoc
- **Testing**: Write unit tests for all new functionality
- **Performance**: Consider performance implications of changes

#### General Guidelines

- **Formatting**: Use provided formatters (Prettier for TS, rustfmt for Rust)
- **Linting**: Fix all linting errors before submitting
- **Comments**: Write clear, helpful comments for complex logic
- **Naming**: Use descriptive, consistent naming conventions

## Pull Request Process

### 1. Prepare Your Changes

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code changes ...

# Test your changes
pnpm test
cd src-tauri && cargo test

# Lint and format
pnpm lint
pnpm format
```

### 2. Commit Guidelines

Use conventional commit messages:

```bash
# Format: type(scope): description
git commit -m "feat(ui): add dark mode toggle"
git commit -m "fix(search): resolve fuzzy search performance issue"
git commit -m "docs: update installation guide"
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 3. Submit Pull Request

1. **Push** your branch to your fork
2. **Create** a pull request on GitHub
3. **Fill out** the PR template completely
4. **Link** related issues using keywords (e.g., "Fixes #123")
5. **Request review** from maintainers

### 4. PR Requirements

- ✅ All tests pass
- ✅ Code is properly formatted and linted
- ✅ Documentation is updated if needed
- ✅ PR description explains the changes
- ✅ Breaking changes are clearly marked
- ✅ Screenshots for UI changes

## Issue Guidelines

### Bug Reports

When reporting bugs, include:

- **Environment**: OS, version, installation method
- **Steps to reproduce**: Clear, step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Logs**: Any error messages or console output

### Feature Requests

For feature requests, provide:

- **Problem description**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you've thought of
- **Use cases**: When would this be useful?
- **Implementation ideas**: Technical suggestions (optional)

### Issue Labels

We use labels to categorize issues:

- `bug`: Something isn't working
- `enhancement`: New feature or improvement
- `documentation`: Documentation needs
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `question`: Further information requested

## Development Workflow

### Feature Development

1. **Plan**: Create or discuss an issue first
2. **Branch**: Create a feature branch from `main`
3. **Develop**: Implement the feature with tests
4. **Test**: Ensure all tests pass
5. **Document**: Update documentation as needed
6. **Review**: Submit PR and address feedback
7. **Merge**: Maintainer merges after approval

### Bug Fixes

1. **Reproduce**: Confirm the bug exists
2. **Investigate**: Understand the root cause
3. **Fix**: Implement the minimal fix
4. **Test**: Add tests to prevent regression
5. **Verify**: Ensure the fix works
6. **Submit**: Create PR with clear description

## Testing

### Frontend Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

**Testing Guidelines:**

- Write tests for new components and functions
- Test user interactions and edge cases
- Mock external dependencies appropriately
- Aim for high test coverage (>90%)

### Backend Testing

```bash
# Run Rust tests
cd src-tauri
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

**Testing Guidelines:**

- Test all public APIs
- Test error conditions
- Use integration tests for complex workflows
- Mock external dependencies

### Integration Testing

```bash
# Run integration tests
cd src-tauri
./test_integration.sh    # Unix/Linux/macOS
./test_integration.ps1   # Windows
```

## Documentation

### Types of Documentation

- **User Documentation**: Guides for end users
- **API Documentation**: Technical API references
- **Developer Documentation**: Setup and contribution guides
- **Code Documentation**: Inline comments and docstrings

### Documentation Standards

- **Clear and concise**: Easy to understand
- **Up-to-date**: Keep in sync with code changes
- **Examples**: Include practical examples
- **Screenshots**: Visual aids for UI features
- **Cross-references**: Link related documentation

### Updating Documentation

When making changes that affect users or developers:

1. **Update relevant documentation files**
2. **Add examples for new features**
3. **Update screenshots if UI changed**
4. **Review for clarity and accuracy**

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Workflow

1. **Prepare**: Update version numbers and changelog
2. **Test**: Ensure all tests pass on all platforms
3. **Tag**: Create git tag with version number
4. **Build**: Automated builds create release artifacts
5. **Publish**: Release is published with changelog
6. **Announce**: Notify community of new release

### Pre-release Testing

Before major releases:

- Test on all supported platforms
- Verify installation packages work
- Check documentation is current
- Validate upgrade/migration paths

## Getting Help

### Resources

- 📖 **Documentation**: [docs/](docs/) directory
- 🐛 **Issues**: [GitHub Issues](https://github.com/pinkydprojects/scratch-pad/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/pinkydprojects/scratch-pad/discussions)
- 📧 **Contact**: Create an issue for questions

### Community

- Be patient - maintainers are volunteers
- Search existing issues before creating new ones
- Provide detailed information in bug reports
- Be respectful in all interactions

## Recognition

Contributors are recognized in:

- **Release notes**: Major contributors mentioned
- **Contributors file**: All contributors listed
- **GitHub**: Automatic contributor recognition

Thank you for contributing to Scratch Pad! 🎉

---

**Questions?** Feel free to create an issue or start a discussion. We're here to help!
