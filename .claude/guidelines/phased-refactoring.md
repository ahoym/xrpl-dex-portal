# Phased Refactoring Approach

When refactoring a codebase, organize work into three phases:

## Phase 1 — Quick DRY wins (low risk)

Extract shared helpers, deduplicate functions, fix inconsistencies, standardize patterns. These are mechanical, safe changes.

## Phase 2 — Test coverage (medium risk)

Add tests for critical pure functions and business logic. The Phase 1 cleanup reduces surface area, making test targets clearer. Focus on untested modules with complex logic (parsers, validators, algorithms).

## Phase 3 — Structural refactors (higher risk)

Decompose large functions/hooks, consolidate overlapping types, extract shared utilities. Tests from Phase 2 provide a safety net.

## Why this ordering matters

- Phase 1 makes the code easier to test.
- Phase 2 makes structural changes safer.
