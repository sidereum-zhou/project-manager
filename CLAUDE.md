# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FLUX Project Manager is a desktop Electron app for managing local Node.js, Python, Java, and monorepo projects. It provides file browsing, an integrated terminal, Git operations, process/service orchestration, workspace scenes, and architecture visualization. UI is in Chinese (简体中文).

## Commands

```bash
npm run dev          # Vite dev server only (port 5173)
npm run build        # Type-check + Vite build + Electron TS compile
npm run test         # Run all tests once (vitest)
npm run test:watch   # Vitest in watch mode
```

No single-test command is configured. To run a specific test file, use:
```bash
npx vitest run electron/core/store.test.ts
npx vitest run electron/detectors/detectors.test.ts
```

## Architecture

### Electron (main process) — `electron/`

Entry: `electron/main.ts` creates the BrowserWindow, initializes the `Store` and `ProcessManager` singletons, and registers all IPC handlers.

**IPC modules** (`electron/ipc/`) — each exports a single `register*Ipc()` function called from main.ts:
- `project.ipc.ts` — directory selection, project CRUD, file listing/reading, settings
- `process.ipc.ts` — process start/stop/restart/status, service orchestration (service keys are `projectId::serviceId`), forwards ProcessManager events to renderer
- `terminal.ipc.ts` — PTY-based terminal creation (powershell on Windows, bash elsewhere), data/exit events via `node-pty`
- `git.ipc.ts` — full git operations via `simple-git` (status, log, diff, add, commit, stash, pull, push, branches, checkout)
- `workspace.ipc.ts` — workspace scene CRUD, architecture analysis dispatch

**Core modules** (`electron/core/`):
- `store.ts` — JSON file-backed persistence (atomic writes via tmp+rename), normalizes/migrates legacy data shapes. Stores projects, scenes, and settings.
- `process-manager.ts` — EventEmitter-based child process lifecycle management with in-memory log buffer (max 1500 entries). Used by both direct process control and service orchestration.
- `architecture-analyzer.ts` — static analysis of Node (workspaces, deps, internal deps), Python (requirements.txt/pyproject.toml), and Java (pom.xml/Gradle) projects into a node/edge graph for visualization.

**Project detectors** (`electron/detectors/`):
- `registry.ts` runs detectors in priority order: monorepo > nodejs > python > java
- Each detector implements `ProjectDetector` interface (`detect()` + `getMetadata()`)
- Node.js detector refines to `nodejs-frontend` when Vite/Next.js/Nuxt config files are present

### Preload bridge — `electron/preload.ts`

Exposes `window.electronAPI` via `contextBridge`. All main↔renderer communication goes through `ipcRenderer.invoke` (request) and `ipcRenderer.on` (push events). Context isolation is enabled; nodeIntegration is disabled.

### Renderer (Vue 3) — `src/`

- **Stack**: Vue 3 Composition API + Pinia + Naive UI (dark theme, custom overrides in `App.vue`)
- **Entry**: `src/main.ts` → `App.vue` (theme provider) → `AppLayout.vue` (sidebar + content area)
- **State**: Single Pinia store `src/stores/projects.ts` manages the active project selection
- **API layer**: `src/api/electron-api.ts` wraps all `window.electronAPI` calls with typed interfaces
- **Types**: `src/types/project.ts` defines all shared domain types (Project, Service, Scene, Architecture, etc.)

**Views** (`src/views/`): `ProjectList`, `ProjectOverview` (tab container), `FileExplorer`, `TerminalPage`, `GitPanel`, `ServicesPage`, `ArchitecturePage`, `WorkspaceScenesPage`, `SettingsPage`

### Two separate TypeScript configs

- `tsconfig.json` — renderer (ESNext modules, bundler resolution, `@/*` → `src/*`)
- `electron/tsconfig.json` — main process (CommonJS, node resolution, excludes tests)

### Key conventions

- IPC channel names follow `domain:action` pattern (e.g., `git:status`, `terminal:create`, `service:start`)
- Push events from main to renderer use `domain:event` (e.g., `service:log`, `service:status`, `terminal:data`, `terminal:exit`)
- `@/` path alias maps to `src/` in both vite.config.ts and tsconfig.json
- `node-pty` is externalized in the Vite rollup config (native module, cannot be bundled)
- Tests use vitest with `globals: true` (no need to import `describe`/`it`/`expect`)
- Store uses in-memory cache after first load; IPC handlers call `store.load()` which returns the cached instance
