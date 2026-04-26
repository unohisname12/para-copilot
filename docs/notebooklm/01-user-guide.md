# SupaPara — User Guide

This is what a para, sped teacher, or admin actually sees and does, screen by screen. Written so anyone can answer "how do I ___?" without reading code.

## First time using SupaPara

1. Go to `supapara.vercel.app`.
2. Click **"Sign in with Google"** and choose your school account.
3. You'll see an **onboarding tour** with 5 slides explaining: welcome, privacy, the Para App Number system, team mode, and how to start.
4. After onboarding, the app drops you on the **Dashboard**.

If your school is new to SupaPara, the **first owner** (usually the sped teacher) creates the team and gets a 6-letter invite code to share with paras.

## The sidebar (left rail)

Always visible. Lets you switch between screens:

- **Dashboard** — your main work screen for the current period
- **Simple Mode** — fast 1-tap logging
- **Data Vault** — all logs, with search/filter/sort
- **IEP Import** — upload student files (admin/sped teacher mostly)
- **Admin** — team management (owners only)
- **? Help** — opens the onboarding tour any time

The sidebar also has the **"Real Names"** widget — that's where you load a saved name list file for THIS computer.

## Dashboard (the main screen / "Normal Mode")

Used by paras who want to log with detail. The layout from top to bottom:

1. **Hero header** — shows the period you're in ("Period 3 · Mr. Smith · 6 IEP students"), Ollama status badge, current date, column count selector, Copilot toggle.
2. **Today's Plan card** — what's the lesson today? Either:
   - **Write it** — type a one-line plan
   - **Get from link** — paste a Google Doc link, app pulls today's section
   - **Skip** — no plan today
3. **Class-wide action picker** ("Now tap students") — pick one of 8 action types (Observed, Participated, Behavior, Goal Check, Break, Accommodation, Escalation, Add Note), then rapid-fire tap student cards. Each tap = 1-click log.
4. **Student cards** — one card per IEP student. Shows:
   - Color dot + name (or Para App Number if real names not loaded)
   - Health indicator (green/yellow/red — based on logs in last few days)
   - Today's count of logs
   - **6 quick-action buttons per card** — tapping any of these opens the Apple-style note sheet
5. **AI Copilot** (collapsible) — chat with the model about a student or situation.

### How logging works on the Dashboard

**Two paths:**

**Path A — Class-wide rapid-fire (Simple Mode-like):**
1. Tap an action pill at the top ("Tap a student card below to log Observed")
2. Tap each student card you want to log for
3. Each tap = instant log, no sheet opens. Good for "mark everyone as participated."

**Path B — Per-student detail (the "Normal Mode" point):**
1. On a student's card, tap one of the small action icons (✓ 🙋 ⚠ ★ ☕ ♿ 🔴 📝)
2. **The Apple-style note sheet opens** with:
   - Big icon tile + action name + student chip
   - Large textarea ("What happened?") with 140px+ writing room
   - **"What worked before"** card showing top successful supports for this student
   - **"Similar past situations"** if Case Memory has matches
3. Type as much as you want. Cmd/Ctrl+Enter saves.
4. Two save buttons:
   - **"Save note"** (orange, primary) — only active when you've typed detail
   - **"Save without note"** (secondary) — for the rare 1-click case
5. Esc closes without saving.

## Simple Mode

For when the classroom is chaotic and you have 5 seconds. Cleaner, fewer choices.

- **Top bar** — period name, teacher, "x of N students", search box, sort toggle, timer/breathing tools
- **Today's summary strip** — clickable category pills showing how many of each type you've logged today. Click a pill to filter to "students who haven't gotten this category today."
- **Student grid** — 1 or 2 columns depending on screen width. Each row has:
  - Student name + health pill + today's count
  - 6 category buttons: Positive ⭐, Academic 📚, Break ☕, Transition 🔔, Refusal ✋, Behavior 🔴
- **Tap a button** → instant log + 5-second undo toast + inline quick-note bar (optional: type detail and press Enter to attach it; ignore it and the log stays as-is).
- **Double-tap** a category icon → jumps to a fuller note screen for that student + category.

The whole point of Simple Mode: **no decisions, no dialogs, just logging.**

## Data Vault

Where every log lives. Search, filter, sort, expand any row.

