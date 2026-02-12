# Refactoring Patterns

Learnings captured from refactoring plan review sessions.

## XRPL: getBalanceChanges() Already Includes Fee Deduction

`getBalanceChanges()` from xrpl.js returns XRP balance deltas that are **already net of transaction fees**. The `AccountRoot` ledger entry in transaction metadata reflects the fee deduction in its `FinalFields.Balance` vs `PreviousFields.Balance`.

**Implication:** Explicitly subtracting `tx.Fee` from `getBalanceChanges()` output **double-counts** the fee. Use the raw delta as-is for accurate trade amounts.

**Example:** If a wallet receives 100 XRP from a trade and pays 12 drops fee:
- `getBalanceChanges()` returns: +99.999988 XRP (correct, net of fee)
- Subtracting `tx.Fee` again: +99.999976 XRP (wrong, double-deducted)

## Git Worktrees for Parallel Subagent Execution

When running parallel subagents that modify code in the same repo, use **git worktrees** so each agent works in its own directory on its own branch. This avoids filesystem collisions that would occur if multiple agents edited files in the same working directory.

**Branching model within a batch:**
- Independent items: each worktree branches from the batch's starting point
- Dependent items: branch the dependent from the dependency's branch (e.g., if agent B needs a shared component extracted by agent A, branch B from A's branch)
- After all agents complete, merge branches sequentially, running the gate after each merge

## Subagent Execution Patterns

### Scope Agent Context Narrowly

When launching parallel subagents for a refactoring plan, give each agent **only its relevant section** of the plan — not the full document. Full plan context leads to over-engineering and cross-cutting concerns that aren't the agent's responsibility. If an agent hits a blocker that requires broader context, it can request it from the orchestrator.

### Pre-Approve Permissions Before Parallel Execution

Before launching parallel subagents, ensure wildcard bash permissions are pre-approved (e.g., `Bash(git branch:*)`, `Bash(git status:*)`, `Bash(pnpm test:*)`). In restrictive permission mode, each agent prompts independently for every command, serializing what should be parallel work. Organize permissions alphabetically by tool group (pnpm, git, gh) for maintainability.
