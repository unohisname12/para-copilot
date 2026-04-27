# SupaPara — NotebookLM Source Pack

This folder contains **7 numbered source files (00–06)** designed to be uploaded to **NotebookLM** so it has full context about the SupaPara app — both how it's built and how it's used.

## How to use

1. Open NotebookLM (`notebooklm.google.com`).
2. Create a new notebook called "SupaPara."
3. Click **Add source** → **Upload** → select the 7 `.md` files numbered `00-` through `06-` in this folder. (You don't need to upload this README itself.)
4. NotebookLM will index them in a few seconds.
5. Ask anything. Examples:
   - "How does a para log a quick note in Simple Mode?"
   - "Where in the code is the FERPA name-stripping enforced?"
   - "What's my realistic close rate visiting 20 schools?"
   - "What's the difference between the Para App Number and a pseudonym?"
   - "Help me write an email to a sped teacher to set up a demo."
   - "What's in the Apple-style note sheet on the Dashboard?"
   - "Explain every tab in the Admin Dashboard." (six tabs as of the v2 release)
   - "How do assigned rosters work for paras and subs?"
   - "What changed in the latest access-control hardening?"
   - "How does the Training-Gap Agenda work, and why is it auto-detect on the sped-teacher side?"
   - "What rules ship in v1 of the training-gap engine and what's deferred to v2?"
   - "What para-facing copy rules apply when I add a new feature?"

## What each file covers

| File | Topic | Use it for questions about... |
|---|---|---|
| `00-overview.md` | The app at a glance | What is SupaPara? Who uses it? What's the privacy rule? |
| `01-user-guide.md` | How every screen is used | Step-by-step "how do I" questions, feature walkthroughs |
| `02-architecture.md` | Tech stack, repo layout, key files | "Where's the code for X?", commands, deployment |
| `03-privacy-and-data.md` | FERPA architecture + Supabase schema | RLS, RPCs, table structure, the 5 privacy layers |
| `04-features-deep-dive.md` | Every feature explained tech + usage | "How does Smart Import work?", "What does PatternsCard do?" |
| `05-design-system.md` | Color tokens, components, plain-English style rule | UI/UX questions, button conventions, the design rules |
| `06-business-and-sales.md` | Pricing, target customer, sales motion | Sales advice, pitch script, objection handling, roadmap |

## Tips for NotebookLM

- **Ask specific questions.** "How does the inline quick-note bar work in Simple Mode?" beats "tell me about the app."
- **Reference file names.** "In `04-features-deep-dive.md`, you mentioned the Second Brain — explain how the keyword classification works."
- **Use the Audio Overview** feature for a podcast-style summary of the whole app.
- **Save snippets to a notebook** when NotebookLM cites something useful.

## Updating these docs

If you change the app and want NotebookLM to reflect it:
1. Edit the relevant `.md` file in this folder.
2. In NotebookLM, **delete the old source** and re-upload the new version.
3. NotebookLM will re-index in ~30 seconds.

The docs are self-contained — none of them require context from outside this folder.

## What lives outside the NotebookLM pack

A few related artifacts are in the repo but are NOT part of this NotebookLM upload:

- **`docs/superpowers/specs/`** — design specs the project goes through before building a feature. Notably `2026-04-26-training-gap-agenda-design.md` for the Training-Gap Agenda. Useful as a reference, but the NotebookLM pack already summarizes the shipped behavior in `04-features-deep-dive.md`.
- **`docs/superpowers/plans/`** — implementation plans (older, may be stale).
- **`docs/business/`** — separate parallel artifacts (e.g. `2026-04-23-money-plan.md`). The canonical business doc for NotebookLM is `06-business-and-sales.md`.
- **Repo-root markdown** like `ROADMAP.md`, `FEATURE_MAP.md`, `REPO_CONTEXT.md`, etc. — historical or in-progress notes. Not in NotebookLM.
