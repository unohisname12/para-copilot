#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const runId = args.runId || timestampRunId();
const suite = args.suite || 'all';
const appUrl = args.appUrl || process.env.E2E_APP_URL || '';
const testTarget = args.test || 'e2e/team-realtime.spec.ts';
const localPort = args.port || process.env.WAR_ROOM_PORT || '3456';
const localUrl = `http://localhost:${localPort}`;
const remote = args.remote || 'origin';
const branch = args.branch || 'main';
const worktreeRoot = path.join(repoRoot, '.war-room-runs');
const sourceDir = path.join(worktreeRoot, runId, 'source');
const reportDir = path.join(repoRoot, 'reports', 'test-runs');
const reportPath = path.join(reportDir, `${runId}.md`);
const jsonReportPath = path.join(worktreeRoot, runId, 'playwright-report.json');
const outputDir = path.join(worktreeRoot, runId, 'playwright-artifacts');
const promptPath = path.join(worktreeRoot, runId, 'needs-dre.html');

const steps = [];

const exitCode = await main();
process.exit(exitCode);

async function main() {
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(path.dirname(sourceDir), { recursive: true });

  let testedRef = `${remote}/${branch}`;
  let commit = '';
  let status = 'Blocked';
  let exitCode = 0;
  let errorMessage = '';
  let ranAnyTest = false;
  let serverProcess = null;

  try {
    runStep('Check repository status', 'git status --short --branch', repoRoot, ['git', ['status', '--short', '--branch']]);

    if (!args.noFetch) {
      const fetchResult = runStep(
        `Fetch latest ${remote}/${branch}`,
        `git fetch ${remote} ${branch}`,
        repoRoot,
        ['git', ['fetch', remote, branch]],
        { allowFailure: true },
      );
      if (fetchResult.status !== 0) {
        testedRef = branch;
        steps.push({
          name: 'Remote fetch fallback',
          status: 'warning',
          detail: `Could not fetch ${remote}/${branch}; falling back to local ${branch}.`,
        });
      }
    }

    commit = commandOutput('Resolve commit', repoRoot, 'git', ['rev-parse', testedRef]).trim();
    runStep(
      'Create clean latest-main worktree',
      `git worktree add --detach ${relative(sourceDir)} ${commit}`,
      repoRoot,
      ['git', ['worktree', 'add', '--detach', sourceDir, commit]],
    );

    if (!args.skipInstall) {
      runStep('Install dependencies in clean copy', 'npm ci', sourceDir, ['npm', ['ci']]);
    }

    if (args.copyEnv && existsSync(path.join(repoRoot, '.env.local'))) {
      copyFileSync(path.join(repoRoot, '.env.local'), path.join(sourceDir, '.env.local'));
      steps.push({ name: 'Copy local app env into clean copy', status: 'passed', detail: '.env.local copied for this disposable run.' });
    }

    if (suite === 'all' || suite === 'local') {
      serverProcess = await startLocalServer(sourceDir, localPort);
      const localResults = runLocalBrowserAudits(sourceDir, localUrl);
      ranAnyTest = true;
      if (localResults.some((result) => result.status !== 0)) exitCode = 1;
    }

    if (suite === 'all' || suite === 'handoff') {
      const handoffReady = canRunHandoff(sourceDir);
      if (!handoffReady.ok) {
        const skipStatus = suite === 'handoff' ? 'blocked' : 'skipped';
        steps.push({ name: 'Run two-account handoff test', status: skipStatus, detail: handoffReady.reason });
        if (suite === 'handoff') {
          openLocalPrompt({
            title: 'War Room needs test setup',
            blocker: handoffReady.reason,
            actions: [
              'Open the staging or preview SupaPara app URL.',
              'Create or confirm two throwaway test accounts on the same team.',
              'Capture signed-in Playwright storage states for both accounts.',
              'Rerun the handoff command with E2E_APP_URL, E2E_A_STORAGE, and E2E_B_STORAGE set.',
            ],
            command: [
              'E2E_APP_URL=https://your-staging-or-preview-url \\',
              'E2E_A_STORAGE=/absolute/path/to/userA.storage.json \\',
              'E2E_B_STORAGE=/absolute/path/to/userB.storage.json \\',
              'npm run warroom:test:handoff',
            ].join('\n'),
          });
          exitCode = 1;
        }
      } else {
        const result = runHandoffTest(sourceDir, appUrl, testTarget);
        ranAnyTest = true;
        if (result.status !== 0) exitCode = 1;
      }
    }

    if (!ranAnyTest) {
      status = 'Blocked';
      exitCode = 1;
    } else {
      status = exitCode === 0 ? 'Pass' : 'Fail';
    }
  } catch (error) {
    exitCode = 1;
    errorMessage = error.message || String(error);
    steps.push({ name: 'Pipeline error', status: 'failed', detail: errorMessage });
    openLocalPrompt({
      title: 'War Room test runner hit a blocker',
      blocker: errorMessage,
      actions: [
        'Read the blocker and fix the missing setup.',
        'Rerun the same War Room command after the setup is corrected.',
      ],
      command: 'npm run warroom:test:latest',
    });
  } finally {
    if (serverProcess) stopLocalServer(serverProcess);
    const report = buildReport({
      runId,
      status,
      suite,
      testedRef,
      commit,
      appUrl,
      localUrl,
      testTarget,
      sourceDir,
      outputDir,
      jsonReportPath,
      steps,
      errorMessage,
    });
    writeFileSync(reportPath, report);
    console.log(`War Room test report: ${reportPath}`);
  }

  return exitCode;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg === '--skip-install') parsed.skipInstall = true;
    else if (arg === '--no-fetch') parsed.noFetch = true;
    else if (arg === '--copy-env') parsed.copyEnv = true;
    else if (arg === '--no-local-prompt') parsed.noLocalPrompt = true;
    else if (arg.startsWith('--app-url=')) parsed.appUrl = arg.slice('--app-url='.length);
    else if (arg.startsWith('--test=')) parsed.test = arg.slice('--test='.length);
    else if (arg.startsWith('--suite=')) parsed.suite = arg.slice('--suite='.length);
    else if (arg.startsWith('--port=')) parsed.port = arg.slice('--port='.length);
    else if (arg.startsWith('--run-id=')) parsed.runId = arg.slice('--run-id='.length);
    else if (arg.startsWith('--remote=')) parsed.remote = arg.slice('--remote='.length);
    else if (arg.startsWith('--branch=')) parsed.branch = arg.slice('--branch='.length);
  }
  return parsed;
}

function timestampRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `latest-main-${stamp}`;
}

async function startLocalServer(cwd, port) {
  const logPath = path.join(worktreeRoot, runId, 'local-server.log');
  const logStream = createWriteStream(logPath, { flags: 'a' });
  const child = spawn('npm', ['start'], {
    cwd,
    env: { ...process.env, BROWSER: 'none', PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  steps.push({ name: 'Start clean-copy local app server', status: 'started', detail: `PORT=${port}; log=${logPath}` });

  try {
    await waitForHttp(localUrl, 90_000);
    steps.push({ name: 'Wait for local app server', status: 'passed', detail: `${localUrl} responded.` });
  } catch (error) {
    stopLocalServer(child);
    throw error;
  }

  return child;
}

function stopLocalServer(child) {
  if (!child.killed) child.kill('SIGTERM');
}

function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
      });
    };
    check();
  });
}

function runLocalBrowserAudits(cwd, url) {
  const env = { ...process.env, E2E_URL: url, BASE: url, OUT: path.join(worktreeRoot, runId, 'screenshots') };
  const audits = [
    ['Run local UI audit', 'e2e/uiAudit.mjs', 'node e2e/uiAudit.mjs', ['node', ['e2e/uiAudit.mjs']]],
    ['Run local help button audit', 'e2e/helpButtonAudit.mjs', 'node e2e/helpButtonAudit.mjs', ['node', ['e2e/helpButtonAudit.mjs']]],
    ['Run local showcase audit', 'e2e/showcaseAudit.mjs', 'node e2e/showcaseAudit.mjs', ['node', ['e2e/showcaseAudit.mjs']]],
    ['Run local app audit', 'e2e/audit.js', `E2E_URL=${url} node e2e/audit.js`, ['node', ['e2e/audit.js']]],
    ['Capture local screenshots', 'e2e/screenshots.mjs', `BASE=${url} node e2e/screenshots.mjs`, ['node', ['e2e/screenshots.mjs']]],
  ];
  return audits.map(([name, scriptPath, display, command]) => {
    if (!existsSync(path.join(cwd, scriptPath))) {
      steps.push({ name, status: 'skipped', detail: `${scriptPath} is not present in the tested latest-main copy.` });
      return { status: 0 };
    }
    return runStep(name, display, cwd, command, { allowFailure: true, env });
  });
}

