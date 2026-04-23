// Playwright audit — drives the live dev server, captures console errors,
// clicks key surfaces, takes screenshots. Run with:
//   node e2e/audit.js
// Requires:
//   - dev server on http://localhost:3000
//   - chromium installed (`npx playwright install chromium` if missing)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.E2E_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, 'audit-output');
fs.mkdirSync(OUT_DIR, { recursive: true });

const findings = [];
const consoleLog = [];

function logFinding(level, area, detail, extra = {}) {
  findings.push({ level, area, detail, ...extra });
  const tag = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${tag} [${area}] ${detail}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 }, // Chromebook-ish
  });
  const page = await ctx.newPage();

  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), url: page.url() };
    consoleLog.push(entry);
    if (msg.type() === 'error') logFinding('error', 'console', msg.text());
    if (msg.type() === 'warning') logFinding('warn', 'console', msg.text());
  });
  page.on('pageerror', err => {
    logFinding('error', 'pageerror', err.message, { stack: err.stack });
  });

  console.log(`\n[audit] Navigating to ${URL} ...`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });

  // Seed localStorage with logs (including orphans) so the Vault actually has
  // rows to test against. This is the specific scenario the user reported:
  // clicking a student name in Vault crashes when the student isn't in the
  // current roster. Orphan logs reference studentIds not in DEMO_STUDENTS.
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const demoLogs = [
      { id: 'log_1', studentId: 'stu_001', type: 'General Observation', note: 'On task.', date: today, timestamp: now, periodId: 'p1', tags: ['good'], source: 'audit' },
      { id: 'log_2', studentId: 'stu_004', type: 'Behavior Incident', note: 'Needed a break.', date: today, timestamp: now, periodId: 'p3', tags: ['break'], flagged: true, source: 'audit' },
      // Orphan: this studentId exists nowhere.
      { id: 'log_3', studentId: 'stu_deleted_999', type: 'Handoff Note', note: 'Old log for a removed student.', date: today, timestamp: now, periodId: 'p1', tags: ['handoff'], source: 'audit' },
      { id: 'log_4', studentId: 'stu_mr_gone', type: 'Goal Progress', note: 'Another orphan.', date: today, timestamp: now, periodId: 'p2', tags: [], source: 'audit' },
    ];
    localStorage.setItem('paraLogsV1', JSON.stringify(demoLogs));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Dismiss onboarding if it opened
  const skip = page.locator('button:has-text("Skip"), button:has-text("Get started")').first();
  if (await skip.isVisible().catch(() => false)) {
    console.log('[audit] Dismissing onboarding…');
    await skip.click();
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: path.join(OUT_DIR, '01-dashboard.png'), fullPage: true });

  // ── Sidebar collapse toggle ──
  console.log('\n[audit] Toggling sidebar …');
  try {
    const toggle = page.locator('.sidebar-toggle').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT_DIR, '02-sidebar-collapsed.png') });
      await toggle.click();
      await page.waitForTimeout(200);
    } else {
      logFinding('warn', 'sidebar', 'collapse toggle not visible');
    }
  } catch (e) {
    logFinding('error', 'sidebar', 'collapse interaction threw: ' + e.message);
  }

  // ── Navigate each main view ──
  const navTargets = [
    { label: '📊 Dashboard', shot: '03-dashboard.png' },
    { label: '🗄️ Data Vault', shot: '04-vault.png' },
    { label: '📥 IEP Import', shot: '05-iep-import.png' },
    { label: '📈 Analytics', shot: '06-analytics.png' },
  ];
  for (const t of navTargets) {
    console.log(`\n[audit] ▶ ${t.label}`);
    try {
      const btn = page.locator(`button:has-text("${t.label}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT_DIR, t.shot), fullPage: true });
      } else {
        logFinding('warn', 'nav', `button "${t.label}" not visible`);
      }
    } catch (e) {
      logFinding('error', 'nav', `clicking "${t.label}" failed: ${e.message}`);
    }
  }

  // ── Vault: click first student cell (user-reported bug) ──
  console.log('\n[audit] Vault: clicking student name cells …');
  try {
    await page.locator('button:has-text("🗄️ Data Vault")').first().click();
    await page.waitForTimeout(400);
    const nameCells = page.locator('.data-table tbody td:nth-child(3)');
    const count = await nameCells.count();
    console.log(`[audit] Found ${count} student-name cells in vault`);
    for (let i = 0; i < Math.min(count, 5); i++) {
      try {
        await nameCells.nth(i).click({ timeout: 2000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT_DIR, `07-vault-click-${i + 1}.png`) });
        // Close modal if opened
        const close = page.locator('.close-btn, button:has-text("×")').first();
        if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
          await close.click();
          await page.waitForTimeout(200);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      } catch (e) {
        logFinding('error', 'vault-click', `cell #${i + 1} threw: ${e.message}`);
      }
    }
  } catch (e) {
    logFinding('error', 'vault-click', 'setup threw: ' + e.message);
  }

  // ── Dashboard: click first student card ──
  console.log('\n[audit] Dashboard: clicking first student card …');
  try {
    await page.locator('button:has-text("📊 Dashboard")').first().click();
    await page.waitForTimeout(400);
    // Student cards aren't buttons — they're divs. Click the name region.
    const firstName = page.locator('.main-content >> text=/Student \\d+|Ember|Fern|Fox|Wave/').first();
    if (await firstName.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstName.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, '08-student-profile.png') });
      await page.keyboard.press('Escape');
    } else {
      logFinding('info', 'dashboard', 'no student cards visible (empty state)');
    }
  } catch (e) {
    logFinding('error', 'dashboard-card', 'click threw: ' + e.message);
  }

  // ── IEP Import: click each primary card ──
  console.log('\n[audit] IEP Import: cycling mode cards …');
  try {
    await page.locator('button:has-text("📥 IEP Import")').first().click();
    await page.waitForTimeout(400);
    for (const title of ['Names + Para #s', 'App Bundle JSON', 'Master Roster']) {
      const card = page.locator(`button:has-text("${title}")`).first();
      if (await card.isVisible()) {
        await card.click();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(OUT_DIR, `09-import-${title.replace(/[^a-z0-9]+/gi, '_')}.png`),
          fullPage: true,
        });
      } else {
        logFinding('warn', 'iep-import', `card "${title}" not visible`);
      }
    }
  } catch (e) {
    logFinding('error', 'iep-import', 'cards threw: ' + e.message);
  }

  // ── Simple Mode toggle ──
  console.log('\n[audit] Toggling Simple Mode …');
  try {
    const simple = page.locator('button:has-text("Simple Mode")').first();
    if (await simple.isVisible()) {
      await simple.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT_DIR, '10-simple-mode.png'), fullPage: true });
      await simple.click();
      await page.waitForTimeout(200);
    } else {
      logFinding('warn', 'simple-mode', 'toggle not visible');
    }
  } catch (e) {
    logFinding('error', 'simple-mode', 'toggle threw: ' + e.message);
  }

  // ── Re-open onboarding ──
  console.log('\n[audit] Re-opening onboarding from sidebar …');
  try {
    const howBtn = page.locator('button:has-text("How it works")').first();
    if (await howBtn.isVisible()) {
      await howBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, '11-onboarding.png'), fullPage: true });
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    logFinding('error', 'onboarding', 'reopen threw: ' + e.message);
  }

  // Save outputs
  fs.writeFileSync(path.join(OUT_DIR, 'findings.json'), JSON.stringify(findings, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'console.json'), JSON.stringify(consoleLog, null, 2));

  await browser.close();

  const errors = findings.filter(f => f.level === 'error').length;
  const warns  = findings.filter(f => f.level === 'warn').length;
  console.log(`\n==========================================`);
  console.log(`AUDIT COMPLETE: ${errors} errors, ${warns} warnings`);
  console.log(`Output: ${OUT_DIR}`);
  console.log(`==========================================\n`);

  if (errors > 0) {
    console.log('\nERRORS:');
    findings.filter(f => f.level === 'error').forEach(f => {
      console.log(`  [${f.area}] ${f.detail}`);
      if (f.stack) console.log(`    ${f.stack.split('\n').slice(0, 3).join('\n    ')}`);
    });
  }
  if (warns > 0) {
    console.log('\nWARNINGS:');
    findings.filter(f => f.level === 'warn').forEach(f => {
      console.log(`  [${f.area}] ${f.detail}`);
    });
  }
}

main().catch(e => { console.error('[audit] fatal:', e); process.exit(1); });
