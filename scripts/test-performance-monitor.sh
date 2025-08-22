#!/bin/bash

##
# Test Performance Monitoring Script for CI/CD
# 
# Runs tests with high-resolution performance tracking and generates
# comprehensive performance reports for CI/CD pipeline integration.
##

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/.claude/reports/performance"
TRENDS_DIR="$REPORTS_DIR/trends"
ARTIFACTS_DIR="$REPORTS_DIR/artifacts"

# Performance monitoring configuration
PERF_CONFIG_FILE="$PROJECT_ROOT/performance-config.json"
SLOW_TEST_THRESHOLD_MS=1000
MEMORY_THRESHOLD_MB=500
BUDGET_VIOLATION_THRESHOLD=5

# Output configuration
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
FRONTEND_REPORT="$REPORTS_DIR/frontend-performance-$TIMESTAMP.json"
BACKEND_REPORT="$REPORTS_DIR/backend-performance-$TIMESTAMP.json"
COMBINED_REPORT="$REPORTS_DIR/combined-performance-$TIMESTAMP.json"
HTML_REPORT="$REPORTS_DIR/performance-dashboard-$TIMESTAMP.html"

# CI/CD integration
CI_MODE="${CI:-false}"
FAIL_ON_BUDGET_VIOLATION="${FAIL_ON_BUDGET_VIOLATION:-true}"
EXPORT_METRICS="${EXPORT_METRICS:-true}"
COMPARE_WITH_BASELINE="${COMPARE_WITH_BASELINE:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Format duration for display
format_duration() {
    local micros=$1
    if [ "$micros" -ge 1000000 ]; then
        echo "$(echo "scale=2; $micros / 1000000" | bc)s"
    elif [ "$micros" -ge 1000 ]; then
        echo "$(echo "scale=2; $micros / 1000" | bc)ms"
    else
        echo "${micros}μs"
    fi
}

# Parse JSON with jq or fallback
parse_json() {
    local json_file="$1"
    local query="$2"
    
    if command_exists jq; then
        jq -r "$query" "$json_file" 2>/dev/null || echo "null"
    else
        # Fallback for environments without jq
        grep -o "\"$query\"[^,}]*" "$json_file" | cut -d'"' -f4 || echo "null"
    fi
}

# ============================================================================
# SETUP AND INITIALIZATION
# ============================================================================

