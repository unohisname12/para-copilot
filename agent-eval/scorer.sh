#!/usr/bin/env bash
# agent-eval/scorer.sh — diffs an agent's find.md against the sealed manifest and prints a score.
set -euo pipefail

RESULT_FILE="${1:-}"
SEALED="$HOME/SupaPara-HQ/agent-eval-sealed/manifest.json"

if [ -z "$RESULT_FILE" ] || [ ! -f "$RESULT_FILE" ]; then
  echo "Usage: $0 <result-file.md>" >&2
  exit 1
fi

if [ ! -f "$SEALED" ]; then
  echo "ERROR: sealed manifest missing at $SEALED" >&2
  exit 1
fi

echo "Result file: $RESULT_FILE"
echo "Sealed manifest: $SEALED"
echo
echo "Manual scoring required. Open both files side-by-side and apply RUBRIC.md."
echo "Slots in sealed manifest:"
jq -r '.bugs[] | "  \(.id) [tier \(.tier)]: \(.file):\(.line_range) — \(.summary)"' "$SEALED"
echo
echo "Record final score in $RESULT_FILE under '## Score'."
