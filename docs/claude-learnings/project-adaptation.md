# Project Adaptation Workflow

When forking or adapting an existing codebase into a new project, systematically categorize every file into one of four actions:

## File Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Copy as-is** | Files that need zero changes | Utility modules, generic hooks, configs |
| **Adapt** | Files that need specific, enumerable modifications | Remove features, rename, add fields |
| **New** | Files that don't exist in the source | New pages, new components for changed UX |
| **Exclude** | Source files that should NOT be brought over | Features being dropped entirely |

## Process

1. **Inventory the source** — list every file grouped by architectural layer
2. **Categorize each file** into copy/adapt/new/exclude
3. **For "Adapt" files**, document the specific changes needed (what to add, remove, rename). This creates a checklist that can be executed mechanically.
4. **Group by dependency layer** — libs → hooks → API routes → shared components → pages. This ensures foundational code exists before dependent code is created.
5. **Identify parallelization** — independent layers (e.g., hooks and API routes) can be built concurrently by separate agents.

## Benefits

- Makes the scope of work explicit and reviewable before coding starts
- "Copy as-is" files require no review — just verify they compile
- "Adapt" files have a clear diff spec — easy to verify completeness
- "Exclude" list prevents accidentally bringing over unwanted code
- Layer grouping respects import dependencies and reveals parallel work
