# Project rules

Each rule is one file, so a rule is edited in one place. Read the ones that apply to what you are about to write.
Cursor attaches them itself from `.cursor/rules/`; the paths below are the Claude copies.

| Read this | When you are |
|---|---|
| `.claude/rules/write-good-code.md` | **always** — order of work, verifying end to end, less code, no constants fallbacks, no `as any` |
| `.claude/rules/rules-stay-synced.md` | adding or changing a rule |

Then, for the folder you are working in:

| Folder | Its rules |
|---|---|
| `backend/` | `backend/AGENTS.md` → `backend/.claude/rules/` (constants, module layout, requests, security, database, tests) |
| `frontend/` | `frontend/AGENTS.md` → `frontend/.claude/rules/` (constants, API calls, pages, state, lists, navigation, styling, tests) |

Each rule exists twice — `.cursor/rules/*.mdc` for Cursor, `.claude/rules/*.md` for Claude. Change both in the same commit; see `rules-stay-synced`.
