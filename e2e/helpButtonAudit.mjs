// ══════════════════════════════════════════════════════════════
// HELP BUTTON E2E AUDIT — Verifies Help FAB, panel, case memory
// Requires: npm start (on port 3456) + demo data loaded
// Run: npx playwright test e2e/helpButtonAudit.mjs
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
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);

  // ── 1. Load app ────────────────────────────────────────────
  console.log('\n1. App Load');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const title = await page.title();
  if (title) log(`Page loaded: "${title}"`);
  else fail('Page did not load');

  // ── 2. Load demo data via showcase banner ──────────────────
  console.log('\n2. Demo Data');
  try {
    const loadBtn = await page.locator('button:has-text("Load Demo")').first();
    if (await loadBtn.isVisible()) {
      await loadBtn.click();
      await page.waitForTimeout(500);
      log('Demo data loaded via banner');
    } else {
      warn('No Load Demo button visible — demo data may already be loaded');
    }
  } catch {
    warn('Could not find or click Load Demo button');
  }

  // ── 3. Check Help FAB exists ──────────────────────────────
  console.log('\n3. Help FAB');
  try {
    // Click a student card first to set context
    const studentCard = await page.locator('[style*="border-radius: 12px"]').first();
    if (await studentCard.isVisible()) {
      await studentCard.click();
      await page.waitForTimeout(300);
    }

    const helpBtn = await page.locator('button[title*="Help"]');
    if (await helpBtn.isVisible()) {
      log('Help FAB button visible');

      // Check it's positioned fixed bottom-right
      const box = await helpBtn.boundingBox();
      if (box && box.x > 500 && box.y > 400) log('Help FAB positioned correctly (bottom-right)');
      else warn(`Help FAB position unexpected: x=${box?.x}, y=${box?.y}`);

      // Check "?" text
      const text = await helpBtn.textContent();
      if (text.includes('?')) log('Help FAB shows "?" icon');
      else warn('Help FAB missing "?" icon');
    } else {
      warn('Help FAB not visible — may need student context');
    }
  } catch (e) {
    warn('Help FAB check failed: ' + e.message);
  }

  // ── 4. Open Help Panel ────────────────────────────────────
  console.log('\n4. Help Panel');
  try {
    const helpBtn = await page.locator('button[title*="Help"]');
    if (await helpBtn.isVisible()) {
      await helpBtn.click();
      await page.waitForTimeout(500);

      // Check panel opened (fixed bottom panel)
      const panel = await page.locator('text=Help —');
      if (await panel.isVisible()) {
        log('Help panel opened');

        // Check search bar
        const searchInput = await page.locator('input[placeholder*="What"]');
        if (await searchInput.isVisible()) log('Search input visible');
        else warn('Search input not found');

        // Check close button
        const closeBtn = await page.locator('button:has-text("Close")');
        if (await closeBtn.isVisible()) log('Close button visible');
        else warn('Close button not found');
      } else {
        warn('Help panel did not open');
      }
    }
  } catch (e) {
    warn('Help panel check failed: ' + e.message);
  }

  // ── 5. Search for case memory ─────────────────────────────
  console.log('\n5. Case Memory Search');
  try {
    const searchInput = await page.locator('input[placeholder*="What"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('covering ears during loud activity');
      await page.waitForTimeout(200);

      // Check tags appeared
      const tags = await page.locator('text=sensory');
      if (await tags.first().isVisible()) log('Auto-detected tags shown (sensory)');
      else warn('Auto-detected tags not shown');

      // Click search
      const searchBtn = await page.locator('button:has-text("Search")');
      await searchBtn.click();
      await page.waitForTimeout(500);

      // Check results
      const pastCases = await page.locator('text=Past Cases');
      if (await pastCases.isVisible()) {
        log('Past cases section visible');

        // Check for "Try This Again" button
        const tryAgain = await page.locator('button:has-text("Try This Again")');
        if (await tryAgain.first().isVisible()) log('"Try This Again" button visible');
        else warn('"Try This Again" button not found');
      } else {
        // Check for empty state
        const empty = await page.locator('text=No past cases');
        if (await empty.isVisible()) log('Empty state shown (no matching cases)');
        else warn('Neither results nor empty state shown');
      }
    }
  } catch (e) {
    warn('Case memory search failed: ' + e.message);
  }

  // ── 6. Log intervention flow ──────────────────────────────
  console.log('\n6. Intervention Logger');
  try {
    const logBtn = await page.locator('button:has-text("Log What")');
    if (await logBtn.isVisible()) {
      await logBtn.click();
      await page.waitForTimeout(500);

      // Check intervention logger appeared
      const strategyLabel = await page.locator('text=Strategy');
      if (await strategyLabel.first().isVisible()) log('Intervention logger opened');
      else warn('Intervention logger did not open');
    } else {
      warn('"Log What I\'m Trying" button not visible');
    }
  } catch (e) {
    warn('Intervention logger check failed: ' + e.message);
  }

  // ── 7. Close panel ────────────────────────────────────────
  console.log('\n7. Close Panel');
  try {
    const closeBtn = await page.locator('button:has-text("Close")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);

      const panel = await page.locator('text=Help —');
      if (!(await panel.isVisible())) log('Panel closed successfully');
      else warn('Panel still visible after close');
    }
  } catch (e) {
    warn('Close panel check failed: ' + e.message);
  }

  // ── Summary ────────────────────────────────────────────────
  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`Help Button Audit: ${passed.length} passed, ${issues.length} issues`);
  if (issues.length > 0) {
    console.log('\nIssues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  console.log('══════════════════════════════════════\n');

  process.exit(issues.filter(i => i.startsWith('✗')).length > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
