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
