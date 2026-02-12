# Refactoring Patterns

## Plan Structure: Dependency Graph + Parallel Batches + Progress Checklist

For large refactoring plans with many interdependent items:

### 1. Draw an explicit dependency graph
Show which items block others. Items within the same phase that have no cross-dependency can be merged into a single batch.

### 2. Group into parallel batches
Maximize concurrency by merging independent phases. Example:
- Batch 1: 3 parallel test tasks (no dependencies)
- Batch 2: 5 parallel tasks — hook splits + component splits merged (no cross-dependency)
- Batch 3: 1 serial blocker (core hook that others depend on)
- Batch 4: 4 parallel tasks (utilities + error boundaries, all depend on Batch 3)

### 3. Add a markdown checkbox progress checklist
Group by batch with a build/test gate after each:

```markdown
### Batch 1 — Tests
- [ ] **1A** Description
- [ ] **1B** Description
- [ ] Batch 1 gate: `pnpm build && pnpm test` passes
```

### Benefits
- **Parallelism:** Subagents can work on independent items concurrently
- **Resumability:** If execution stops mid-way, read the checklist, find first unchecked item in current batch, resume from there
- **Visibility:** Clear progress tracking across sessions

## API Contract Audit Approach

When building a shared API client utility (e.g., `apiFetch<T>`):

### 1. Audit actual vs documented contract
- Read every route handler — document the actual success and error response shapes
- Read every client-side consumer — document how hooks/adapters parse responses
- Compare with documented contract (e.g., in CLAUDE.md or README)
- They often diverge significantly

### 2. Choose normalization strategy

**Option A — Client-side only (recommended first):**
- Build `apiFetch<T>` with discriminated union: `ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }`
- `data` is the full JSON body typed as `T` — no unwrapping, routes keep current shapes
- Add typed response interfaces per route (e.g., `BalancesResponse`, `OrderBookResponse`)
- Zero server changes required

**Option B — Server + client normalization (later):**
- Wrap all route responses in `{ data: T }` envelope
- Update `apiFetch` to unwrap `json.data`
- Bigger change, touches every route and callsite

**Recommendation:** Option A first for incremental adoption. Option B as a later consistency pass if desired. The discriminated union is the important part — it works with either approach.
