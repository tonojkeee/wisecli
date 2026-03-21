<div align="center">

# WiseCLI

<img src="resources/icon.png" alt="WiseCLI Logo" width="512">

**Мощный графический интерфейс для Claude CLI**

Управляйте несколькими агентами Claude с мониторингом в реальном времени,
эмуляцией терминала, просмотром файлов и бесшовной интеграцией Git — всё в одном нативном приложении.

[![Version](https://img.shields.io/badge/version-0.1.2-blue.svg)](https://github.com/wisecli/wisecli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

[Установка](#-установка) • [Возможности](#-возможности) • [Скриншоты](#-скриншоты) • [Разработка](#-разработка) • [Roadmap](#-roadmap)

</div>

---

## Почему WiseCLI?

Claude CLI — мощный инструмент, но управление несколькими сессиями может быть неудобным. WiseCLI предоставляет:

- **Визуальное управление сессиями** — все агенты перед глазами
- **Персистентные сессии** — продолжайте диалоги после перезапуска
- **Интегрированный workflow** — терминал, файлы и Git в одном окне
- **Инсайты в реальном времени** — отслеживание модели, контекста и стоимости
- **Нативная производительность** — Electron-приложение с минимальными накладными расходами

## Возможности

| Категория              | Функционал                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Мультиагентность**   | Запуск нескольких сессий Claude CLI параллельно в изолированных терминалах                       |
| **Терминал**           | Полнофункциональный терминал на xterm.js с WebGL-рендерингом, поиском, ссылками и буфером обмена |
| **Проводник файлов**   | Древовидный просмотр с контекстным меню, интеграция Monaco Editor и diff-просмотр                |
| **Интеграция Git**     | Отслеживание статуса, визуализация изменений и контекстная осведомлённость агентов               |
| **Интеграция с IDE**   | WebSocket-сервер для двусторонней связи Claude CLI ↔ IDE                                         |
| **Статусная строка**   | Название модели, использование контекста % и отслеживание стоимости в реальном времени           |
| **Отслеживание задач** | Парсинг todo и управление задачами в режиме планирования                                         |
| **GLM-5 чат**          | Встроенный чат-агент с поддержкой MCP-инструментов                                               |
| **Локализация**        | Поддержка английского и русского языков                                                          |

## Скриншоты

> **Примечание:** Скриншоты появятся в ближайшее время. Приложение выполнено в современном тёмном стиле с боковой панелью навигации, вкладками терминальных сессий и встроенным проводником файлов.

## Требования

- **Claude CLI** установлен и настроен (`claude --version`)
- **Anthropic API ключ** в `~/.claude/settings.json`
- **Node.js 18+** и **pnpm** (для сборки из исходников)

## Установка

### Скачать

Скачайте последнюю версию для вашей платформы:

| Платформа | Форматы                                      |
| --------- | -------------------------------------------- |
| Windows   | `.exe` (установщик) или `.exe` (портативная) |
| Linux     | `.AppImage`, `.deb` или `.rpm`               |

### Сборка из исходников

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

| Категория | Технология                      |
| --------- | ------------------------------- |
| Фреймворк | Electron 32                     |
| Фронтенд  | React 19, TypeScript 5.9        |
| Стили     | Tailwind CSS, shadcn/ui         |
| Состояние | Zustand                         |
| Терминал  | xterm.js с WebGL                |
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

## Roadmap

См. [ROADMAP.md](ROADMAP.md) для планов по развитию и графика релизов.

**Ожидается в v0.2.0:**

- UI выбора модели Claude
- Полная поддержка proxy
- Шаблоны агентов

## Участие в разработке

Приветствуются любые вклады! Пожалуйста, ознакомьтесь с правилами:

1. Сделайте форк репозитория
2. Создайте ветку для функции (`git checkout -b feature/amazing-feature`)
3. Коммитьте изменения по [Conventional Commits](https://www.conventionalcommits.org/)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

### Формат коммитов

```
<type>(<scope>): <description>

# Примеры:
feat(git): add commit history viewer
fix(terminal): resolve resize issue
docs: update README
```

## Лицензия

[MIT](LICENSE) © WiseCLI

---

<div align="center">

Сделано с ❤️ для пользователей Claude CLI

**[Сообщить о баге](https://github.com/wisecli/wisecli/issues)** • **[Предложить функцию](https://github.com/wisecli/wisecli/issues)**

</div>
