# Versioning Strategy

This project uses Semantic Versioning (`MAJOR.MINOR.PATCH`) and follows a "post-commit confirmation" flow for version bumps.

## Version Format

- Stable release: `X.Y.Z` (for example `0.2.1`)
- Optional pre-release: `X.Y.Z-beta.N`, `X.Y.Z-rc.N`

## Bump Rules

### PATCH (`X.Y.Z+1`)

Use patch for backward-compatible fixes and small improvements:

- Bug fixes (drag/drop interaction, hit area, editor behavior, config UI defects)
- Minor refactors without behavior changes
- Style/perf tuning without user-visible feature expansion

### MINOR (`X.Y+1.0`)

Use minor for backward-compatible feature additions:

- New user-facing features (new controls, tabs, toggles, hotkey capabilities)
- New config fields with safe defaults and migration/normalization support
- New optional behaviors that do not break old config data

### MAJOR (`X+1.0.0`)

Use major for incompatible changes:

- Removing/renaming config keys without compatibility fallback
- Breaking IPC contract changes between main/preload/renderer
- Workflow changes that require explicit migration for existing users

## Post-Commit Version Update Flow (Required)

After each agent-created code commit:

1. Ask the user whether to bump version.
2. Show the bump rationale (change type, compatibility impact, and recommended bump level).
3. Only after explicit user confirmation, update `package.json` `"version"`.
4. Add/update notes in `COMMIT_HISTORY.md` including version bump rationale.
5. Create a dedicated version-bump commit (recommended for traceability).

## Mapping Conventional Commit Prefixes

- `fix:` -> usually `PATCH`
- `feat:` -> at least `MINOR`
- `perf:`, `refactor:`, `style:` -> usually `PATCH` unless behavior expands significantly (then `MINOR`)
- Any incompatible behavior/API/config change -> `MAJOR` regardless of prefix

## Examples

- `0.1.0` -> `0.1.1`: fix drag text append bug
- `0.1.1` -> `0.2.0`: add text tab rail + new config options
- `0.2.3` -> `1.0.0`: remove legacy config schema without fallback

## Example Prompt (After Commit)

- Agent: "Do you want to bump the version now?  
  Rationale: this commit adds backward-compatible user-visible features, so `MINOR` is recommended (for example `0.2.0 -> 0.3.0`)."