function canRunHandoff(cwd) {
  if (!appUrl) {
    return { ok: false, reason: 'E2E_APP_URL is not set. Set it to staging/preview/local cloud app URL to run the two-account handoff test.' };
  }
  const storageA = process.env.E2E_A_STORAGE || 'e2e/fixtures/userA.storage.json';
  const storageB = process.env.E2E_B_STORAGE || 'e2e/fixtures/userB.storage.json';
  const resolvedA = path.isAbsolute(storageA) ? storageA : path.join(cwd, storageA);
  const resolvedB = path.isAbsolute(storageB) ? storageB : path.join(cwd, storageB);
  if (!existsSync(resolvedA) || !existsSync(resolvedB)) {
    return { ok: false, reason: `Two signed-in test storage states are required. Missing ${resolvedA} or ${resolvedB}.` };
  }
  return { ok: true };
}

function runHandoffTest(cwd, targetUrl, targetTest) {
  const env = {
    ...process.env,
    E2E_APP_URL: targetUrl,
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
  };
  const playwrightArgs = [
    'playwright',
    'test',
    targetTest,
    '--reporter=line,json',
    `--output=${outputDir}`,
  ];

  return runStep(
    'Run two-account handoff test',
    `npx ${playwrightArgs.join(' ')}`,
    cwd,
    ['npx', playwrightArgs],
    { allowFailure: true, env },
  );
}

function openLocalPrompt({ title, blocker, actions, command }) {
  if (args.noLocalPrompt) {
    steps.push({ name: 'Open local blocker prompt', status: 'skipped', detail: '--no-local-prompt was set.' });
    return;
  }

  mkdirSync(path.dirname(promptPath), { recursive: true });
  writeFileSync(promptPath, buildPromptHtml({ title, blocker, actions, command }));

  const openers = [
    ['xdg-open', [pathToFileURL(promptPath).href]],
    ['gio', ['open', promptPath]],
  ];

  for (const [cmd, cmdArgs] of openers) {
    const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status === 0) {
      steps.push({ name: 'Open local blocker prompt', status: 'passed', detail: promptPath });
      return;
    }
  }

  steps.push({
    name: 'Open local blocker prompt',
    status: 'failed',
    detail: `Could not open a desktop/browser window automatically. Prompt file: ${promptPath}`,
  });
}

