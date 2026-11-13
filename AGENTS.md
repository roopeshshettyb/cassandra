# Cassandra

Hotel management: NestJS + Sequelize backend, React + MUI frontend.

## How a task runs

1. Before changing code, read the rules for the folder you are changing: Claude in `backend/.claude/rules/` or `frontend/.claude/rules/`, Cursor in `.cursor/rules/` (`backend-*` or `frontend-*`). Follow every one of them.
2. Do the backend first, then the frontend.
3. Write less code. Reuse existing helpers, components and patterns, and don't add code for cases that can't happen.
4. Start the servers (`npm start` in `backend/`, then in `frontend/`) and verify the change end to end, on both backend and frontend, before calling it done.

## Adding a rule

One rule per file, in two copies with the same body: `<scope>/.claude/rules/<name>.md` for Claude
and `.cursor/rules/<scope>-<name>.mdc` for Cursor. The copies must stay identical.
Rules go in rule files only, never in this file.
