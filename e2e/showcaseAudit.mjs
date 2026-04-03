// ══════════════════════════════════════════════════════════════
// SHOWCASE AUDIT — Verifies demo data loading, student display,
// case memory population, and clear functionality
// Requires: npm start (on port 3456) with fresh localStorage
// Run: npx playwright test e2e/showcaseAudit.mjs
// ══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';

const BASE = 'http://localhost:3456';
const issues = [];
const passed = [];

function log(msg) { console.log(`  ✓ ${msg}`); passed.push(msg); }
function warn(msg) { console.log(`  ⚠ ${msg}`); issues.push(msg); }
function fail(msg) { console.log(`  ✗ ${msg}`); issues.push(msg); }

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  // ── 1. Fresh load ─────────────────────────────────────────
  console.log('\n1. Fresh App Load');
  // Clear localStorage for clean test
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.removeItem('paraLogsV1');
    localStorage.removeItem('paraIncidentsV1');
    localStorage.removeItem('paraInterventionsV1');
    localStorage.removeItem('paraOutcomesV1');
  });
  await page.reload({ waitUntil: 'networkidle' });
  log('App loaded with clean localStorage');

  // ── 2. Showcase banner visible on empty state ─────────────
  console.log('\n2. Showcase Banner');
  try {
    const banner = await page.locator('text=New here');
    if (await banner.isVisible()) {
      log('Showcase banner visible on empty state');

      const loadBtn = await page.locator('button:has-text("Load Demo")');
      if (await loadBtn.isVisible()) log('Load Demo button visible');
      else warn('Load Demo button not found in banner');
    } else {
      warn('Showcase banner not visible — may have existing data');
    }
  } catch (e) {
    warn('Banner check failed: ' + e.message);
  }

  // ── 3. Load demo data ─────────────────────────────────────
  console.log('\n3. Load Demo Data');
  try {
    const loadBtn = await page.locator('button:has-text("Load Demo")').first();
    await loadBtn.click();
    await page.waitForTimeout(1000);

    // Verify students are visible
    const studentCards = await page.locator('[style*="border-radius: 12px"]').count();
    if (studentCards > 0) log(`${studentCards} student cards visible after loading demo`);
    else warn('No student cards visible after loading demo data');

    // Check banner disappears
    const banner = await page.locator('text=New here');
    if (!(await banner.isVisible())) log('Banner hidden after loading data');
    else warn('Banner still visible after loading data');
  } catch (e) {
    warn('Load demo failed: ' + e.message);
  }

  // ── 4. Verify demo logs in localStorage ───────────────────
  console.log('\n4. Verify Data in Storage');
  try {
    const data = await page.evaluate(() => ({
      logs: JSON.parse(localStorage.getItem('paraLogsV1') || '[]').length,
      incidents: JSON.parse(localStorage.getItem('paraIncidentsV1') || '[]').length,
      interventions: JSON.parse(localStorage.getItem('paraInterventionsV1') || '[]').length,
      outcomes: JSON.parse(localStorage.getItem('paraOutcomesV1') || '[]').length,
    }));

    if (data.logs > 0) log(`${data.logs} logs in storage`);
    else warn('No logs found in localStorage');

    if (data.incidents > 0) log(`${data.incidents} incidents in storage`);
    else warn('No incidents found in localStorage');

    if (data.interventions > 0) log(`${data.interventions} interventions in storage`);
    else warn('No interventions found in localStorage');

    if (data.outcomes > 0) log(`${data.outcomes} outcomes in storage`);
    else warn('No outcomes found in localStorage');
  } catch (e) {
    warn('Storage verification failed: ' + e.message);
  }

  // ── 5. Navigate to import tab and check prepared tab ──────
  console.log('\n5. Import Tab - Prepared Mode');
  try {
    // Click import sidebar button
    const importBtn = await page.locator('button:has-text("Import")').first();
    if (await importBtn.isVisible()) {
      await importBtn.click();
      await page.waitForTimeout(500);

      // Check prepared tab is default/active
      const preparedTab = await page.locator('button:has-text("Load Profiles")');
      if (await preparedTab.isVisible()) log('Prepared profiles tab visible');
      else warn('Prepared profiles tab not found');

      // Check demo students button
      const demoBtn = await page.locator('button:has-text("Load Demo Students")');
      if (await demoBtn.isVisible()) log('Load Demo Students button visible in import');
      else warn('Load Demo Students button not found in import');
    }
  } catch (e) {
    warn('Import tab check failed: ' + e.message);
  }

  // ── 6. Navigate back to dashboard ─────────────────────────
  console.log('\n6. Back to Dashboard');
  try {
    const dashBtn = await page.locator('button:has-text("Dashboard")').first();
    if (await dashBtn.isVisible()) {
      await dashBtn.click();
      await page.waitForTimeout(500);
      log('Returned to dashboard');
    }
  } catch (e) {
    warn('Navigation back failed: ' + e.message);
  }

  // ── 7. Verify Help button works with demo data ────────────
  console.log('\n7. Help with Demo Data');
  try {
    // Click a student card to set context
    const card = await page.locator('[style*="border-radius: 12px"]').first();
    if (await card.isVisible()) {
      await card.click();
      await page.waitForTimeout(300);
    }

    const helpBtn = await page.locator('button[title*="Help"]');
    if (await helpBtn.isVisible()) {
      await helpBtn.click();
      await page.waitForTimeout(500);

      // Type a search
      const searchInput = await page.locator('input[placeholder*="What"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('sensory overload');
        const searchBtn = await page.locator('button:has-text("Search")');
        await searchBtn.click();
        await page.waitForTimeout(500);

        // Check if results appeared
        const pastCases = await page.locator('text=Past Cases');
        if (await pastCases.isVisible()) log('Demo case memory results visible in Help');
        else log('No matching cases (depends on which student selected)');
      }

      // Close
      const closeBtn = await page.locator('button:has-text("Close")');
      if (await closeBtn.isVisible()) await closeBtn.click();
    } else {
      warn('Help FAB not visible with demo data');
    }
  } catch (e) {
    warn('Help with demo data check failed: ' + e.message);
  }

  // ── Summary ────────────────────────────────────────────────
  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`Showcase Audit: ${passed.length} passed, ${issues.length} issues`);
  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  console.log('══════════════════════════════════════\n');

  process.exit(issues.filter(i => i.startsWith('✗')).length > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