function buildPromptHtml({ title, blocker, actions, command }) {
  const actionItems = actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #111827; color: #f9fafb; }
    main { max-width: 760px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 28px; margin: 0 0 18px; }
    section { border: 1px solid #374151; border-radius: 8px; padding: 18px; margin: 18px 0; background: #1f2937; }
    h2 { font-size: 16px; margin: 0 0 10px; color: #93c5fd; }
    p, li { line-height: 1.5; }
    code, pre { background: #030712; color: #d1fae5; border-radius: 6px; }
    pre { padding: 14px; overflow: auto; white-space: pre-wrap; }
    .blocker { color: #fecaca; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <section>
      <h2>Blocker</h2>
      <p class="blocker">${escapeHtml(blocker)}</p>
    </section>
    <section>
      <h2>What Dre Needs To Do</h2>
      <ol>${actionItems}</ol>
    </section>
    <section>
      <h2>Rerun Command</h2>
      <pre>${escapeHtml(command)}</pre>
    </section>
    <section>
      <h2>War Room Rule</h2>
      <p>Use local visible prompts first. Email only if local prompting fails or Dre explicitly asks for email.</p>
    </section>
  </main>
</body>
</html>
`;
}

function runStep(name, displayCommand, cwd, command, options = {}) {
  const [cmd, cmdArgs] = command;
  const startedAt = new Date();
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const detail = `${trimOutput(result.stdout)}${result.stderr ? `\n${trimOutput(result.stderr)}` : ''}`.trim();
  const step = {
    name,
    command: displayCommand,
    cwd,
    status: result.status === 0 ? 'passed' : 'failed',
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    detail,
  };
  steps.push(step);

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${name} failed: ${detail || `${cmd} exited ${result.status}`}`);
  }

  return result;
}

function commandOutput(name, cwd, cmd, cmdArgs) {
  const result = runStep(name, `${cmd} ${cmdArgs.join(' ')}`, cwd, [cmd, cmdArgs]);
  return result.stdout || '';
}

function buildReport(data) {
  const jsonSummary = readPlaywrightSummary(data.jsonReportPath);
  const lines = [
    `# War Room Test Report`,
    '',
    `Result: ${data.status}`,
    `Run ID: ${data.runId}`,
    `Suite: ${data.suite}`,
    `Tested ref: ${data.testedRef}`,
    `Commit: ${data.commit || 'unknown'}`,
    `Pulled at: ${new Date().toISOString()}`,
    `App URL: ${data.appUrl || 'not set'}`,
    `Local clean-copy URL: ${data.localUrl}`,
    `Test target: ${data.testTarget}`,
    `Clean copy: ${data.sourceDir}`,
    `Artifacts: ${data.outputDir}`,
    '',
    `## What This Checks`,
    '',
    `- Creates a fresh testing copy from the latest main ref without changing the current working branch.`,
    `- Runs local browser audits against that clean copy.`,
    `- Runs the two-account handoff Playwright flow when test account storage states and E2E_APP_URL are available.`,
    `- Records the exact commit and command steps so findings can be used on a fix branch before merging to main.`,
    '',
    `## Step Log`,
    '',
  ];

  for (const step of data.steps) {
    lines.push(`- ${step.status.toUpperCase()}: ${step.name}`);
    if (step.command) lines.push(`  Command: \`${step.command}\``);
    if (step.detail) lines.push(`  Detail: ${singleLine(step.detail)}`);
  }

  if (jsonSummary) {
    lines.push('', '## Playwright Summary', '', jsonSummary);
  }

  if (data.errorMessage) {
    lines.push('', '## Blocker', '', data.errorMessage);
  }

  lines.push(
    '',
    '## Next Action',
    '',
    data.status === 'Pass'
      ? 'The handoff flow passed on the tested build. Use this report as evidence for the current main commit.'
      : data.status === 'Blocked'
        ? 'Configure the missing test inputs, then rerun this same War Room command against latest main.'
      : 'Open a fix branch from this commit, repair the failing flow, then rerun this same War Room command before merging.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function readPlaywrightSummary(filePath) {
  if (!existsSync(filePath)) return '';
  try {
    const report = JSON.parse(readFileSync(filePath, 'utf8'));
    const stats = report.stats || {};
    const suites = report.suites?.length ?? 0;
    return [
      `Suites: ${suites}`,
      `Expected: ${stats.expected ?? 'unknown'}`,
      `Unexpected: ${stats.unexpected ?? 'unknown'}`,
      `Flaky: ${stats.flaky ?? 'unknown'}`,
      `Skipped: ${stats.skipped ?? 'unknown'}`,
      `Duration ms: ${stats.duration ?? 'unknown'}`,
    ].join('\n');
  } catch (error) {
    return `Could not parse Playwright JSON report: ${error.message || error}`;
  }
}

function trimOutput(output) {
  const text = String(output || '').trim();
  if (text.length <= 1200) return text;
  return `${text.slice(0, 1200)}...`;
}

function singleLine(text) {
  return String(text).replace(/\s+/g, ' ').slice(0, 700);
}

function relative(target) {
  return path.relative(repoRoot, target) || '.';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
