# War Room Testing Pipeline

The War Room test runner is designed to test a fresh copy of the latest app
before findings are used to change the main branch.

For standing behavior rules, including mid-conversation corrections and
"local visible prompt first, email only as fallback", see
`docs/war-room/operating-rules.md`.

## Core Rule

Every run starts from the latest `origin/main` commit in a disposable Git
worktree under `.war-room-runs/`. The current working branch is not checked out,
reset, or mutated.

Reports are written back to:

```text
reports/test-runs/<run-id>.md
```

Each report includes the tested ref, exact commit SHA, clean-copy path, test
steps, result, and artifact locations.

When the runner is blocked and needs Dre, it writes and opens:

```text
.war-room-runs/<run-id>/needs-dre.html
```

Use `--no-local-prompt` only when a visible desktop/browser prompt is not wanted.

## Commands

Run the full latest-main browser pipeline:

```bash
npm run warroom:test:latest
```

Run only the two-account handoff test:

```bash
E2E_APP_URL=https://your-staging-or-preview-url \
E2E_A_STORAGE=/absolute/path/to/userA.storage.json \
E2E_B_STORAGE=/absolute/path/to/userB.storage.json \
npm run warroom:test:handoff
```

Run local browser audits but skip dependency install when the clean worktree
already has dependencies:

```bash
npm run warroom:test:latest -- --suite=local --skip-install
```

Copy local `.env.local` into the disposable worktree for cloud-enabled local
testing:

```bash
npm run warroom:test:latest -- --copy-env
```

## What It Runs

The default `warroom:test:latest` suite:

- fetches latest `origin/main`
- creates a detached clean worktree from that commit
- installs dependencies with `npm ci`
- starts the clean-copy app on `http://localhost:3456`
- runs the existing local browser audit scripts
- runs the two-account handoff Playwright test when `E2E_APP_URL` and both
  storage-state files are available
- writes a Markdown report

## Handoff Requirements

The handoff test needs two already signed-in browser storage states. The current
spec defaults to:

```text
e2e/fixtures/userA.storage.json
e2e/fixtures/userB.storage.json
```

For safer local use, keep these outside Git and pass absolute paths through
`E2E_A_STORAGE` and `E2E_B_STORAGE`.

## Intended Workflow

1. Run War Room tests against latest main.
2. Read the generated report.
3. Create a fix branch from the tested commit or latest main.
4. Make app changes.
5. Rerun the same War Room command.
6. Merge only after the report is clean enough for the change.
