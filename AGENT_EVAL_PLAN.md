# Agent Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a graded planted-bug eval harness for SuperPara so multiple AI agents (Claude Code, Cursor, Aider, etc.) can be benchmarked on bug-finding and bug-fixing against the real codebase, without ever risking a planted bug shipping to `main`.

**Architecture:** A long-lived `eval/planted-bugs` branch (never merged) holds 10 graded bugs across 5 difficulty tiers, each as its own atomic commit so they can be cherry-picked, reverted, or run as subsets. A sealed answer-key manifest lives outside the repo; the in-repo harness contains only the runner, scoring rubric, and slot definitions. Each agent run produces a transcript file that's scored against the sealed manifest.

**Tech Stack:** Bash for runner/scorer, JSON for manifests, Markdown for rubric and per-run results. No new runtime deps in SuperPara itself.

---

## Design Decisions (Locked)

1. **Branch:** `eval/planted-bugs` — long-lived, never merged. CI/Vercel must skip it (already the case — only `main` deploys).
2. **One bug = one commit.** Commits use a strict message format: `eval(tier-N): <one-line slot id>`. This lets you reset/cherry-pick individual bugs.
3. **Sealed manifest lives outside the repo** at `~/SupaPara-HQ/agent-eval-sealed/manifest.json`. The repo never contains the answer key.
4. **In-repo `agent-eval/` directory** holds: runner, scorer, rubric, slot list (slot IDs only — no file/line/fix info), per-run results.
5. **Slot IDs are opaque** (e.g. `T1-A`, `T3-B`) — they don't hint at file location or bug type beyond tier number.
6. **`main` is the baseline.** The harness diffs `main` ↔ `eval/planted-bugs` to know what changed; the sealed manifest annotates each diff hunk with intent.
7. **Agent-agnostic.** Runner just produces a clean checkout + a generic prompt; you paste the prompt into whatever agent you're testing. Transcript capture is manual (paste agent's response into a result file).

## File Structure

**New (in repo, branch `main`):**
- `agent-eval/README.md` — what this is, how to run an eval round
- `agent-eval/RUBRIC.md` — scoring rubric (objective criteria)
- `agent-eval/slots.json` — opaque slot list: `[{id, tier, status: "planted"|"empty"}]`
- `agent-eval/prompts/find-bugs.md` — generic agent prompt for find-mode
- `agent-eval/prompts/fix-bug.md` — generic agent prompt for fix-mode (one bug at a time)
- `agent-eval/runner.sh` — sets up a clean worktree on `eval/planted-bugs` and prints the prompt
- `agent-eval/scorer.sh` — given a result file, diffs the agent's findings against the sealed manifest and prints a score
- `agent-eval/results/.gitkeep` — per-run transcripts go here, format `YYYY-MM-DD-<agent>-<round>.md`
- `.gitignore` (modify) — add `agent-eval/.sealed-link` (a symlink to the sealed manifest, never committed)

**New (outside repo, sealed):**
- `~/SupaPara-HQ/agent-eval-sealed/manifest.json` — full bug list with file paths, line ranges, intent, expected fix
- `~/SupaPara-HQ/agent-eval-sealed/README.md` — how to update sealed manifest when planting new bugs

**New (in repo, branch `eval/planted-bugs` only):**
- 10 commits, one per bug. No new files; only edits to existing source under `src/`.

## Bug Slot Allocation

10 slots, 2 per tier. Specific files/lines decided at planting time (not in this plan). Tier definitions:

| Tier | Category | Example shape (NOT actual bugs) |
|------|----------|---------------------------------|
| 1 | Surface — copy / aria / lint | wrong button label, missing aria-label, swapped i18n key |
| 2 | Logic — pure function | off-by-one, inverted boolean, wrong object key |
| 3 | React state / hooks | stale closure in `useEffect`, missing dep, wrong dependency causing infinite render |
| 4 | Async / IO | missing `await`, swallowed promise rejection, racey Supabase call order |
| 5 | Cross-file / architectural | invariant violation between two modules (e.g. identity ID format writer/reader mismatch) |

