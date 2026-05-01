# Delayed Outcome Follow-ups — Upgrade Plan

> **Goal:** Turn SupaPara's case memory from "log everything right now" into a lightweight follow-up system. The para can log what happened, log what they tried, and then SupaPara asks later what happened after. Follow-up timing changes based on the note: some supports need a 5-minute check, some need a period-end check, some need a next-day or 5-day check.

## What exists today

The feature already lives in the app as **case memory**:

| Piece | File | Current job |
|---|---|---|
| Case memory storage | `src/hooks/useCaseMemory.js` | Stores incidents, interventions, and outcomes in local storage and syncs to Supabase when cloud is configured. |
| Data models | `src/models/index.js` | `createIncident()`, `createIntervention()`, `createOutcome()`. |
| Help flow | `src/features/help/HelpPanel.jsx` | Lets a para describe what is happening, search past cases, log what they tried, then log an outcome immediately. |
| Intervention form | `src/features/help/InterventionLogger.jsx` | Captures what staff tried. |
| Outcome form | `src/features/help/OutcomeLogger.jsx` | Captures whether it worked, partly worked, did not work, or is unknown. |
| Pattern search | `src/engine/index.js` | `searchCaseMemory()` ranks past incidents and boosts supports that worked. |
| Analytics patterns | `src/features/analytics/getStudentPatterns.js` | Keyword-based "worked / did not work" pattern classifier. |
| Dashboard hinting | `src/features/dashboard/Dashboard.jsx` | Shows case-memory matches while a para writes a note. |

The missing piece: **there is no pending follow-up queue.** If the para skips the outcome, the app does not reliably bring it back later.

## Product behavior

When a para logs a note like:

> Student did not start task. I gave first/then choice and reduced it to problems 1-3.

SupaPara should:

1. Save the incident and what the para tried.
2. Create a pending follow-up.
3. Ask later: "What happened after you tried that?"
4. Let the para answer with big buttons:
   - `Helped`
   - `Got worse`
   - `No change yet`
   - `Not sure`
   - `Ask me later`
5. Let the para add a tiny note or a longer note.
6. Keep asking until the outcome is resolved, dismissed, or expires.
7. Use those outcomes to improve "what worked before" and pattern summaries.

This gives the full story without forcing the para to enter everything at once.

## Timing rules

Create a pure scheduler that chooses `nextPromptAt` from the incident/intervention text and tags.

| Signal in note | First follow-up | Why |
|---|---:|---|
| unsafe, hit, eloped, ran out, aggression, chair, throwing | 5 minutes | Safety supports need quick check. |
| refused, would not start, did not do task, off task, shutdown | 10 minutes | Enough time to see if support helped. |
| break, calm space, breathing, sensory, headphones | 15 minutes | Regulation may take a little longer. |
| academic support, chunking, calculator, read aloud, first/then | 20 minutes or period end | Work completion takes time. |
| transition, hallway, arrival, dismissal | period end | Outcome may be visible after transition ends. |
| parent note, home concern, attendance, long-term plan | next school day | Not a same-period outcome. |
| repeated pattern / uncertain outcome | 5 days max retention | Keep it available for later pattern review. |

Default: 15 minutes.

Hard cap: pending follow-ups expire after 5 days unless answered.

## Data model upgrade

Add a new local-storage-backed queue. Do not change Supabase first; ship the offline behavior first, then sync it.

New file:

`src/features/help/followUpScheduler.js`

```js
export function chooseFollowUpDelay({ incident, intervention, now = new Date() }) {}
export function createPendingFollowUp({ incident, intervention, currentDate, activePeriod }) {}
export function getDueFollowUps(followUps, now = new Date()) {}
export function snoozeFollowUp(followUp, delayMinutes, now = new Date()) {}
export function expireOldFollowUps(followUps, now = new Date()) {}
```

New hook:

`src/hooks/useFollowUps.js`

Local storage key:

`paraPendingFollowUpsV1`

Follow-up shape:

```js
{
  id: "fu_...",
  incidentId: "inc_...",
  interventionId: "intv_...",
  studentId: "stu_...",
  paraAppNumber: "123456",
  prompt: "What happened after you tried first/then choice?",
  createdAt: "...",
  nextPromptAt: "...",
  expiresAt: "...", // createdAt + 5 days
  status: "pending" | "snoozed" | "answered" | "expired" | "dismissed",
  attempts: 0,
  reason: "task_refusal",
  delayMinutes: 10
}
```

Keep it local first because school computers may be offline and this is para workflow data, not a backend blocker.

## UI upgrade

### 1. Help flow

File: `src/features/help/HelpPanel.jsx`

Change `Track outcome later` from "close and forget" to:

- Create a pending follow-up.
- Show a small confirmation: `Saved. I'll ask again in about 10 minutes.`
- Close the sheet.

### 2. Follow-up prompt

New component:

`src/features/help/FollowUpPrompt.jsx`

Design:

- Bottom sheet, same family as `HelpPanel`.
- Big buttons, 40px+ tall.
- No jargon.
- One optional text box:
  - Placeholder: `Add details if you have them.`
  - It can be blank.

Button mapping:

