# SupaPara — Changelog

A running log of meaningful changes to the app — fixes, new features, schema changes, and infra moves. Most recent first. An automated agent appends a new dated section every 3 days based on the commit history; manual entries are welcome too.

The point of this file in the NotebookLM pack: when a teammate asks "what changed recently?" or "is X bug fixed?", NotebookLM has a real answer instead of inferring from code.

---

## 2026-04-30 — External audit follow-up: 5 stability fixes

An outside AI auditor flagged 7 candidate bugs in the codebase. After verifying each against the live code, **5 turned out to be real** and have been fixed and shipped to production. The other 2 were false alarms (one was looking at the moved `JPDs-gZD` repo path; the other was an environmental issue with the auditor's local port, not the code).

**Live on `supapara.vercel.app` after this date.** Migration `20260430100000_create_team_owner_code.sql` is applied to the production Supabase project.

### What got fixed

- **Owner-code join now refreshes the team list.** Joining a team via an `OWN-XXXXXXXX` code was calling the bare service function directly, bypassing `TeamProvider`'s `getMyTeams()` reload that the invite-code path uses. Server-side membership succeeded but the client teams list never updated, so the para stayed stuck on the onboarding modal until a manual reload. `joinTeamAsOwner` is now wired through `TeamProvider` with the same reload + `setActiveTeamId` flow as `joinTeamByCode`.
- **New teams now get an owner code automatically.** The `create_team` RPC was authored Apr 22, before owner codes existed. The Apr 29 owner-code migration backfilled existing rows but never updated `create_team`, so any team minted after that came back with `owner_code = NULL` — leaving fresh admins with no code to share. New migration replaces the function to call `generate_owner_code()` inline on insert.
- **Guided case-memory saves no longer create duplicate incidents.** `StudentProfileModal.handleSaveGuided` was pre-creating each record with `createIncident` / `createIntervention` / `createOutcome`, then passing the result into `caseMemory.add*` — which calls those same factories *again* internally and mints fresh ids. The stored records ended up with ids the modal never saw, while the modal kept using the discarded first ids for cross-references (`interventionIds`, `incidentId`, `interventionId`). Every chained link was broken. Now passes raw data to `caseMemory.add*` and uses the returned record's id for chaining.
- **Drafts re-hydrate when the textarea key changes.** `useDraft`'s hydrate effect ran with empty deps, so the same hook instance kept the first key's draft forever. Switching students or actions on a mounted component never loaded the new key's saved draft, and the previous key's text could leak into the new key's auto-save slot. Hydrate effect now depends on `[key]`, keeping the original "user-loaded data wins" semantic on the initial mount only and re-hydrating (or clearing) on subsequent key changes.
- **E2E test runner dependency aligned.** `package.json` listed `playwright` as a dev dep instead of `@playwright/test`. The runner imports come from `@playwright/test`, so `npm run test:e2e` was failing to resolve them. Swapped.

### Verification

Full Jest suite: **616/616 passing** across 48 suites. Local `npm run build` clean. Vercel production build clean (one earlier deploy failed on a named ESLint suppression rule that CRA's lint config doesn't ship — fixed in a follow-up commit using a bare `// eslint-disable-next-line`).

### Why these matter to a para

- The owner-code refresh fix means a sped teacher pasting their `OWN-XXXXXXXX` code actually lands inside the team on first try. Before the fix, the modal looked frozen and they'd give up or call Dre.
- The duplicate-incident fix means the "Add Help Details" guided flow under a kid's profile actually links the intervention to the incident the para was looking at — so the next para checking case history sees the trail. Before the fix, the trail was silently broken: the incident was saved, the intervention was saved, but they pointed at IDs that didn't exist.
- The draft fix means typing a partial note for one student, opening another student's profile, and coming back doesn't clobber the first student's saved draft.

---

<!-- Future entries appended above this line by the every-3-days update agent. -->
