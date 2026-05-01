# Agent Eval Harness

Benchmarks AI coding agents against planted bugs in SuperPara.

## How it works
- `eval/planted-bugs` branch contains 10 bugs across 5 tiers.
- This directory has the runner, prompts, rubric, and results — no answer key.
- Sealed manifest lives at `~/SupaPara-HQ/agent-eval-sealed/manifest.json`.

## Running a round
1. `./agent-eval/runner.sh <agent-name>` — sets up worktree, prints prompt.
2. Paste prompt into the agent. Capture full response.
3. Save response to `agent-eval/results/YYYY-MM-DD-<agent>-find.md`.
4. `./agent-eval/scorer.sh agent-eval/results/<file>.md` — prints score.

## Modes
- **find:** agent reviews the branch and reports bugs it sees.
- **fix:** agent is given one bug location and asked to fix it.

## Adding a new bug
See `~/SupaPara-HQ/agent-eval-sealed/README.md`.
