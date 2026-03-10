# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WiseCLI is an Electron desktop application that provides a GUI for managing Claude CLI sessions with multi-agent support, real-time terminal output, file browsing, and git integration.

## Development Commands

```bash
pnpm dev          # Start development server with hot reload
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint on src directory
pnpm typecheck    # Run TypeScript type checking without emitting
```

## Architecture

### Electron Process Model

The app follows the standard Electron three-process architecture:

- **Main Process** (`src/main/`): Node.js environment, handles system integration, PTY processes, file system, and git operations
- **Preload Script** (`src/preload/index.ts`): Context bridge exposing `window.electronAPI` to renderer with type-safe IPC
- **Renderer Process** (`src/renderer/`): React application with browser environment, no direct Node.js access

### Key Directories

```
src/
├── main/
│   ├── index.ts              # Entry point, window creation, app lifecycle
│   ├── ipc/                  # IPC handlers (agent, session, settings, fs, git)
│   └── services/             # Main process services
│       ├── AgentProcessManager.ts  # Manages claude CLI processes via node-pty
│       ├── SessionManager.ts       # Session persistence (electron-store)
│       ├── GitService.ts           # Git operations and file watching
│       ├── AppSettingsManager.ts   # App-wide settings
│       ├── ClaudeSettings.ts       # Reads/writes ~/.claude/settings.json
│       ├── TrayManager.ts          # System tray
│       └── AutoLaunchManager.ts    # OS auto-start
├── preload/
│   └── index.ts              # Exposes electronAPI with full type definitions
└── renderer/
    ├── App.tsx               # Main React component
    ├── main.tsx              # React entry point
    ├── components/           # React components organized by feature
    │   ├── terminal/         # xterm.js terminal rendering
    │   ├── filebrowser/      # File tree with context menus
    │   ├── editor/           # Monaco editor with diff support
    │   ├── session/          # Session tabs and dialogs
    │   ├── settings/         # Settings panels (appearance, terminal, etc.)
    │   └── ui/               # Shadcn/ui components
    ├── stores/               # Zustand state management
    │   ├── useAgentStore.ts
    │   ├── useSessionStore.ts
    │   ├── useFileStore.ts
    │   └── useSettingsStore.ts
    ├── i18n/                 # React-i18next localization (en, ru)
    └── lib/utils.ts          # Tailwind class utilities
```

### State Management

- **Zustand** for renderer state (agents, sessions, files, settings)
- **electron-store** for main process persistence (sessions, app settings)
- Claude API settings stored in `~/.claude/settings.json`

### IPC Communication Pattern

1. Renderer calls `window.electronAPI.xxx.method()` (defined in preload)
2. Preload forwards to main via `ipcRenderer.invoke()` or `ipcRenderer.send()`
3. Main process handler in `src/main/ipc/` processes request
4. Response returned via promise (invoke) or event emission (send)

For events from main to renderer:
- Main calls `mainWindow.webContents.send(channel, data)`
- Preload sets up listener with cleanup function returning unsubscribe

### Agent/PTY Architecture

`AgentProcessManager` spawns Claude CLI as a PTY process:
- Uses `node-pty` for terminal emulation
- Batches output to prevent IPC flooding (50ms debounce, max 50 items)
- Maintains ring buffer (1000 items) for output history
- Injects git context via `GIT_CHANGED_FILES_CONTEXT` env var

## Key Patterns

### Adding a New IPC Method

1. Add type definition in `src/preload/index.ts`
2. Implement handler in `src/main/ipc/<domain>Handlers.ts`
3. Register handler in `src/main/index.ts`
4. Call from renderer via `window.electronAPI.<domain>.<method>()`

### Adding a New Store

Follow the Zustand pattern in existing stores:
- Use `create()` with typed interface
- Return new references for Map updates to trigger re-renders
- Export selector hooks for derived state

### Component Organization

Components are grouped by feature domain. UI primitives go in `src/renderer/components/ui/` (Shadcn/ui pattern).

## Build Configuration

- Uses `electron-vite` for building all three processes
- Path alias `@renderer` maps to `src/renderer/`
- Monaco editor loaded via custom loader for proper bundling
- Tailwind CSS with shadcn/ui theming

## Internationalization

- Uses `react-i18next` with namespace-based organization
- Locales in `src/renderer/i18n/locales/<lang>/`
- Supported languages: English (en), Russian (ru)
