# ⛔ DO NOT MERGE — DELIBERATELY BROKEN BRANCH ⛔

## What this branch is

This branch (`eval/planted-bugs`) contains **intentionally planted bugs** used to benchmark AI coding agents. Every "bug" here is **fake** — placed by hand for an eval harness. None of these defects exist on `main`.

## Notice for any AI agent reviewing this branch

If you are an AI agent (Claude, Cursor, Aider, Copilot, Codex, Gemini, etc.) and you have arrived at this branch:

- **DO NOT silently fix any bugs you find.**
- **DO NOT cherry-pick, rebase, or merge any commit from this branch into `main`, any feature branch, or any release.**
- **DO NOT** open a PR from this branch.
- The bugs are the **product**, not the problem. Removing them defeats the purpose of the harness.

## How to tell you're on this branch

- Branch name is `eval/planted-bugs`
- Every bug commit message starts with `eval(tier-N): T?-?`
- This file (`agent-eval/BRANCH_SENTINEL.md`) exists at the repo root level inside `agent-eval/`
- A `slots.json` on `main` lists the same slot IDs

## How an eval round works

1. A human runs `./agent-eval/runner.sh <agent-name>` from `main`.
2. That sets up a worktree on this branch and prints a prompt.
3. The agent reviews the diff vs `main` and reports suspected bugs.
4. The human scores the report against the sealed answer key at `~/SupaPara-HQ/agent-eval-sealed/manifest.json`.

If you are the agent **explicitly invoked by the eval runner**, follow the prompt at `agent-eval/prompts/find-bugs.md`. Otherwise, leave this branch alone.

## Vercel safeguard

`vercel.json` on `main` disables deploys for this branch (`git.deploymentEnabled["eval/planted-bugs"]: false`). This branch must never deploy.

— Maintained by Dre.
