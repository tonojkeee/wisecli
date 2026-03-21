# Совместная разработка WiseCLI

Это руководство описывает процесс работы над проектом для команды разработчиков.

## Содержание
- [Первичная настройка](#первичная-настройка)
- [Рабочий процесс](#рабочий-процесс)
- [Формат коммитов](#формат-коммитов)
- [Проверки перед push](#проверки-перед-push)
- [Решение конфликтов](#решение-конфликтов)
- [Полезные команды](#полезные-команды)

---

## Первичная настройка

### 1. Установка pnpm

```bash
# Через npm
npm install -g pnpm

# Через curl (Linux/macOS)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 2. Клонирование репозитория

```bash
git clone https://github.com/tonojkeee/wisecli.git
cd wisecli
```

### 3. Установка зависимостей

```bash
pnpm install
```

Эта команда автоматически установит нативные модули (node-pty) через `electron-builder install-app-deps`.

### 4. Запуск в режиме разработки

```bash
pnpm dev
```

Приложение должно открыться с hot reload.

---

## Рабочий процесс

### Ветвление

Используем простую модель ветвления:

```
main (защищённая ветка)
  ↑
feature/название-фичи  →  PR  →  merge
fix/название-бага
chore/описание
```

### Пошаговый процесс

**1. Начало работы над задачей**

```bash
# Переключиться на main и получить последние изменения
git checkout main
git pull origin main

# Создать новую ветку
git checkout -b feature/my-feature
# или
git checkout -b fix/some-bug
```

**2. Работа и коммиты**

```bash
# Посмотреть изменённые файлы
git status

# Добавить файлы
git add src/path/to/file.ts

# Закоммитить (смотри формат коммитов ниже)
git commit -m "feat(scope): описание изменений"
```

**3. Отправка ветки на GitHub**

```bash
# Первый push новой ветки
git push -u origin feature/my-feature

# Последующие push
git push
```

**4. Создание Pull Request**

1. Откройте репозиторий на GitHub
2. Нажмите "Compare & pull request"
3. Опишите изменения в PR
4. Дождитесь code review
5. После одобрения — merge в main

**5. После merge**

```bash
git checkout main
git pull origin main
```

---

## Формат коммитов

Проект использует **Conventional Commits**:

```
<тип>(<область>): <описание>
```

### Типы

| Тип | Описание | Пример |
|-----|----------|--------|
| `feat` | Новая функциональность | `feat(git): add commit history viewer` |
| `fix` | Исправление бага | `fix(terminal): resolve resize issue` |
| `refactor` | Рефакторинг без изменения поведения | `refactor(agent): simplify process manager` |
| `chore` | Технические изменения | `chore: bump version to 0.1.2` |
| `docs` | Документация | `docs: update README` |
| `style` | Форматирование | `style: fix indentation` |
| `test` | Тесты | `test: add unit tests for GitService` |

### Области (scopes)

Основные области проекта:

- `git` — git-функционал
- `main` — main-процесс Electron
- `renderer` — React-приложение
- `terminal` — xterm.js компонент
- `editor` — Monaco editor
- `i18n` — локализация
- `ipc` — IPC-хендлеры

### Примеры из истории проекта

```
feat(git): add Git History viewer with diff support
fix: security improvements and code cleanup
chore: bump version to 0.1.2
refactor: migrate terminal runtime from ghostty-web to xterm
```

---

## Проверки перед push

### Автоматические (pre-commit hook)

При каждом коммите автоматически запускается:
- **ESLint** — проверка кода
- **Prettier** — форматирование

Если линтер находит ошибки, коммит не пройдёт.

### Ручные проверки

**Перед каждым push:**

```bash
# Проверка типов TypeScript
pnpm typecheck

# Линтинг всего проекта
pnpm lint
```

**Перед Pull Request:**

```bash
# Полная сборка
pnpm build
```

---

## Решение конфликтов

### При pull

Если `git pull` выдаёт конфликт:

```bash
# Посмотреть конфликтующие файлы
git status

# Открыть файлы и разрешить конфликты
# (искать <<<<<<< HEAD в файлах)

# После разрешения
git add .
git commit
```

### При merge PR

Если GitHub показывает конфликты:

```bash
# Обновить main в своей ветке
git checkout main
git pull origin main
git checkout feature/my-feature
git merge main

# Разрешить конфликты, затем
git add .
git commit
git push
```

### Использование rebase (альтернатива)

```bash
# Вместо merge использовать rebase
git checkout feature/my-feature
git fetch origin
git rebase origin/main

# Разрешить конфликты (если есть)
git add .
git rebase --continue

# Push с force (только для своей ветки!)
git push --force-with-lease
```

---

## Полезные команды

### Git

```bash
# История коммитов
git log --oneline -10

# Изменения в файлах
git diff

# Отменить изменения в файле (до add)
git checkout -- filename

# Отменить add
git reset HEAD filename

# Отменить последний коммит (сохранить изменения)
git reset --soft HEAD~1

# Удалить ветку
git branch -d feature/my-feature

# Удалить remote ветку
git push origin --delete feature/my-feature
```

### Проект

```bash
# Разработка
pnpm dev

# Сборка
pnpm build

# Предпросмотр сборки
pnpm preview

# Линтинг
pnpm lint

# Проверка типов
pnpm typecheck
```

### Очистка при проблемах

```bash
# Удалить node_modules и переустановить
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Очистить сборку
rm -rf dist out release
pnpm build
```

---

## Структура проекта

Краткий обзор для ориентации:

```
src/
├── main/           # Node.js процесс (backend)
│   ├── ipc/        # IPC обработчики
│   └── services/   # Сервисы main-процесса
├── preload/        # Context bridge (main ↔ renderer)
├── renderer/       # React приложение (frontend)
│   ├── components/ # UI компоненты
│   ├── stores/     # Zustand state
│   ├── hooks/      # React hooks
│   └── i18n/       # Локализация
└── shared/         # Общие типы
```

---

## Контакты

При возникновении вопросов обращайтесь к @tonojkeee.