setup_directories() {
    log "Setting up performance monitoring directories..."
    
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$TRENDS_DIR"
    mkdir -p "$ARTIFACTS_DIR"
    
    # Create .gitignore for reports directory
    cat > "$REPORTS_DIR/.gitignore" << EOF
# Performance reports are CI artifacts
*.json
*.csv
*.html
artifacts/
trends/

# Keep directory structure
!.gitignore
!README.md
EOF
    
    # Create README
    cat > "$REPORTS_DIR/README.md" << EOF
# Test Performance Reports

This directory contains test performance monitoring reports and artifacts.

## Report Types

- \`frontend-performance-*.json\` - Frontend (Vitest) performance metrics
- \`backend-performance-*.json\` - Backend (Rust) performance metrics
- \`combined-performance-*.json\` - Combined performance analysis
- \`performance-dashboard-*.html\` - Visual performance dashboard

## Trends

The \`trends/\` directory contains historical performance data for tracking
performance regression over time.

## Artifacts

The \`artifacts/\` directory contains supporting files like performance
profiles, flame graphs, and detailed trace data.
EOF
}

create_performance_config() {
    if [ ! -f "$PERF_CONFIG_FILE" ]; then
        log "Creating default performance configuration..."
        
        cat > "$PERF_CONFIG_FILE" << EOF
{
  "frontend": {
    "enableDetailedTiming": true,
    "enableBudgetWarnings": true,
    "slowTestThreshold": ${SLOW_TEST_THRESHOLD_MS}000,
    "showMemoryUsage": true,
    "groupByFile": true,
    "budgets": {
      "unit": {
        "maxDurationMicros": 100000,
        "maxMemoryBytes": 52428800
      },
      "integration": {
        "maxDurationMicros": 5000000,
        "maxMemoryBytes": 524288000
      }
    }
  },
  "backend": {
    "enableDetailedTiming": true,
    "enableBudgetWarnings": true,
    "slowTestThreshold": ${SLOW_TEST_THRESHOLD_MS}000,
    "budgets": {
      "unit": {
        "maxDurationMicros": 50000,
        "maxMemoryBytes": 10485760
      },
      "integration": {
        "maxDurationMicros": 10000000,
        "maxMemoryBytes": 1073741824
      }
    }
  },
  "ci": {
    "failOnBudgetViolation": $FAIL_ON_BUDGET_VIOLATION,
    "exportMetrics": $EXPORT_METRICS,
    "compareWithBaseline": $COMPARE_WITH_BASELINE,
    "maxBudgetViolations": $BUDGET_VIOLATION_THRESHOLD
  }
}
EOF
    fi
}

# ============================================================================
# FRONTEND PERFORMANCE TESTING
# ============================================================================

run_frontend_performance_tests() {
    log "Running frontend performance tests..."
    
    cd "$PROJECT_ROOT"
    
    # Create custom Vitest config for performance testing
    cat > vitest.performance.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createCIPerformanceReporter } from './src/test/performance-reporter'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,
    reporters: [
      'default',
      createCIPerformanceReporter(process.env.FRONTEND_REPORT || './frontend-performance.json')
    ],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    coverage: {
      reporter: ['text', 'json']
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.trunk/**',
      '**/commitlint.test.ts',
      '**/poetry.test.ts',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ]
  }
})
EOF

    # Set environment variables for performance tracking
    export FRONTEND_REPORT="$FRONTEND_REPORT"
    export PERFORMANCE_TRACKING_ENABLED=true
    export PERFORMANCE_BUDGET_WARNINGS=true
    
    # Run tests with performance tracking
    if pnpm vitest run --config vitest.performance.config.ts --reporter=verbose; then
        success "Frontend performance tests completed successfully"
        
        # Cleanup temp config
        rm -f vitest.performance.config.ts
        
        return 0
    else
        error "Frontend performance tests failed"
        rm -f vitest.performance.config.ts
        return 1
    fi
}

# ============================================================================
# BACKEND PERFORMANCE TESTING  
# ============================================================================

run_backend_performance_tests() {
    log "Running backend performance tests..."
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Set environment variables for Rust performance tracking
    export RUST_PERFORMANCE_REPORT="$BACKEND_REPORT"
    export RUST_PERFORMANCE_TRACKING=1
    export RUST_LOG=debug
    
    # Run Rust tests with performance tracking
    if timeout 300 cargo test --features performance-tracking -- --nocapture; then
        success "Backend performance tests completed successfully"
        return 0
    else
        warn "Backend performance tests completed with issues"
        return 1
    fi
}

# ============================================================================
# PERFORMANCE ANALYSIS
# ============================================================================

analyze_performance_results() {
    log "Analyzing performance results..."
    
    local frontend_success=false
    local backend_success=false
    local total_violations=0
    
    # Analyze frontend results
    if [ -f "$FRONTEND_REPORT" ]; then
        frontend_success=true
        local fe_violations=$(parse_json "$FRONTEND_REPORT" '.stats.failingTests')
        if [ "$fe_violations" != "null" ] && [ "$fe_violations" -gt 0 ]; then
            warn "Frontend has $fe_violations performance budget violations"
            total_violations=$((total_violations + fe_violations))
        fi
    else
        warn "Frontend performance report not found: $FRONTEND_REPORT"
    fi
    
    # Analyze backend results
    if [ -f "$BACKEND_REPORT" ]; then
        backend_success=true
        local be_violations=$(parse_json "$BACKEND_REPORT" '.stats.failingTests')
        if [ "$be_violations" != "null" ] && [ "$be_violations" -gt 0 ]; then
            warn "Backend has $be_violations performance budget violations"
            total_violations=$((total_violations + be_violations))
        fi
    else
        warn "Backend performance report not found: $BACKEND_REPORT"
    fi
    
    # Generate combined report
    if [ "$frontend_success" = true ] || [ "$backend_success" = true ]; then
        generate_combined_report
    fi
    
    # Check if we should fail on violations
    if [ "$FAIL_ON_BUDGET_VIOLATION" = "true" ] && [ "$total_violations" -gt "$BUDGET_VIOLATION_THRESHOLD" ]; then
        error "Too many performance budget violations: $total_violations > $BUDGET_VIOLATION_THRESHOLD"
        return 1
    fi
    
    success "Performance analysis completed"
    return 0
}

generate_combined_report() {
    log "Generating combined performance report..."
    
    # Create combined JSON report
    cat > "$COMBINED_REPORT" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "environment": {
    "ci": $CI_MODE,
    "node_version": "$(node --version 2>/dev/null || echo 'unknown')",
    "rust_version": "$(rustc --version 2>/dev/null || echo 'unknown')",
    "platform": "$(uname -s)",
    "arch": "$(uname -m)"
  },
  "configuration": {
    "slowTestThreshold": $SLOW_TEST_THRESHOLD_MS,
    "memoryThreshold": $MEMORY_THRESHOLD_MB,
    "budgetViolationThreshold": $BUDGET_VIOLATION_THRESHOLD
  },
EOF

    # Add frontend data if available
    if [ -f "$FRONTEND_REPORT" ]; then
        echo '  "frontend": ' >> "$COMBINED_REPORT"
        cat "$FRONTEND_REPORT" >> "$COMBINED_REPORT"
        echo ',' >> "$COMBINED_REPORT"
    fi
    
    # Add backend data if available
    if [ -f "$BACKEND_REPORT" ]; then
        echo '  "backend": ' >> "$COMBINED_REPORT"
        cat "$BACKEND_REPORT" >> "$COMBINED_REPORT"
        echo ',' >> "$COMBINED_REPORT"
    fi
    
    # Close JSON
    echo '  "generated": "test-performance-monitor.sh"' >> "$COMBINED_REPORT"
    echo '}' >> "$COMBINED_REPORT"
    
    # Generate HTML dashboard
    generate_html_dashboard
}

generate_html_dashboard() {
    log "Generating HTML performance dashboard..."
    
    cat > "$HTML_REPORT" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Performance Dashboard</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-list { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .test-item:last-child { border-bottom: none; }
        .test-duration { font-weight: bold; }
        .test-slow { color: #ffc107; }
        .test-fast { color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Test Performance Dashboard</h1>
            <p>Generated on: <span id="timestamp"></span></p>
        </div>
        
        <div class="metrics" id="metrics">
            <!-- Metrics will be populated by JavaScript -->
        </div>
        
        <div class="chart-container">
            <h2>📊 Performance Overview</h2>
            <div id="performance-chart">
                <p>Performance visualization would be displayed here with a proper charting library.</p>
            </div>
        </div>
        
        <div class="test-list">
            <h2>🐌 Slowest Tests</h2>
            <div id="slow-tests">
                <!-- Slow tests will be populated by JavaScript -->
            </div>
        </div>
    </div>

    <script>
        // This would normally load the actual performance data
        // For now, we'll show placeholder content
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
        
        // Placeholder metrics
        const metrics = [
            { label: 'Total Tests', value: '-', class: 'success' },
            { label: 'Average Duration', value: '-', class: 'success' },
            { label: 'Budget Violations', value: '-', class: 'warning' },
            { label: 'Memory Usage', value: '-', class: 'success' }
        ];
        
        const metricsContainer = document.getElementById('metrics');
        metrics.forEach(metric => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = `
                <div class="metric-value ${metric.class}">${metric.value}</div>
                <div class="metric-label">${metric.label}</div>
            `;
            metricsContainer.appendChild(card);
        });
        
        // Placeholder slow tests
        const slowTestsContainer = document.getElementById('slow-tests');
        slowTestsContainer.innerHTML = '<p>No performance data available. Run tests with performance tracking enabled.</p>';
    </script>
</body>
</html>
EOF
}

# ============================================================================
# TREND ANALYSIS
# ============================================================================

update_performance_trends() {
    if [ "$COMPARE_WITH_BASELINE" != "true" ]; then
        return 0
    fi
    
    log "Updating performance trends..."
    
    local trends_file="$TRENDS_DIR/performance-trends.json"
    local current_data
    
    # Extract key metrics from combined report
    if [ -f "$COMBINED_REPORT" ]; then
        current_data=$(cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "commit": "${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}",
  "branch": "${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo 'unknown')}",
  "metrics": $(cat "$COMBINED_REPORT")
}
EOF
)
    else
        warn "No combined report available for trend analysis"
        return 0
    fi
    
    # Initialize trends file if it doesn't exist
    if [ ! -f "$trends_file" ]; then
        echo '{"trends": []}' > "$trends_file"
    fi
    
    # Add current data to trends (keep last 50 entries)
    if command_exists jq; then
        echo "$current_data" | jq -s '.[0] as $new | 
            (try (input | .trends) catch []) as $existing |
            {"trends": ([$new] + $existing)[:50]}' "$trends_file" > "$trends_file.tmp" &&
            mv "$trends_file.tmp" "$trends_file"
    else
        # Fallback without jq - just append (no limit)
        cp "$trends_file" "$trends_file.bak"
        echo "$current_data" >> "$trends_file"
    fi
    
    success "Performance trends updated"
}

# ============================================================================
# CI/CD INTEGRATION
# ============================================================================

export_ci_metrics() {
    if [ "$EXPORT_METRICS" != "true" ]; then
        return 0
    fi
    
    log "Exporting CI/CD metrics..."
    
    # GitHub Actions integration
    if [ "$CI_MODE" = "true" ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
        export_github_actions_metrics
    fi
    
    # Generic CI metrics export
    export_generic_ci_metrics
}

export_github_actions_metrics() {
    if [ ! -f "$COMBINED_REPORT" ]; then
        return 0
    fi
    
    # Extract key metrics
    local total_tests=$(parse_json "$COMBINED_REPORT" '.frontend.stats.totalTests // 0')
    local failing_tests=$(parse_json "$COMBINED_REPORT" '.frontend.stats.failingTests // 0')
    local avg_duration=$(parse_json "$COMBINED_REPORT" '.frontend.stats.avgDurationMicros // 0')
    
    # Set GitHub Actions outputs
    echo "total-tests=$total_tests" >> "$GITHUB_OUTPUT"
    echo "failing-tests=$failing_tests" >> "$GITHUB_OUTPUT"
    echo "avg-duration-micros=$avg_duration" >> "$GITHUB_OUTPUT"
    echo "performance-report=$COMBINED_REPORT" >> "$GITHUB_OUTPUT"
    
    # Create job summary
    cat >> "$GITHUB_STEP_SUMMARY" << EOF
## 📊 Test Performance Summary

- **Total Tests**: $total_tests
- **Budget Violations**: $failing_tests
- **Average Duration**: $(format_duration "$avg_duration")

[Download Full Report]($COMBINED_REPORT)
EOF
}

export_generic_ci_metrics() {
    # Create metrics summary for any CI system
    local metrics_summary="$ARTIFACTS_DIR/ci-metrics-$TIMESTAMP.txt"
    
    cat > "$metrics_summary" << EOF
# Test Performance Metrics - $(date -Iseconds)

TOTAL_TESTS=$(parse_json "$COMBINED_REPORT" '.frontend.stats.totalTests // 0')
FAILING_TESTS=$(parse_json "$COMBINED_REPORT" '.frontend.stats.failingTests // 0')
AVG_DURATION_MICROS=$(parse_json "$COMBINED_REPORT" '.frontend.stats.avgDurationMicros // 0')
PERFORMANCE_REPORT="$COMBINED_REPORT"
HTML_DASHBOARD="$HTML_REPORT"

# For sourcing in other scripts:
export TOTAL_TESTS FAILING_TESTS AVG_DURATION_MICROS PERFORMANCE_REPORT HTML_DASHBOARD
EOF
    
    log "CI metrics exported to: $metrics_summary"
}

# ============================================================================
# CLEANUP AND ERROR HANDLING
# ============================================================================

cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove temporary config files
    rm -f "$PROJECT_ROOT/vitest.performance.config.ts"
    
    # Cleanup old reports (keep last 10)
    find "$REPORTS_DIR" -name "*.json" -type f | sort -r | tail -n +11 | xargs rm -f
    find "$REPORTS_DIR" -name "*.html" -type f | sort -r | tail -n +11 | xargs rm -f
}

handle_error() {
    local exit_code=$?
    error "Performance monitoring failed with exit code: $exit_code"
    cleanup
    exit $exit_code
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log "Starting test performance monitoring..."
    
    # Set up error handling
    trap handle_error ERR
    trap cleanup EXIT
    
    # Initialize
    setup_directories
    create_performance_config
    
    # Run performance tests
    local frontend_result=0
    local backend_result=0
    
    if ! run_frontend_performance_tests; then
        frontend_result=1
    fi
    
    if ! run_backend_performance_tests; then
        backend_result=1
    fi
    
    # Analyze results
    if ! analyze_performance_results; then
        error "Performance analysis failed"
        exit 1
    fi
    
    # Update trends and export metrics
    update_performance_trends
    export_ci_metrics
    
    # Final status
    if [ $frontend_result -eq 0 ] && [ $backend_result -eq 0 ]; then
        success "All performance tests completed successfully!"
        success "Reports generated:"
        echo "  - Combined: $COMBINED_REPORT"
        echo "  - Dashboard: $HTML_REPORT"
        exit 0
    else
        warn "Some performance tests had issues, but analysis completed"
        echo "  - Combined: $COMBINED_REPORT"
        echo "  - Dashboard: $HTML_REPORT"
        exit 1
    fi
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

# Check for required tools
if ! command_exists pnpm; then
    error "pnpm is required but not installed"
    exit 1
fi

if ! command_exists cargo; then
    error "cargo is required but not installed"
    exit 1
fi

# Parse command line options
while [[ $# -gt 0 ]]; do
    case $1 in
        --ci)
            CI_MODE=true
            shift
            ;;
        --no-budget-fail)
            FAIL_ON_BUDGET_VIOLATION=false
            shift
            ;;
        --slow-threshold)
            SLOW_TEST_THRESHOLD_MS="$2"
            shift 2
            ;;
        --memory-threshold)
            MEMORY_THRESHOLD_MB="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --ci                   Enable CI mode"
            echo "  --no-budget-fail       Don't fail on budget violations"
            echo "  --slow-threshold MS    Slow test threshold in milliseconds"
            echo "  --memory-threshold MB  Memory threshold in megabytes"
            echo "  --help                 Show this help"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"