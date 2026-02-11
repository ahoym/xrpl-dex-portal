# Planning Patterns

## Plan Parallelization via Dependency Graphs

For large multi-phase implementation plans, map the dependency graph between phases to identify parallel execution batches.

### Process

1. **List all phases** and what each phase imports/depends on
2. **Draw dependency edges** (e.g., "hooks import from lib/" → hooks depend on libs)
3. **Identify independent phases** — phases with no cross-dependencies can run in parallel (e.g., hooks don't import API routes, API routes don't import hooks)
4. **Group into sequential batches** where each batch's phases run in parallel

### Example

```
Batch 1: Scaffolding + shared libs (sequential, foundational)
Batch 2: Hooks ‖ API routes (parallel — no cross-imports)
Batch 3: Shared components (needs hooks from Batch 2)
Batch 4: Page A ‖ Page B ‖ Page C (parallel — pages are independent)
Batch 5: Verification (pnpm build, manual testing)
```

### Within-Phase Parallelism

Further parallelism exists within phases:
- All API routes are independent of each other
- All pages are independent of each other
- Library files with no cross-imports can be written in parallel

Each parallel item maps directly to a separate Task subagent.

### Key Insight

The dependency graph for a typical Next.js app follows a predictable pattern:
```
configs → lib/ → hooks + API routes → shared components → pages
```

Hooks and API routes are almost always independent (hooks run client-side, routes run server-side), making them a reliable parallelization boundary.
