// e2e/team-realtime.spec.ts
// Verifies realtime fan-out between two paras on the same team.
// Prerequisites (see e2e/README.md): two signed-in browser storage states,
// and the app deployed at E2E_APP_URL.
import { test, expect, chromium } from '@playwright/test';

test('shared handoff appears on teammate within 3s', async () => {
  const appUrl = process.env.E2E_APP_URL;
  if (!appUrl) test.skip(true, 'E2E_APP_URL not set');

  const browser = await chromium.launch();
  const ctxA = await browser.newContext({
    storageState: process.env.E2E_A_STORAGE || 'e2e/fixtures/userA.storage.json',
  });
  const ctxB = await browser.newContext({
    storageState: process.env.E2E_B_STORAGE || 'e2e/fixtures/userB.storage.json',
  });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await Promise.all([pageA.goto(appUrl!), pageB.goto(appUrl!)]);

  // Open Handoff Builder on A
  await pageA.getByRole('button', { name: /handoff notes/i }).click();

  const unique = `e2e chair throw ${Date.now()}`;
  await pageA.getByRole('textbox').filter({ hasText: '' }).nth(0).fill(unique);

  // Ensure "Share with team" is on (default on when cloud configured)
  const shareToggle = pageA.getByRole('checkbox', { name: /share with team/i });
  if (!(await shareToggle.isChecked())) await shareToggle.check();

  await pageA.getByRole('button', { name: /save handoff note/i }).click();

  // Expect B to see the unique body within 3 seconds via realtime
  await expect(pageB.getByText(unique)).toBeVisible({ timeout: 3000 });

  await browser.close();
});
