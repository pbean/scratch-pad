#!/bin/bash

# Integration Test Suite for Scratch Pad
# Unix/Linux/macOS version - harmonized with Windows PowerShell script
# Ensures consistent cross-platform test execution

set -e  # Exit on error

echo "=========================================="
echo "Running Integration Tests for Scratch Pad"
echo "Platform: $(uname -s)"
echo "=========================================="

# Set error handling
export RUST_BACKTRACE=1

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test suite and track results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    
    echo ""
    echo "Running $test_name..."
    echo "------------------------------------------"
    
    if $test_command; then
        echo "✅ $test_name PASSED"
        ((TESTS_PASSED++))
    else
        echo "❌ $test_name FAILED"
        ((TESTS_FAILED++))
    fi
}

# Run cross-platform tests
run_test_suite "Cross-Platform Tests" "cargo test --test cross_platform_tests --release"

# Run integration tests
run_test_suite "Integration Tests" "cargo test --test integration_tests --release"

# Run IPC integration tests
run_test_suite "IPC Integration Tests" "cargo test --test ipc_integration_tests --release"

# Run window management tests
run_test_suite "Window Management Tests" "cargo test --test window_management_tests --release"

# Run database schema and migration tests
run_test_suite "Database Schema Tests" "cargo test test_database_schema_and_migrations --release"

# Run layout mode tests
run_test_suite "Layout Mode Tests" "cargo test test_layout_mode_conversion --release"

# Run file path tests
run_test_suite "File Path Tests" "cargo test test_cross_platform_file_paths --release"

# Run settings integration tests
run_test_suite "Settings Integration Tests" "cargo test test_layout_mode_settings_integration --release"

echo ""
echo "=========================================="
echo "Integration Tests Summary"
echo "=========================================="
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo "🎉 All integration tests passed successfully!"
    exit 0
else
    echo "💥 Some integration tests failed!"
    exit 1
fi