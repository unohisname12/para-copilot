// ══════════════════════════════════════════════════════════════
// MINT TEST FIXTURES — uses Supabase service role to mint sessions
// for the two handoff test accounts and writes Playwright storage
// state files. No browser, no Google OAuth.
//
// Run:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
//   SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   APP_ORIGIN=https://supapara.vercel.app \
//   node e2e/mintTestFixtures.mjs
// ══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://supapara.vercel.app';

if (!SUPABASE_URL || !SERVICE_KEY || !PUBLISHABLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).host.split('.')[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const ACCOUNTS = [
  { label: 'A', email: 'Deandresample22@gmail.com', out: 'e2e/fixtures/userA.storage.json' },
  { label: 'B', email: 'Deandresample4@gmail.com',  out: 'e2e/fixtures/userB.storage.json' },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const { label, email, out } of ACCOUNTS) {
  console.log(`\n[${label}] ${email}`);

  console.log(`[${label}] Generating magic link...`);
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) {
    console.error(`[${label}] generateLink failed:`, linkErr);
    process.exit(1);
  }
  const hashed = linkData?.properties?.hashed_token;
  if (!hashed) {
    console.error(`[${label}] No hashed_token in response`, linkData);
    process.exit(1);
  }

  console.log(`[${label}] Verifying token to mint session...`);
  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verifyData, error: verifyErr } = await userClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  });
  if (verifyErr) {
    console.error(`[${label}] verifyOtp failed:`, verifyErr);
    process.exit(1);
  }
  const session = verifyData?.session;
  if (!session) {
    console.error(`[${label}] No session returned`, verifyData);
    process.exit(1);
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: APP_ORIGIN,
        localStorage: [
          { name: STORAGE_KEY, value: JSON.stringify(session) },
          // Suppress first-run OnboardingModal so the test isn't blocked by
          // a modal-overlay intercepting clicks. See OnboardingModal.jsx.
          { name: 'supapara_onboarded_v1', value: '1' },
        ],
      },
    ],
  };

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(storageState, null, 2));
  console.log(`[${label}] Wrote ${out} (user.id=${session.user?.id} email=${session.user?.email})`);
}

console.log('\nDone. Both fixtures minted.');