Slot IDs: `T1-A T1-B T2-A T2-B T3-A T3-B T4-A T4-B T5-A T5-B`.

---

## Task 1: Scaffold agent-eval/ directory on main

**Files:**
- Create: `agent-eval/README.md`
- Create: `agent-eval/RUBRIC.md`
- Create: `agent-eval/slots.json`
- Create: `agent-eval/prompts/find-bugs.md`
- Create: `agent-eval/prompts/fix-bug.md`
- Create: `agent-eval/results/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create directory and stub files**

```bash
cd ~/Code/SuperPara
git checkout main
git pull
mkdir -p agent-eval/prompts agent-eval/results
touch agent-eval/results/.gitkeep
```

- [ ] **Step 2: Write `agent-eval/README.md`**

```markdown
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
```

- [ ] **Step 3: Write `agent-eval/slots.json`**

```json
{
  "version": 1,
  "branch": "eval/planted-bugs",
  "baseline": "main",
  "slots": [
    {"id": "T1-A", "tier": 1, "status": "empty"},
    {"id": "T1-B", "tier": 1, "status": "empty"},
    {"id": "T2-A", "tier": 2, "status": "empty"},
    {"id": "T2-B", "tier": 2, "status": "empty"},
    {"id": "T3-A", "tier": 3, "status": "empty"},
    {"id": "T3-B", "tier": 3, "status": "empty"},
    {"id": "T4-A", "tier": 4, "status": "empty"},
    {"id": "T4-B", "tier": 4, "status": "empty"},
    {"id": "T5-A", "tier": 5, "status": "empty"},
    {"id": "T5-B", "tier": 5, "status": "empty"}
  ]
}
```

- [ ] **Step 4: Write `agent-eval/prompts/find-bugs.md`**

```markdown
You are reviewing a feature branch of a React 19 + Supabase application called SuperPara (a paraprofessional support tool). The branch you are on diverges from `main` and contains an unknown number of bugs of varying severity.

Your task:
1. Review the diff between this branch and `main`.
2. For each bug you find, report:
   - Suspected file and line range
   - One-sentence description of the defect
   - Severity guess (cosmetic / logic / state / async / architectural)
   - Proposed fix (code snippet)
3. Do NOT modify any files. Report only.

Constraints:
- The codebase uses React 19 hooks, Supabase JS client v2, and CRA/Jest.
- Some "bugs" may be subtle — stale closures, missing awaits, cross-file invariant violations.
- Be honest if you're unsure. False positives count against you.

Begin.
```

- [ ] **Step 5: Write `agent-eval/prompts/fix-bug.md`**

```markdown
You are fixing a single known bug in a React 19 + Supabase application (SuperPara).

Bug location: {{FILE_PATH}}:{{LINE_RANGE}}
Symptom: {{SYMPTOM}}

Your task:
1. Identify the root cause (one paragraph).
2. Provide a minimal fix (diff or full edited file).
3. List any tests you'd add to lock the fix in.

Do not refactor unrelated code. Do not "improve" anything outside the bug.
```

- [ ] **Step 6: Write `agent-eval/RUBRIC.md`**

```markdown
# Scoring Rubric

Each planted bug is worth points. Each agent run produces a `find.md` (and optionally `fix.md` per bug).

## Find mode (per bug)
- **3 pts** — agent identified the bug, correct file, correct line range (±5 lines), correct root cause.
- **2 pts** — correct file + correct root-cause description, but wrong line range or vague location.
- **1 pt** — flagged the right file but misdiagnosed the cause (got close).
- **0 pts** — missed.
- **−1 pt** — false positive: flagged a non-bug as a bug, with confidence.

## Fix mode (per bug, optional follow-up)
- **3 pts** — fix is minimal, correct, and would pass a regression test.
- **2 pts** — fix works but is over-broad (touches unrelated code).
- **1 pt** — fix masks the symptom but doesn't address root cause.
- **0 pts** — fix is wrong or introduces a new bug.

