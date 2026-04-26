# SupaPara — NotebookLM Source Pack

This folder contains 6 source files designed to be uploaded to **NotebookLM** so it has full context about the SupaPara app — both how it's built and how it's used.

## How to use

1. Open NotebookLM (`notebooklm.google.com`).
2. Create a new notebook called "SupaPara."
3. Click **Add source** → **Upload** → select all 6 `.md` files in this folder.
4. NotebookLM will index them in a few seconds.
5. Ask anything. Examples:
   - "How does a para log a quick note in Simple Mode?"
   - "Where in the code is the FERPA name-stripping enforced?"
   - "What's my realistic close rate visiting 20 schools?"
   - "What's the difference between the Para App Number and a pseudonym?"
   - "Help me write an email to a sped teacher to set up a demo."
   - "What's in the Apple-style note sheet on the Dashboard?"

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
