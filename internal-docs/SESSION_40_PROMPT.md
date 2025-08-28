# Session 40: Final Test Suite Recovery - Achieve 98-100% Pass Rate

## Your Mission
Complete the Scratch Pad test suite recovery using the comprehensive plan at: `/home/paulb/dev/scratch-pad/internal-docs/SESSION_40_FINAL_TEST_RECOVERY_PLAN.md`

## Current State
- **Branch**: `session-39-test-recovery` (create new: `session-40-final-recovery`)
- **Status**: 184/217 tests passing (84.8% pass rate)
- **Remaining**: 26 failing, 7 skipped
- **Infrastructure**: Simplified and stable (Session 39 fixes applied)

## Critical Context from Previous Sessions

### What Works (DO NOT CHANGE)
1. **No act() wrapping on render()** - RTL handles this automatically
2. **Direct store state** - `useScratchPadStore.setState()` 
3. **Minimal test-utils** - Simple RTL re-export
4. **Session 36 infrastructure** - Timer cleanup, portal cleanup, smart store reset
5. **Explicit timeouts** - 3000ms standard, 5000ms complex

### What Failed (DO NOT REINTRODUCE)
1. ❌ Complex async-timeout-utils
2. ❌ Helper functions like setupStoreState
3. ❌ Aggressive DOM cleanup
4. ❌ Manual act() wrapping

## Your Execution Strategy

### Phase 1: Fix Test Isolation (10 tests)
**Target**: Fix "Found multiple elements" errors in StatusBar, TabBar

**CRITICAL**: Use context7 to research:
```
context7__resolve-library-id: "@testing-library/react"
context7__get-library-docs: "React 19 StrictMode test isolation multiple elements container cleanup"
```

**Solution Pattern**:
```typescript
// Option 1: Unique containers per test
const container = document.createElement('div')
container.id = `test-${Date.now()}`

// Option 2: Query first element when multiple exist
const elements = screen.getAllByText('text')
expect(elements[0]).toBeInTheDocument()
```

### Phase 2: Fix Async Patterns (10 tests)
**Target**: Fix timeout errors in CommandPalette, SearchHistoryView

**CRITICAL**: Use context7 to research:
```
context7__resolve-library-id: "@testing-library/react"
context7__get-library-docs: "findBy waitFor async component testing patterns React 19"
```

**Solution Patterns**:
```typescript
// Use findBy for async elements
const element = await screen.findByTestId('element')

// Wait for conditions
await waitFor(() => expect(mockFn).toHaveBeenCalled())
```

### Phase 3: Fix Initialization (3 tests)
**Target**: Fix ScratchPadApp initialization tests

**Focus**: Mock synchronization and timing

### Phase 4: Enable Skipped Tests (3-5 tests)
**Target**: Review and enable viable skipped tests

## Execution Rules

1. **Use sequential-thinking** for complex problem solving
2. **Use context7 extensively** - Get React 19 + RTL v16 patterns for EVERY issue
3. **Test after EVERY change** - Run specific test file, not full suite
4. **Commit after EACH phase** - Preserve progress
5. **If regression occurs** - Immediately revert and try different approach

## Context7 Queries to Execute

Run these BEFORE making changes:

```typescript
// 1. React 19 Testing Patterns
context7__resolve-library-id: "@testing-library/react"
context7__get-library-docs: "React 19 StrictMode concurrent testing patterns"

// 2. Vitest Cleanup
context7__resolve-library-id: "vitest"  
context7__get-library-docs: "test isolation cleanup beforeEach afterEach React"

// 3. Zustand Testing
context7__resolve-library-id: "zustand"
context7__get-library-docs: "testing store mocks React 19 state management"

// 4. Async Testing
context7__resolve-library-id: "@testing-library/react"
context7__get-library-docs: "findBy waitFor userEvent async patterns"

// 5. Focus Testing
context7__resolve-library-id: "@testing-library/user-event"
context7__get-library-docs: "focus keyboard testing tab enter escape"
```

## Success Validation

After EACH fix:
```bash
# Check specific component
pnpm test src/components/[component]/__tests__/[file].test.tsx --run

# Check overall progress  
pnpm test --run 2>&1 | grep "Tests.*passed"

# Verify no regression
git diff --stat | grep -E "test.*\.(ts|tsx)"
```

## Expected Outcomes

### Phase 1 Complete
- StatusBar tests: ✅ All passing
- TabBar tests: ✅ All passing
- Progress: 194+/217 (89.4%)
- Commit: "fix: Test isolation - unique containers and query strategies"

### Phase 2 Complete
- CommandPalette tests: ✅ All passing
- SearchHistoryView tests: ✅ All passing
- Progress: 204+/217 (94.0%)
- Commit: "fix: Async patterns - findBy and proper waitFor usage"

### Phase 3 Complete
- ScratchPadApp tests: ✅ All passing
- Progress: 207+/217 (95.4%)
- Commit: "fix: Initialization - mock synchronization"

### Phase 4 Complete
- Skipped tests reviewed: 3-5 enabled
- Progress: 210+/217 (96.8%)
- Commit: "fix: Strategic test enablement"

### Final Target
- **Minimum**: 210/217 (96.8%) - Must achieve
- **Target**: 214/217 (98.6%) - Should achieve
- **Stretch**: 217/217 (100%) - Nice to have

## Important Warnings

1. **DO NOT** add act() wrapping to render calls
2. **DO NOT** create complex test utilities
3. **DO NOT** modify working infrastructure from Session 36
4. **DO NOT** proceed without context7 verification
5. **DO NOT** batch changes - fix one component at a time

## Start Commands

```bash
# 1. Create new branch
git checkout -b session-40-final-recovery

# 2. Verify starting point
pnpm test --run 2>&1 | grep "Tests.*passed"
# Should show: Tests 26 failed | 184 passed | 7 skipped (217)

# 3. Start with Phase 1 - StatusBar
pnpm test src/components/note-view/__tests__/StatusBar.test.tsx --run

# 4. When you see "Found multiple elements", implement isolation fix
```

## Key Insights to Remember

From Session 39, we learned:
- React Testing Library in React 19 handles act() automatically
- Simple, direct approaches beat complex abstractions
- Test isolation is critical with React 19's StrictMode
- Each test should have its own container to prevent collisions
- Trust the framework's built-in behavior

Your goal: Take us from 184/217 (84.8%) to 210+/217 (96.8%+) using proven patterns and modern documentation.

Begin with Phase 1 after reviewing the comprehensive plan.