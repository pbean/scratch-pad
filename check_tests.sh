#!/bin/bash
total_tests=0
passing_tests=0

echo "=== Running Test Suite Analysis ==="

# Run tests and capture output
test_output=$(timeout 90 pnpm test --run 2>&1)

# Count passing tests
passing=$(echo "$test_output" | grep -c "✓" || echo 0)
failing=$(echo "$test_output" | grep -c "✗" || echo 0)
total=$((passing + failing))

echo "Passing tests: $passing"
echo "Failing tests: $failing"
echo "Total tests: $total"

if [ $total -gt 0 ]; then
  pass_rate=$(echo "scale=1; $passing * 100 / $total" | bc)
  echo "Pass rate: ${pass_rate}%"
fi

# Check if we hit the target
if [ $total -gt 0 ]; then
  target_tests=$(echo "scale=0; $total * 91 / 100" | bc)
  echo "Target (91%): $target_tests tests"
  if [ $passing -ge $target_tests ]; then
    echo "✅ TARGET ACHIEVED!"
  else
    needed=$((target_tests - passing))
    echo "❌ Need $needed more passing tests"
  fi
fi
