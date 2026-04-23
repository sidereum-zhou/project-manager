# CLAUDE.md

This repository is set up for Claude Code driven vibe coding. Treat this file as the default operating guide for the project.

## Goal

FLUX Project Manager is an Electron desktop app for managing local development projects. It supports:

- project detection and import
- integrated terminal
- Git operations
- service orchestration and logs
- workspace scenes
- architecture visualization
- local settings and dashboards

UI copy is Chinese (简体中文). Keep new user-facing text consistent with the existing tone.

## Preferred Workflow

For most feature work, use this loop:

1. Inspect the relevant files first.
2. Make the smallest coherent change that solves the request.
3. Update shared types and IPC contracts when behavior changes.
4. Add or update tests if the change touches store logic, detectors, process logic, or parsing.
5. Run targeted verification first, then broader verification if the change is substantial.
6. Summarize changed files, verification, and remaining risks.

If the task is small, do the work directly. If the task is broad, split it into 2-4 concrete steps before editing.

## Fast Commands

Use these commands by default:

```bash
npm run dev              # renderer dev server
npm run dev:app          # full Electron app for manual testing
npm run typecheck        # Vue + TS type-check only
npm run test             # all tests
npm run test:store       # store regression tests only
npm run test:detectors   # detector tests only
npm run build            # production build
npm run check:quick      # typecheck + test
npm run check            # test + build
```

## Editing Rules

- Do not edit `dist/`, `dist-electron/`, or `node_modules/`.
- Preserve unrelated user changes.
- Prefer updating the real source instead of adding workaround code.
- Keep changes local and cohesive; avoid speculative refactors.
- When IPC changes, update all three layers together:
  - `electron/ipc/*`
  - `electron/preload.ts`
  - `src/api/electron-api.ts`

## Repo Map

### Electron main process

- `electron/main.ts`: app bootstrap, window creation, IPC registration
- `electron/core/store.ts`: JSON persistence and migration defaults
- `electron/core/process-manager.ts`: service lifecycle, logs, health checks
- `electron/core/architecture-analyzer.ts`: static project graph analysis

### IPC layer

- `electron/ipc/project.ipc.ts`: project CRUD, file access, settings
- `electron/ipc/process.ipc.ts`: service start/stop/restart, logs, health events
- `electron/ipc/terminal.ipc.ts`: PTY terminals
- `electron/ipc/git.ipc.ts`: Git operations via `simple-git`
- `electron/ipc/workspace.ipc.ts`: scenes and architecture analysis
- `electron/ipc/system.ipc.ts`: dashboard system metrics

### Renderer

- `src/AppLayout.vue`: top-level shell
- `src/stores/projects.ts`: project state
- `src/types/project.ts`: shared domain types
- `src/api/electron-api.ts`: typed renderer bridge
- `src/views/ProjectOverview.vue`: project tab container and cross-tab orchestration
- `src/views/ServicesPage.vue`: service control + logs + health
- `src/views/FileExplorer.vue`: file tree + preview + search
- `src/views/WorkspaceScenesPage.vue`: scene/workflow templates

## High-Value Patterns

### If you change service behavior

Check:

- `src/types/project.ts`
- `electron/core/process-manager.ts`
- `electron/ipc/process.ipc.ts`
- `electron/preload.ts`
- `src/api/electron-api.ts`
- `src/views/ServicesPage.vue`

### If you change scene/workflow behavior

Check:

- `src/types/project.ts`
- `electron/core/store.ts`
- `electron/ipc/workspace.ipc.ts`
- `src/views/WorkspaceScenesPage.vue`
- `src/views/ProjectOverview.vue`

### If you change file browsing/search

Check:

- `electron/ipc/project.ipc.ts`
- `src/api/electron-api.ts`
- `src/components/FileNode.vue`
- `src/views/FileExplorer.vue`

## Verification Guidance

- For store/data-shape changes: run `npm run test:store`
- For detector changes: run `npm run test:detectors`
- For renderer or IPC changes: run `npm run check:quick`
- For large cross-layer changes: run `npm run check`

## Review Mode

If asked to review code:

- prioritize bugs, regressions, risky assumptions, and missing tests
- list findings first
- keep summaries brief
- include file references when possible

## Vibe Coding Shortcuts

Project custom commands live under `.claude/commands/`.

Recommended starting points:

- `/feature ...`
- `/debug ...`
- `/review`
- `/check`
- `/ship`
