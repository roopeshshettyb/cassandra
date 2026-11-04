# Backend rules

Each rule is one file. Read the ones that apply to what you are about to write.
Cursor attaches them itself from `backend/.cursor/rules/`; the paths below are the Claude copies.

| Read this | When you are |
|---|---|
| `.claude/rules/constants-rules.md` | using any string, enum, status, label, limit, `PERMISSIONS` or env value |
| `.claude/rules/module-rules.md` | adding a feature folder, controller, service or repository |
| `.claude/rules/api-rules.md` | adding or changing a route, DTO, response or list filter |
| `.claude/rules/security-rules.md` | touching any route — guards, roles, ownership |
| `.claude/rules/database-rules.md` | adding or changing a model, column, migration, transaction or seed data |
| `.claude/rules/test-rules.md` | writing or changing backend tests |

Repo-wide rules live in the root `AGENTS.md`. Every rule applies even when you only read its summary here; open the file before you rely on it.
