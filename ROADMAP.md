# WiseCLI Roadmap

Анализ проекта и предложения по новому функционалу.

---

## 📊 Текущее состояние (v0.1.2)

### Реализовано

| Область        | Функционал                                                                  |
| -------------- | --------------------------------------------------------------------------- |
| **Сессии**     | Мульти-агентные сессии, персистентность (electron-store), resume диалог     |
| **Терминал**   | xterm.js + WebGL, PTY (node-pty), RingBuffer (1000 items), batching (60fps) |
| **Чат**        | GLM-5 интеграция с SSE streaming, MCP tools (web_search, web_reader, zread) |
| **Git**        | Статус, file watching, diff (HEAD vs working), контекст в env               |
| **IDE**        | WebSocket сервер, openFile, selection tracking, @-mentions                  |
| **Файлы**      | Браузер + Monaco редактор, табы, diff                                       |
| **Задачи**     | TodoWrite парсинг, Plan mode (.claude/tasks/), dependency graph             |
| **Statusline** | OSC парсинг, model/context/cost, hooks сервер (port 45673)                  |
| **Система**    | Tray, auto-launch, splash, i18n (en/ru)                                     |

### Известные TODO

- `src/renderer/main.tsx:16` - Fix IPC subscriptions for StrictMode

---

## 🚀 Функционал к реализации

### Приоритет 1: Высокая ценность / Низкие усилия

#### 1.1 Выбор модели Claude

**Проблема:** Нет UI для переключения между claude-sonnet/opus/haiku

**Решение:**

- Dropdown в UI создания агента
- Передача `--model claude-sonnet-4` в AgentProcessManager

**Файлы:**

- `src/main/services/AgentProcessManager.ts` - добавить model arg
- `src/shared/types/session.ts` - добавить model в AgentConfig
- `src/renderer/components/session/` - UI для выбора модели
- `src/renderer/stores/useAgentStore.ts` - store для model

**Acceptance:**

```
- Создать агента с моделью sonnet
- Проверить в терминале что запустилось с --model claude-sonnet-4
```

---

#### 1.2 Git Log просмотр

**Проблема:** Git интеграция базовая - только статус и diff

**Решение:**

- `git log --oneline -n 50` парсинг
- Компонент списка коммитов
- Клик на коммит показывает diff

**Файлы:**

- `src/main/services/GitService.ts` - добавить getLog(), getCommitDiff()
- `src/main/ipc/gitHandlers.ts` - IPC handlers
- `src/shared/types/git.ts` - типы для LogEntry
- `src/renderer/components/filebrowser/` - вкладка Git History

**Acceptance:**

```
- Открыть Git History вкладку
- Увидеть список последних коммитов
- Кликнуть на коммит - увидеть diff
```

---

#### 1.3 Авто-обновление

**Проблема:** Нет механизма обновления приложения

**Решение:**

- electron-updater интеграция
- Background download
- Install on quit / restart button

**Файлы:**

- `src/main/services/AutoUpdateService.ts` - новый сервис
- `src/main/index.ts` - инициализация
- `src/renderer/components/ui/UpdateNotification.tsx` - UI
- `package.json` - добавить electron-updater

**Acceptance:**

```
- Опубликовать релиз на GitHub
- Приложение детектит обновление
- Показывает уведомление
- Скачивает и устанавливает
```

---

#### 1.4 Полный Proxy Support

**Проблема:** Proxy только для GLM-5, не для Claude CLI и MCP

**Решение:**

- Передавать proxy env vars в PTY процесс
- Использовать proxy в McpClientService

**Файлы:**

- `src/main/services/AgentProcessManager.ts` - HTTP_PROXY/HTTPS_PROXY env
- `src/main/services/McpClientService.ts` - proxy для HTTP requests
- `src/shared/types/settings.ts` - уже есть proxyEnabled/proxyUrl

**Acceptance:**

```
- Включить proxy в настройках
- Запустить агента - трафик через proxy
- MCP tools - трафик через proxy
```

