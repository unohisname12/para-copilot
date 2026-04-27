# Training-Gap Agenda — Design

**Status:** Approved. Ready for implementation plan.
**Date:** 2026-04-26
**Owner:** Mr. Dre

---

## Background — Why this exists

A reviewer raised a concern about SuperPara's intervention logging:

> A para may log an intervention, see "the behavior stopped," and conclude the strategy is working. But paras don't always have the training to know that *stopping* a behavior isn't the same as the student *learning* — and in some cases the strategy reinforces escape behavior or other bad habits.

The sped teacher *can* review the para's data, but reviewing every log is impractical, and an unguided review easily slides into a punitive dynamic. Mr. Dre's product principle is that paras are the primary user — anything that smells like surveillance or admin oversight kills adoption.

**Goal:** surface evidence-based-practice (EBP) gaps in a way that produces *training conversations*, not write-ups. Make it structurally hard for a sped teacher to weaponize the data.

---

## Chosen approach — "Shared Training Agenda"

A new **"Topics for our next check-in"** section is added to the existing sped-teacher data export. It surfaces 1–3 EBP-gap topics detected as patterns across the para's logs, each with a short explainer and 1–2 alternative strategies.

Underneath each topic, the export links to the specific log entries that contributed to that pattern, so the sped teacher does not have to scroll all data — they can click a topic and jump to its evidence.

The para and the sped teacher see the **identical export view.** No teacher dashboard. No hidden version. No per-para performance report.

### Approaches considered and rejected

- **B. Student-Plan-Anchored Suggestions** — too indirect; the training conversation might not actually happen because nobody named it.
- **C. Para-Self-Selection** — defeats the purpose; paras don't always know when a strategy isn't EBP, so letting them gatekeep what the teacher sees means the gap never surfaces.

---

## Hard rules (baked into the design)

