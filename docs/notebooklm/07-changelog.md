# SupaPara — Changelog

A running narrative of meaningful changes to the app — what shipped, why it shipped, and how it lands in a para's day. Newest entries on top.

The point of this file in the NotebookLM source pack: when NotebookLM evaluates the app against its other context (para-reality data, school operations, the actual texture of a teacher aide's day), this file gives it the story of what's currently true that wasn't a few weeks ago. So it can ask: does this match the world?

An automated background agent appends new entries every three days based on the commit history. Manual entries from Dre are welcome too — they sit comfortably alongside the auto-generated ones.

---

## 2026-04-30 — Stability sweep after an outside audit

An outside reviewer flagged seven candidate bugs in SupaPara. After verifying each against the live code, five turned out to be real and were fixed and shipped to production the same day. The other two were noise — one was reading the moved repo path; the other was an environment glitch on the auditor's local machine, not the app. The five that landed:

### Owner-code joins now drop the sped teacher straight into the team

A sped teacher pasting their `OWN-XXXXXXXX` admin code at sign-in expects to land inside the team. Until today, the join succeeded server-side but the modal never noticed, leaving the teacher staring at a frozen onboarding screen until they manually reloaded. The standard invite-code path already had the right behavior — it reloads the local team list and switches the active team — but the owner-code path was bypassing all of that and calling the service layer raw. Now it goes through the same provider plumbing as invite codes, so the join is one click and you're in.

### New teams now ship with an owner code automatically

The owner-code feature itself only landed Apr 29, and the migration that introduced it backfilled every existing team — but it didn't update the function that creates new teams. So any team minted between Apr 29 and today came back with a NULL owner code, leaving freshly-onboarded admins with nothing to share. A small follow-up migration fixes the create function to generate a code at insert time. Existing teams were already taken care of; new teams are now consistent with them.

### Guided "add help details" no longer breaks its own paper trail

When a para uses the guided follow-up flow under a kid's profile — antecedent, what you tried, did it work, what happened after — those answers are supposed to chain into a single case-memory record: this incident, then this intervention, then this outcome. The chaining was silently broken. Each record was being created twice in a row, and the cross-references all pointed at the first (now-discarded) copy. So a para reviewing a kid's history would see incidents floating without their interventions attached, and outcomes pointing at interventions that didn't seem to exist. The guided flow now creates each record once and uses the right ids, so the trail is intact: the next para checking the same kid's history sees what was tried and how it went.

### Drafts now follow you when you switch students mid-thought

Paras work in motion. They're typing about one student when another erupts, tap over to log the new incident, and come back to finish the first thought. The Dashboard's draft system already handled full reloads — your typing survived a flaky wifi reconnect or a Chromebook hiccup — but it didn't handle switching student profiles within the same session. The textbox identifier changes when you tap a different kid, and the draft system wasn't watching for that change. Now it is. Half-typed notes follow you across student tabs, clear themselves once you save, and remain safe across reloads.

### Smaller infra fix: test runner dependency

The end-to-end test command was failing to resolve its imports because `package.json` listed the wrong Playwright package name. Not user-visible, but it meant the e2e suite was blind. Swapped to the correct one. Full unit-test suite (616 tests) is green.

---

<!-- Future entries appended above this line by the every-3-days update agent. -->