---

#### 1.5 Поиск по сессиям

**Проблема:** Нет поиска по истории вывода агентов

**Решение:**

- Полнотекстовый поиск по RingBuffer
- Подсветка найденного
- Навигация между результатами

**Файлы:**

- `src/renderer/stores/RingBuffer.ts` - добавить search()
- `src/main/ipc/agentHandlers.ts` - search IPC (если поиск на main side)
- `src/renderer/components/terminal/SearchPanel.tsx` - UI

**Acceptance:**

```
- Открыть сессию с историей
- Нажать Ctrl+F
- Ввести запрос
- Увидеть подсвеченные результаты
```

---

### Приоритет 2: Высокая ценность / Средние усилия

#### 2.1 Шаблоны агентов

**Проблема:** Пользователи создают одни и те же типы агентов

**Решение:**

- Сохранение конфигурации агента как шаблон
- Store для шаблонов
- UI для создания из шаблона

**Файлы:**

- `src/main/services/AgentTemplateService.ts` - новый сервис
- `src/renderer/stores/useAgentTemplateStore.ts` - store
- `src/renderer/components/session/TemplateDialog.tsx` - UI
- `src/shared/types/agent.ts` - AgentTemplate interface

**Acceptance:**

```
- Создать агента с настройками
- Сохранить как шаблон "Code Review"
- Создать нового агента из шаблона
```

---

#### 2.2 MCP Server Management UI

**Проблема:** Нет UI для управления MCP серверами Claude CLI

**Решение:**

- Читать/писать `mcpServers` в ~/.claude/settings.json
- UI для добавления/удаления серверов
- Статус подключения

**Файлы:**

- `src/main/services/ClaudeSettings.ts` - mcpServers CRUD
- `src/renderer/components/settings/panels/McpPanel.tsx` - UI
- `src/shared/types/settings.ts` - McpServerConfig interface

**Acceptance:**

```
- Открыть Settings > MCP
- Добавить MCP сервер (stdio или http)
- Перезапустить агента - сервер активен
```

---

#### 2.3 Git Branch Operations

**Проблема:** Нет управления ветками из UI

**Решение:**

- Create/switch/delete branches
- Merge status detection
- Branch list в sidebar

**Файлы:**

- `src/main/services/GitService.ts` - branch CRUD
- `src/renderer/components/filebrowser/GitBranchMenu.tsx` - UI
- Контекстное меню в filebrowser

**Acceptance:**

```
- Открыть Git Branch меню
- Создать новую ветку
- Переключиться на ветку
- Удалить ветку
```

---

#### 2.4 Экспорт сессий

**Проблема:** Нет экспорта истории сессий

**Решение:**

- Export в Markdown, JSON, TXT
- Включать metadata (model, timestamps)
- Batch export нескольких сессий

**Файлы:**

- `src/main/services/ExportService.ts` - новый сервис
- `src/main/ipc/sessionHandlers.ts` - export IPC
- `src/renderer/components/session/ExportDialog.tsx` - UI

**Acceptance:**

```
- Открыть контекстное меню сессии
- Выбрать Export > Markdown
- Сохранить файл
- Открыть - формат корректный
```

---

#### 2.5 Теги сессий

**Проблема:** Плоский список сессий без организации

**Решение:**

- Добавить tags к сессиям
- Фильтрация по тегам
- Цветовые метки

**Файлы:**

- `src/main/services/SessionManager.ts` - tags в Session
- `src/shared/types/session.ts` - tags: string[]
- `src/renderer/components/session/SessionList.tsx` - tags UI
- `src/renderer/components/session/TagFilter.tsx` - фильтр

**Acceptance:**

```
- Добавить тег "work" к сессии
- Добавить тег "personal" к другой
- Отфильтровать по тегу "work"
```

---

### Приоритет 3: Nice to Have

#### 3.1 Dashboard расширение

**Текущее:** Только AgentPanel
**Добавить:**

