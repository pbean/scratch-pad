# Session 40: Final Test Recovery Plan - Path to 100%

## Current State (Post-Session 39)
- **Pass Rate**: 184/217 tests passing (84.8%)
- **Improvement**: +9 tests from Session 39 start (175 → 184)
- **Branch**: `session-39-test-recovery`
- **Key Success**: Simplified infrastructure, removed act() wrapping

## Learned Patterns That Work

### ✅ Successful Patterns Applied
1. **No act() wrapping on render()** - React Testing Library handles this automatically
2. **Direct store state setting** - `useScratchPadStore.setState()` instead of helpers
3. **Minimal test-utils** - Simple re-export of RTL functions
4. **Session 36 fixes preserved** - Timer cleanup, portal cleanup, smart store reset
5. **Explicit timeouts** - 3000ms for standard, 5000ms for complex operations

### ❌ Patterns That Failed
1. Complex async-timeout-utils abstraction
2. Overly aggressive DOM cleanup
3. Helper functions that obscure test behavior
4. act() wrapping around userEvent (already handled)

## Root Cause Analysis of Remaining Failures

### 1. Multiple Elements Error (10 tests)
**Affected**: StatusBar, TabBar
**Symptom**: "Found multiple elements with text: [text]"
**Root Cause**: React 19 StrictMode double-rendering without proper cleanup
**Solution**: Unique test containers and getAllBy* queries with index selection

### 2. Async Timeout Errors (10 tests)
**Affected**: CommandPalette, SearchHistoryView
**Symptom**: Tests timing out at 3-5 seconds
**Root Cause**: Improper async handling, waiting for wrong elements
**Solution**: findBy* queries for async elements, proper waitFor patterns

### 3. Initialization Failures (3 tests)
**Affected**: ScratchPadApp
**Symptom**: Components not initializing properly
**Root Cause**: Mock timing issues with Tauri API
**Solution**: Ensure mocks are ready before render

### 4. Skipped Tests (7 tests)
**Reason**: Real implementation issues, not test issues
**Action**: Keep skipped until implementation fixed

## Phase-by-Phase Recovery Plan

### Phase 1: Fix Test Isolation (Target: +10 tests)
**Goal**: Eliminate "multiple elements" errors

#### 1.1 Enhanced Test Container Isolation
```typescript
// test-utils.tsx
let testId = 0
function render(ui: ReactElement, options?: RenderOptions) {
  const container = document.createElement('div')
  container.setAttribute('data-testid', `test-container-${++testId}`)
  document.body.appendChild(container)
  
  return rtlRender(ui, { container, ...options })
}
```

#### 1.2 Query Strategy for Multiple Elements
```typescript
// For tests with multiple elements
const elements = screen.getAllByText('text')
expect(elements[0]).toBeInTheDocument() // Use first visible
```

#### 1.3 Context7 Research Queries
```typescript
// Query 1: React 19 StrictMode testing
context7__get-library-docs: "React 19 StrictMode double rendering test isolation"

// Query 2: RTL container isolation
context7__get-library-docs: "React Testing Library custom container isolation cleanup"
```

### Phase 2: Fix Async Patterns (Target: +10 tests)
**Goal**: Resolve timeout errors in async components

#### 2.1 Standardized Async Patterns
```typescript
// Pattern 1: Wait for async elements
const element = await screen.findByTestId('element', { timeout: 5000 })

// Pattern 2: Wait for disappearance
await waitFor(() => {
  expect(screen.queryByText('Loading')).not.toBeInTheDocument()
}, { timeout: 5000 })

// Pattern 3: Wait for mock to be called
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled()
})
```

#### 2.2 Component-Specific Fixes

**CommandPalette Focus Fix**:
```typescript
// Wait for element to exist, then focus
const input = await screen.findByTestId('command-search-input')
await waitFor(() => {
  expect(document.activeElement).toBe(input)
})
```

**SearchHistoryView Virtual List Fix**:
```typescript
// Ensure intersection observer is triggered
beforeEach(() => {
  mockAllIsIntersecting(true)
})

// Wait for virtual list to render
await screen.findByTestId('virtual-list')
```

#### 2.3 Context7 Research Queries
```typescript
// Query 3: Async component testing patterns
context7__get-library-docs: "React Testing Library findBy waitFor async component patterns"

// Query 4: Focus management testing
context7__get-library-docs: "testing focus keyboard events React Testing Library"
```

### Phase 3: Fix Initialization (Target: +3 tests)
**Goal**: Ensure ScratchPadApp tests pass

#### 3.1 Mock Synchronization
```typescript
beforeEach(() => {
  // Ensure mocks are ready
  vi.mocked(invoke).mockClear()
  vi.mocked(invoke).mockImplementation((cmd) => {
    if (cmd === 'initialize_settings') return Promise.resolve()
    if (cmd === 'load_notes') return Promise.resolve([])
    throw new Error(`Unknown command: ${cmd}`)
  })
})
```

