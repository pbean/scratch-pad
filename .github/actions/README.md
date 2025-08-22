# GitHub Actions Composite Actions

This directory contains reusable composite actions for the Scratch Pad project CI/CD pipeline. These actions reduce duplication across workflows and provide consistent setup and execution patterns.

## Available Composite Actions

### 🔧 setup-node-pnpm

Sets up Node.js environment with PNPM package manager and caching.

**Inputs:**
- `node-version` (optional): Node.js version to use (default: '20')
- `pnpm-version` (optional): PNPM version to use (default: '10')
- `cache-dependency-path` (optional): Path to package.json for cache key (default: 'package.json')

**Usage:**
```yaml
- name: Setup Node.js and PNPM
  uses: ./.github/actions/setup-node-pnpm
  with:
    node-version: '20'
    pnpm-version: '10'
```

### 🦀 setup-rust

Sets up Rust toolchain with caching and optional targets/components.

**Inputs:**
- `toolchain` (optional): Rust toolchain version (default: 'stable')
- `targets` (optional): Additional targets to install (space-separated)
- `components` (optional): Additional components to install (space-separated)
- `cache-workspaces` (optional): Workspaces to cache (default: 'src-tauri')

**Usage:**
```yaml
- name: Setup Rust toolchain
  uses: ./.github/actions/setup-rust
  with:
    toolchain: 'stable'
    targets: 'x86_64-apple-darwin aarch64-apple-darwin'
    components: 'llvm-tools-preview'
```

### 🐧 install-linux-deps

Installs Linux system dependencies for Tauri application builds.

**Inputs:**
- `additional-packages` (optional): Additional apt packages to install (space-separated)

**Usage:**
```yaml
- name: Install Linux dependencies
  if: runner.os == 'Linux'
  uses: ./.github/actions/install-linux-deps
  with:
    additional-packages: 'libfoo-dev libbar-dev'
```

### 🏗️ build-frontend

Builds frontend application with optional quality checks.

**Inputs:**
- `run-tests` (optional): Run frontend tests (default: 'true')
- `run-type-check` (optional): Run TypeScript type checking (default: 'true')
- `run-lint` (optional): Run ESLint (default: 'true')
- `test-coverage` (optional): Generate test coverage (default: 'false')
- `build-production` (optional): Build for production (default: 'true')

**Usage:**
```yaml
- name: Build frontend with tests
  uses: ./.github/actions/build-frontend
  with:
    run-tests: 'true'
    run-type-check: 'true'
    run-lint: 'true'
    test-coverage: 'true'
    build-production: 'true'
```

### 🧪 run-tests

Executes frontend and backend tests with optional performance monitoring and high-resolution timestamps.

**Inputs:**
- `run-frontend-tests` (optional): Run frontend tests (default: 'true')
- `run-backend-tests` (optional): Run backend tests (default: 'true')
- `run-integration-tests` (optional): Run integration tests (default: 'true')
- `performance-monitoring` (optional): Enable performance monitoring (default: 'false')
- `test-timeout` (optional): Test timeout in seconds (default: '300')
- `platform` (optional): Current platform for conditional test execution

**Outputs:**
- `frontend-test-result`: Frontend test execution result
- `backend-test-result`: Backend test execution result
- `integration-test-result`: Integration test execution result
- `performance-metrics`: Performance metrics JSON

**Usage:**
```yaml
- name: Run tests with performance monitoring
  id: test-run
  uses: ./.github/actions/run-tests
  with:
    run-frontend-tests: 'true'
    run-backend-tests: 'true'
    run-integration-tests: 'true'
    performance-monitoring: 'true'
    platform: ${{ matrix.os }}

- name: Check test results
  run: |
    echo "Frontend: ${{ steps.test-run.outputs.frontend-test-result }}"
    echo "Backend: ${{ steps.test-run.outputs.backend-test-result }}"
    echo "Integration: ${{ steps.test-run.outputs.integration-test-result }}"
```

## Reusable Workflows

### 🔄 reusable-test.yml

A comprehensive reusable workflow for cross-platform testing with performance monitoring.

**Inputs:**
- `platforms`: JSON array of platforms to test on
- `node-version`: Node.js version to use
- `rust-toolchain`: Rust toolchain version
- `run-frontend-tests`: Run frontend tests
- `run-backend-tests`: Run backend tests
- `run-integration-tests`: Run integration tests
- `performance-monitoring`: Enable performance monitoring
- `test-coverage`: Generate test coverage
- `fail-fast`: Fail fast on first error

**Outputs:**
- `test-results`: JSON object with test results for all platforms
- `performance-metrics`: Aggregated performance metrics

**Usage:**
```yaml
jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      platforms: '["ubuntu-latest", "windows-latest", "macos-latest"]'
      performance-monitoring: true
      test-coverage: false
      fail-fast: false
```

### 📊 performance-test.yml

Enhanced workflow that leverages performance monitoring capabilities for detailed analysis and reporting.

**Features:**
- Cross-platform performance testing
- High-resolution timestamp tracking
- Performance trend analysis
- Automated threshold checking
- PR comments with performance results
- Performance metrics aggregation and visualization

**Triggers:**
- Push to main/develop branches
- Pull requests
- Daily scheduled runs (4 AM UTC)
- Manual workflow dispatch with customizable parameters

## Performance Monitoring Features

### High-Resolution Timestamps

All test executions include microsecond-precision timestamps for accurate performance measurement:

```json
{
  "test_type": "frontend",
  "start_time": "2025-01-21T10:30:45.123456Z",
  "end_time": "2025-01-21T10:32:15.789012Z",
  "result": "success",
  "platform": "ubuntu-latest"
}
```

### Performance Metrics Collection

- Test execution duration tracking
- Platform-specific performance comparison
- Success rate monitoring
- Resource usage insights
- Performance trend analysis

### Automated Reporting

- GitHub Actions step summaries
- PR comments with performance insights
- Performance threshold alerts
- Long-term metrics storage

## Integration Examples

### Basic CI/CD Pipeline

```yaml
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./.github/actions/setup-node-pnpm
      - uses: ./.github/actions/setup-rust
      - uses: ./.github/actions/install-linux-deps
      - uses: ./.github/actions/build-frontend
      - uses: ./.github/actions/run-tests
```

### Cross-Platform Testing

```yaml
name: Cross-Platform Tests
on: [push, pull_request]

jobs:
  test:
    uses: ./.github/workflows/reusable-test.yml
    with:
      platforms: '["ubuntu-latest", "windows-latest", "macos-latest"]'
      performance-monitoring: true
```

### Performance Monitoring

```yaml
name: Performance Tests
on:
  schedule:
    - cron: '0 4 * * *'  # Daily at 4 AM UTC

jobs:
  performance:
    uses: ./.github/workflows/performance-test.yml
    with:
      performance-monitoring: true
      test-coverage: true
```

## Best Practices

1. **Always use composite actions** for common setup tasks to maintain consistency
2. **Enable performance monitoring** for important workflows to track performance trends
3. **Use reusable workflows** for complex multi-step processes
4. **Customize inputs** based on specific workflow requirements
5. **Monitor performance thresholds** and act on alerts
6. **Review performance metrics** regularly to identify optimization opportunities

## Maintenance

These composite actions are designed to be:
- **Maintainable**: Centralized logic reduces duplication
- **Flexible**: Configurable inputs adapt to different use cases
- **Observable**: Built-in performance monitoring and reporting
- **Reliable**: Consistent setup patterns reduce failures

When updating actions, ensure backward compatibility and test across all using workflows.