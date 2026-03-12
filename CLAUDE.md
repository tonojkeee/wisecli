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

Note: `pnpm install` runs `electron-builder install-app-deps` automatically to rebuild native modules like `node-pty`.

## Architecture

### Electron Process Model

The app follows the standard Electron three-process architecture:

- **Main Process** (`src/main/`): Node.js environment, handles system integration, PTY processes, file system, and git operations
- **Preload Script** (`src/preload/index.ts`): Context bridge exposing `window.electronAPI` to renderer with type-safe IPC
- **Renderer Process** (`src/renderer/`): React application with browser environment, no direct Node.js access

### Shared Types

Types shared between main and renderer are in `src/shared/types/`. Import with `@shared/types`. This ensures type safety across the IPC boundary. Key type files: `session.ts`, `settings.ts`, `todo.ts`, `statusline.ts`, `claude-code.ts`, `claude-task.ts`.

### Key Directories

```
src/
├── main/
│   ├── index.ts              # Entry point, window creation, app lifecycle, global shortcuts
│   ├── ipc/                  # IPC handlers (agent, session, settings, fs, git, clipboard, tasks)
│   └── services/             # Main process services
│       ├── AgentProcessManager.ts  # Manages claude CLI processes via node-pty
│       ├── SessionManager.ts       # Session persistence (electron-store)
│       ├── GitService.ts           # Git operations and file watching
│       ├── AppSettingsManager.ts   # App-wide settings
│       ├── ClaudeSettings.ts       # Reads/writes ~/.claude/settings.json
│       ├── ClaudeCodeServer.ts     # WebSocket server for IDE integration
│       ├── StatuslineParser.ts     # Parses OSC escape sequences from Claude CLI
│       ├── TodoParser.ts           # Parses todo items from agent output
│       ├── ClaudeTaskService.ts    # Plan mode task file management
│       ├── TrayManager.ts          # System tray
│       └── AutoLaunchManager.ts    # OS auto-start
├── preload/
│   └── index.ts              # Exposes electronAPI with full type definitions
├── shared/
│   └── types/                # Shared type definitions (import via @shared/types)
└── renderer/
    ├── App.tsx               # Main React component
    ├── main.tsx              # React entry point
    ├── components/           # React components organized by feature
    │   ├── terminal/         # xterm.js terminal rendering
    │   ├── filebrowser/      # File tree with context menus
    │   ├── editor/           # Monaco editor with diff support
    │   ├── session/          # Session tabs and dialogs
    │   ├── settings/         # Settings panels (appearance, terminal, etc.)
    │   ├── statusline/       # Claude connection status indicator
    │   └── ui/               # Shadcn/ui components
    ├── stores/               # Zustand state management
    │   ├── useAgentStore.ts  # Agent metadata + output buffer store
    │   ├── useSessionStore.ts
    │   ├── useFileStore.ts
    │   ├── useSettingsStore.ts
    │   ├── useTodoStore.ts   # Agent task tracking
    │   ├── useStatuslineStore.ts
    │   └── RingBuffer.ts     # O(1) ring buffer for terminal output
    ├── hooks/                # Custom React hooks
    ├── i18n/                 # React-i18next localization (en, ru)
    └── lib/utils.ts          # Tailwind class utilities
```

### State Management

- **Zustand** for renderer state (agents, sessions, files, settings)
- **electron-store** for main process persistence (sessions, app settings)
- Claude API settings stored in `~/.claude/settings.json`

### Output Buffer Architecture (Critical for Performance)

Terminal output is handled specially to prevent performance issues:

1. **Main Process** (`AgentProcessManager`):
   - Batches PTY output (100ms debounce, max 100 items per batch) to prevent IPC flooding
   - Maintains ring buffer (1000 items) for history

2. **Renderer Process** (`useAgentStore.ts`):
   - Agent metadata stored in Zustand (rarely changes)
   - Output stored in separate `RingBuffer` class with `useSyncExternalStore` for optimal re-renders
   - Use `useAgentOutputBuffer(agentId)` or `useActiveAgent()` hook to get output
   - Direct access via `appendOutput()`, `clearOutputBuffer()`, `getOutputBuffer()` for IPC handlers

3. **RingBuffer** (`src/renderer/stores/RingBuffer.ts`):
   - O(1) push operations, O(n) toArray (only when needed)
   - Fixed capacity prevents memory issues from large terminal outputs
   - `sliceFrom(index)` for incremental updates

### Settings Architecture

Two separate settings systems:

- **App Settings** (`AppSettingsManager`): UI preferences, terminal config, shortcuts, notifications. Persisted via electron-store.
- **Claude Settings** (`ClaudeSettings`): API keys, base URL, model selection. Read/written to `~/.claude/settings.json` to integrate with Claude CLI.

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
- Batches output to prevent IPC flooding (100ms debounce, max 100 items)
- Maintains ring buffer (1000 items) for output history
- Injects git context via `GIT_CHANGED_FILES_CONTEXT` env var for contextual awareness

### Git Integration