## Per-tier weight (multiplier on raw score)
- Tier 1: ×1
- Tier 2: ×1
- Tier 3: ×2
- Tier 4: ×2
- Tier 5: ×3

## Reporting
Final score: sum of (raw_pts × tier_weight) across all 10 slots.
Max possible (find mode): 3 × (1+1+2+2+3) × 2 = 54
```

- [ ] **Step 7: Modify `.gitignore`**

Add line:
```
agent-eval/.sealed-link
```

- [ ] **Step 8: Commit scaffolding**

```bash
git add agent-eval/ .gitignore
git commit -m "chore(agent-eval): scaffold harness — slots, prompts, rubric, README"
```

---

## Task 2: Build runner.sh

**Files:**
- Create: `agent-eval/runner.sh`

- [ ] **Step 1: Write the runner**

```bash
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
```

- [ ] **Step 2: Make executable + smoke test**

```bash
chmod +x agent-eval/runner.sh
./agent-eval/runner.sh test-agent
```

Expected: error "branch eval/planted-bugs does not exist" (because we haven't created it yet — that's correct behavior at this point).

- [ ] **Step 3: Commit**

```bash
git add agent-eval/runner.sh
git commit -m "feat(agent-eval): add runner.sh for setting up eval worktree"
```

---

## Task 3: Build scorer.sh (skeleton — full scoring after manifest exists)

**Files:**
- Create: `agent-eval/scorer.sh`

- [ ] **Step 1: Write the scorer skeleton**

```bash
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
```

- [ ] **Step 2: Make executable**

```bash
chmod +x agent-eval/scorer.sh
```

Note: full auto-scoring is out of scope v1 — manual scoring against sealed manifest is fine.

- [ ] **Step 3: Commit**

```bash
git add agent-eval/scorer.sh
git commit -m "feat(agent-eval): add scorer.sh skeleton (manual scoring v1)"
```

---

## Task 4: Create sealed manifest scaffolding outside repo

**Files (outside SuperPara repo):**
- Create: `~/SupaPara-HQ/agent-eval-sealed/manifest.json`
- Create: `~/SupaPara-HQ/agent-eval-sealed/README.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p ~/SupaPara-HQ/agent-eval-sealed
```

- [ ] **Step 2: Write empty manifest**

```bash
cat > ~/SupaPara-HQ/agent-eval-sealed/manifest.json <<'EOF'
{
  "version": 1,
  "branch": "eval/planted-bugs",
  "baseline": "main",
  "bugs": []
}
EOF
```

- [ ] **Step 3: Write sealed README**

```markdown
# Sealed Agent Eval Manifest

This directory contains the answer key for the SuperPara agent eval. **Do not check this into any repo.**

## manifest.json schema

```json
{
  "bugs": [
    {
      "id": "T2-A",
      "tier": 2,
      "commit_sha": "abc123",
      "file": "src/engine/foo.js",
      "line_range": "42-47",
      "summary": "off-by-one in bounds check",
      "root_cause": "loop uses <= instead of <",
      "expected_fix": "change <= to <",
      "regression_test_hint": "test should assert no out-of-bounds at len-1"
    }
  ]
}
```

## Adding a new bug
1. On `eval/planted-bugs` branch, make the edit in a SuperPara source file.
2. Commit with message `eval(tier-N): <slot-id>` (e.g. `eval(tier-2): T2-A`).
3. Append the bug entry to `manifest.json` with the resulting commit SHA.
4. Update `agent-eval/slots.json` in main: set the slot's `status` to `"planted"`.
```

- [ ] **Step 4: Add to `~/SupaPara-HQ/.gitignore` (it IS a git repo)**

```bash
cd ~/SupaPara-HQ
grep -qxF 'agent-eval-sealed/' .gitignore 2>/dev/null || echo 'agent-eval-sealed/' >> .gitignore
git add .gitignore
git status agent-eval-sealed/ 2>&1
```

Expected: `git status` shows the directory as ignored (untracked, but excluded). Then commit:

```bash
git commit -m "chore: gitignore agent-eval-sealed (answer key for SuperPara agent eval)"
```

---

## Task 5: Create eval/planted-bugs branch

**Files:** none (branch creation only)

- [ ] **Step 1: Create branch from current main**

```bash
cd ~/Code/SuperPara
git checkout main
git checkout -b eval/planted-bugs
git push -u origin eval/planted-bugs
```

- [ ] **Step 2: Add a sentinel commit so the branch is non-empty**

Create `agent-eval/BRANCH_SENTINEL.md` (this file lives only on `eval/planted-bugs`):

```markdown
# DO NOT MERGE THIS BRANCH

