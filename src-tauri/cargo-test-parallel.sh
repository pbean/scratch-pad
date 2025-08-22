#!/bin/bash

# Phase 3: Backend Parallel Test Execution
#
# Optimized Cargo test runner with parallel execution, resource management,
# and detailed performance monitoring for Rust backend tests.

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Default configuration
DEFAULT_JOBS=4
DEFAULT_TIMEOUT=300 # 5 minutes
DEFAULT_OUTPUT_DIR="../test-results/backend"

# Test categories and their execution strategies
declare -A TEST_CATEGORIES=(
    ["unit"]="--lib --bins"
    ["integration"]="--test '*'"
    ["database"]="--test '*database*'"
    ["security"]="--test '*security*'"
    ["performance"]="--test '*performance*'"
)

# Performance thresholds
SLOW_TEST_THRESHOLD_MS=1000
MEMORY_THRESHOLD_MB=500

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

log_info() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')] ℹ️${NC} $1"
}

# Get optimal job count based on system resources
calculate_optimal_jobs() {
    local cpu_count
    local memory_gb
    
    # Get CPU count
    if command -v nproc >/dev/null 2>&1; then
        cpu_count=$(nproc)
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        cpu_count=$(sysctl -n hw.ncpu)
    else
        cpu_count=4
    fi
    
    # Get available memory (in GB)
    if command -v free >/dev/null 2>&1; then
        memory_gb=$(free -g | awk '/^Mem:/{print $7}') # Available memory
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        memory_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
    else
        memory_gb=8 # Default assumption
    fi
    
    # Calculate optimal jobs (conservative approach)
    local optimal_jobs=$((cpu_count - 1))
    
    # Limit based on memory (assume each test job needs ~1GB)
    if [[ $optimal_jobs -gt $memory_gb ]]; then
        optimal_jobs=$memory_gb
    fi
    
    # Ensure minimum and maximum bounds
    if [[ $optimal_jobs -lt 2 ]]; then
        optimal_jobs=2
    elif [[ $optimal_jobs -gt 8 ]]; then
        optimal_jobs=8
    fi
    
    echo "$optimal_jobs"
}

# Setup test environment
setup_test_environment() {
    local output_dir="$1"
    
    # Create output directory structure
    mkdir -p "$output_dir"
    mkdir -p "$output_dir/junit"
    mkdir -p "$output_dir/coverage"
    mkdir -p "$output_dir/performance"
    
    # Set test-specific environment variables
    export RUST_BACKTRACE=1
    export RUST_LOG=debug
    export DATABASE_URL="sqlite::memory:"
    export CARGO_TARGET_DIR="$output_dir/target"
    
    # Configure test database for isolation
    export TEST_DATABASE_ISOLATION=true
    export TEST_PARALLEL_EXECUTION=true
    
    log_info "Test environment configured:"
    log_info "  - Output directory: $output_dir"
    log_info "  - Target directory: $CARGO_TARGET_DIR"
    log_info "  - Database isolation: enabled"
}

# ============================================================================
# PARALLEL TEST EXECUTION
# ============================================================================

run_parallel_tests() {
    local jobs="${1:-$DEFAULT_JOBS}"
    local output_dir="${2:-$DEFAULT_OUTPUT_DIR}"
    local timeout="${3:-$DEFAULT_TIMEOUT}"
    
    log "🦀 Starting parallel Rust tests with $jobs jobs..."
    
    setup_test_environment "$output_dir"
    
    local start_time
    start_time=$(date +%s%N)
    
    # Create temporary files for capturing output
    local stdout_file="$output_dir/cargo-test-stdout.log"
    local stderr_file="$output_dir/cargo-test-stderr.log"
    local json_file="$output_dir/cargo-test-results.json"
    
    # Build test dependencies first
    log_info "Building test dependencies..."
    if ! cargo build --tests --jobs "$jobs" 2>"$output_dir/build.log"; then
        log_error "Failed to build test dependencies"
        cat "$output_dir/build.log"
        return 1
    fi
    
    # Run tests with enhanced configuration
    local cargo_cmd=(
        cargo test
        --jobs "$jobs"
        --message-format json
        --no-fail-fast
        --features "test-utils"
        --workspace
        --all-targets
        --
        --test-threads "$jobs"
        --nocapture
    )
    
    log_info "Executing: ${cargo_cmd[*]}"
    
    # Run tests with timeout protection
    if timeout "$timeout" "${cargo_cmd[@]}" \
        >"$stdout_file" \
        2>"$stderr_file"; then
        
        local end_time
        end_time=$(date +%s%N)
        local duration_ns=$((end_time - start_time))
        local duration_ms=$((duration_ns / 1000000))
        
        log_success "Tests completed in ${duration_ms}ms"
        
        # Process test results
        process_test_results "$stdout_file" "$stderr_file" "$output_dir" "$duration_ms"
        return 0
    else
        local exit_code=$?
        local end_time
        end_time=$(date +%s%N)
        local duration_ns=$((end_time - start_time))
        local duration_ms=$((duration_ns / 1000000))
        
        if [[ $exit_code -eq 124 ]]; then
            log_error "Tests timed out after ${timeout}s"
        else
            log_error "Tests failed with exit code $exit_code after ${duration_ms}ms"
        fi
        
        # Still process partial results
        process_test_results "$stdout_file" "$stderr_file" "$output_dir" "$duration_ms"
        return $exit_code
    fi
}

