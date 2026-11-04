# Rules stay synced

Every rule lives in two copies, so both tools load it without being told:

| Tool | Reads | Extension |
|---|---|---|
| Cursor | `.cursor/rules/` in the root, `frontend/` and `backend/` | `.mdc`, with `description` and `globs` frontmatter |
| Claude Code | the `AGENTS.md` in the folder, which points at `.claude/rules/` | `.md`, no frontmatter |

- **Change a rule in both copies, in the same commit.** They must stay identical apart from the Cursor frontmatter.
- Regenerate the Claude copies from the Cursor ones rather than editing them by hand:
  ```bash
  for f in .cursor/rules/*.mdc frontend/.cursor/rules/*.mdc backend/.cursor/rules/*.mdc; do
    out="${f/.cursor\/rules/.claude/rules}"; out="${out%.mdc}.md"
    mkdir -p "$(dirname "$out")" && sed '1{/^---$/!q};1,/^---$/d' "$f" | sed '1{/^$/d}' > "$out"
  done
  ```
- Adding a rule means a new file in both, plus a row in that folder's `AGENTS.md` saying when to read it. One rule per file; don't inline a rule into `AGENTS.md`.
