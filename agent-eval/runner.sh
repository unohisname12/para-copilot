#!/usr/bin/env bash
# agent-eval/runner.sh — sets up a clean checkout of eval/planted-bugs and prints the find-bugs prompt.
set -euo pipefail

AGENT_NAME="${1:-unknown}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_DIR="${REPO_ROOT}/.agent-eval-worktree"

cd "$REPO_ROOT"

# Ensure eval/planted-bugs branch exists
if ! git show-ref --verify --quiet refs/heads/eval/planted-bugs; then
  echo "ERROR: branch eval/planted-bugs does not exist. Plant bugs first." >&2
  exit 1
fi

# Clean up old worktree if present
if [ -d "$WORKTREE_DIR" ]; then
  git worktree remove --force "$WORKTREE_DIR"
fi

git worktree add "$WORKTREE_DIR" eval/planted-bugs

DATE=$(date +%Y-%m-%d)
RESULT_FILE="agent-eval/results/${DATE}-${AGENT_NAME}-find.md"

echo "================================================================"
echo "Eval round: ${AGENT_NAME} (find mode)"
echo "Worktree:   ${WORKTREE_DIR}"
echo "Save response to: ${RESULT_FILE}"
echo "================================================================"
echo
echo "----- BEGIN PROMPT -----"
cat "${REPO_ROOT}/agent-eval/prompts/find-bugs.md"
echo "----- END PROMPT -----"
