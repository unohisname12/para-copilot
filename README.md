# supapara

FERPA-compliant classroom assistant for paraprofessionals. Runs fully offline by
default; optional cloud backend (Supabase + Vercel) enables team-shared pseudonymous
handoffs, logs, and case memory across paras.

## Offline (default)

```bash
npm install
npm start
```

Opens on `http://localhost:3000`. All data lives in `localStorage`; real names stay in
React session state (`identityRegistry`) and never persist.

## Cloud deploy (Supabase + Vercel)

### 1. Create a Supabase project
1. Sign in at https://supabase.com, click **New project**.
2. Name it `supapara-demo`, pick a region near you, choose the free tier.
3. Once provisioned, open **Settings → API**. Copy **Project URL** and **anon public key**.

### 2. Configure Google OAuth
1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Paste the Client ID and Client Secret into Supabase → **Auth → Providers → Google**. Enable.
4. Supabase → **Auth → URL Configuration** → set Site URL to your Vercel URL (set after step 4).

### 3. Apply migrations

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Verify in Supabase dashboard → Table Editor that all 7 tables are present with RLS enabled:
`teams`, `team_members`, `team_students`, `logs`, `incidents`, `interventions`, `outcomes`, `handoffs`.

### 4. Deploy to Vercel
1. Push the repo to GitHub if not already.
2. On Vercel, import the repo. Framework: Create React App. Build: `npm run build`. Output: `build/`.
3. Project Settings → Environment Variables — add for **Production and Preview**:
   - `REACT_APP_SUPABASE_URL` = your project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
4. Deploy. Copy the production URL back into Supabase Site URL + Additional Redirect URLs (step 2.4).

### 5. Local dev with cloud

```bash
cp .env.local.example .env.local
# fill in URL + anon key from Supabase dashboard
npm start
```

With env vars set, the app requires sign-in. Without them, it runs fully offline.

## FERPA posture

- Real student names live only in `identityRegistry` (React state, session-only, never persisted).
- Cloud schema has no real-name column. Every cloud write runs through `stripUnsafeKeys`,
  and `team_students` has a database trigger that rejects `realName`-shaped jsonb keys.
- Private roster JSON files (containing real names) live only on the user's device.
  They are never uploaded by the app.

## Tests

```bash
npm test
```

Full suite: 277 tests across 21 files covering models, identity, case memory,
FERPA guards, and team sync.

Integration (Playwright, requires deployed app + two test Google accounts):

```bash
npx playwright test e2e/
```

## Documentation

- `APP_KNOWLEDGE.md` — full system reference
- `docs/superpowers/specs/2026-04-22-cloud-backend-design.md` — cloud backend design
- `docs/superpowers/plans/2026-04-22-cloud-backend.md` — phased implementation plan
- `supabase/tests/rls_test.sql` — RLS + FERPA trigger smoke tests (run in SQL editor)
