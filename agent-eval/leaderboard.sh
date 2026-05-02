#!/usr/bin/env bash
# agent-eval/leaderboard.sh — regenerates LEADERBOARD.md from result files.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RESULTS_DIR="${REPO_ROOT}/agent-eval/results"
OUT="${REPO_ROOT}/agent-eval/LEADERBOARD.md"

{
  echo "# Agent Eval Leaderboard"
  echo
  echo "_Auto-generated from \`agent-eval/results/*.md\` by \`leaderboard.sh\`. Do not edit by hand._"
  echo
  echo "| Date | Agent | Mode | Raw | Weighted | Max | Notes |"
  echo "|------|-------|------|-----|----------|-----|-------|"

  for f in "$RESULTS_DIR"/*.md; do
    [ -f "$f" ] || continue
    awk '
      /<!-- AGENT_EVAL_SCORE/,/-->/ {
        if (/agent:/)           { sub(/.*agent:[ ]*/, ""); agent=$0 }
        if (/mode:/)            { sub(/.*mode:[ ]*/, "");  mode=$0 }
        if (/date:/)            { sub(/.*date:[ ]*/, "");  date=$0 }
        if (/raw_points:/)      { sub(/.*raw_points:[ ]*/, ""); raw=$0 }
        if (/weighted_points:/) { sub(/.*weighted_points:[ ]*/, ""); w=$0 }
        if (/max_possible:/)    { sub(/.*max_possible:[ ]*/, ""); maxp=$0 }
        if (/notes:/)           { sub(/.*notes:[ ]*/, ""); notes=$0 }
      }
      END { if (agent) printf "| %s | %s | %s | %s | %s | %s | %s |\n", date, agent, mode, raw, w, maxp, notes }
    ' "$f"
  done | sort -r
} > "$OUT"

echo "Wrote $OUT"
