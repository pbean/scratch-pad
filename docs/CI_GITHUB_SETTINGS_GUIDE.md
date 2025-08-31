# GitHub Repository Settings Guide for CI

## Current Status
- **Branch Protection**: Not configured (main branch unprotected)
- **Default Branch**: main
- **CI Workflow**: Configured to run on pushes to main/develop and all PRs

## Recommended Settings for Your Workflow

### Option 1: Keep It Simple (Recommended for Solo Dev)
No branch protection needed. The CI will run automatically on:
- Direct pushes to main
- Direct pushes to develop (if you create it)
- Any pull requests

**No action needed** - your current setup will work perfectly!

### Option 2: Light Protection (Good Practice)
Add minimal branch protection to main:

1. Go to: https://github.com/paulb/scratch-pad/settings/branches
2. Click "Add rule" 
3. Configure:
   - **Branch name pattern**: `main`
   - **Protect matching branches**: ✅
   - **Require status checks to pass**: ✅
     - Search and select: `build-and-test`
   - **Include administrators**: ❌ (so you can bypass if needed)
   - Leave everything else unchecked

4. Click "Create" or "Save changes"

### Option 3: Full PR Workflow (If You Want Structure)
Force all changes through PRs:

1. Go to: https://github.com/paulb/scratch-pad/settings/branches
2. Click "Add rule"
3. Configure:
   - **Branch name pattern**: `main`
   - **Require pull request reviews**: ✅
     - Dismiss stale reviews: ✅
     - Required approving reviews: 0 (since you're solo)
   - **Require status checks**: ✅
     - Search and select: `build-and-test`
     - Require branches to be up to date: ❌
   - **Include administrators**: ❌

## How to Test Your CI

### Method 1: Direct Push (if no protection)
```bash
git push origin main
```
Then check: https://github.com/paulb/scratch-pad/actions

### Method 2: Create a Test PR
```bash
# Create a test branch
git checkout -b test-ci
echo "# CI Test" >> README.md
git add README.md
git commit -m "Test CI"
git push origin test-ci

# Create PR via CLI
gh pr create --title "Test CI" --body "Testing CI workflow"

# Or create PR via web
# Visit: https://github.com/paulb/scratch-pad/compare/test-ci
```

## Verifying CI Status

### Check Workflow Runs
Visit: https://github.com/paulb/scratch-pad/actions/workflows/ci.yml

### Expected Results
- ✅ Green checkmark = Build successful (tests may fail with continue-on-error)
- 🟡 Yellow = In progress
- ❌ Red X = Build failed (actual compilation error)

### Badge Status
Your README badge will show:
- `passing` (green) - Workflow completed successfully
- `failing` (red) - Workflow failed
- No status - Workflow hasn't run yet

## Troubleshooting

### If CI doesn't trigger:
1. Make sure you've pushed to GitHub
2. Check the Actions tab is enabled: https://github.com/paulb/scratch-pad/settings/actions
3. Verify workflow file is in `.github/workflows/ci.yml`

### If you get "waiting for status checks":
This means branch protection is enabled. Either:
- Wait for CI to complete
- Bypass as admin (if you didn't check "Include administrators")
- Disable branch protection temporarily

### If PR comments don't appear:
The comment feature requires:
- The workflow to have write permissions
- PR to exist (won't work on direct pushes)

## Quick Commands Reference

```bash
# View current protection status
gh api repos/paulb/scratch-pad/branches/main/protection

# List recent workflow runs
gh run list --workflow=ci.yml

# Watch a running workflow
gh run watch

# Re-run failed workflow
gh run rerun [run-id]
```

## Recommendation

For your single-developer project, **Option 1 (no protection)** is perfectly fine. The CI will still run and the badge will update. You can always add protection later if needed.

If you want to practice good habits, **Option 2 (light protection)** gives you safety without friction.