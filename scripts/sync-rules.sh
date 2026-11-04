#!/usr/bin/env bash
#
# Every rule lives twice: `.cursor/rules/<name>.mdc` for Cursor, and the same body as
# `.claude/rules/<name>.md` for Claude Code. The Claude copy is generated, never hand-written.
#
#   scripts/sync-rules.sh            regenerate every Claude copy from its Cursor original
#   scripts/sync-rules.sh --check    fail if a copy is stale, orphaned, or missing from AGENTS.md
#
# CI runs --check, so a rule changed in one copy only cannot merge.
set -euo pipefail
cd "$(dirname "$0")/.."

check=false
[ "${1:-}" = "--check" ] && check=true

fail=0
problem() {
  echo "::error file=$1::$2"
  fail=1
}

# The body of a rule: everything after the Cursor frontmatter, with its leading blank line gone.
# CR is stripped so a Windows checkout (core.autocrlf) doesn't read as drift.
body_of() {
  sed '1{/^---$/!q};1,/^---$/d' "$1" | sed '1{/^$/d}' | tr -d '\r'
}

for dir in . frontend backend; do
  src="${dir#./}/.cursor/rules"
  dst="${dir#./}/.claude/rules"
  src="${src#/}"
  dst="${dst#/}"
  [ -d "$src" ] || continue
  agents="${dir}/AGENTS.md"

  mkdir -p "$dst"

  for mdc in "$src"/*.mdc; do
    [ -e "$mdc" ] || continue
    name=$(basename "$mdc" .mdc)
    md="$dst/$name.md"

    if $check; then
      if [ ! -f "$md" ]; then
        problem "$md" "missing: run scripts/sync-rules.sh"
      elif [ "$(body_of "$mdc")" != "$(tr -d '\r' < "$md")" ]; then
        problem "$md" "out of sync with $mdc: run scripts/sync-rules.sh"
      fi
      # Every rule must be reachable, or an agent never opens it.
      grep -q "$name" "$agents" || problem "$agents" "does not say when to read $name"
    else
      body_of "$mdc" > "$md"
    fi
  done

  # A Claude copy whose Cursor original is gone would go on being read by one tool only.
  for md in "$dst"/*.md; do
    [ -e "$md" ] || continue
    name=$(basename "$md" .md)
    [ -f "$src/$name.mdc" ] || problem "$md" "no $src/$name.mdc: delete it, or add the Cursor rule"
  done
done

if $check; then
  [ $fail -eq 0 ] && echo "Rules are in sync." || echo "Rules are out of sync."
  exit $fail
fi

echo "Claude copies regenerated from .cursor/rules/."
