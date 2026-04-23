# e2e — Playwright integration tests

These verify cloud sync end-to-end across two browsers on the deployed app.

## Prerequisites

1. App deployed (local dev or Vercel preview with cloud configured).
2. Two test Google accounts. For CI, capture their storage state with
   `npx playwright codegen` and commit under `e2e/fixtures/` (don't check in
   real credentials — use throwaway test accounts).
3. Env vars:
   ```
   E2E_APP_URL=https://<your-preview>.vercel.app
   E2E_INVITE_CODE=ABCDEF      # a team invite code both users are members of
   ```

## Run

```bash
npx playwright test e2e/
```
