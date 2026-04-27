# SupaPara — User Guide

This is what a para, sped teacher, or admin actually sees and does, screen by screen. Written so anyone can answer "how do I ___?" without reading code.

## First time using SupaPara

1. Go to `supapara.vercel.app`.
2. Click **"Sign in with Google"** and choose your school account.
3. You'll see an **onboarding tour** with 5 slides explaining: welcome, privacy, the Para App Number system, team mode, and how to start.
4. After onboarding, the app drops you on the **Dashboard**.

If your school is new to SupaPara, the **first owner** (usually the sped teacher) creates the team and gets a 6-letter invite code to share with paras.

If a sped teacher pre-assigned students to your school email before you joined, SupaPara claims those assignments after you sign in and join the team. You will see the students assigned to you, plus any students you personally add.

## The sidebar (left rail)

Always visible. Top-to-bottom layout (post-onboarding redesign, commit `717d65d`):

1. **🎒 Find my students** — primary onboarding entry point. Opens the file-load modal so paras can match real names to the cloud student records. Shown at the very top of the sidebar so a brand-new para can't miss it.
2. **Period / Date controls** — pick the current class period and date.
3. **Toolbox (grouped by audience)** — the panels open inline in the sidebar:
   - **For your work** — Situations, Quick Actions, Support Cards, ABC Builder, Goal Tracker, Handoff Notes, **🔖 Topics for Next Check-in** (training-gap agenda), Checklist, Strategies.
   - **For your student** — Visual Timer, Breathing Exercise, Grounding (5-4-3-2-1), Calculator, Multiplication Chart, CER Organizer. (These are `studentSafe: true` — they're meant to be turned around to face the kid.)
4. **Real Names** widget — load a saved name list file for THIS computer.
5. **Handoff Inbox** — team handoffs that are still active.
6. **Team switcher** — choose active team, copy invite code, open the create/join team modal, or sign out.
7. **Demo controls** — seed or remove sample data (visible per setting).
8. **⚙️ Settings** — display/account/danger-zone modal.
9. **Report a problem** — opens an email draft to Dre with page/browser context but no student names.

**Top-bar nav** (across the top of the screen) routes between the major screens: Dashboard, Simple Mode, Data Vault, IEP Import, Analytics, Admin (admins only), and the **? Help** drawer.

## Dashboard (the main screen / "Normal Mode")

Used by paras who want to log with detail. The layout from top to bottom:

1. **Hero header** — shows the period you're in ("Period 3 · Mr. Smith · 6 IEP students"), Ollama status badge, current date, column count selector, Copilot toggle.
2. **Today's Plan card** — what's the lesson today? Either:
   - **Write it** — type a one-line plan
   - **Get from link** — paste a Google Doc link, app pulls today's section
   - **Skip** — no plan today
3. **Class-wide action picker** ("Now tap students") — pick one of 8 action types (Observed, Participated, Behavior, Goal Check, Break, Accommodation, Escalation, Add Note), then rapid-fire tap student cards. Each tap = 1-click log. (Note: this 8-action list is the Dashboard's class-wide picker, hard-coded in `Dashboard.jsx`. It is NOT the same as `QUICK_ACTIONS` in `src/data.js`, which is the 12-item list that powers the per-student quick-action panel and toolbox.)
4. **Student cards** — one card per IEP student. Shows:
   - Color dot + name (or Para App Number if real names not loaded)
   - Health indicator (green/yellow/red — based on logs in last few days)
   - Today's count of logs
   - **6 quick-action buttons per card** — tapping any of these opens the Apple-style note sheet
5. **AI Copilot** (collapsible) — chat with the model about a student or situation.

In team mode, admins see the full team roster. Paras and subs see their assigned students and any student records they created themselves.

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

### Student profile modal

Clicking a student opens their profile. Tabs include:
- **Overview** — strengths, triggers, para notes, quick log, identity label editor
- **Goals** — IEP goals with one-click goal progress buttons
- **Accommodations** — listed supports
- **Strategies** — strategy list
- **Support Info** — only appears when imported data includes watch-fors, do-this-actions, health notes, or cross-period notes
- **Logs** — log history for that student
- **Parent Notes** — only visible to Owner / Sped Teacher roles

The quick log area can detect a significant behavior note and offer guided details: what happened before, what the para tried, whether it worked, and what happened after. Saving with details creates structured case-memory records in addition to the normal log.

### Help button / case memory

When a student is selected, the floating Help button opens a bottom panel. The para types what is happening, and SupaPara searches past case memory for similar situations for that student. If useful past interventions exist, the para can try them again. If nothing exists, the para can log what they are trying now and then record the outcome.

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

## Analytics

The Analytics screen summarizes logs visually.

It supports:
- date ranges: today, 7 days, 14 days, month, quarter, year, custom
- overview activity over time
- log type breakdowns
- per-student cards with expandable details
- custom student groups
- group-level analytics
- opening a student profile from analytics
- optional local-AI pattern summaries when Ollama is online

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

After importing, students sync to the team roster when cloud mode is active. Admins see the full roster; paras/subs see assigned students plus students they personally created. If a cloud sync fails, the app shows a visible **Cloud sync issue** message while keeping the local import intact.

## Admin Dashboard

Owner / sped teacher only. Visible from the sidebar when your role is owner or sped_teacher.

The Admin Dashboard has six tabs:

### Get paras started
Plain-English setup guide for the sped teacher. It explains that paras need two keys:
- real name, which stays local on the para's device
- 6-digit Para App Number, which is the cloud-safe identifier

It walks admins through loading students, assigning each para's caseload, sharing the para's file, and checking that the para can see names in the app. It also links straight to the Assign Students tab.

### 🔖 Coaching
The sped teacher's triage list. Auto-detected from team-shared logs — no para action required.

Each row is one fired training-gap topic and shows:
- Topic title in plain English (e.g. *"When breaks help vs. when they backfire"*, *"Catching them being good — when the redirect is the reward"*, *"What we want them to do instead"*)
- The para whose logs surfaced the pattern
- The student pseudonym
- How recent the most recent matching log is (e.g. "2 days ago")
- A one-line plain-English description of the rule that fired (e.g. "3+ times this week the student got a break, but they never asked for one with their break card")
- One button: **Share a tip with [Para's first name]**

Clicking **Share a tip** opens a modal with a friendly pre-filled coaching message — greeting, the topic, the explainer, "a few things to try," "want to talk through it at our next check-in?". The sped teacher edits, copies, pastes into their own email/Slack/text. No auto-send, no in-app notification to the para.

Empty state when nothing has fired: *"Nothing to discuss right now — your team's logs look good."* with a 👍.

What the Coaching tab deliberately does NOT include:
- No charts or graphs.
- No per-para "scoreboard" or counts of "how many topics each para has."
- No "flag for follow-up," "discuss in next meeting" record, or "mark as addressed" state — if the underlying logs change such that the rule no longer fires, the topic just disappears.
- No way to author records *about* the para from this view — the only action is to send the para something useful.

The same training-gap rules also surface on the para's own side via the toolbox panel **🔖 Topics for Next Check-in** (see the toolbox section above). Para and sped teacher get the same topic content; the sped teacher's view adds para-name attribution because that's what makes it actionable.

### Members
Shows every team member with:
- display name
- role
- joined date
- active/paused status

Admins can:
- change roles: Owner, Sped Teacher, Para, Sub
- pause/resume a member
- remove a member
- transfer ownership by promoting another user to Owner and demoting themselves to Sped Teacher

Owner promotions and owner demotions require confirmation because they change full admin access. Server RPCs also prevent removing or demoting the last active admin.

### Assign Students
Used to assign a para/sub to the students they support.

Workflow:
1. Pick an existing para/sub, or pre-register someone by school email before they have joined.
2. Check the students that belong to that para's caseload.
3. Save assignment. The cloud stores only team id, student id, para user id or pending email, and assigned_by.

Exports:
- **CSV** — fastest handoff file. The para can paste or upload it in Find My Students.
- **Full file** — assignment manifest that can include real names locally so the para's Real Names vault loads faster.

Real names in exports come from the admin's local vault/name list. They are downloaded to a file; they are not uploaded to Supabase.

### Access
One master switch: **Allow subs to use the app**.

When OFF:
- users with role `sub` see the locked screen
- backend RLS also blocks sub access, so it is not just a visual lock

### Settings
Shows:
- team name
- current invite code
- regenerate invite code button

Regenerating the invite code invalidates the old code. People who have not joined yet need the new one.

Admins can pause a member. Paused members lose backend access, not just UI access. If subs are disabled, sub access is blocked by backend policy too.

## Find My Students

This modal helps paras load the real names and student matches they personally need.

Ways to use it:
- paste names + Para App Numbers
- upload CSV / JSON / Markdown / text / PDF name-list files
- upload the assignment manifest exported by the Admin Dashboard
- download a CSV template

After a successful load:
- real names map locally to Para App Numbers
- `claimPendingAssignments()` runs so pre-registered assignments can attach to the signed-in para
- the modal offers "Remember on this device" so names auto-load next time, with the 14-day inactivity wipe still applying

If a student is not found, the likely cause is that the sped teacher has not loaded that student into the team yet.

## Settings

The Settings modal is intentionally flat, not a deep admin console.

Display:
- show/hide the Dashboard "Find my students" banner
- show real names when a name list is loaded
- remember names on this device / stop remembering names

Help:
- replay the onboarding tour

Account:
- sign out of SupaPara on this computer

Signing out does not wipe local notes or local real-name files. It only ends the Supabase session.

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
