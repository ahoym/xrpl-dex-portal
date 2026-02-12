# Project Setup

## Git Worktree Layout

This project uses git worktrees:
- **Main worktree** (`main` branch): `/Users/malcolmahoy/WORKSPACE/xrpl-dex-portal`
- **Feature worktree**: `/Users/malcolmahoy/WORKSPACE/xrpl-dex-portal-refactor`

Because `main` is checked out in its own worktree, you cannot `git checkout main` from the feature worktree. To update main:
```
git -C /Users/malcolmahoy/WORKSPACE/xrpl-dex-portal pull
```

Similarly, to pull latest on the feature branch worktree:
```
git -C /Users/malcolmahoy/WORKSPACE/xrpl-dex-portal-refactor pull
```
