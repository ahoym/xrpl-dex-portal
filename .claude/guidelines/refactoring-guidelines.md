# Refactoring Guidelines

## Assess Before Adding React Context

Before replacing prop drilling with React Context, measure these three factors:

1. **Drilling depth** — 2 levels is acceptable and common; Context adds value at 3+
2. **Consumer count** — under 5 consumers doesn't justify the abstraction overhead
3. **Update frequency** — if the Context holds polling data that updates on different schedules (e.g., orderbook every 3s, balances every 3s, offers on events), every consumer re-renders on every tick even if they only need one field

For monolithic data objects with mixed update frequencies, prop drilling with scoped props is often **better** than Context. Splitting into multiple Contexts to fix re-render issues adds more complexity than the prop drilling it replaces.

## Split PRs by Risk Profile

Split PRs by **risk and reviewability**, not by batch or phase boundaries:

- **Bug fixes that change observable behavior** get their own PR, separate from pure test additions — even if they're in the same implementation batch
- **Pure refactors** (module splits, extractions) can be grouped if they touch independent areas
- **New shared abstractions** (hooks, utilities) get their own PR so the API can be reviewed before adoption

This gives reviewers focused diffs and produces cleaner git history for bisecting.

## Parallel Batch Failure Handling

When one of several parallel agents fails (tests break, refactor is more complex than expected):
1. **Let successful agents merge** — don't block the entire batch on one failure
2. **Re-attempt the failed agent** from the merged state of successful work
3. The re-attempted agent gets a fresh worktree branched from the updated base

This minimizes wasted work and keeps the batch moving forward.

## Gate Strategy: Unit Tests + Selective E2E

- **Every batch:** gate with `pnpm build && pnpm test` (unit tests + type check)
- **Behavior-changing PRs only:** also run `pnpm e2e` (E2E tests against testnet)
- **Pure refactors and test additions:** skip E2E — they add latency without catching new regressions

E2E tests hit real networks and are slow. Reserve them for PRs where user-visible behavior changes (bug fixes, UI modifications, fee display changes).
