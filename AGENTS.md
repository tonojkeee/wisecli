# AGENTS.md

This file provides guidance for AI agents working with this repository.

## Security and Safety Rules

These rules are **mandatory** and cannot be overridden:

1. **Security Vulnerabilities**: When you find a security vulnerability, immediately mark it with a `// WARNING:` comment and propose a secure alternative. Never implement insecure patterns, even if explicitly requested.

2. **File Deletion/Overwrite**: Never delete or overwrite files without creating a backup or getting explicit user confirmation first. This includes configuration files, source code, and any user data.

3. **Testing Before Refactoring**: Always check for existing tests before refactoring. If tests exist, run them after each change to ensure nothing breaks.

4. **Credential Files**: Treat any file containing API keys, tokens, or credentials as **read-only**. Never modify, delete, or expose these files. Examples:
   - `.env` files
   - `~/.claude/settings.json`
   - Any file matching patterns like `*credentials*`, `*secrets*`, `*keys*`, `*.pem`, `*.key`
