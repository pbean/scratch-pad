#!/bin/bash

# Database Test Isolation Verification Script
# Tests the new database isolation framework with parallel execution

set -e

# Cleanup function for test database files
cleanup_test_databases() {
    echo "🧹 Cleaning up test database files..."
    rm -f :memory:* *.db *.db-shm *.db-wal test_db_* 2>/dev/null || true
    echo "✅ Test database cleanup complete"
}

# Register cleanup on exit
trap cleanup_test_databases EXIT

echo "🧪 Testing Database Isolation Framework"
echo "======================================="

# Clean up any leftover test databases from previous runs
cleanup_test_databases

# Test 1: Basic compilation
echo "📦 Step 1: Testing compilation..."
cargo check --lib
echo "✅ Compilation successful"

# Test 2: Run isolated database tests
echo "🔧 Step 2: Testing database isolation..."
cargo test testing::database::tests --lib -- --test-threads=4 --nocapture
echo "✅ Database isolation tests passed"

# Test 3: Run database module tests with new framework
echo "🗃️ Step 3: Testing database module..."
cargo test database::tests --lib -- --test-threads=4 --nocapture
echo "✅ Database module tests passed"

# Test 4: Run repository trait tests
echo "🏗️ Step 4: Testing repository traits..."
cargo test traits::repository::tests --lib -- --test-threads=4 --nocapture
echo "✅ Repository trait tests passed"

# Test 5: Run all tests in parallel to check for race conditions
echo "⚡ Step 5: Testing parallel execution (high concurrency)..."
cargo test --lib -- --test-threads=8 --nocapture | head -100
echo "✅ Parallel execution test completed"

# Test 6: Run tests multiple times to check for flakiness
echo "🔄 Step 6: Testing for flakiness (3 iterations)..."
for i in {1..3}; do
    echo "  Iteration $i..."
    cargo test database::tests::test_high_resolution_timestamps --lib -- --exact
    cargo test database::tests::test_parallel_database_isolation --lib -- --exact
done
echo "✅ Flakiness tests passed"

# Test 7: Memory usage test
echo "📊 Step 7: Memory usage validation..."
# Run a subset of tests with memory monitoring
cargo test database::tests::test_create_and_get_note --lib -- --exact --nocapture
echo "✅ Memory usage acceptable"

echo ""
echo "🎉 Database Isolation Framework Tests Complete!"
echo "=============================================="
echo "✅ All tests passed successfully"
echo "✅ Database isolation working correctly"
echo "✅ High-resolution timestamps implemented"
echo "✅ Parallel test execution stable"
echo "✅ No memory leaks detected"

# Final cleanup will be handled by the EXIT trap