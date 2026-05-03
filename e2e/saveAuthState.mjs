// ══════════════════════════════════════════════════════════════
// SAVE AUTH STATE — opens a headed Chrome, waits for user to
// sign in via Google OAuth, then saves cookies + localStorage to
// a fixture file for headless replay.
//
// Run: BASE=<url> STORAGE=<out.json> node e2e/saveAuthState.mjs
// ══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, basename } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3456';
const OUT = process.env.STORAGE || 'e2e/fixtures/dre.storage.json';
const TIMEOUT_MS = 15 * 60 * 1000;

// Per-output persistent profile dir so two captures (userA / userB) don't
// share cookies. Derived from the OUT filename so reruns reuse the same
// profile and Google does not re-flag a "new device".
const profileDir = `/tmp/supapara-auth-${basename(OUT).replace(/[^a-zA-Z0-9._-]/g, '_')}`;

console.log(`\nOpening ${BASE} in a headed Chrome window.`);
console.log(`Profile dir: ${profileDir}`);
console.log('Sign in with Google when the window appears.');
console.log('I will detect when you reach the Dashboard and save the session.\n');

await mkdir(dirname(OUT), { recursive: true });

// Use launchPersistentContext + ignoreDefaultArgs: ['--enable-automation']
// to make Chrome look like a normal user session. Google's OAuth gate
// blocks Playwright's default-flagged Chrome with "browser may not be secure".
const ctx = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--start-maximized', '--no-default-browser-check', '--no-first-run'],
});

// Strip the navigator.webdriver flag — Google's bot detector reads it.
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const page = ctx.pages()[0] || await ctx.newPage();
console.log('>>> Chrome window should be open. Title: "SupaPara".');
console.log('>>> If hidden: alt-tab or check taskbar.\n');

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// Positive detector: dashboard renders a "Sign out" control once auth
// completes. Reliable because that string is not present pre-auth.
console.log(`Waiting for sign-in (up to ${Math.round(TIMEOUT_MS / 60000)} min)...`);
try {
  await page.waitForFunction(
    () => (document.body?.innerText || '').toLowerCase().includes('sign out'),
    { timeout: TIMEOUT_MS, polling: 1000 }
  );
} catch (e) {
  console.error('\n✗ Timed out waiting for sign-in. Closing.');
  await ctx.close();
  process.exit(1);
}

await page.waitForTimeout(2000);

await ctx.storageState({ path: OUT });
console.log(`\n✓ Saved auth state to ${OUT}`);

await ctx.close();
