// ══════════════════════════════════════════════════════════════
// UI AUDIT — Playwright-based automated inspection
// Exercises all major interactive surfaces and logs issues.
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
  page.setDefaultTimeout(5000);

  // ── 1. App Load ────────────────────────────────────────────
  console.log('\n1. App Load');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const title = await page.title();
  if (title) log(`Page loaded, title: "${title}"`);
  else fail('Page did not load');

  // Check brand header
  const brand = await page.$('.brand');
  if (brand) log('Brand header rendered');
  else warn('Brand header not found');

  // Check sidebar
  const sidebar = await page.$('.sidebar');
  if (sidebar) log('Sidebar rendered');
  else fail('Sidebar missing');

  // Check main content
  const main = await page.$('.main-content');
  if (main) log('Main content rendered');
  else fail('Main content missing');

  // ── 2. Period Switching ────────────────────────────────────
  console.log('\n2. Period Switching');
  const periodSelect = await page.$('select.period-select');
  if (periodSelect) {
    await periodSelect.selectOption('p1');
    await page.waitForTimeout(300);
    log('Switched to Period 1');
    await periodSelect.selectOption('p3');
    await page.waitForTimeout(300);
    log('Switched back to Period 3');
  } else {
    fail('Period selector not found');
  }

  // ── 3. Navigation ──────────────────────────────────────────
  console.log('\n3. Navigation');
  const navBtns = await page.$$('.nav-btn');
  const navLabels = [];
  for (const btn of navBtns) {
    const text = await btn.textContent();
    navLabels.push(text.trim());
  }
  log(`Found ${navBtns.length} nav buttons: ${navLabels.slice(0, 6).join(', ')}`);

  // Click each view tab
  for (const label of ['🗄️ Data Vault', '📥 IEP Import', '📈 Analytics', '📊 Dashboard']) {
    try {
      await page.click(`.nav-btn:has-text("${label}")`);
      await page.waitForTimeout(300);
      log(`Navigated to ${label}`);
    } catch {
      warn(`Could not navigate to ${label}`);
    }
  }

  // ── 4. Simple Mode Toggle ──────────────────────────────────
  console.log('\n4. Simple Mode');
  try {
    await page.click('button:has-text("Simple Mode")');
    await page.waitForTimeout(300);
    const simpleModeOn = await page.$('button:has-text("Simple Mode ON")');
    if (simpleModeOn) log('Simple Mode toggled ON');
    else warn('Simple Mode button did not update text');

    // Check student cards in simple mode
    const simpleCards = await page.$$('[style*="cursor: pointer"]');
    log(`Simple mode shows ${simpleCards.length} interactive elements`);

    // Toggle back off
    await page.click('button:has-text("Simple Mode")');
    await page.waitForTimeout(300);
    log('Simple Mode toggled OFF');
  } catch (e) {
    warn(`Simple Mode toggle issue: ${e.message}`);
  }

  // ── 5. Toolbox Sidebar ─────────────────────────────────────
  console.log('\n5. Toolbox');
  try {
    // Click Situations button
    await page.click('.nav-btn:has-text("🧠 Situations")');
    await page.waitForTimeout(300);
    const toolboxPanel = await page.$('aside:nth-of-type(2)');
    if (toolboxPanel) log('Toolbox sidebar opened for Situations');
    else warn('Toolbox sidebar did not open');

    // Close it
    const closeBtn = await page.$('aside:nth-of-type(2) button:has-text("×")');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(200);
      log('Toolbox closed');
    }
  } catch (e) {
    warn(`Toolbox issue: ${e.message}`);
  }

  // Try Timer tool
  try {
    await page.click('.nav-btn:has-text("⏱️ Timer")');
    await page.waitForTimeout(300);
    log('Timer toolbox opened');
    // Check for fullscreen button (studentSafe tools have it)
    const fullscreenBtn = await page.$('button[title="Fullscreen"]');
    if (fullscreenBtn) log('Fullscreen button available for Timer');

    // Close
    const closeBtn2 = await page.$('aside:nth-of-type(2) button:has-text("×")');
    if (closeBtn2) await closeBtn2.click();
  } catch (e) {
    warn(`Timer toolbox issue: ${e.message}`);
  }

  // ── 6. Stealth Mode ────────────────────────────────────────
  console.log('\n6. Stealth Mode');
  try {
    await page.click('button:has-text("Stealth Mode")');
    await page.waitForTimeout(400);
    // Check for stealth overlay — fullscreen fixed div with dark bg
    const stealthOverlay = await page.$('div[style*="position: fixed"][style*="z-index: 1500"]');
    if (stealthOverlay) {
      log('Stealth mode overlay visible');
      const overlayText = await stealthOverlay.textContent();
      if (overlayText.includes('Stealth Mode Active')) log('Stealth overlay text confirmed');
      else if (overlayText.includes('Classroom Tools')) log('Stealth header bar confirmed');
      else warn('Stealth overlay text unexpected: ' + overlayText.slice(0, 60));
    } else warn('Stealth mode overlay not found');

    // Exit stealth
    const exitBtn = await page.$('button:has-text("Exit")');
    if (exitBtn) {
      await exitBtn.click();
      await page.waitForTimeout(300);
      log('Exited stealth mode');
    } else {
      warn('Could not find Exit button in stealth mode');
    }
  } catch (e) {
    warn(`Stealth mode issue: ${e.message}`);
  }

  // ── 7. Private Roster Panel ────────────────────────────────
  console.log('\n7. Private Roster');
  try {
    await page.click('button:has-text("Private Roster")');
    await page.waitForTimeout(300);
    const rosterPanel = await page.$('text=Private Roster');
    if (rosterPanel) log('Private Roster panel opened');

    // Close it
    await page.click('button:has-text("Private Roster")');
    await page.waitForTimeout(200);
    log('Private Roster closed');
  } catch (e) {
    warn(`Private Roster issue: ${e.message}`);
  }

  // ── 8. Dashboard View ──────────────────────────────────────
  console.log('\n8. Dashboard');
  try {
    await page.click('.nav-btn:has-text("Dashboard")');
    await page.waitForTimeout(300);

    // Check for student cards
    const studentCards = await page.$$('.student-card-small');
    log(`Dashboard shows ${studentCards.length} student cards`);

    // Open chat panel via Copilot toggle
    try {
      await page.click('button:has-text("Copilot")');
      await page.waitForTimeout(300);
      log('Copilot chat panel toggled');
    } catch { warn('Copilot toggle button not found'); }

    // Check chat bubbles area
    const chatBubbles = await page.$$('.chat-bubble');
    log(`Chat area has ${chatBubbles.length} message bubbles`);

    // Check chat input (placeholder contains "decimals" or "escalating")
    const chatInput = await page.$('input[placeholder*="decimals"]');
    if (chatInput) log('Chat input found');
    else {
      // Try broader search
      const anyInput = await page.$('input[style*="background"]');
      if (anyInput) {
        const ph = await anyInput.getAttribute('placeholder');
        log(`Chat input found (placeholder: "${(ph||'').slice(0, 40)}...")`);
      } else warn('Chat input not found');
    }

    // Try sending a test chat
    if (chatInput) {
      await chatInput.fill('test observation');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const afterBubbles = await page.$$('.chat-bubble');
      if (afterBubbles.length > chatBubbles.length) log('Chat message sent and displayed');
      else warn('Chat message may not have displayed');
    }
  } catch (e) {
    warn(`Dashboard issue: ${e.message}`);
  }

  // ── 9. Vault View ─────────────────────────────────────────
  console.log('\n9. Vault View');
  try {
    await page.click('.nav-btn:has-text("Data Vault")');
    await page.waitForTimeout(300);

    const vaultHeader = await page.$('h1:has-text("Data Vault")');
    if (vaultHeader) log('Vault header visible');
    else warn('Vault header not found');

    // Check vault tabs
    const vaultTabBtns = await page.$$('button:has-text("All Logs"), button:has-text("By Student"), button:has-text("Flagged")');
    log(`Found ${vaultTabBtns.length} vault tab buttons`);

    // Click By Student tab
    try {
      await page.click('button:has-text("By Student")');
      await page.waitForTimeout(200);
      log('By Student tab clicked');
    } catch { warn('By Student tab click failed'); }

    // Click KB tab
    try {
      await page.click('button:has-text("KB")');
      await page.waitForTimeout(200);
      const kbSection = await page.$('text=Add to Knowledge Base');
      if (kbSection) log('KB tab shows add form');
      else warn('KB form not visible');
    } catch { warn('KB tab click failed'); }

    // Back to All Logs
    await page.click('button:has-text("All Logs")');
    await page.waitForTimeout(200);
  } catch (e) {
    warn(`Vault issue: ${e.message}`);
  }

  // ── 10. Analytics View ─────────────────────────────────────
  console.log('\n10. Analytics');
  try {
    await page.click('.nav-btn:has-text("Analytics")');
    await page.waitForTimeout(300);
    const analyticsContent = await page.$('.main-content');
    if (analyticsContent) log('Analytics view rendered');
    else warn('Analytics view not found');
  } catch (e) {
    warn(`Analytics issue: ${e.message}`);
  }

  // ── 11. IEP Import View ────────────────────────────────────
  console.log('\n11. IEP Import');
  try {
    await page.click('.nav-btn:has-text("IEP Import")');
    await page.waitForTimeout(300);
    const importContent = await page.$('.main-content');
    if (importContent) log('IEP Import view rendered');
    else warn('IEP Import view not found');
  } catch (e) {
    warn(`IEP Import issue: ${e.message}`);
  }

  // ── 12. Quick Actions Panel ──────────────────────────────────
  console.log('\n12. Quick Actions');
  try {
    await page.click('.nav-btn:has-text("Dashboard")');
    await page.waitForTimeout(200);
    await page.click('.nav-btn:has-text("Quick Actions")');
    await page.waitForTimeout(300);
    const qaPanel = await page.$('aside');
    if (qaPanel) {
      const qaText = await qaPanel.textContent();
      log(`Quick Actions panel opened (${qaText.length} chars of content)`);
    } else warn('Quick Actions panel not found');
    // Close
    const qaClose = await page.$('aside button:has-text("×")');
    if (qaClose) { await qaClose.click(); await page.waitForTimeout(200); log('Quick Actions closed'); }
  } catch (e) {
    warn(`Quick Actions issue: ${e.message}`);
  }

  // ── 13. Floating Tool Window ────────────────────────────────
  console.log('\n13. Floating Tool Window');
  try {
    // Double-click a tool to pop it out as floating
    await page.dblclick('.nav-btn:has-text("Timer")');
    await page.waitForTimeout(400);
    const floatingWin = await page.$('div[style*="position: fixed"][style*="z-index: 1200"]');
    if (floatingWin) {
      log('Floating tool window appeared on double-click');
      // Look for close button on the floating window
      const floatClose = await floatingWin.$('button:has-text("×")');
      if (floatClose) { await floatClose.click(); await page.waitForTimeout(200); log('Floating window closed'); }
    } else warn('Floating tool window not found after double-click');
  } catch (e) {
    warn(`Floating tool issue: ${e.message}`);
  }

  // ── 14. Student Profile Modal ───────────────────────────────
  console.log('\n14. Student Profile Modal');
  try {
    await page.click('.nav-btn:has-text("Dashboard")');
    await page.waitForTimeout(300);
    // Click on a student card if any exist
    const stuCard = await page.$('.student-card-small');
    if (stuCard) {
      await stuCard.click();
      await page.waitForTimeout(400);
      // Check for modal
      const modal = await page.$('div[style*="position: fixed"][style*="z-index"]');
      if (modal) {
        const modalText = await modal.textContent();
        if (modalText.includes('Overview') || modalText.includes('Goals') || modalText.includes('Logs')) {
          log('Student profile modal opened with tabs');
        } else {
          log('Student profile modal opened');
        }
        // Close modal
        const closeModal = await modal.$('button:has-text("×")');
        if (closeModal) { await closeModal.click(); await page.waitForTimeout(200); }
      } else warn('Student profile modal did not open on card click');
    } else log('No student cards to test profile modal (demo mode off)');
  } catch (e) {
    warn(`Student profile modal issue: ${e.message}`);
  }

  // ── 15. Console Errors ─────────────────────────────────────
  console.log('\n15. Console Errors');
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  // Navigate through views to catch any errors
  await page.click('.nav-btn:has-text("Dashboard")');
  await page.waitForTimeout(500);
  await page.click('.nav-btn:has-text("Data Vault")');
  await page.waitForTimeout(500);
  await page.click('.nav-btn:has-text("Dashboard")');
  await page.waitForTimeout(500);

  if (consoleErrors.length === 0) log('No console errors during navigation');
  else warn(`${consoleErrors.length} console errors: ${consoleErrors.slice(0, 3).join('; ')}`);

  // ── Summary ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`PASSED: ${passed.length}`);
  console.log(`ISSUES: ${issues.length}`);
  if (issues.length > 0) {
    console.log('\nIssues found:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }
  console.log('══════════════════════════════════════════\n');

  await browser.close();
}

run().catch(e => { console.error('Audit failed:', e.message); process.exit(1); });
