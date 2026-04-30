# SupaPara — Overview

## What is SupaPara

SupaPara is a classroom helper for **paraprofessionals** (teacher aides) who support students with **IEPs** (Individualized Education Plans, the legal documents that govern special-education services). It runs in a web browser and is built primarily for school-issued **Chromebooks**.

A para uses SupaPara to:
- Log observations about each student during class (what they said, what worked, what didn't)
- Read handoff notes from the previous shift
- Track progress toward each student's IEP goals
- Get one-tap support strategies for situations like meltdowns, work refusal, transitions
- Talk to an AI copilot that already knows each student's plan
- Hand off notes to the next para with one click
- Maintain the **Tools & Supports** fact base for each kid — break access, BIP status, reinforcement system — so the next para or sub isn't starting from zero
- Generate **Topics for Next Check-in** — a short list of patterns from their own recent logs worth bringing up with their sped teacher

An owner or sped teacher uses SupaPara to:
- Create a school team and invite paras/subs with a code
- Assign students to specific paras or pre-register assignments by school email
- Manage roles, pause/resume members, remove members, and transfer ownership
- Approve or deny **join requests** — paras who don't have an invite code can request access, and the admin grants it from the Members tab
- Toggle all sub access off when needed
- Regenerate invite codes
- Add private parent notes that paras cannot see
- Open the **Coaching tab** in the Admin Dashboard to see training-gap topics auto-detected from team-shared logs and send a friendly "share a tip" message to the right para

It is built and maintained by **Deandre ("Dre") Sample**, a paraprofessional at Fairview Middle School in Washington State. He built it because the existing tools (paper, Google Docs, district software) all failed in the same way: they either leaked student names everywhere, or they took too long to use during a real classroom situation.

## Live URL

`supapara.vercel.app`

## Who uses it

| Role | What they do | Permissions |
|---|---|---|
| **Para** | Logs notes, reads handoffs, opens student cards, edits the per-student Tools & Supports tab | Sees IEP summary + their own + shared team logs. No parent notes. |
| **Special-Ed Teacher (Sped Teacher)** | Edits IEP summaries, adds parent notes, manages goals, approves join requests, sees the Coaching tab | Full admin access including parent notes. Reaches this role by joining via an `OWN-XXXXXXXX` owner code (not the 6-letter para invite code). |
| **Owner / Team Admin** | Creates the team, invites paras, manages roles, can transfer ownership, approves join requests | Full control. Multiple owners allowed (good for co-leads). Same in-app permissions as Sped Teacher — distinction is just whether you created the team or joined into it. |
| **Sub** | Substitute para — temporary, locked-down view | Same as para but admin can disable all subs with one switch. |

Owner and Sped Teacher have identical permissions inside the app; the difference is *how* the role got assigned. The Owner created the team. A Sped Teacher joined an existing team via an owner code (or by being promoted later). This split exists so the original owner doesn't have to manually promote every sped teacher who joins — the owner just hands them an `OWN-` code and they land with full admin rights.

The **Tools & Supports** tab inside each student's profile is a small fact base — break access, BIP status, reinforcement system — and it is **para-editable**, not admin-only. Paras live with these systems daily, so they're the right people to keep the record current.

A "team" in SupaPara = one school's special-ed support team (typically 1 sped teacher + 3–8 paras + occasional subs). Most schools will have one team.

## Student assignment model

Admins can assign specific students to specific paras/subs. This matters because paras should be able to work quickly without seeing more student data than they need.

- **Admins / sped teachers** see the full team roster.
- **Paras / subs** see students assigned to them, plus student rows they personally added.
- **Paras can still add students** for their active team. They are not blocked from building their working roster.
- Paras can maintain rows they created, but they cannot edit other people's roster rows or browse unassigned admin-created students.
- Pending assignments can be pre-registered by email; when that para joins the team with that email, the assignment is claimed.

## The one load-bearing rule (FERPA)

**Real student names never leave the user's computer.**

This is the rule the entire architecture exists to enforce. In US education law (FERPA — the Family Educational Rights and Privacy Act), student PII (personally identifiable information) is heavily regulated. Any cloud service that stores student names is suddenly subject to district procurement, data-sharing agreements, and a year of legal review.

SupaPara solves this by separating identity from data:

- **On the cloud:** every student is just a 6-digit number called a **Para App Number** (e.g. 847293). That's all that ever syncs to Supabase, ever shows up in shared handoffs, ever touches the AI.
- **On the para's computer only:** there's a local "Real Names" file that maps Para App Numbers back to actual student names. This file can be saved or remembered (opt-in) but it never uploads anywhere.

This split is what lets SupaPara make a stronger FERPA/privacy argument than ordinary shared docs: the most sensitive identifier, the real student name, is not stored in Supabase because the cloud never receives it.

## Three modes a para uses every day

1. **Simple Mode** — for fast 1-tap logging during chaos (e.g. mid-meltdown). Gives 6 category buttons per student, undo timer, inline detail bar.
2. **Normal Mode** (the regular Dashboard) — for thoughtful logging when you have time. Tap an action, get a roomy "what happened?" sheet with a textarea + history of what's worked before for that student.
3. **AI Copilot** (optional) — chat panel where the para describes a situation and the app suggests strategies based on the student's IEP goals + recent logs. Works locally via Ollama OR via a paid Google Gemini API key.

## Tech in one sentence

React 19 (Create React App) frontend, Supabase Postgres + Auth + Realtime backend with Row Level Security, deployed on Vercel.

## Status

- **Production:** `supapara.vercel.app`
- **Pilot school:** Fairview Middle School (free through June 2026)
- **Pricing plan:** $300/year per school starting Sept 2026 ("Founding School" rate, locked for 3 years for early-adopter districts)
- **Tests:** 346 unit tests passing across 28 suites (Jest); Playwright e2e covers the major flows
- **Codebase size:** ~19,000 lines of app code, ~24,000 total including styles, SQL, and tests

## Para-facing copy rule

All strings paras see in the UI — labels, default notes on quick actions, topic explainers, alternatives, audit-panel text — must be plain English. **No specialist behavior-analysis vocabulary** (no EBP, FCT, DRA, DRO, ABA, "extinction," "satiation," "reinforcer," "function-maintained," "planned ignoring" used as a labeled term, "antecedent" used in user copy). The training-gap feature in particular started with clinical wording and was rewritten end-to-end after a review pass — paras come from many backgrounds, and assuming they know that vocabulary excludes the actual users.
