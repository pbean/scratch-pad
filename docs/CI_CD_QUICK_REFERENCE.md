# CI/CD Quick Reference Guide

## ⚡ Emergency Commands

```bash
# STOP ALL WORKFLOWS
gh workflow disable --all

# ROLLBACK EVERYTHING
git checkout main
cp -r .github/workflows-backup-* .github/workflows/
git add . && git commit -m "Emergency rollback"
git push

# CLEAR ALL CACHES
gh cache delete --all

# CHECK GITHUB STATUS
curl -s https://www.githubstatus.com/api/v2/status.json | jq .status
```

## 📌 Critical Version Numbers (DO NOT CHANGE)

```yaml
OS: ubuntu-22.04          # NOT ubuntu-latest!
Node: 20.11.0            # Fixed version
PNPM: 8.15.0             # Fixed version  
Rust: 1.75.0             # Fixed version
actions/checkout: v4      # v5 doesn't exist!
actions/setup-node: v4    # v5 doesn't exist!
pnpm/action-setup: v3    # Stable version
```

## 🎯 Phase 1 Success Criteria

- ✅ 95% success rate (47/50 builds minimum)
- ✅ <5 minute average build time
- ✅ Zero infrastructure failures
- ✅ >80% cache hit rate
- ✅ Clear error messages

## 📊 Key Metrics Commands

```bash
# Check current success rate
cat internal-docs/CI_CD_METRICS.json | jq .summary.success_rate

# Get last 10 build results
gh run list --workflow=build-check.yml --limit=10

# Calculate average build time
gh run list --workflow=build-check.yml --json durationMS --jq '[.[] | .durationMS] | add/length/1000'

# View today's failures
gh run list --workflow=build-check.yml --status=failure --created="$(date -I)"
```

## 🚀 Daily Workflow Commands

```bash
# Morning: Check overnight builds
gh run list --workflow=build-check.yml --created=">$(date -d yesterday -I)"

# Trigger test build
gh workflow run build-check.yml

# Trigger 10 builds (space them out)
for i in {1..10}; do 
  gh workflow run build-check.yml
  sleep 60
done

# Update metrics
node .github/scripts/ci-metrics.js collect
node .github/scripts/ci-metrics.js report
```

## 🔍 Debugging Failed Builds

```bash
# Get detailed failure logs
gh run view <run-id> --log-failed

# Download artifacts from failed build
gh run download <run-id>

# Re-run failed workflow
gh run rerun <run-id>

# Run with debug logging
gh workflow run build-check.yml -f debug_enabled=true
```

## 📁 File Structure

```
.github/
├── workflows-backup-YYYYMMDD/  # Old (broken) workflows
├── workflows-v2/                # New workflows (Phase 1+)
│   ├── build-check.yml         # Phase 1 main workflow
│   └── notify-failure.yml      # Notification system
├── scripts/
│   ├── ci-metrics.js           # Metrics collection
│   ├── collect-metrics.sh      # Metrics wrapper
│   └── rollback.sh            # Emergency rollback
internal-docs/
├── CI_CD_IMPLEMENTATION_PLAN.md     # Master plan
├── CI_CD_PHASE_1_CHECKLIST.md      # Current checklist
├── CI_CD_IMPLEMENTATION_STATUS.md   # Live status
├── CI_CD_METRICS.json              # Metrics data
└── CI_CD_QUICK_REFERENCE.md        # This file
```

## ⚠️ Common Issues & Fixes

### Build Timeout
```bash
# Increase timeout in workflow
timeout-minutes: 15  # was 10
```

### Cache Miss
```bash
# Clear and rebuild cache
gh cache delete --all
gh workflow run build-check.yml
```

### PNPM Lock Issues
```bash
# Use frozen lockfile
pnpm install --frozen-lockfile
```

### Rust Compilation Slow
```bash
# Check cache is working
- uses: Swatinem/rust-cache@v2
  with:
    workspaces: src-tauri
    cache-on-failure: true
```

## 🎭 Test Local Workflow

```bash
# Install act if needed
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Test workflow locally
act -W .github/workflows-v2/build-check.yml

# Test with specific event
act push -W .github/workflows-v2/build-check.yml
```

## 📈 Progress Tracking

```bash
# Quick progress check
echo "Builds today: $(gh run list --workflow=build-check.yml --created="$(date -I)" --json status --jq length)"
echo "Success today: $(gh run list --workflow=build-check.yml --created="$(date -I)" --status=success --json status --jq length)"
echo "Failures today: $(gh run list --workflow=build-check.yml --created="$(date -I)" --status=failure --json status --jq length)"
```

## 🔄 Workflow State Transitions

```
NOT_STARTED → Phase 0 → Phase 1 → GATE → Phase 2
                ↓          ↓        ↓        ↓
             [Setup]   [Build]  [95%?]  [Tests]
```

## 📝 Update Status Document

```bash
# Quick status update
cat << EOF >> internal-docs/CI_CD_IMPLEMENTATION_STATUS.md

### $(date +%Y-%m-%d) Update
- Builds completed: X/50
- Current success rate: X%
- Average build time: X minutes
- Issues: None/Description
- Next: Continue Phase 1 testing
EOF
```

## 🚨 DO NOT DO THIS

```bash
# ❌ NEVER use latest versions
runs-on: ubuntu-latest  # WRONG!

# ❌ NEVER add tests in Phase 1
- run: pnpm test  # WRONG!

# ❌ NEVER try parallel builds in Phase 1
strategy:
  matrix:
    os: [ubuntu, windows, macos]  # WRONG!

# ❌ NEVER modify old workflows
vim .github/workflows/test.yml  # WRONG!

# ❌ NEVER skip metrics collection
# Always track every build result!
```

## ✅ ALWAYS DO THIS

```bash
# ✅ Pin versions
runs-on: ubuntu-22.04  # CORRECT!

# ✅ Track metrics
echo "{\"build\": \"$STATUS\", \"time\": \"$(date -Iseconds)\"}" >> metrics.json

# ✅ Use frozen lockfile
pnpm install --frozen-lockfile  # CORRECT!

# ✅ Set timeout
timeout-minutes: 10  # CORRECT!

# ✅ Document failures
echo "Build failed: $REASON" >> failures.log
```

## 📞 Getting Help

1. Check this guide first
2. Review CI_CD_IMPLEMENTATION_PLAN.md
3. Check GitHub Actions status page
4. Ask in team channel with:
   - Build number/ID
   - Error message
   - What you tried
   - Metrics snapshot

## 🎯 Remember the Mission

**Phase 1 Goal**: Make builds work reliably. Nothing else.

**Success looks like**: 
- "Build #47 of 50 passed ✅"
- "Success rate: 96%"
- "Average time: 4.2 minutes"

**Not**:
- "Added testing!"
- "Optimized for speed!"
- "Works on Windows too!"

---

*Keep it simple. Make it work. Celebrate small wins.*

*Last Updated: 2025-01-29*