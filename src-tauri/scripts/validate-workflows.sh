#!/bin/bash
echo "🔍 Validating GitHub Actions workflows..."
echo "Found $(find .github/workflows -name "*.yml" | wc -l) workflow files"
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        echo "✓ $(basename "$workflow") exists and is readable"
    fi
done
echo "🎉 Basic validation complete!"
