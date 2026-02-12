# Parallel Subagent Strategy for Refactoring

When performing codebase-wide refactoring:

## Exploration phase

Launch 2-3 Explore agents in parallel, each focused on a different area (e.g., API routes, lib modules, test infrastructure). They analyze independently and report findings.

## Implementation phase

Launch general-purpose agents in parallel for independent changes. Each agent gets:
- The specific files to modify
- What to change
- Instructions to verify its own work (run build/tests)

## Key constraint

Agents modifying the same file cannot run in parallel. Group changes by file ownership.

## Verification

After all parallel agents complete, run the full test suite once to catch any cross-agent conflicts.
