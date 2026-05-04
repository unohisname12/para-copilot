# Mission Control — pre-merge review prompt

Stealth-mode prompt for an eval round. The agent under test believes it's
reviewing a real feature branch before merge. Use with a neutrally-named
branch that holds the planted bug diffs (no `eval/` prefix, no sentinel,
no "DELIBERATE BUG" commit messages).

## Setup before each round

1. Create a fresh stealth branch from `main` containing the bug diffs:
   ```bash
   cd ~/Code/SuperPara && \
   git checkout main && \
   git checkout -b feat/pre-merge-audit-<YYYY-MM-DD> && \
   git checkout eval/planted-bugs -- src/ && \
   git commit -m "refactor: cleanup pass across import, hooks, services, and UI copy"
   ```
2. Keep the stealth branch local-only (don't push — it would trigger a
   Vercel preview unless `vercel.json` is updated to disable it).
3. Replace `<BRANCH_NAME>` in the prompt below with the stealth branch you
   just created.

## After each round

Delete the stealth branch so it can't drift or accidentally merge:
```bash
cd ~/Code/SuperPara && git checkout main && git branch -D feat/pre-merge-audit-<YYYY-MM-DD>
```

## The prompt

```
Pre-merge code review — SuperPara

You are reviewing a feature branch before it merges into `main` of the SuperPara React 19 + Supabase app (a paraprofessional support tool — classroom notes, IEP context, FERPA-safe team handoffs).

## Repo
- Working dir: /home/dre/Code/SuperPara
- Branch under review: <BRANCH_NAME>
- Compare against: main
- Stack: React 19, react-scripts (CRA), @supabase/supabase-js v2, Jest, Playwright

## Your task
Read the diff between the branch and `main`, then for each file touched, read the full file (not just the hunk) and assess every change.

Look for:
- **Logic** — off-by-one, inverted boolean, wrong key access, fallback-chain order, condition typos
- **React hooks** — stale closures, wrong/missing dependencies, missing cleanup (intervals/timeouts/subscriptions), unstable deps causing re-render loops
- **Async / IO** — missing `await`, swallowed promise rejections, race conditions between dependent calls, fire-and-forget where the result is needed
- **Cross-file contracts** — writer and reader disagree on a field name, format, or normalization. Two files that look fine alone but break the invariant between them
- **Surface** — typos in user-facing copy, broken aria/accessibility, wrong button labels

For each defect, report:
1. File path and approximate line range
2. One-sentence description of the defect
3. Severity category from the list above
4. Root cause (one sentence)
5. Proposed minimal fix (diff or replacement snippet)

## Constraints
- Do NOT modify any files. This is review-only.
- Do NOT skim — read the full file when assessing each change.
- Be honest about uncertainty. False positives count against the review.
- Some defects are subtle and require holding two files in mind at once. Don't dismiss a change as "fine" just because it reads okay on its own.

## Output format
Begin with `git diff main..HEAD --stat` summary, then walk file by file. Group findings under headings "Findings" and "Clean (no defects)". End with a one-paragraph overall assessment: ready to merge / needs changes / needs deeper review.
```

## Capturing the result

After the agent reports, save its full response to:
`agent-eval/results/<YYYY-MM-DD>-<agent-name>-find.md`

Append the required `<!-- AGENT_EVAL_SCORE -->` footer (see `agent-eval/RUBRIC.md`)
once you've scored it manually against `~/SupaPara-HQ/agent-eval-sealed/manifest.json`.

Then regenerate the leaderboard:
```bash
./agent-eval/leaderboard.sh
git add agent-eval/results/ agent-eval/LEADERBOARD.md && \
git commit -m "eval(results): <agent-name> round <date>"
```
