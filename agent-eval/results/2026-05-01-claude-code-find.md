# Claude Code Find Eval — 2026-05-01

Branch under review: `feat/pre-merge-audit-2026-05-01`
Baseline: `main`
Eval round tag: `eval-round-2026-05-01`
Baseline tag: `eval-baseline-2026-05-01`

## Result

Claude Code found all 10 planted bugs in find mode:

- T1-A: `src/components/SignInScreen.jsx` — "Goggle" typo on Google sign-in button.
- T1-B: `src/components/BrandHeader.jsx` — "ParaProfesionals" tagline typo.
- T2-A: `src/utils/fuzzyMatch.js` — off-by-one in the Jaro inner loop.
- T2-B: `src/utils/exportCSV.js` — reversed `paraAppNumber` fallback order.
- T3-A: `src/hooks/useFollowUps.js` — interval cleanup no longer clears the timer.
- T3-B: `src/hooks/useDraft.js` — `value` missing from the autosave effect dependencies.
- T4-A: `src/services/paraAssignments.js` — missing `await` on Supabase query.
- T4-B: `src/engine/cloudAI.js` — missing `await` on `res.json()`.
- T5-A: `src/features/import/legacyImport.js` — row-side name normalization no longer matches vault-side `normalizeName()`.
- T5-B: `src/hooks/useStudents.js` — cloud reader uses `student_uid` while writer/schema use `external_key`.

The agent also correctly treated `agent-eval/prompts/mission-control-pre-merge-review.md` as branch-base drift from `main`, not as a planted code defect.

<!-- AGENT_EVAL_SCORE
agent: claude-code
mode: find
date: 2026-05-01
raw_points: 30
weighted_points: 54
max_possible: 54
notes: found all 10 planted bugs; no confirmed false positives
-->