- **Header pills** — total observations, saved notes, "Real names stay local" privacy reminder
- **Three buttons:**
  - **Export filtered data** (orange, primary) — CSV of whatever's currently visible
  - **Export everything** (secondary) — entire log history
  - **Export with real names** (yellow warning button — only shown if a name list is loaded) — for the para's private gradebook only. Has a warning.
- **Metric cards** — Logged today / This week / Needs attention (count of red-health students)
- **Tabs:** All Logs, By Student, By Period, Flagged, Handoffs, Goals, Notes
- **Search bar** — searches across notes, types, students, tags
- **Filter dropdown** (in By Student / By Period tabs) — students with **>3 logs in last 24 hours** are prefixed with ⚠ and their rows tint subtle red. This is the "Needs attention" priority signal.
- **Click any row's ▶ to expand** — see full note text, tags, who logged it, and "edit" button.

## IEP Import

Admin/sped teacher use this to load student data into the app. Three ways at the top, plus a flagship **Smart Import** banner below.

### The 3 simple cards
1. **Just Names + Para App Numbers** — minimal name list (no IEP details)
2. **Full student info (one file)** — combined file with IEP data + names
3. **School-style roster** — the JSON your district might already have

### Smart Import (flagship)
1. **Upload a name list** (CSV, JSON, or simple text)
2. **Upload an IEP document** (PDF, DOCX, or paste text)
3. **App strips real names**, then sends to AI (Ollama locally, or Gemini cloud)
4. **AI extracts** goals, accommodations, eligibility, strategies, triggers per student
5. **Match report** shows which students matched cleanly + any conflicts to resolve
6. **Save the result** as a "bundle" file your computer keeps
7. **Local backup** — picks a folder; saves the bundle + private name list + a README explaining what each file is

After importing, paras see all students with proper IEP data + (if name list loaded) real names.

## Admin Dashboard

Owner / sped teacher only. Visible from the sidebar when your role is owner or sped_teacher.

- **Team members table** — name, role, active toggle
- **Change anyone's role** — Owner / Sped Teacher / Para / Sub
- **Multi-owner support** — multiple owners allowed; one-click "Transfer Ownership" to make someone else the primary.
- **"Allow subs"** master switch — turn off all sub access at once when a stranger is in the building or there's a security concern.
- **Invite codes** — generate, share, revoke 6-letter codes paras use to join.
- **Parent Notes section** — sped-teacher-only private notes about parents/family. Other paras don't see these.

## Real Names sidebar widget

Toggle "Show real names" — flips between displayed names and Para App Numbers everywhere in the app.

If a name list is loaded, you also see:
- **"Remember on this device"** — opt-in checkbox, opens a privacy modal explaining what local storage means
- **"Purge"** button (when remembered) — wipes the local copy
- **"Auto-wipes after N days of inactivity"** — safety net

If you upload a Master Roster on the IEP Import screen, the app extracts real names and offers to save them as a name list file you can re-load any time.

## AI Copilot

Right side of the Dashboard (collapsible). Two modes:

- **Local AI (Ollama)** — runs on your computer. Free. Requires Ollama installed + the qwen2.5:7b-instruct model. The status badge shows "online" or "offline."
- **Cloud AI (Gemini)** — paid, uses your own Google API key. Stored only in your browser, never on a server. Better for paras without local AI.

Ask the copilot anything: "What can I do for [student] when they refuse work?" / "Draft a handoff for the next para about Period 3" / "Summarize this week for [student]."

Names are stripped before any AI call. The AI sees fake names like "Red Student 1" or just the Para App Number — never the real name.

## Handoffs

Compose a handoff note for the next para via the Handoff Builder panel. Pick:
- **Audience** — Next Para, Teacher, End of Day, Urgent Follow-up
- **Urgency** — Normal, Important, Urgent
- **Student** (or "all students this period")
- **Summary** + **Action Needed**
- **Share with team** checkbox — when checked, other paras in the team see it in real time within seconds

Urgent handoffs show as red in the Vault. Other paras get them on their Dashboard's Handoff Inbox.

## Stealth Mode

Panic button — instantly hides the app behind a fake calculator/timer/grounding-exercise tool. Use when an observer walks in unexpectedly. Tap a hidden corner to come back.

## Backup & Privacy controls

- **Reset data on this computer** (sidebar bottom) — wipes everything stored locally. The cloud copy is unaffected.
- **Real names stay on this computer** — the footer reminder.
- **Auto-wipe** — names auto-delete after 14 days of app inactivity to prevent ghosted devices from holding student data.
