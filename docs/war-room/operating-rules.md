# War Room Operating Rules

These rules apply to War Room testing and agent tasks in this repo.

## Mid-Conversation Corrections

If Dre corrects the War Room mid-task, treat the newest instruction as active
immediately. Do not keep following the older plan.

Examples:

- "Don't email me, open a window."
- "Use latest main, not that old copy."
- "Stop testing production."
- "Go back and fix yourself."

Required behavior:

1. Pause the current action if it conflicts with the new instruction.
2. Update the working plan.
3. Repair the workflow, script, prompt, or report that caused the problem.
4. Continue from the corrected behavior.
5. Record the correction in the final report if it affected the test.

## Local Prompt First

When War Room needs Dre to do something, use a local visible prompt first.
Email is only a fallback.

Use a local prompt for:

- Claude handoff or Claude-specific work
- test-account login
- credential or storage-state capture
- approval to run a risky action
- missing staging URL
- missing Supabase or auth setup
- any manual browser step

Preferred order:

1. Open a browser or desktop window on this computer.
2. Show the exact blocker and exact command/action Dre needs.
3. Continue after Dre completes the manual step.
4. Email only if the local prompt fails or Dre explicitly asks for email.

## Latest-Main Testing

War Room must not test old builds by default.

Default test flow:

1. Fetch latest `origin/main`.
2. Create a disposable worktree from that exact commit.
3. Run tests against the disposable copy.
4. Save a report with branch, commit SHA, run ID, and artifacts.
5. Use findings to create or guide a fix branch.
6. Do not mutate `main` directly during testing.

## Reports

Every report must say:

- result: pass, fail, or blocked
- exact commit tested
- whether latest main was fetched
- accounts or storage states used
- local prompt path if War Room needed Dre
- what failed
- likely cause
- recommended next action
