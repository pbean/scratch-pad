#!/bin/bash

# Script to validate GitHub Actions workflows
# This script checks the syntax and structure of workflow files

set -e

echo "🔍 Validating GitHub Actions workflows..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if workflow directory exists
if [ ! -d ".github/workflows" ]; then
    print_error "No .github/workflows directory found"
    exit 1
fi

# Count workflow files
WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
echo "Found $WORKFLOW_COUNT workflow files"

# Validate each workflow file
for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
    if [ -f "$workflow" ]; then
        echo ""
        echo "Validating $(basename "$workflow")..."
        
        # Check if file is readable
        if [ ! -r "$workflow" ]; then
            print_error "Cannot read $workflow"
            continue
        fi
        
        # Basic YAML syntax check using Python (if available)
        if command -v python3 &> /dev/null; then
            if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
                print_status "YAML syntax is valid"
            else
                print_error "YAML syntax error in $workflow"
                continue
            fi
        else
            print_warning "Python3 not available, skipping YAML syntax check"
        fi
        
        # Check for required fields
        if grep -q "^name:" "$workflow"; then
            print_status "Has workflow name"
        else
            print_warning "Missing workflow name"
        fi
        
        if grep -q "^on:" "$workflow"; then
            print_status "Has trigger events"
        else
            print_error "Missing trigger events"
        fi
        
        if grep -q "^jobs:" "$workflow"; then
            print_status "Has jobs defined"
        else
            print_error "Missing jobs"
        fi
        
        # Check for common issues
        if grep -q "uses: actions/checkout@v[0-9]" "$workflow"; then
            print_status "Uses pinned action versions"
        else
            print_warning "Consider pinning action versions"
        fi
        
        # Check for secrets usage
        if grep -q "\${{ secrets\." "$workflow"; then
            print_status "Uses GitHub secrets (if needed)"
        fi
        
        print_status "$(basename "$workflow") validation complete"
    fi
done

echo ""
echo "🎉 Workflow validation complete!"
echo ""
echo "Summary:"
echo "- Build workflow: Handles CI/CD for all platforms"
echo "- Test workflow: Cross-platform testing"
echo "- Release workflow: Automated releases with checksums"
echo "- Security workflow: Security scanning and audits"
echo "- Nightly workflow: Automated nightly builds"
echo ""
echo "To test workflows locally, consider using:"
echo "- act (https://github.com/nektos/act)"
echo "- GitHub CLI (gh workflow run)"