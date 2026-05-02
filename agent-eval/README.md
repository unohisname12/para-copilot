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

## Adding a new bug
See `~/SupaPara-HQ/agent-eval-sealed/README.md` for the procedure. Each new bug is one commit on `eval/planted-bugs` with message `eval(tier-N): <slot-id>`, plus an entry appended to the sealed manifest, plus a status flip in `slots.json` on `main`.

## Replanting after a refactor
When `main` evolves, planted bugs may dissolve (the touched lines change or the file moves). To resync:
1. Rebase `eval/planted-bugs` onto the new `main`.
2. For any commit that produced merge conflicts or no longer applies cleanly, re-plant the bug in the new code shape and update the commit SHA in `~/SupaPara-HQ/agent-eval-sealed/manifest.json`.

## Regenerating the leaderboard
After you add a new result file under `agent-eval/results/`, run:

```bash
./agent-eval/leaderboard.sh
git add agent-eval/results/<new-file>.md agent-eval/LEADERBOARD.md
git commit -m "eval(results): <agent-name> round <date>"
```

## Auto-scoring (deferred)
Scoring is currently manual: a human compares the agent's `find.md` output against the sealed manifest and applies `RUBRIC.md`. Future work could parse the agent's structured response (file/line/root-cause per finding) and diff it against the manifest automatically. Out of scope for v1.