# Process and analyze test results
process_test_results() {
    local stdout_file="$1"
    local stderr_file="$2"
    local output_dir="$3"
    local duration_ms="$4"
    
    log_info "Processing test results..."
    
    # Extract JSON test results
    local json_file="$output_dir/test-results.json"
    grep '^{.*"type":"test"' "$stdout_file" > "$json_file" 2>/dev/null || true
    
    # Generate summary statistics
    generate_test_summary "$json_file" "$output_dir" "$duration_ms"
    
    # Extract performance metrics
    extract_performance_metrics "$stdout_file" "$output_dir"
    
    # Generate JUnit XML for CI integration
    generate_junit_xml "$json_file" "$output_dir"
    
    # Analyze failures
    analyze_test_failures "$json_file" "$stderr_file" "$output_dir"
}

# Generate comprehensive test summary
generate_test_summary() {
    local json_file="$1"
    local output_dir="$2"
    local duration_ms="$3"
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local ignored_tests=0
    local slow_tests=0
    
    if [[ -f "$json_file" && -s "$json_file" ]]; then
        # Count test results
        total_tests=$(jq -s 'length' "$json_file" 2>/dev/null || echo "0")
        passed_tests=$(jq -s '[.[] | select(.event == "ok")] | length' "$json_file" 2>/dev/null || echo "0")
        failed_tests=$(jq -s '[.[] | select(.event == "failed")] | length' "$json_file" 2>/dev/null || echo "0")
        ignored_tests=$(jq -s '[.[] | select(.event == "ignored")] | length' "$json_file" 2>/dev/null || echo "0")
        
        # Count slow tests (execution time > threshold)
        slow_tests=$(jq -s "[.[] | select(.exec_time_ms? > $SLOW_TEST_THRESHOLD_MS)] | length" "$json_file" 2>/dev/null || echo "0")
    fi
    
    # Calculate pass rate
    local pass_rate=0
    if [[ $total_tests -gt 0 ]]; then
        pass_rate=$(( (passed_tests * 100) / total_tests ))
    fi
    
    # Generate summary JSON
    cat > "$output_dir/summary.json" << EOF
{
  "execution": {
    "total_duration_ms": $duration_ms,
    "timestamp": "$(date -Iseconds)",
    "parallel_jobs": $(grep -o 'jobs [0-9]*' "$output_dir/../cargo-test-stdout.log" | head -1 | awk '{print $2}' || echo "unknown")
  },
  "results": {
    "total_tests": $total_tests,
    "passed_tests": $passed_tests,
    "failed_tests": $failed_tests,
    "ignored_tests": $ignored_tests,
    "pass_rate": $pass_rate
  },
  "performance": {
    "slow_tests": $slow_tests,
    "slow_test_threshold_ms": $SLOW_TEST_THRESHOLD_MS,
    "average_test_time_ms": $(( duration_ms / (total_tests > 0 ? total_tests : 1) ))
  }
}
EOF
    
    # Log summary
    log_info "Test Summary:"
    log_info "  - Total tests: $total_tests"
    log_info "  - Passed: $passed_tests"
    log_info "  - Failed: $failed_tests"
    log_info "  - Ignored: $ignored_tests"
    log_info "  - Pass rate: $pass_rate%"
    log_info "  - Duration: ${duration_ms}ms"
    log_info "  - Slow tests: $slow_tests"
}

# Extract performance metrics from test output
extract_performance_metrics() {
    local stdout_file="$1"
    local output_dir="$2"
    
    local perf_file="$output_dir/performance/metrics.json"
    
    # Extract compilation time
    local compile_time
    compile_time=$(grep -o "Finished test.*in [0-9.]*s" "$stdout_file" | grep -o "[0-9.]*s" | sed 's/s//' || echo "0")
    
    # Extract memory usage if available
    local peak_memory=0
    if command -v ps >/dev/null 2>&1; then
        # This would need to be tracked during test execution
        peak_memory=0
    fi
    
    # Create performance metrics
    cat > "$perf_file" << EOF
{
  "compilation": {
    "time_seconds": $compile_time
  },
  "memory": {
    "peak_usage_mb": $peak_memory,
    "threshold_mb": $MEMORY_THRESHOLD_MB
  },
  "slow_tests": $(extract_slow_tests "$output_dir/test-results.json"),
  "timestamp": "$(date -Iseconds)"
}
EOF
    
    log_info "Performance metrics saved to $perf_file"
}

