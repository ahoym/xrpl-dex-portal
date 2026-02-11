# UI Patterns

## Centralize Design Tokens Before Component-Level Changes

When doing comprehensive UI upgrades across many components, centralize design tokens (colors, spacing, borders, shadows, typography) into shared constants **before** touching individual component files.

**Why:** This enables global design changes (like removing all rounded corners) with a single constant edit instead of touching every component file.

**Pattern:** Define shared Tailwind class constants in a central file (e.g., `lib/ui/ui.ts`):
- `cardClass` — Card wrapper styling (border, background, padding, shadow)
- `inputClass` — Text input styling
- `primaryButtonClass` — Primary action button
- `secondaryButtonClass` — Secondary/outline button
- `dangerButtonClass` — Destructive action button
- `labelClass` — Form field labels

All components import from this file. Changing a constant propagates everywhere instantly.

**Incremental experimentation:** When testing a design change on one page before going app-wide, use Tailwind's `!important` modifier to temporarily override the shared constant (e.g., `className={`${cardClass} !rounded-none`}`). Once the change is confirmed, update the shared constant itself and remove the overrides.
