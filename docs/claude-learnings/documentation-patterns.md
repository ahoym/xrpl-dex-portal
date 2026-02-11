# Documentation Patterns

## Single Source of Truth: README + CLAUDE.md + Symlink

To maintain one source of truth for both human and agent documentation:

1. **CLAUDE.md** — The real technical reference. Auto-loaded by agents. Contains architecture, API routes, state management, conventions, and gotchas.
2. **README.md** — Lightweight human entry point. Project overview, getting started instructions, and a link to the technical docs. No architecture details (avoids duplication).
3. **TECHNICAL_DETAILS.md** — Symlink to CLAUDE.md. Humans find it from README.md; agents never need it.

```
README.md (humans) ──link──▶ TECHNICAL_DETAILS.md ──symlink──▶ CLAUDE.md (agents)
```

Key insight: CLAUDE.md content is already human-readable — the split is about entry points, not content format. Humans expect README.md; agents get CLAUDE.md auto-loaded. The symlink bridges the two without any content duplication.
