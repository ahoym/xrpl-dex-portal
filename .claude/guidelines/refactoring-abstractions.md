# Refactoring Abstractions

## Audit Before Abstracting: Two-Tier Hook Design

When extracting a "repeated pattern" across N components into a shared abstraction, always research the actual usage in every component first. The pattern is often less uniform than it appears.

**Approach:**
1. Read each component's implementation — don't just grep for the pattern
2. Catalog the variations: What type is the loading state? (boolean vs string key vs enum) Is there a success state? (boolean vs string message vs callback-only vs none) Are arguments passed at call time or closed over?
3. Group components by actual compatibility, not surface similarity
4. Design tiered abstractions covering the real groups — don't force outliers

**Example — loading/error/success pattern:**
- 8 components appeared to share the pattern
- After audit: 4 used boolean loading + success → core `useAsyncAction` hook
- 2 used string/enum loading keys (to identify which button in a list is active) → `useAsyncActionKeyed<K>` variant
- 2 were sync-only or used browser APIs (FileReader, alert) → left alone

**Key insight:** Two focused tiers covering 6 of 8 components is better than one over-generalized abstraction that awkwardly handles all 8.

## Fix Bugs Structurally Through Refactoring

When a refactoring plan includes both "add tests" and "split/extract" phases, use the phases together strategically:

1. **Test phase:** Identify bugs, write tests that expose them, document the root cause
2. **Split phase:** Design the extracted hook/module so its API naturally prevents the bug class

**Example — timer leak in a monolithic hook:**
- Phase 1 (tests): Documented that `useEffect` managing offer expiration timers didn't clean up old timers when the offers array changed
- Phase 2 (split): Extracted `useOfferExpirationTimers(offers, onExpire)` — the new hook owns its own cleanup via a proper `useEffect` dependency array + cleanup return. The timer leak is impossible by construction.
- Phase 1 tests verify the Phase 2 fix without any separate "fix" commit

**Why this beats patching first:**
- The patch may be thrown away during the split anyway
- The extracted API naturally prevents the bug class (better than a point fix)
- Tests written in Phase 1 serve as regression tests for the Phase 2 extraction