- Статистика использования (sessions, agents, messages)
- Activity timeline
- Resource usage graphs
- Quick actions

**Файлы:**

- `src/renderer/components/dashboard/` - новые компоненты
- `src/main/services/StatsService.ts` - сбор статистики

---

#### 3.2 Plugin System

**Описание:** Расширение функционала через плагины

**Компоненты:**

- PluginService для загрузки плагинов
- Plugin API (hooks, commands, UI extensions)
- Plugin settings UI

**Файлы:**

- `src/main/services/PluginService.ts`
- `src/shared/types/plugin.ts`
- `src/renderer/components/settings/panels/PluginPanel.tsx`

---

#### 3.3 Voice Input

**Описание:** Голосовой ввод для чата

**Компоненты:**

- Web Speech API интеграция
- Push-to-talk кнопка
- Transcription display

**Файлы:**

- `src/renderer/hooks/useVoiceInput.ts`
- `src/renderer/components/chat/VoiceButton.tsx`

---

#### 3.4 Cloud Sync

**Описание:** Синхронизация сессий между устройствами

**Компоненты:**

- CloudService (AWS/GCP/Dropbox)
- Conflict resolution
- Offline queue

**Файлы:**

- `src/main/services/CloudSyncService.ts`
- `src/renderer/components/settings/panels/SyncPanel.tsx`

---

#### 3.5 Agent Collaboration

**Описание:** Коммуникация между агентами

**Компоненты:**

- Inter-agent messaging IPC channel
- Shared context between agents
- Orchestration UI

**Файлы:**

- `src/main/services/AgentOrchestrator.ts`
- `src/shared/types/collaboration.ts`
- `src/renderer/components/session/AgentChat.tsx`

---

## 🏗️ Архитектурные улучшения

### NotificationService расширение

**Текущее:** agentComplete, agentError
**Добавить:**

- taskComplete - завершение задачи
- costThreshold - превышение лимита стоимости
- fileChanged - изменения в отслеживаемых файлах
- gitPush - уведомление о push

**Файл:** `src/main/services/NotificationService.ts`

---

### CommandPalette расширение

**Текущее:** Predefined slash commands
**Добавить:**

- Fuzzy file search
- Recent commands history
- Custom user commands
- Keyboard shortcuts editor

**Файл:** `src/renderer/components/commands/CommandPalette.tsx`

---

### Telemetry реализация

**Текущее:** Настройка есть, реализации нет
**Добавить:**

- Anonymous usage stats
- Error reporting
- Opt-in/out UI

**Файл:** `src/main/services/TelemetryService.ts`

---

## 📅 Релизный план (предложение)

### v0.2.0 - Core Improvements

- [ ] 1.1 Выбор модели Claude
- [ ] 1.4 Полный Proxy Support
- [ ] 2.1 Шаблоны агентов

### v0.3.0 - Git Enhancement

- [ ] 1.2 Git Log
- [ ] 2.3 Git Branch Operations
- [ ] 1.5 Поиск по сессиям

### v0.4.0 - MCP & Export

- [ ] 2.2 MCP Server Management
- [ ] 2.4 Экспорт сессий
- [ ] 2.5 Теги сессий

### v0.5.0 - Auto-Update & Dashboard

- [ ] 1.3 Авто-обновление
- [ ] 3.1 Dashboard расширение
- [ ] NotificationService расширение

### v1.0.0 - Advanced Features

- [ ] 3.2 Plugin System
- [ ] 3.5 Agent Collaboration

---

## 🔧 Технический долг

1. **React StrictMode** - исправить IPC subscriptions (`src/renderer/main.tsx:16`)
2. **Tests** - добавить unit тесты для сервисов
3. **Type safety** - усилить типизацию в IPC handlers
4. **Error boundaries** - добавить в критичные компоненты
5. **Performance monitoring** - добавить метрики рендера

---

## 📝 Заметки

- Файл создан: 2026-03-18
- Версия проекта: 0.1.2
- Основано на анализе кодовой базы через Explore агентов
