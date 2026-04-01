# AGENTS.md

Repository guidance for agentic coding assistants working in `dragFree`.

## Project Overview

- App type: Electron desktop app.
- Runtime: Node.js + Electron.
- Module mode: ESM for app code (`"type": "module"`), CommonJS for preload files (`*.cjs`).
- Entry point: `src/main/main.js`.
- Primary domains:
  - `src/main/`: app lifecycle, windows, config, drag session orchestration.
  - `src/renderer/`: overlay/panel/config/new-folder UI.
  - `tests/`: Node built-in test runner suites.

## Source of Truth and Rules Files

- Checked for Cursor rules:
  - `.cursorrules`: not present.
  - `.cursor/rules/`: not present.
- Checked for Copilot rules:
  - `.github/copilot-instructions.md`: not present.
- Therefore, this file is the effective agent guidance in-repo.

## Install / Run / Build / Test Commands

Run commands from repository root:

```bash
npm install
```

Start app locally:

```bash
npm run start
```

Run all tests:

```bash
npm test
```

Build Windows portable package:

```bash
npm run build:win
```

## Single-Test Workflows (Important)

This repo uses Node's built-in test runner (`node --test`).

Run one test file:

```bash
npm test -- tests/m2/hotzone.test.js
```

Equivalent direct command:

```bash
node --test tests/m2/hotzone.test.js
```

Run multiple specific files:

```bash
node --test tests/m2/hotzone.test.js tests/m2/drag-session-controller.test.js
```

Run tests by name pattern:

```bash
node --test --test-name-pattern="hotzone"
```

Recommended agent loop for code changes:

1. Run the most specific impacted test file first.
2. Run all tests (`npm test`) before claiming completion.
3. If behavior changes config/defaults, include `tests/config/defaults.test.js`.

## Lint / Format Status

- No lint script is currently defined in `package.json`.
- No repo-level ESLint/Prettier config was found.
- Formatting/style enforcement is convention-based; keep edits consistent with nearby code.

## Code Style Guidelines

### JavaScript / Module Conventions

- Use ESM `import`/`export` in `.js` files.
- Keep preload files as CommonJS (`require`, `contextBridge`) in `.cjs`.
- Prefer explicit named imports (for example from `electron`, `node:path`, `node:fs/promises`).
- Group imports by origin:
  1. External/runtime (`electron`).
  2. Node built-ins (`node:*`).
  3. Local modules (`./...`).

### Formatting

- Use double quotes for strings.
- Keep trailing semicolons.
- Prefer 2-space indentation.
- Preserve existing line wrapping style; do not reflow unrelated code.
- Keep functions focused and small when practical.

### Naming

- Functions/variables: `camelCase`.
- Classes: `PascalCase` (for example `DragSessionController`).
- Constants: `UPPER_SNAKE_CASE` for fixed timings/thresholds.
- Use descriptive names that encode intent (`dropPulseConfirmSec`, `panelEventsEnabled`).

### Types and Validation (without TypeScript)

- Guard and normalize untrusted values at boundaries:
  - IPC payloads.
  - Config loaded from disk.
  - DOM event-derived data.
- Follow existing normalization approach in `src/main/config-store.js`:
  - Clamp numeric ranges.
  - Apply safe defaults.
  - Filter invalid list entries.

### Error Handling

- Use `try/catch` around filesystem, IPC, and routing operations.
- Return safe fallbacks rather than crashing UI flows.
- In renderer, surface user-facing status messages for recoverable failures.
- In preload bridges, catch failures and return empty/safe values.
- In main process, log operational details (`console.info/debug`) for drag/drop flows.

### IPC and Security

- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Expose minimal APIs via preload `contextBridge`.
- Do not leak unrestricted Node access into renderer global scope.
- Prefer `ipcRenderer.invoke` for request/response and `send` for event-style signals.

### UI / Renderer Practices

- Maintain current behavior contracts:
  - Drag success usually silent.
  - Cancel/failure may notify.
  - Drop targets and panel close behavior are intentional and tested.
- Avoid large DOM rewrites when a small targeted change works.
- Preserve Chinese UI copy style where already used.

### Testing Conventions

- Test framework: `node:test` + `node:assert/strict`.
- Keep test names behavior-oriented (for example `"detects point inside top-edge hotzone"`).
- Prefer deterministic tests with explicit numeric timings/positions.
- When changing state machines, test both transition and emitted events.

## Files and Areas to Treat Carefully

- `src/main/main.js`: central orchestration; regressions are high-impact.
- `src/main/drag-session-controller.js`: drag lifecycle timing-sensitive.
- `src/main/hotzone.js`: geometry logic used by trigger detection.
- `src/main/config-store.js`: default values + normalization rules.
- `src/renderer/panel-controller.js`: dense drag/drop hit-testing logic.

## Agent Execution Guidance

- Prefer minimal, surgical edits.
- Do not change unrelated behavior while implementing a fix/feature.
- If adding config fields:
  1. Add defaults.
  2. Add normalization/merge behavior.
  3. Wire IPC/UI.
  4. Add/update tests.
- Verify with targeted tests first, then full test run.
- Follow `docs/versioning.zh-CN.md` for all agent-created commits (fallback: `docs/versioning.md`):
  1. After each code commit, append the commit summary to `COMMIT_HISTORY.md`.
  2. Then ask the user whether to bump version.
  3. Show bump rationale and recommended `MAJOR.MINOR.PATCH` level.
  4. Before changing version, check whether there are multiple commits since last release entry.
  5. If multiple commits exist, merge them into one release note summary, then bump version once.
  6. Only bump `package.json` version after explicit user confirmation.

## Known Operational Notes

- Packaging may fail in restricted network setups when Electron binaries cannot be downloaded.
- If `npm run start` fails due to Electron download/proxy issues, resolve local network/DNS first.
