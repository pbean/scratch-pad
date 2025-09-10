#!/bin/bash
# Security Tools Recovery Script
# Re-enables security tools after emergency shutdown

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "SECURITY TOOLS RECOVERY"
echo "================================================"

echo ""
echo "🔄 Re-enabling security tools..."

# Re-enable CodeQL
if [ -f "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml.disabled" ]; then
    mv "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml.disabled" \
       "$REPO_ROOT/.github/workflows-v2/codeql-basic.yml"
    echo -e "${GREEN}✓${NC} CodeQL workflow restored"
fi

# Restore Dependabot configuration
cat > "$REPO_ROOT/.github/dependabot.yml" << 'EOF'
# Dependabot configuration for Scratch Pad - RESTORED
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
      time: "06:00"
      timezone: "America/Los_Angeles"
    open-pull-requests-limit: 2
    labels:
      - "dependencies"
      - "security"
      - "javascript"
    commit-message:
      prefix: "sec"
      include: "scope"
    allow:
      - dependency-type: "security"
    
  - package-ecosystem: "cargo"
    directory: "/src-tauri"
    schedule:
      interval: "daily"
      time: "06:00"
      timezone: "America/Los_Angeles"
    open-pull-requests-limit: 2
    labels:
      - "dependencies"
      - "security"
      - "rust"
    commit-message:
      prefix: "sec(rust)"
      include: "scope"
    allow:
      - dependency-type: "security"
    
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
    open-pull-requests-limit: 1
    labels:
      - "dependencies"
      - "ci"
      - "security"
    commit-message:
      prefix: "ci(deps)"
      include: "scope"
EOF

echo -e "${GREEN}✓${NC} Dependabot configuration restored"

echo ""
echo -e "${GREEN}✅ Security tools re-enabled successfully${NC}"
echo ""
echo "📋 Post-recovery checklist:"
echo "  [ ] Update incident report with root cause"
echo "  [ ] Verify CodeQL runs on next PR"
echo "  [ ] Check Dependabot dashboard for new alerts"
echo "  [ ] Monitor for 24 hours"
echo "  [ ] Document lessons learned"
echo ""
echo -e "${YELLOW}ℹ️  Security scanning will resume on next scheduled run${NC}"