This is the planted-bugs eval branch. It deliberately contains broken code.
Vercel/CI must not deploy this branch. Do not cherry-pick from it into main.
```

```bash
git add agent-eval/BRANCH_SENTINEL.md
git commit -m "eval: add branch sentinel — DO NOT MERGE"
git push
```

- [ ] **Step 3: Confirm Vercel ignores this branch**

Check `vercel.json` for branch filters or Vercel dashboard's git settings. If branch deploys are not restricted to `main`, add a guard. Print the result:

```bash
cat vercel.json
```

If `vercel.json` does not already restrict deploys to `main`, add:
```json
{ "git": { "deploymentEnabled": { "main": true } } }
```
(merging with existing config). Then commit on `main`, not on `eval/planted-bugs`.

---

## Task 6: Plant Tier 1 bugs (T1-A, T1-B)

**Files:** TBD per bug — actual files chosen at planting time.

- [ ] **Step 1: Decide T1-A target**

Pick a surface-level slot — copy text in a component, an aria-label, an i18n key. Should be findable by visual review of any rendered page. Do NOT pick a string that's covered by an existing test.

- [ ] **Step 2: Plant T1-A**

```bash
git checkout eval/planted-bugs
# Edit the chosen file. Single-line, surface-level mistake.
git add <file>
git commit -m "eval(tier-1): T1-A"
```

- [ ] **Step 3: Record T1-A in sealed manifest**

Append entry to `~/SupaPara-HQ/agent-eval-sealed/manifest.json` with the commit SHA from `git rev-parse HEAD`.

- [ ] **Step 4: Update slots.json on main**

```bash
git checkout main
# Edit agent-eval/slots.json: set T1-A.status to "planted"
git add agent-eval/slots.json
git commit -m "chore(agent-eval): mark slot T1-A as planted"
```

- [ ] **Step 5: Repeat steps 1–4 for T1-B**

Different file from T1-A. Different style of surface bug.

- [ ] **Step 6: Sanity check on eval branch**

```bash
git checkout eval/planted-bugs
npm test -- --watchAll=false 2>&1 | tail -20
```

Tier 1 bugs should NOT break the test suite (they're surface-level). If any test fails, your bug is too easy / wrong tier — re-plant.

---

## Task 7: Plant Tier 2 bugs (T2-A, T2-B)

Pure-function logic bugs in `src/engine/`, `src/utils/`, or `src/services/`. Off-by-one, inverted boolean, wrong key access.

- [ ] **Step 1: T2-A — pick a pure function with no test coverage**

Run:
```bash
git checkout main
ls src/engine src/utils 2>/dev/null
grep -L "describe\|test\|it(" src/engine/*.js src/utils/*.js 2>/dev/null | head -10
```

Pick an untested or thinly-tested pure function.

- [ ] **Step 2: Plant T2-A**

```bash
git checkout eval/planted-bugs
# Introduce off-by-one or inverted boolean in the chosen function.
git add <file>
git commit -m "eval(tier-2): T2-A"
```

- [ ] **Step 3: Record in sealed manifest, update slots.json (same flow as Task 6)**

- [ ] **Step 4: Repeat for T2-B**

Different function, different bug shape.

- [ ] **Step 5: Sanity check**

```bash
git checkout eval/planted-bugs
npm test -- --watchAll=false 2>&1 | tail -20
```

Some tests MAY fail here — that's fine for tier 2 (logic bugs can break tests). Note which tests fail in the sealed manifest under `regression_test_hint`.

---

## Task 8: Plant Tier 3 bugs (T3-A, T3-B)

React state / hook bugs. Stale closure, wrong dep array, missing dep.

- [ ] **Step 1: T3-A — pick a `useEffect` with non-trivial deps**

```bash
git checkout main
grep -rn "useEffect" src/components src/features src/hooks 2>/dev/null | head -20
```

Pick one with a real dep array.

- [ ] **Step 2: Plant T3-A**

Examples: drop a dep that's actually read inside the effect (causes stale render), add an unstable dep (causes loop), or capture a stale variable in a callback.

```bash
git checkout eval/planted-bugs
# Edit the hook
git add <file>
git commit -m "eval(tier-3): T3-A"
```

- [ ] **Step 3: Record + slots.json (same flow)**

- [ ] **Step 4: Repeat for T3-B** — different hook, different shape.

- [ ] **Step 5: Manual UI check**

```bash
git checkout eval/planted-bugs
npm start
```

Open the app, exercise the affected feature. Confirm the bug actually manifests in the UI (otherwise it's not a real bug). Don't ship a bug that no human or agent could ever observe.

---

## Task 9: Plant Tier 4 bugs (T4-A, T4-B)

Async/IO bugs. Missing `await`, swallowed rejection, racey Supabase order.

- [ ] **Step 1: T4-A — pick a Supabase call site**

```bash
grep -rn "supabase\." src/services src/features 2>/dev/null | head -20
```

- [ ] **Step 2: Plant T4-A**

Examples: drop an `await` so the next line runs against a pending promise; swap order of two dependent queries; replace `.eq(` with a wrong column.

```bash
git checkout eval/planted-bugs
git add <file>
git commit -m "eval(tier-4): T4-A"
```

- [ ] **Step 3: Record + slots.json**

- [ ] **Step 4: Repeat for T4-B**

- [ ] **Step 5: Manual + automated check**

Confirm the bug only manifests under a specific timing or data condition — that's what makes it tier 4. Document the trigger in the sealed manifest.

---

## Task 10: Plant Tier 5 bugs (T5-A, T5-B)

Cross-file architectural bugs. Two modules disagree on an invariant.

- [ ] **Step 1: T5-A — pick an invariant**

Candidates: identity ID format (writer A serializes one way, reader B parses another), a normalization step that's done in one place but skipped in another, a contract between a hook and the component that consumes it.

```bash
cat ~/Code/SuperPara/IDENTITY_SYSTEM_PLAN.md ~/Code/SuperPara/ARCHITECTURE_OVERVIEW.md 2>&1 | head -100
```

- [ ] **Step 2: Plant T5-A**

Edit ONE side of the invariant only. Two-file diff at most. The bug should be invisible in either file alone — only the contract between them is broken.

```bash
git checkout eval/planted-bugs
git add <file>
git commit -m "eval(tier-5): T5-A"
```

- [ ] **Step 3: Record + slots.json**

In the sealed manifest, list BOTH files involved (`file_primary`, `file_secondary`) so scoring can credit an agent that finds the relationship.

- [ ] **Step 4: Repeat for T5-B**

- [ ] **Step 5: Verify the bug requires cross-file reasoning**

Confirm: reading the changed file alone with no other context, would a senior engineer flag this as wrong? If yes, it's not tier 5 — re-plant. Tier 5 must require holding two files in head.

---

## Task 11: Dry run with one agent

- [ ] **Step 1: Run runner with Claude Code as the test agent**

```bash
cd ~/Code/SuperPara
git checkout main
./agent-eval/runner.sh claude-code
```

- [ ] **Step 2: Use Claude Code in the worktree**

```bash
cd .agent-eval-worktree
# Open Claude Code, paste the prompt, capture the response.
```

- [ ] **Step 3: Save response**

Save Claude Code's full response to `agent-eval/results/$(date +%Y-%m-%d)-claude-code-find.md`.

- [ ] **Step 4: Manually score against sealed manifest**

```bash
./agent-eval/scorer.sh agent-eval/results/$(date +%Y-%m-%d)-claude-code-find.md
```

Apply RUBRIC.md, write final score at the bottom of the result file under `## Score`.

- [ ] **Step 5: Commit the result file**

```bash
cd ~/Code/SuperPara
git add agent-eval/results/
git commit -m "eval(results): claude-code find round $(date +%Y-%m-%d)"
```

- [ ] **Step 6: Cleanup worktree**

```bash
git worktree remove --force .agent-eval-worktree
```

---

## Task 12: Auto-generated leaderboard

**Files:**
- Create: `agent-eval/leaderboard.sh`
- Create: `agent-eval/LEADERBOARD.md` (generated; checked in so it's browsable on GitHub)

- [ ] **Step 1: Define result-file score format**

Each `agent-eval/results/YYYY-MM-DD-<agent>-find.md` must end with this fenced block (the leaderboard parser scans for it):

```
<!-- AGENT_EVAL_SCORE
agent: claude-code
mode: find
date: 2026-05-01
raw_points: 42
weighted_points: 78
max_possible: 162
notes: missed T5-B, false-positive on T2-A
-->
```

Update `agent-eval/RUBRIC.md` to require this footer in every result file.

- [ ] **Step 2: Write `agent-eval/leaderboard.sh`**

```bash
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
```

- [ ] **Step 3: Make executable + smoke test**

```bash
chmod +x agent-eval/leaderboard.sh
./agent-eval/leaderboard.sh
cat agent-eval/LEADERBOARD.md
```

Expected: header table with no rows (no result files yet).

- [ ] **Step 4: Update README to expand playbook**

In `agent-eval/README.md`, add sections:
- **Adding a new bug** — link to `~/SupaPara-HQ/agent-eval-sealed/README.md`
- **Replanting after a refactor** — when `main` evolves, planted bugs may dissolve; rebase `eval/planted-bugs` onto new `main` and update SHAs in sealed manifest.
- **Regenerating the leaderboard** — run `./agent-eval/leaderboard.sh` after every new result file is committed.
- **Auto-scoring (deferred)** — note that scoring is manual v1; auto-scoring is on the backlog and would parse the agent's structured response against the sealed manifest.

- [ ] **Step 5: Commit**

```bash
git add agent-eval/leaderboard.sh agent-eval/LEADERBOARD.md agent-eval/README.md agent-eval/RUBRIC.md
git commit -m "feat(agent-eval): add leaderboard generator + expanded playbook"
```

---

## Self-Review Checklist

- [ ] No actual bug content (file paths, line numbers, fix snippets) appears in this plan or in any in-repo file. Bug specifics live only in sealed manifest.
- [ ] Every script path is exact (`agent-eval/runner.sh`, `agent-eval/scorer.sh`).
- [ ] Branch name is consistent: `eval/planted-bugs` everywhere.
- [ ] Slot IDs are consistent (T1-A through T5-B).
- [ ] `vercel.json` guard step (Task 5 Step 3) prevents accidental deploys.
- [ ] Each tier task includes a sanity-check step to verify the bug actually manifests.
- [ ] Tier 5 task requires cross-file reasoning — verified by Step 5.
- [ ] Sealed manifest path is consistent: `~/SupaPara-HQ/agent-eval-sealed/manifest.json`.

## Decisions (locked 2026-05-01)

1. `~/SupaPara-HQ/` IS a git repo — Task 4 Step 4 adds `agent-eval-sealed/` to its `.gitignore`.
2. Manual scoring v1; auto-scoring deferred to backlog (noted in README via Task 12).
3. Auto-generated leaderboard in scope — Task 12 builds `agent-eval/leaderboard.sh` and `agent-eval/LEADERBOARD.md`.
