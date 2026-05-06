// ══════════════════════════════════════════════════════════════
// SCREENSHOTS — capture every major screen for the design brief
// Run: node e2e/screenshots.mjs
// Requires: dev server on http://localhost:3456 (override with BASE env)
// Output: docs/screenshots/*.png
// ══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3456';
const OUT = process.env.OUT || join(process.cwd(), 'docs', 'screenshots');
const STORAGE = process.env.STORAGE || null;
const VIEWPORT = { width: 1366, height: 768 };

const log = (msg) => console.log(`  ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const skip = (msg) => console.log(`  ⊘ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  ok(`${name}.png`);
}

async function safeClick(page, selector, opts = {}) {
  try {
    const el = await page.locator(selector).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.click({ timeout: 2000, ...opts });
      return true;
    }
  } catch {}
  return false;
}

async function safeClickByText(page, text) {
  try {
    const el = page.getByText(text, { exact: false }).first();
    if (await el.isVisible({ timeout: 1500 })) {
      await el.click({ timeout: 2000 });
      return true;
    }
  } catch {}
  return false;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  console.log(`\nScreenshots → ${OUT}`);
  console.log(`Base URL    → ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctxOpts = { viewport: VIEWPORT };
  if (STORAGE) {
    ctxOpts.storageState = STORAGE;
    log(`Using saved auth state: ${STORAGE}`);
  }
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);

  // ── 1. App load ────────────────────────────────────────────
  console.log('1. App load');
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    fail(`Could not reach ${BASE} — is the dev server running?`);
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(1500);
  await shot(page, '01-initial-load');

  // ── 2. Detect auth state ───────────────────────────────────
  console.log('\n2. Auth detection');
  const signInVisible = await page.getByText(/sign in|google/i).first()
    .isVisible({ timeout: 1500 }).catch(() => false);
  if (signInVisible) {
    skip('Sign-in screen detected — capturing it then exiting.');
    await shot(page, '02-signin-screen');
    skip('Past-auth screens require a signed-in session. See e2e/README.md for storageState fixtures.');
    await browser.close();
    process.exit(0);
  }

  // ── 3. Try Load Demo (bypass real students) ────────────────
  console.log('\n3. Load demo data');
  const loadedDemo = await safeClickByText(page, 'Load Demo')
    || await safeClickByText(page, 'Load demo')
    || await safeClickByText(page, '🎬');
  if (loadedDemo) {
    await page.waitForTimeout(1500);
    ok('Demo data loaded');
  } else {
    skip('Load Demo button not found — proceeding with current state.');
  }

  // ── 4. Dashboard ───────────────────────────────────────────
  console.log('\n4. Dashboard');
  await shot(page, '03-dashboard');

  // ── 5. Saved notes (Vault) ─────────────────────────────────
  console.log('\n5. Saved notes');
  if (await safeClickByText(page, 'Data Vault')
   || await safeClickByText(page, 'Saved notes')
   || await safeClickByText(page, '🗄️')) {
    await page.waitForTimeout(800);
    await shot(page, '04-saved-notes');
  } else { skip('Saved notes nav not found'); }

  // ── 6. IEP Import ──────────────────────────────────────────
  console.log('\n6. IEP Import');
  if (await safeClickByText(page, 'IEP Import')
   || await safeClickByText(page, 'Import')) {
    await page.waitForTimeout(800);
    await shot(page, '05-iep-import');
  } else { skip('Import nav not found'); }

  // ── 7. Analytics ───────────────────────────────────────────
  console.log('\n7. Analytics');
  if (await safeClickByText(page, 'Analytics')) {
    await page.waitForTimeout(800);
    await shot(page, '06-analytics');
  } else { skip('Analytics nav not found'); }

  // ── 8. Back to dashboard for panels/modals ─────────────────
  console.log('\n8. Back to dashboard');
  if (await safeClickByText(page, 'Dashboard')) {
    await page.waitForTimeout(800);
  }

  // ── 9. Open Situation Picker panel ─────────────────────────
  console.log('\n9. Situation Picker panel');
  if (await safeClickByText(page, 'Situations')
   || await safeClickByText(page, '🧠')) {
    await page.waitForTimeout(600);
    await shot(page, '07-situation-picker');
  } else { skip('Situations panel not found'); }

  // ── 10. Strategy Library ───────────────────────────────────
  console.log('\n10. Strategy Library panel');
  if (await safeClickByText(page, 'Strategies')) {
    await page.waitForTimeout(600);
    await shot(page, '08-strategy-library');
  } else { skip('Strategies panel not found'); }

  // ── 11. Goal Tracker ───────────────────────────────────────
  console.log('\n11. Goal Tracker panel');
  if (await safeClickByText(page, 'Goal Tracker')
   || await safeClickByText(page, 'Goals')) {
    await page.waitForTimeout(600);
    await shot(page, '09-goal-tracker');
  } else { skip('Goal Tracker panel not found'); }

  // ── 12. Handoff Builder ────────────────────────────────────
  console.log('\n12. Handoff Builder panel');
  if (await safeClickByText(page, 'Handoff')) {
    await page.waitForTimeout(600);
    await shot(page, '10-handoff-builder');
  } else { skip('Handoff panel not found'); }

  // ── 13. Open a Student Profile modal ───────────────────────
  console.log('\n13. Student Profile modal');
  if (await safeClickByText(page, 'Dashboard')) await page.waitForTimeout(500);
  // Student cards usually have data-attributes or numeric labels — try clicking the first card-shaped thing
  const studentCard = page.locator('[class*="student"], [class*="card"]').first();
  try {
    await studentCard.click({ timeout: 1500 });
    await page.waitForTimeout(800);
    await shot(page, '11-student-profile-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch { skip('Student card not found / not clickable'); }

  // ── 14. Stealth Mode ───────────────────────────────────────
  console.log('\n14. Stealth Mode');
  if (await safeClickByText(page, 'Stealth')
   || await safeClickByText(page, '🛡️')) {
    await page.waitForTimeout(800);
    await shot(page, '12-stealth-mode');
    // Try to exit
    await safeClickByText(page, 'Done');
    await page.waitForTimeout(400);
  } else { skip('Stealth Mode button not found'); }

  // ── 15. Simple Mode ────────────────────────────────────────
  console.log('\n15. Simple Mode');
  if (await safeClickByText(page, 'Simple Mode')
   || await safeClickByText(page, 'Simple')) {
    await page.waitForTimeout(800);
    await shot(page, '13-simple-mode');
  } else { skip('Simple Mode button not found'); }

  // ── 16. Onboarding (force re-show) ─────────────────────────
  console.log('\n16. Onboarding modal');
  await page.evaluate(() => { try { localStorage.removeItem('supapara_onboarded_v1'); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const onboardingVisible = await page.getByText(/welcome to supapara/i).first()
    .isVisible({ timeout: 1500 }).catch(() => false);
  if (onboardingVisible) {
    await shot(page, '14-onboarding-slide-1');
    await safeClickByText(page, 'Next');
    await page.waitForTimeout(400);
    await shot(page, '15-onboarding-slide-2-privacy');
  } else { skip('Onboarding did not appear'); }

  // ── 17. Narrow viewport — see how things wrap ──────────────
  console.log('\n17. Narrow viewport (1100×768)');
  await page.setViewportSize({ width: 1100, height: 768 });
  await page.waitForTimeout(500);
  await shot(page, '16-narrow-viewport');

  await browser.close();
  console.log('\n✓ Done. Screenshots saved to docs/screenshots/');
}

run().catch((e) => {
  fail(e.message);
  process.exit(1);
});
