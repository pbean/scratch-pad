#!/bin/bash

echo "Running Integration Tests for Scratch Pad"
echo "=========================================="

echo "1. Testing database schema and migrations..."
cargo test test_database_schema_and_migrations --quiet

echo "2. Testing cross-platform database paths..."
cargo test test_cross_platform_database_paths --quiet

echo "3. Testing layout mode conversion..."
cargo test test_layout_mode_conversion --quiet

echo "4. Testing cross-platform file paths..."
cargo test test_cross_platform_file_paths --quiet

echo "5. Testing window management settings..."
cargo test test_layout_mode_settings_integration --quiet

echo ""
echo "Integration tests completed!"
echo "Note: Some tests may be skipped due to environment constraints."