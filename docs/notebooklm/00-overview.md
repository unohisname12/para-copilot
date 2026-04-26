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

It is built and maintained by **Deandre ("Dre") Sample**, a paraprofessional at Fairview Middle School in Washington State. He built it because the existing tools (paper, Google Docs, district software) all failed in the same way: they either leaked student names everywhere, or they took too long to use during a real classroom situation.

## Live URL

`supapara.vercel.app`

## Who uses it

| Role | What they do | Permissions |
|---|---|---|
| **Para** | Logs notes, reads handoffs, opens student cards | Sees IEP summary + their own + shared team logs. No parent notes. |
| **Special-Ed Teacher** | Edits IEP summaries, adds parent notes, manages goals | Full access including parent notes. |
| **Owner / Team Admin** | Creates the team, invites paras, manages roles, can transfer ownership | Full control. Multiple owners allowed (good for co-leads). |
| **Sub** | Substitute para — temporary, locked-down view | Same as para but admin can disable all subs with one switch. |

A "team" in SupaPara = one school's special-ed support team (typically 1 sped teacher + 3–8 paras + occasional subs). Most schools will have one team.

## The one load-bearing rule (FERPA)

**Real student names never leave the user's computer.**

This is the rule the entire architecture exists to enforce. In US education law (FERPA — the Family Educational Rights and Privacy Act), student PII (personally identifiable information) is heavily regulated. Any cloud service that stores student names is suddenly subject to district procurement, data-sharing agreements, and a year of legal review.

SupaPara solves this by separating identity from data:

- **On the cloud:** every student is just a 6-digit number called a **Para App Number** (e.g. 847293). That's all that ever syncs to Supabase, ever shows up in shared handoffs, ever touches the AI.
- **On the para's computer only:** there's a local "Real Names" file that maps Para App Numbers back to actual student names. This file can be saved or remembered (opt-in) but it never uploads anywhere.

This split is what lets SupaPara legitimately claim "FERPA-safe" without lawyers. The names physically cannot leak because the cloud has never seen them.

## Three modes a para uses every day

1. **Simple Mode** — for fast 1-tap logging during chaos (e.g. mid-meltdown). Gives 6 category buttons per student, undo timer, inline detail bar.
2. **Normal Mode** (the regular Dashboard) — for thoughtful logging when you have time. Tap an action, get a roomy "what happened?" sheet with a textarea + history of what's worked before for that student.
3. **AI Copilot** (optional) — chat panel where the para describes a situation and the app suggests strategies based on the student's IEP goals + recent logs. Works locally via Ollama OR via a paid Google Gemini API key.

## Tech in one sentence

React 19 (Create React App) frontend, Supabase Postgres + Auth + Realtime backend with Row Level Security, deployed on Vercel.

## Status

- **Production:** `supapara.vercel.app`
- **Pilot school:** Fairview Middle School (free through June 2026)
- **Pricing plan:** $300/year per school starting Sept 2026 ("Founding School" rate)
- **Tests:** 327 passing (Jest + Playwright)
- **Codebase size:** ~19,000 lines of app code, ~24,000 total including styles, SQL, and tests
