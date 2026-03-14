<div align="center">

# WiseCLI

**Графический интерфейс для Claude CLI**

Управление несколькими агентами с мониторингом в реальном времени, просмотром файлов и интеграцией Git

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

[Установка](#-установка) • [Возможности](#-возможности) • [Разработка](#-разработка) • [Архитектура](#-архитектура)

</div>

---

## Возможности

- **Мультиагентность** — запуск нескольких сессий Claude CLI параллельно в изолированных терминалах
- **Терминал в реальном времени** — полнофункциональный терминал на xterm.js с поиском, ссылками и буфером обмена
- **Проводник файлов** — древовидный просмотр с контекстным меню, diff-просмотром и интеграцией Monaco Editor
- **Интеграция Git** — отслеживание статуса, просмотр изменений и контекстная осведомлённость агентов
- **Интеграция с IDE** — WebSocket-сервер для двусторонней связи Claude CLI ↔ IDE
- **Статусная строка** — информация о модели, использовании контекста и стоимости в реальном времени
- **Отслеживание задач** — парсинг todo и управление задачами в режиме планирования
- **GLM-5 чат** — встроенный чат-агент с поддержкой MCP-инструментов
- **Локализация** — поддержка английского и русского языков

## Установка

### Скачать

Скачайте последнюю версию для вашей платформы:

| Платформа | Формат                                       |
| --------- | -------------------------------------------- |
| Windows   | `.exe` (установщик) или `.exe` (портативная) |
| Linux     | `.AppImage`, `.deb` или `.rpm`               |

### Из исходников

```bash
# Клонировать репозиторий
git clone https://github.com/wisecli/wisecli.git
cd wisecli

# Установить зависимости
pnpm install

# Запуск в режиме разработки
pnpm dev

# Сборка для продакшена
pnpm build
pnpm preview
```

## Разработка

```bash
pnpm dev          # Запуск сервера разработки с hot reload
pnpm build        # Сборка для продакшена
pnpm preview      # Предпросмотр production-сборки
pnpm lint         # Запуск ESLint
pnpm typecheck    # Проверка типов TypeScript
```

## Архитектура

```
src/
├── main/           # Главный процесс Electron (Node.js)
│   ├── index.ts    # Точка входа, создание окна
│   ├── ipc/        # IPC-обработчики
│   └── services/   # Основные сервисы (PTY, git, настройки)
├── preload/        # Context bridge для renderer
├── renderer/       # React-приложение
│   ├── components/ # UI-компоненты по функциональности
│   ├── stores/     # Управление состоянием (Zustand)
│   └── hooks/      # Кастомные React-хуки
└── shared/         # Общие типы между процессами
```

### Технологии

| Категория | Технологии                      |
| --------- | ------------------------------- |
| Фреймворк | Electron 32                     |
| Фронтенд  | React 18, TypeScript            |
| Стили     | Tailwind CSS, shadcn/ui         |
| Состояние | Zustand                         |
| Терминал  | xterm.js                        |
| Редактор  | Monaco Editor                   |
| Сборка    | electron-vite, electron-builder |

## Горячие клавиши

| Комбинация             | Действие                       |
| ---------------------- | ------------------------------ |
| `Ctrl/Cmd + Shift + C` | `/commit`                      |
| `Ctrl/Cmd + Shift + R` | `/review-pr`                   |
| `Ctrl/Cmd + Shift + H` | `/help`                        |
| `Ctrl/Cmd + Shift + L` | `/clear`                       |
| `F12`                  | DevTools (в режиме разработки) |

## Лицензия

[MIT](LICENSE) © WiseCLI

---

<div align="center">

Сделано с ❤️ для пользователей Claude CLI

</div>