`GitService` provides git context to agents:

- `getChangedFilesContext()` returns formatted status string injected into agent environment
- File watching on `.git/` directory with debounced status updates to renderer
- `getFileAtRef()` for diff view (get file at HEAD vs working copy)
- Max 50 changed files in context to prevent overflow

### IDE Integration (ClaudeCodeServer)

WebSocket server that enables bidirectional communication between Claude CLI and the IDE:

- Creates lock file in `~/.claude/ide/{port}.lock` for Claude CLI discovery
- Handles `openFile` tool requests from Claude CLI
- Sends `selection_changed` and `at_mentioned` notifications to Claude
- Uses JSON-RPC 2.0 protocol over WebSocket
- Sets `CLAUDE_CODE_SSE_PORT` and `ENABLE_IDE_INTEGRATION` environment variables
- Port range: 10000-65535

### Statusline Parsing

`StatuslineParser` extracts real-time status from Claude CLI output:

- Parses OSC escape sequences: `\x1b]1337;StatuslineData;{...}\x07`
- Extracts: model name, context usage %, cost
- Updates pushed to renderer via `agent:statusline` IPC channel
- Displayed in `ClaudeConnectionIndicator` component

### Todo/Task Tracking

Two parallel tracking systems:

1. **TodoParser** (real-time): Parses todo items from agent terminal output, stored in `useTodoStore`
2. **ClaudeTaskService** (plan mode): Reads/writes `.claude/tasks/{session}/` markdown files for persistent task tracking

## Key Patterns

### Adding a New IPC Method

1. Add type definition in `src/preload/index.ts` (import from `@shared/types` if shared)
2. Implement handler in `src/main/ipc/<domain>Handlers.ts`
3. Register handler in `src/main/index.ts`
4. Call from renderer via `window.electronAPI.<domain>.<method>()`

Current IPC domains: `agent`, `session`, `appSettings`, `claudeSettings`, `fs`, `git`, `claudeCode`, `clipboard`, `tasks`, `dialog`, `logs`, `shortcuts`, `app`

### Adding a New Store

Follow the Zustand pattern in existing stores:

- Use `create()` with typed interface
- Return new references for Map updates to trigger re-renders
- Export selector hooks for derived state
- For high-frequency updates, consider using `useSyncExternalStore` (see `useAgentStore.ts`)

### Component Organization

Components are grouped by feature domain. UI primitives go in `src/renderer/components/ui/` (Shadcn/ui pattern).

### Custom Hooks

Hooks in `src/renderer/hooks/` encapsulate reusable logic:

- `useAgentActions`: Agent creation, killing, input handling
- `useSessionActions`: Session CRUD operations
- `useClaudeSettings`: Claude API settings management
- `useThemeEffects`: Theme change side effects
- `useCommandShortcuts`: Global shortcut command handling

## Build Configuration

- Uses `electron-vite` for building all three processes
- Path aliases: `@renderer` → `src/renderer/`, `@shared` → `src/shared/`
- Monaco editor loaded via custom loader (`src/renderer/components/editor/monaco-loader.ts`) for proper bundling
- Tailwind CSS with shadcn/ui theming

## Terminal Component

The terminal uses xterm.js with the `useTerminalManager` hook pattern:

- Hook returns `handleInput` and `handleResize` callbacks
- Terminal settings (fontSize, fontFamily, cursorStyle) passed as props from App.tsx
- Addons: `@xterm/addon-fit`, `@xterm/addon-search`, `@xterm/addon-web-links`
- Uses refs for callbacks to avoid stale closures in terminal event handlers
- Agent switching clears terminal and resets buffer tracking

## Global Shortcuts

Defined in `src/main/index.ts` via `globalShortcut.register()`:

- `Cmd/Ctrl+Shift+C` → `/commit`
- `Cmd/Ctrl+Shift+R` → `/review-pr`
- `Cmd/Ctrl+Shift+H` → `/help`
- `Cmd/Ctrl+Shift+L` → `/clear`

Sent to renderer via `shortcut:command` IPC channel, handled by `useCommandShortcuts` hook.

## Internationalization

- Uses `react-i18next` with namespace-based organization
- Locales in `src/renderer/i18n/locales/<lang>/`
- Supported languages: English (en), Russian (ru)
- Namespaces: `app`, `common`, `settings`, `sidebar`, `terminal`, `dialogs`, `commands`, `agents`, `sessions`, `filebrowser`, `editor`

## Debugging

- **F12** opens DevTools in development mode
- **DISABLE_GPU=1** environment variable disables hardware acceleration (useful if GPU crashes occur)
- Main process logs go to terminal; renderer logs go to DevTools console
- Agent PTY output is batched (100ms debounce) to prevent IPC flooding - check `AgentProcessManager` for details
- Common issues:
  - Terminal not rendering: Check if container has valid dimensions before XTerm initialization
  - Stale closures in callbacks: Use refs to store latest callback references (see TerminalView pattern)
  - Memory pressure from output: RingBuffer automatically limits to 1000 items