# Extract slow tests from JSON results
extract_slow_tests() {
    local json_file="$1"
    
    if [[ -f "$json_file" && -s "$json_file" ]]; then
        jq -s "[.[] | select(.exec_time_ms? > $SLOW_TEST_THRESHOLD_MS) | {name: .name, duration_ms: .exec_time_ms}]" "$json_file" 2>/dev/null || echo "[]"
    else
        echo "[]"
    fi
}

# Generate JUnit XML for CI integration
generate_junit_xml() {
    local json_file="$1"
    local output_dir="$2"
    
    local junit_file="$output_dir/junit/results.xml"
    
    if [[ -f "$json_file" && -s "$json_file" ]]; then
        # This would require a JSON to JUnit XML converter
        # For now, create a placeholder structure
        cat > "$junit_file" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="rust-tests" tests="0" failures="0" errors="0" time="0">
  <!-- JUnit XML conversion would go here -->
</testsuite>
EOF
        
        log_info "JUnit XML placeholder created at $junit_file"
    else
        log_warning "No test results to convert to JUnit XML"
    fi
}

# Analyze test failures
analyze_test_failures() {
    local json_file="$1"
    local stderr_file="$2"
    local output_dir="$3"
    
    local failures_file="$output_dir/failures.json"
    
    if [[ -f "$json_file" && -s "$json_file" ]]; then
        # Extract failed tests
        jq -s '[.[] | select(.event == "failed") | {name: .name, reason: .reason}]' "$json_file" > "$failures_file" 2>/dev/null || echo "[]" > "$failures_file"
        
        local failure_count
        failure_count=$(jq length "$failures_file" 2>/dev/null || echo "0")
        
        if [[ $failure_count -gt 0 ]]; then
            log_warning "Found $failure_count failed tests. Details in $failures_file"
            
            # Log first few failures for immediate visibility
            jq -r '.[0:3][] | "- \(.name): \(.reason // "Unknown reason")"' "$failures_file" 2>/dev/null || true
        fi
    else
        echo "[]" > "$failures_file"
    fi
}

# ============================================================================
# CATEGORY-SPECIFIC TEST EXECUTION
# ============================================================================

run_test_category() {
    local category="$1"
    local jobs="${2:-$DEFAULT_JOBS}"
    local output_dir="${3:-$DEFAULT_OUTPUT_DIR}"
    
    if [[ -z "${TEST_CATEGORIES[$category]:-}" ]]; then
        log_error "Unknown test category: $category"
        log_info "Available categories: ${!TEST_CATEGORIES[*]}"
        return 1
    fi
    
    local test_args="${TEST_CATEGORIES[$category]}"
    local category_output="$output_dir/$category"
    
    mkdir -p "$category_output"
    
    log "Running $category tests with args: $test_args"
    
    setup_test_environment "$category_output"
    
    # Run category-specific tests
    cargo test $test_args \
        --jobs "$jobs" \
        --message-format json \
        >"$category_output/results.json" \
        2>"$category_output/stderr.log"
    
    local exit_code=$?
    
    # Process results
    process_test_results \
        "$category_output/results.json" \
        "$category_output/stderr.log" \
        "$category_output" \
        "$(date +%s%N)"
    
    return $exit_code
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local command="${1:-all}"
    local jobs="${2:-$(calculate_optimal_jobs)}"
    local output_dir="${3:-$DEFAULT_OUTPUT_DIR}"
    
    # Ensure we're in the correct directory
    if [[ ! -f "Cargo.toml" ]]; then
        log_error "Must be run from src-tauri directory"
        return 1
    fi
    
    case "$command" in
        "all")
            run_parallel_tests "$jobs" "$output_dir"
            ;;
        "unit"|"integration"|"database"|"security"|"performance")
            run_test_category "$command" "$jobs" "$output_dir"
            ;;
        "help"|*)
            echo "Backend Parallel Test Runner"
            echo ""
            echo "Usage: $0 <command> [jobs] [output_dir]"
            echo ""
            echo "Commands:"
            echo "  all          - Run all tests (default)"
            echo "  unit         - Run unit tests only"
            echo "  integration  - Run integration tests only"
            echo "  database     - Run database tests only"
            echo "  security     - Run security tests only"
            echo "  performance  - Run performance tests only"
            echo "  help         - Show this help"
            echo ""
            echo "Arguments:"
            echo "  jobs         - Number of parallel jobs (default: auto-detect)"
            echo "  output_dir   - Output directory (default: $DEFAULT_OUTPUT_DIR)"
            ;;
    esac
}

# Execute main function with all arguments
main "$@"