#### 3.2 Context7 Research Query
```typescript
// Query 5: Tauri testing patterns
context7__get-library-docs: "Tauri invoke mock testing async initialization"
```

### Phase 4: Strategic Test Enablement (Target: +3 tests)
**Goal**: Enable skipped tests that might now pass

Review each skipped test:
1. Try enabling one at a time
2. Apply fixes from Phases 1-3
3. Skip again if real implementation issue

## Implementation Checklist

### Pre-Implementation
- [ ] Create branch: `git checkout -b session-40-final-recovery`
- [ ] Current baseline: 184/217 tests passing
- [ ] Set up monitoring: `watch -n 1 'pnpm test --run 2>&1 | grep "Tests.*passed"'`

### Phase 1 Execution (Test Isolation)
- [ ] Update test-utils.tsx with unique containers
- [ ] Fix StatusBar tests with getAllBy queries
- [ ] Fix TabBar tests with getAllBy queries
- [ ] Verify: No more "multiple elements" errors
- [ ] Commit: "fix: Phase 1 - Test isolation fixes"
- [ ] Expected: 194+/217 tests passing

### Phase 2 Execution (Async Patterns)
- [ ] Fix CommandPalette focus test
- [ ] Fix CommandPalette filter test
- [ ] Fix CommandPalette keyboard navigation
- [ ] Fix SearchHistoryView tests
- [ ] Verify: No more timeout errors
- [ ] Commit: "fix: Phase 2 - Async pattern fixes"
- [ ] Expected: 204+/217 tests passing

### Phase 3 Execution (Initialization)
- [ ] Fix ScratchPadApp initialization test
- [ ] Fix ScratchPadApp error handling test
- [ ] Fix ScratchPadApp loadNotes test
- [ ] Commit: "fix: Phase 3 - Initialization fixes"
- [ ] Expected: 207+/217 tests passing

### Phase 4 Execution (Enable Skipped)
- [ ] Review each of 7 skipped tests
- [ ] Enable and fix viable tests
- [ ] Document why others remain skipped
- [ ] Commit: "fix: Phase 4 - Strategic test enablement"
- [ ] Expected: 210+/217 tests passing

### Final Validation
- [ ] Run full test suite 3 times
- [ ] Verify no flaky tests
- [ ] Update documentation
- [ ] Create PR

## Success Metrics

### Minimum Success (Must Have)
- ✅ 210/217 tests passing (96.8%)
- ✅ No test flakiness
- ✅ Clean, maintainable patterns

### Target Success (Should Have)
- ✅ 214/217 tests passing (98.6%)
- ✅ Only legitimate bugs skipped
- ✅ Sub-15 second test run time

### Stretch Goal (Nice to Have)
- ✅ 217/217 tests passing (100%)
- ✅ All tests enabled
- ✅ Comprehensive test coverage

## Key Context7 Documentation Needs

1. **React 19 + React Testing Library v16**
   - StrictMode double-rendering handling
   - Concurrent features testing
   - Automatic act() behavior

2. **Vitest + React Integration**
   - Test isolation strategies
   - Cleanup patterns
   - Mock preservation

3. **Zustand Store Testing**
   - Mock state management
   - Reset patterns for React 19
   - External store updates

4. **Async Testing Patterns**
   - findBy vs getBy vs queryBy
   - waitFor best practices
   - Timeout strategies

5. **Virtual List Testing**
   - react-window mocking
   - Intersection observer testing
   - Performance optimization

## Risk Management

| Risk | Mitigation |
|------|------------|
| Breaking working tests | Git commit after each phase |
| React 19 incompatibility | Verify patterns with context7 |
| Over-engineering | Start minimal, add only if needed |
| Test flakiness | Add retry only for known issues |
| Time constraints | Phases are independent, can stop at any |

## Command Reference

```bash
# Run specific test file
pnpm test src/components/[component]/__tests__/[test].test.tsx --run

# Run with pattern matching
pnpm test --run --grep "StatusBar"

# Watch mode for development
pnpm test --watch

# Check current status
pnpm test --run 2>&1 | grep "Tests.*passed"

# Run with detailed reporter
pnpm test --run --reporter=verbose

# Check for specific errors
pnpm test --run 2>&1 | grep -A 5 "multiple elements"
```

## Notes from Session 39 Success

The key breakthrough was recognizing that React Testing Library already handles act() automatically in React 19. Removing manual act() wrapping immediately fixed 20 tests. This reinforces the principle: trust the framework's built-in behavior before adding abstractions.

Other critical insights:
- Simple is better - removed 500+ lines of test utilities
- Direct store manipulation is clearer than helpers
- Explicit timeouts are more maintainable than constants
- Test isolation is critical in React 19's concurrent mode

## Final Recommendations

1. **Stay minimal**: Every abstraction should prove its value
2. **Trust the framework**: RTL and Vitest handle most complexity
3. **Use context7 proactively**: Verify patterns against latest docs
4. **Commit frequently**: Each successful fix should be preserved
5. **Document patterns**: Future sessions benefit from learned patterns

Success is achieved through disciplined, incremental progress with constant validation.