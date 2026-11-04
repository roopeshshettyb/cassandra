# Rules stay synced

Every rule lives in two copies, so both tools load it without being told:

| Tool | Reads | Extension |
|---|---|---|
| Cursor | `.cursor/rules/` in the root, `frontend/` and `backend/` | `.mdc`, with `description` and `globs` frontmatter |
| Claude Code | the `AGENTS.md` in the folder, which points at `.claude/rules/` | `.md`, no frontmatter |

- **One rule per file.** Never inline a rule into `AGENTS.md`; it holds only which file to read, and when.
- **The `.mdc` is the original.** Edit it, then regenerate the Claude copies — never edit a `.md` by hand:
  ```bash
  scripts/sync-rules.sh
  ```
- **Adding a rule** means a new `.mdc` plus a row in that folder's `AGENTS.md` saying when to read it. Regenerating creates the `.md`.
- `scripts/sync-rules.sh --check` reports a stale copy, a missing or orphaned one, and a rule no `AGENTS.md` mentions. The Rules Sync workflow runs it on every PR, so a rule changed for one tool only cannot merge.
