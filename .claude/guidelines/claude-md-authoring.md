# CLAUDE.md Authoring Guidelines

## Document Relationships, Not Just Inventory

CLAUDE.md should document how components connect — not just list what files exist. A file inventory tells an agent *what* exists, but relationships tell it *how* things work together.

Key relationship sections to include:

- **App Shell**: Component tree from layout down (e.g., `layout.tsx → Providers → NavBar → page`). Shows providers, wrappers, and navigation structure.
- **State Flow**: How data moves through the system (e.g., context → localStorage → API). Include the auth/session model (or lack thereof).
- **API Conventions**: Request/response patterns, how mutations vs reads differ, shared validation patterns.

These sections let an agent skip straight to the task instead of reading multiple source files to understand the wiring.

## Use Pointers for Fast-Growing Directories

For directories that grow frequently (e.g., UI components), use a pointer instead of an inventory:

**Good** — scales without maintenance:
```markdown
Reusable UI components live in `app/components/`. Before creating a new component, check there first — it likely already exists (modals, loading states, balance formatting, etc.).
```

**Avoid** — becomes stale, bloats context:
```markdown
- `modal-shell.tsx` — Reusable modal wrapper
- `balance-display.tsx` — Formatted balance rendering
- `explorer-link.tsx` — Links to XRPL explorer
...
```

Reserve detailed inventories for stable infrastructure (lib modules, hooks, API routes) that change infrequently. The pointer pattern gives the agent the location and a behavioral nudge ("check here first") without maintenance burden.