1. **Only patterns trigger topics.** Single log = no topic, no marker, ever. (Threshold: 3+ similar logs within a window, default 7 days, configurable.)
2. **No per-incident callouts.** Markers on individual logs only exist as *pattern membership* ("this log is part of pattern X"), never as *quality judgments* ("this log is wrong").
3. **No para name on topics in the para's own view.** From the para's perspective, topics are tied to student pseudonyms and intervention types, not to themselves. (See v2 sped-teacher view below: para names *do* appear in the sped-teacher's coaching list because the whole purpose there is "which para should I bring this tip to.")
4. **Para and sped teacher see identical topic content.** Same explainers, same alternatives, same audit information. The sped teacher's view adds para-name attribution; nothing else differs.
5. **Markers only appear in the export view.** The para is NOT interrupted in the live logging UI. Reasoning: this should lead to a *teacher↔para conversation*, not be silently self-corrected by the para in the moment.
6. **Sped teacher's only actions:** "discuss in next meeting" and "share resource." There is NO complaint field, NO performance-note field, NO "flag for follow-up" UI. The output surface cannot generate a report on the para.
7. **Language audit.** Never "flagged," "non-compliant," "audit," "review required." Always "topic," "tip," "another approach to try," "training available."
8. **Visually neutral markers.** Small bookmark/tag icon. No red. No warning glyphs.
9. **Every topic must be auditable.** Para can ask "why is this topic on our agenda?" and see the rule that fired and the logs that triggered it.

---

## Architecture

### Rule storage — hybrid: JSON descriptors + named JS predicates

Rules are stored as data objects (JSON-serializable). The pattern-matching logic lives in a small library of named JS predicates that the rule descriptors reference by name. This keeps every rule human-readable (the para's audit panel can render straight from the rule object) while still allowing non-trivial pattern logic to be tested in isolation.

**Files:**
- `src/engine/trainingGapRules.js` — exports the rule array.
- `src/engine/trainingGapPredicates.js` — exports the named predicate functions.
- `src/engine/index.js` — gains a `runTrainingGapRules(logs, students)` function that iterates rules, calls the named predicate for each, and returns the list of fired topics with evidence.

### Rule object schema

```js
{
  id: 'escape_reinforcement_pattern',
  topicTitle: "When breaks help vs. when they backfire",
  window: { days: 7 },
  scope: 'per-student',
  fires: {
    predicate: 'countWithoutCounter',
    presence: { interventionTags: ['break', 'regulation'], min: 3 },
    counter: { interventionTags: ['fct', 'replacement_skill'], max: 0 }
  },
  topicExplainer: "Giving a break right after problem behavior can reinforce the escape — the kid learns 'act out → demand goes away.' Teaching the student to *ask* for the break (functional communication) and only honoring breaks earned that way is the EBP fix.",
  alternatives: [
    "Functional communication training: teach a 'break card' or break sign.",
    "Pair earned breaks with skill demonstration, not with escalation."
  ]
}
```

### Predicate library (v1)

Only one predicate ships in v1 — the three v1 rules all use it:

- **`countWithoutCounter`** — fires when ≥ N logs match the `presence` criteria in the window AND ≤ M logs match the `counter` criteria. Both criteria are evaluated against the same student/window scope.

**Tag matching semantics.** When `interventionTags` is a list (e.g., `['redirect','deescalation','break']`), a log matches if it has *any* of the listed tags (OR). This makes it easy to write rules that group related interventions (Rule 3 groups all reactive interventions together). Rules that need AND-matching are not supported in v1.

New predicates can be added later as new rules are introduced; each predicate is a single named function that's testable in isolation.

### Starter rules (v1 — 3 rules ship)

#### Rule 1 — Escape-Reinforcement Pattern
- **Pattern:** Same student, 3+ "break used" logs (`tags: ['break','regulation']`) in 7 days, with zero "student asked for break" logs (`tags: ['fct','replacement_skill']`) in same window.
- **Topic title:** *"When breaks help vs. when they backfire"*
- **EBP gap:** Giving a break right after problem behavior reinforces the escape function. Fix: functional communication training (FCT) so the student earns breaks by asking, not by escalating.

#### Rule 2 — Attention-Loop Pattern
- **Pattern:** Same student, 3+ verbal-redirect logs (`qa_redirect`, `tags: ['redirect','behavior']`) in 7 days, with fewer than 2 positive-participation logs (`qa_positive`, `tags: ['positive','praise']`) in same window.
- **Topic title:** *"Catching them being good — flipping attention loops"*
- **EBP gap:** For attention-maintained behavior, the redirect IS the reinforcer. Fix: planned ignoring of the problem behavior + heavy reinforcement of any moment of on-task behavior (DRA/DRO).

#### Rule 3 — Reactive-Without-Skill-Building Pattern
- **Pattern:** Same student, 3+ reactive-intervention logs (combined `qa_redirect` + `qa_deescal` + `qa_break`, `tags: ['redirect','deescalation','break']`) in 14 days, with zero skill-teaching logs (`qa_skill_taught`, `tags: ['skill_teaching','replacement']`) in same window.
- **Topic title:** *"What we want them to do instead"*
- **EBP gap:** Reactive interventions (redirect, de-escalate, give break) don't teach the kid what to do *instead*. Without an explicit replacement skill being taught, the behavior comes back. Fix: pair every reactive intervention with a "what we want them to do instead" plan.

### New `QUICK_ACTIONS` required for v1

Two new actions need to be added to `src/data.js`. Both are positive-framed — they give the para *more* credit-taking surface, not more burden:

```js
{ id:"qa_break_requested", label:"Student Asked for Break (used break card)",
  icon:"🙋", category:"regulation", logType:"Positive Note",
  defaultNote:"Student self-initiated break using break card / FCT.",
  tags:["break","fct","replacement_skill","regulation","positive"] },

{ id:"qa_skill_taught", label:"Taught Replacement Skill",
  icon:"🌱", category:"academic", logType:"Skill Teaching",
  defaultNote:"Modeled or practiced a replacement skill with student.",
  tags:["skill_teaching","replacement","positive"] },
```

### Topic-content AI generation — dual-provider

The `topicExplainer` and `alternatives` fields are *seeded* in the rule definitions (so v1 ships without an AI dependency). When AI enrichment is enabled, an AI layer can rewrite or expand them per-export to fit the specific student context.

The AI layer supports both providers behind a common interface:
- **Google Gemini** — used in the shipping product.
- **Ollama** (qwen2.5:7b-instruct local) — used for local/offline mode and Mr. Dre's dev environment.

Pseudonymized data only — real student names never sent to either provider (existing FERPA constraint).

### Audit trail UX — Approach A: full transparency

When the para taps "why is this topic on our agenda?" on any topic, an expandable panel shows:

1. **The rule name in plain English** (e.g., "3+ break-pass uses with no break-card-request in 7 days").
2. **The exact threshold and window** used.
3. **Every matching log** that contributed, with pseudonym + timestamp + what was logged.
4. **The alternative strategies** suggested in the topic explainer.

Deliberately *not* included: a "what would make this topic stop appearing" hint. Reason: that would collapse the audit panel (transparency surface) with the topic explainer (coaching surface) and risks reading as manipulative. The topic explainer already says what the better practice is; the audit panel's job is transparency.

### Engine cadence

Rules run **only when the para presses "Generate Export for Meeting."** No background workers, no live re-evaluation in the logging UI, no scheduled jobs. The para fully controls when the analysis runs.

### Multi-para handling (v1)

**Per-para.** Each para's export only includes their own logs, and rules fire on their data only. Reasoning: if Para A's logs surface a topic that shows up on Para B's export, B will rightly feel blamed for someone else's pattern. Pooling can be revisited in v2 if sped teachers want a classroom-level view.

### New-para handling

Suppress all topics for a student until the para has logged **at least 10 incidents/interventions total for that student.** Prevents day-one false positives and ensures rules see enough behavior to mean something.

### Resource sharing

When the sped teacher taps "share resource" on a topic, it generates an **email draft** (reusing the existing case-manager email feature), pre-filled with the topic explainer + alternatives + a link to training resources. Sped teacher edits and sends. Para receives it as a normal email — not an in-app notification, not a dashboard alert. Lower-pressure surface; feels like a colleague sharing a tip.

### UI surface

The "Topics for our next check-in" section sits at the top of the existing sped-teacher data export. Each topic is expandable; expanding shows the audit panel (above). Both the para's in-app export view and whatever the sped teacher receives render the same layout.

---

## v2 Roadmap (deferred from v1)

These rules were drafted but require schema changes too large to bundle into this feature. Each warrants its own brainstorm.

### Rule 4 — Missing-Antecedent Pattern (deferred)
- **Pattern:** 50%+ of incident logs in the last 14 days are missing the antecedent / "what was happening before" field.
- **Why deferred:** Logs don't currently have an explicit antecedent field. Adding one changes what paras enter on *every* log — a UX shift big enough to need its own brainstorm and rollout.

### Rule 5 — Prompt-Dependency Pattern (deferred)
- **Pattern:** Same student, same task type, 5+ logs in 14 days all at "full prompt" with no fading evidence.
- **Why deferred:** Intervention logs don't currently track prompt level. Adding it touches every intervention input form.

### Other v2 candidates
- Pooled (classroom-wide) topic detection in addition to per-para.
- Tangible/access function rules.
- Sensory function rules.
- Sped-teacher-authored custom rules (Approach A path from the original brainstorm).

---

## v2 — Sped-teacher coaching view (added 2026-04-26)

Adds a triage section inside the existing `AdminDashboard` (already gated to `isAdmin = owner || sped_teacher`) so sped teachers walk into check-ins with prepared coaching tips instead of having to ask paras to surface gaps themselves.

**Product principle (from the original spec, reinforced):** the app exists to make paras' lives better. The sped-teacher view is a tool for the sped teacher to *support paras better*, not a separate product. Anything that doesn't translate into "the sped teacher walks into the check-in better-prepared to help the para" gets cut.

### Mode — auto-detect from team-synced logs

Sped teacher's view runs `runTrainingGapRules` on `team.sharedLogs` (already populated via `pullSharedTeamLogs`/`subscribeSharedLogs` in `TeamProvider`). Topics appear in the sped-teacher list whenever rules fire — no para action required.

**Why auto-detect over para-share-required:** the whole reason this feature exists is paras don't always know when something isn't best practice. Requiring them to *share* gaps they don't recognize as gaps filters out the most valuable cases. Logs are already cloud-synced — the sped teacher could read every log line manually if they wanted. The training-gap rules are a new lens on data the sped teacher already has access to, not new data exposure.

### UI — minimal triage list inside AdminDashboard

A new section labeled **"Coaching topics from your team"** (gated by the existing `isAdmin` flag).

Each row shows:
- Topic title (plain English, no jargon)
- Para name (from the team membership — the whole point is "who should I bring this to")
- Student pseudonym
- Relative age (e.g., "2 days ago")
- One action: **"Share a tip with [Para name]"** → opens existing `EmailModal` pre-filled with topic explainer + alternatives, addressed to the para

Empty state: *"Nothing to discuss right now — your team's logs look good."*

What is **deliberately not** in this view:
- No charts, graphs, or visualizations.
- No per-para "scoreboards" or counts of "how many topics each para has."
- No "discuss in next meeting" button (it doesn't actually help the para — collapses into "Share a tip").
- No "marked as addressed" / dismiss state. If logs change such that the rule no longer fires, the topic disappears on its own.
- No drill-down into per-para or per-student detail. (The triage list IS the surface.)

### Topic-level dedup behavior

If the same topic fires for the same student across multiple paras, **show separately per para.** Each is its own coaching moment — Para A and Para B with the same kid likely need different coaching context. Pooling would collapse useful nuance.

### Para-side disclosure

The para's own panel adds a one-line disclosure (under the `?` help): *"Topics here are also visible to your sped teacher so they can come ready with tips."* No surprise — the para knows the data flow.

### Refinement of Hard Rule #3

Rule #3 was originally "No para name on topics." The sharper rule is: **"No para name on topics in the para's own view."** The sped teacher's coaching list does include para names because actionability requires it. The spirit of the original rule — keep paras feeling like tool-users, not flagged records — is preserved on the para's side. The sped teacher always had access to who logged what (cloud sync makes that visible regardless); the rule was always about the para's experience.

### What the sped teacher does NOT get (still bound by the original Hard Rules)

- No "flag this para for follow-up" UI.
- No "complaint" or "performance note" field.
- No way to author records *about* the para from this view — only "share a tip *with* the para."
- No language like "non-compliant," "audit," "review required."
- No para-side surveillance (e.g., live notifications when a topic fires — only their own panel + the disclosure copy).

### Implementation surface (v2 additions)

| Area | Change |
|---|---|
| `src/components/AdminDashboard.jsx` | Add a "Coaching topics from your team" section. Calls `runTrainingGapRules(team.sharedLogs, allTeamStudentIds)`. Renders rows with para name + student + age + share-tip button. |
| `src/components/panels/TrainingGapPanel.jsx` | Add disclosure line under `?` help: *"Topics here are also visible to your sped teacher…"* |
| Email-modal integration | Reuse existing `EmailModal` for the share-tip flow. Pre-fill recipient = para's display name, body = topic explainer + alternatives. |
| `src/engine/trainingGapRules.js` + `src/data.js` | Jargon scrub on topic explainers, alternatives, `plainEnglishRule`, and `qa_break_requested` / `qa_skill_taught` `defaultNote` strings. No EBP / FCT / DRA / DRO / "functional communication" / "extinction" / "reinforcer" — plain English only. (See "Para-facing copy rule" below.)
| Tests | Update copy assertions if any; add a test that confirms the engine works against `team.sharedLogs`-shaped data (per-para attribution surfaces correctly). |

### Para-facing copy rule

All strings that appear in the para's UI — including topic titles, explainers, alternatives, `plainEnglishRule`, audit panel labels, and the `defaultNote` of any QUICK_ACTION — must be plain English with no specialist vocabulary. No EBP, FCT, DRA, DRO, ABA, "extinction," "satiation," "reinforcer," "function-maintained," "planned ignoring" (as a labeled term), "antecedent" (in user-facing copy; fine as a field name).

Use plain descriptions of what to do and why instead. Internal IDs, code comments, and this spec are exempt — they're for engineers/designers, not paras.

---

## Implementation surface summary

| Area | Change |
|---|---|
| `src/data.js` | Add 2 new `QUICK_ACTIONS` (`qa_break_requested`, `qa_skill_taught`). |
| `src/engine/trainingGapRules.js` | New file. Exports the 3 v1 rule objects. |
| `src/engine/trainingGapPredicates.js` | New file. Exports `countWithoutCounter`. |
| `src/engine/index.js` | Add `runTrainingGapRules(logs, students)` function. |
| Sped-teacher export view | Add "Topics for our next check-in" section at top, with expandable topics + audit panels. |
| Sped-teacher export view | Add "Discuss in next meeting" + "Share resource" actions per topic (no other actions). |
| Resource-share path | Reuse existing case-manager email draft feature, pre-filled per topic. |

---

## Out of scope (for this spec)

- Live in-logging-UI markers or warnings.
- Sped-teacher dashboard (separate from the export).
- Per-para performance reporting in any form.
- Any UI element for the sped teacher to write notes about the para.
- Cron/background workers.
- Backend persistence of rule firings (rules re-run from logs each export).
