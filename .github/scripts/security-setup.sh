#!/bin/bash
# Security Tools Setup Script for Scratch Pad CI/CD
# Part of the phased security integration plan

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "================================================"
echo "Scratch Pad Security Tools Setup - Phase 1"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in GitHub repository
if [ ! -d "$REPO_ROOT/.git" ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

echo ""
echo "📋 Checking configuration files..."

# Check CodeQL configuration
if [ -f "$REPO_ROOT/.github/codeql-config.yml" ]; then
    echo -e "${GREEN}✓${NC} CodeQL configuration found"
else
    echo -e "${RED}✗${NC} CodeQL configuration missing"
fi

# Check CodeQL workflow
if [ -f "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml" ]; then
    echo -e "${GREEN}✓${NC} CodeQL workflow found"
else
    echo -e "${RED}✗${NC} CodeQL workflow missing"
fi

# Check Dependabot configuration
if [ -f "$REPO_ROOT/.github/dependabot.yml" ]; then
    echo -e "${GREEN}✓${NC} Dependabot configuration found"
else
    echo -e "${RED}✗${NC} Dependabot configuration missing"
fi

echo ""
echo "📊 Current Phase: 1 (Basic Security Scanning)"
echo "Configuration:"
echo "  - CodeQL: JavaScript/TypeScript only"
echo "  - Dependabot: Security updates only"
echo "  - PR Limit: 2 per ecosystem"
echo "  - Schedule: Daily security, Weekly CodeQL"

echo ""
echo "🔧 GitHub Settings Required:"
echo "  1. Enable Dependabot security updates in Settings > Security"
echo "  2. Enable Code scanning alerts in Settings > Security"
echo "  3. Configure alert notifications in Settings > Notifications"

echo ""
echo "📈 Next Steps:"
echo "  1. Push configuration to GitHub"
echo "  2. Monitor initial scans for 1 week"
echo "  3. Triage and suppress false positives"
echo "  4. Move to Phase 2 after achieving 95% success rate"

echo ""
echo "📚 Documentation:"
echo "  Full plan: internal-docs/CODEQL_DEPENDABOT_INTEGRATION_PLAN.md"
echo "  CI/CD plan: internal-docs/CI_CD_IMPLEMENTATION_PLAN.md"

echo ""
echo "🚨 Emergency Shutdown:"
echo "  If issues arise, run: $SCRIPT_DIR/security-emergency-shutdown.sh"

echo ""
echo "================================================"
echo "Setup check complete!"
echo "================================================"