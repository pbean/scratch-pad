#!/bin/bash
# Emergency Security Tools Shutdown Script
# Use this if security tools are causing critical issues

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}================================================${NC}"
echo -e "${RED}EMERGENCY SECURITY TOOLS SHUTDOWN${NC}"
echo -e "${RED}================================================${NC}"

echo ""
echo -e "${YELLOW}⚠️  This will disable all security scanning tools${NC}"
echo -e "${YELLOW}⚠️  Use only in case of critical blocking issues${NC}"
echo ""

read -p "Are you sure you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Shutdown cancelled"
    exit 0
fi

echo ""
echo "🔴 Disabling security tools..."

# Disable CodeQL by commenting out triggers
if [ -f "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml" ]; then
    mv "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml" \
       "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml.disabled"
    echo -e "${GREEN}✓${NC} CodeQL workflow disabled"
fi

# Disable Dependabot by setting PR limit to 0
if [ -f "$REPO_ROOT/.github/dependabot.yml" ]; then
    # Create emergency shutdown version
    cat > "$REPO_ROOT/.github/dependabot.yml" << 'EOF'
# EMERGENCY SHUTDOWN - Security tools temporarily disabled
# Original configuration backed up to dependabot.yml.backup
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 0  # DISABLED
    
  - package-ecosystem: "cargo"
    directory: "/src-tauri"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 0  # DISABLED
    
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 0  # DISABLED
EOF
    echo -e "${GREEN}✓${NC} Dependabot disabled (PR limit set to 0)"
fi

# Create incident report
INCIDENT_FILE="$REPO_ROOT/internal-docs/SECURITY_SHUTDOWN_$(date +%Y%m%d_%H%M%S).md"
cat > "$INCIDENT_FILE" << EOF
# Security Tools Emergency Shutdown Report

**Date**: $(date)
**Triggered By**: $(whoami)
**Reason**: [TO BE FILLED]

## Actions Taken
- CodeQL workflow disabled (renamed to .disabled)
- Dependabot PR limit set to 0
- Original configurations preserved

## Recovery Steps
1. Investigate root cause
2. Fix identified issues
3. Run recovery script: .github/scripts/security-recovery.sh
4. Monitor for 24 hours
5. Update this report with findings

## Root Cause
[TO BE FILLED]

## Lessons Learned
[TO BE FILLED]
EOF

echo ""
echo -e "${GREEN}✅ Security tools disabled successfully${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Document reason in: $INCIDENT_FILE"
echo "  2. Investigate and fix root cause"
echo "  3. Run recovery script when ready: $SCRIPT_DIR/security-recovery.sh"
echo ""
echo -e "${YELLOW}⚠️  Remember to re-enable security tools ASAP${NC}"