| Button | Outcome result |
|---|---|
| Helped | `worked` |
| Got worse | `failed` |
| No change yet | `partly` or `unknown` plus auto-snooze |
| Not sure | `unknown` |
| Ask me later | no outcome, snooze |

For `No change yet`, save a partial outcome only if the para adds detail. Otherwise snooze 15 minutes.

### 3. App-level queue host

File: `src/App.jsx`

Wire `useFollowUps()` near `useCaseMemory()`.

Render `FollowUpPrompt` when:

- A follow-up is due.
- The student still exists in `allStudents`.
- Stealth Mode is not active.
- A modal is not already blocking the screen, or use a compact banner instead.

If multiple are due, show one at a time, oldest first.

### 4. Dashboard / Simple Mode visibility

Add a small pending count:

- Dashboard: near focused student or Help button.
- Simple Mode: small header chip like `2 check-ins due`.

Do not add noise to the whole sidebar.

## Pattern engine upgrade

Current `getStudentPatterns()` only reads normal logs and keyword matches. Upgrade it to use structured case memory first:

1. Count successful interventions from `outcomes.result === "worked"`.
2. Count failed interventions from `outcomes.result === "failed"`.
3. Count partial/unknown as "needs more data", not success.
4. Fall back to keyword logs only when no structured case memory exists.
5. Add `timeToOutcomeMinutes` so the app learns whether a support worked fast or slowly.

Files:

- `src/features/analytics/getStudentPatterns.js`
- `src/engine/index.js`
- `src/context/buildContext.js`
- `src/features/analytics/PatternsCard.jsx`

New pattern summary should answer:

- What keeps happening?
- What did we try?
- What happened after?
- How long did it take?
- Would staff try it again?

## Cloud sync phase

Do this after offline behavior is working.

The app already syncs incidents, interventions, and outcomes. Pending reminders are trickier because reminders are device/workflow state.

Recommended cloud rule:

- Sync final outcomes.
- Keep pending reminder timing local per device.
- Do not sync "nag state" like attempts/due banners.

Reason: one para may need a prompt at 10:15, another para may not. The team needs the outcome, not every local reminder.

## Implementation tasks

- [ ] Add `followUpScheduler.js` with pure timing rules.
- [ ] Add Jest tests for keyword-to-delay behavior and 5-day expiry.
- [ ] Add `useFollowUps.js` with local storage queue helpers.
- [ ] Add tests for creating, due filtering, snoozing, answering, and expiring follow-ups.
- [ ] Modify `OutcomeLogger` so "Track outcome later" calls `onTrackLater` with a scheduler reason instead of just closing.
- [ ] Modify `HelpPanel` to create pending follow-ups after skipped outcomes.
- [ ] Build `FollowUpPrompt.jsx` with big buttons and optional details.
- [ ] Wire `FollowUpPrompt` into `App.jsx`.
- [ ] On answer, call `caseMemory.addOutcome()` and create the companion `Outcome` log.
- [ ] Snooze `No change yet` / `Ask me later`.
- [ ] Upgrade `getStudentPatterns()` to prefer structured outcomes.
- [ ] Add/adjust tests in `src/__tests__/helpFlow.test.js` and `src/__tests__/quickLog.test.js`.
- [ ] Run `CI=true npm test -- --watchAll=false`.

## Acceptance tests

Manual:

1. Log a help-worthy note for a focused student.
2. Log an intervention.
3. Click `Track outcome later`.
4. Confirm the app says when it will ask again.
5. Fast-forward local test clock or temporarily set follow-up delay to 1 minute.
6. Confirm a prompt appears with big buttons.
7. Click `Helped` with no details.
8. Confirm an outcome is saved and the incident resolves.
9. Repeat with `No change yet`; confirm it snoozes instead of resolving.
10. Confirm no real names are written to cloud payloads.

Automated:

- Scheduler returns 5 minutes for unsafe/escalation notes.
- Scheduler returns 10 minutes for refusal/task-start notes.
- Scheduler returns 15 minutes for regulation notes.
- Scheduler returns 20 minutes/period-end for academic support notes.
- Pending follow-ups expire after 5 days.
- Answering a follow-up creates one outcome and removes that follow-up from the due queue.
- `getStudentPatterns()` ranks structured worked/failed outcomes ahead of keyword-only logs.

## Copy rules

Use para-friendly copy:

- `What happened after?`
- `Helped`
- `Got worse`
- `No change yet`
- `Ask me later`
- `Add details if you have them.`
- `Saved. I'll ask again later.`

Avoid:

- `intervention fidelity`
- `antecedent`
- `consequence`
- `extinction`
- `FERPA`
- `data collection burden`

## Risk notes

- Do not make the prompt modal aggressive. Paras are busy. It should be easy to snooze.
- Do not require detail text. The big-button outcome is the minimum useful data.
- Do not block Stealth Mode.
- Do not sync reminder due times until there is a team-level workflow design.
- Do not overwrite the existing case memory model; extend it.

## Best first implementation slice

Ship this first:

1. Local follow-up scheduler.
2. `Track outcome later` creates a pending item.
3. Due prompt with big buttons.
4. Answer creates outcome.
5. Tests.

Then upgrade pattern analytics in the second slice.
