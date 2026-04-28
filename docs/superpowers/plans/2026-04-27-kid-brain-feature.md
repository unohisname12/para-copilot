# Kid Brain Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every student a persistent, team-shared "Brain" of structured facts that the para can browse, edit, and feed into AI chat — without ever leaking real names to Supabase.

**Architecture:** Cloud-first, keyed by 6-digit Para App Number. New table `kid_brain_facts` in Supabase, RLS-gated by `is_member_of_team`. Every fact text is run through the existing `sanitizeFact()` (already shipped at `src/privacy/factSanitizer.js`) before insert, so real names from the para's local vault get auto-replaced with `[student]`. Realtime subscribe so paras on the same team see new facts within ~1 second. UI lives as a new "Brain" tab in `StudentProfileModal`. AI chat retrieves top-N facts as grounded context.

**Tech Stack:** Supabase (Postgres + RLS + Realtime), React 19 + CRA, plain CSS variables (no Tailwind), Jest/RTL for tests. Uses existing `is_member_of_team(uuid)` and `is_team_admin(uuid)` SQL helpers from migration `20260423100500_rls_recursion_fix.sql` and `20260426120000_access_control_hardening.sql`.

**Repo path:** `/home/dre/Code/old-projects/code mach/JPDs-gZD/`

---

## Pre-flight (do this BEFORE Task 1)

The other Claude (you) is starting cold. Read this whole header before any edits.

### Project ground rules (NON-NEGOTIABLE)

These come from `REPO_CONTEXT.md` and `CLAUDE.md`. Violating them breaks the product:

1. **Plain English UI** — banned words in user-facing strings: `JSON`, `bundle`, `roster`, `pseudonym`, `vault`, `IndexedDB`, `FERPA`, `KB`, `EBP`, `BIP`, `SLD`, `PII`, `purge`. Use: *name list, student file, real names, saved notes, Para App Number, this computer, the cloud, the team, fact, things to remember, forget*.
2. **Para-first framing** — features must benefit the para, not feel like surveillance. Never say "your sped teacher will see this" as the lede. Say "you and your team can see this."
3. **Design tokens only** — no inline `#hex` in user-visible UI. Use `var(--accent)`, `var(--green)`, `var(--bg-surface)`, etc. from `src/styles/styles.css`.
4. **Orange = action** — only `.btn-primary` is orange, one per panel/modal max.
5. **FERPA invariant** — real student names NEVER touch Supabase. Brain fact text must pass through `sanitizeFact()` before insert. Period.
6. **Chromebook target** — tap targets ≥ 32px (≥ 40px when handed to a student), 1366×768 baseline.

### Verify state before starting

- [ ] **Step 1: Verify the sanitizer exists**

```bash
test -f src/privacy/factSanitizer.js && echo "OK: sanitizer present" || echo "MISSING — STOP"
test -f src/__tests__/factSanitizer.test.js && echo "OK: sanitizer tests present" || echo "MISSING — STOP"
```
Expected: both lines print `OK`. If either is missing, STOP and tell the user — the sanitizer is a hard dependency for this whole plan.

- [ ] **Step 2: Verify the helpers this plan depends on**

```bash
grep -l "is_member_of_team" supabase/migrations/*.sql
grep -l "is_team_admin" supabase/migrations/*.sql
```
Expected: at least one file matches each. If empty, STOP — this plan reuses those helpers.

- [ ] **Step 3: Check branch + uncommitted state**

```bash
git status
git branch -vv
```
Expected: clean tree on the branch the user told you. If there are uncommitted changes from another session, STOP and surface them — do NOT bury them under your commits.

- [ ] **Step 4: Verify tests pass before any change**

```bash
CI=true npm test -- --watchAll=false 2>&1 | tail -5
```
Expected: `Test Suites: 36 passed, 36 total` (or higher), `Tests: 440 passed` (or higher). If RED before you start, STOP — don't make it worse.

### Coordination notes

- The user keeps two Claude sessions on this repo. Before each commit, run `git status` and confirm only files YOU touched are staged.
- Use `git add <file>` explicitly per file. NEVER `git add .` or `-A`.
- Branch confusion exists: `feat/roster-reconnect` is the working branch as of 2026-04-27, but `REPO_CONTEXT.md` says Vercel auto-deploys from `feat/ui-reskin`. Confirm with the user which branch you're on and whether to merge after — DO NOT push to `feat/ui-reskin` without explicit instruction.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260427120000_kid_brain_facts.sql` | CREATE | Table + indexes + RLS policies |
| `src/services/brainSync.js` | CREATE | CRUD + Realtime subscribe; calls `sanitizeFact` before insert |
| `src/__tests__/brainSync.test.js` | CREATE | Unit tests with mocked supabase client |
| `src/hooks/useKidBrain.js` | CREATE | React hook: subscribe + facts state per student |
| `src/__tests__/useKidBrain.test.js` | CREATE | Hook tests |
| `src/components/modals/BrainTab.jsx` | CREATE | New Brain tab UI: list, add form, edit, mark-stale |
| `src/__tests__/BrainTab.test.js` | CREATE | RTL tests for the tab |
| `src/components/modals/StudentProfileModal.jsx` | MODIFY | Add Brain tab to tabs array + render block |
| `src/context/buildContext.js` | MODIFY | Inject top-N brain facts into AI prompt |
| `src/__tests__/buildContext.test.js` | MODIFY (or CREATE if missing) | Test brain-fact injection |

---

## Task 1: SQL Migration — `kid_brain_facts` table

**Files:**
- Create: `supabase/migrations/20260427120000_kid_brain_facts.sql`

This task only touches Supabase. No app code changes. No tests yet (SQL is verified by applying it).

- [ ] **Step 1: Create the migration file**

Path: `supabase/migrations/20260427120000_kid_brain_facts.sql`

```sql
-- Kid Brain — per-student persistent facts the team accumulates over time.
-- Cloud-first, pseudonymous (keyed by Para App Number, never name).
-- Real names are stripped client-side via sanitizeFact() before insert; this
-- migration includes a defense-in-depth check constraint as a safety net.

create table if not exists kid_brain_facts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  student_uid text not null,
  fact text not null check (length(trim(fact)) between 1 and 500),
  category text check (category in (
    'sensory','social','academic','emotional',
    'transitions','engagement','triggers','what_works','other'
  )),
  confidence smallint not null default 50 check (confidence between 0 and 100),
  source_log_id uuid references observations(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_reinforced_at timestamptz not null default now(),
  superseded_by uuid references kid_brain_facts(id) on delete set null
);

create index if not exists kid_brain_facts_team_student_idx
  on kid_brain_facts (team_id, student_uid)
  where superseded_by is null;

create index if not exists kid_brain_facts_team_student_cat_idx
  on kid_brain_facts (team_id, student_uid, category)
  where superseded_by is null;

alter table kid_brain_facts enable row level security;

drop policy if exists "team members read brain facts" on kid_brain_facts;
create policy "team members read brain facts"
  on kid_brain_facts
  for select
  using (is_member_of_team(team_id));

drop policy if exists "team members write brain facts" on kid_brain_facts;
create policy "team members write brain facts"
  on kid_brain_facts
  for insert
  with check (
    is_member_of_team(team_id)
    and created_by = auth.uid()
  );

drop policy if exists "creator or admin updates brain facts" on kid_brain_facts;
create policy "creator or admin updates brain facts"
  on kid_brain_facts
  for update
  using (created_by = auth.uid() or is_team_admin(team_id))
  with check (created_by = auth.uid() or is_team_admin(team_id));

drop policy if exists "admin deletes brain facts" on kid_brain_facts;
create policy "admin deletes brain facts"
  on kid_brain_facts
  for delete
  using (is_team_admin(team_id));

-- Realtime support — needed for live sync across team paras
alter publication supabase_realtime add table kid_brain_facts;
```

- [ ] **Step 2: Apply the migration locally**

```bash
npx supabase db reset 2>&1 | tail -20
```
Expected: no errors, last lines show `Finished supabase db reset`. If the user's local Supabase isn't running, ask them to start it (`npx supabase start`) before continuing.

If the user's project doesn't use the local Supabase CLI workflow, run:
```bash
npx supabase migration new --help
```
…and ask the user which deploy path they want (CLI push vs paste-into-dashboard). Do NOT push to remote without confirmation.

- [ ] **Step 3: Sanity-check the table exists**

```bash
npx supabase db diff 2>&1 | tail -10
```
Expected: empty diff (migration applied cleanly, schema matches).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427120000_kid_brain_facts.sql
git commit -m "feat(brain): kid_brain_facts table + RLS + realtime publication"
```

---

## Task 2: `brainSync.js` Service

**Files:**
- Create: `src/services/brainSync.js`
- Test: `src/__tests__/brainSync.test.js`

Mirror the shape of `src/services/teamSync.js`. Every insert calls `sanitizeFact()` from `src/privacy/factSanitizer.js` before the row hits supabase.

- [ ] **Step 1: Write the failing tests**

Path: `src/__tests__/brainSync.test.js`

```js
import { listFacts, addFact, updateFact, supersedeFact } from '../services/brainSync';

// Mock the supabase client + sanitizer
jest.mock('../services/supabaseClient', () => {
  const insertResult = { data: [{ id: 'f1', fact: '[student] loves Pokémon' }], error: null };
  const selectResult = { data: [{ id: 'f1', fact: '[student] loves Pokémon', student_uid: '847293' }], error: null };
  const updateResult = { data: [{ id: 'f1', confidence: 80 }], error: null };

  const builder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    then: jest.fn((cb) => cb(selectResult)),
  };
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(insertResult),
  };
  const updateBuilder = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(updateResult),
  };

  return {
    supabase: {
      from: jest.fn((table) => {
        // Return a builder that handles all the chained calls used in brainSync
        return {
          insert: insertBuilder.insert,
          select: jest.fn(() => ({
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            is: jest.fn().mockResolvedValue(selectResult),
          })),
          update: updateBuilder.update,
        };
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      })),
      removeChannel: jest.fn(),
    },
    supabaseConfigured: true,
  };
});

describe('brainSync', () => {
  beforeEach(() => jest.clearAllMocks());

  test('addFact sanitizes fact text before insert', async () => {
    const vault = { '847293': 'Marcus Thompson' };
    await addFact({
      teamId: 't1',
      studentUid: '847293',
      factText: 'Marcus loves Pokémon',
      category: 'engagement',
      vault,
    });
    const { supabase } = require('../services/supabaseClient');
    const insertCall = supabase.from.mock.calls.find(c => c[0] === 'kid_brain_facts');
    expect(insertCall).toBeDefined();
  });

  test('addFact rejects empty fact text', async () => {
    await expect(
      addFact({ teamId: 't1', studentUid: '847293', factText: '', category: 'engagement', vault: {} })
    ).rejects.toThrow(/fact text required/i);
  });

  test('addFact rejects when no team or student', async () => {
    await expect(
      addFact({ teamId: '', studentUid: '847293', factText: 'x', category: 'engagement', vault: {} })
    ).rejects.toThrow(/team/i);
    await expect(
      addFact({ teamId: 't1', studentUid: '', factText: 'x', category: 'engagement', vault: {} })
    ).rejects.toThrow(/student/i);
  });

  test('listFacts queries by team + student + active only', async () => {
    await listFacts({ teamId: 't1', studentUid: '847293' });
    const { supabase } = require('../services/supabaseClient');
    expect(supabase.from).toHaveBeenCalledWith('kid_brain_facts');
  });

  test('updateFact bumps last_reinforced_at when confidence changes', async () => {
    await updateFact({ id: 'f1', confidence: 90 });
    const { supabase } = require('../services/supabaseClient');
    expect(supabase.from).toHaveBeenCalledWith('kid_brain_facts');
  });

  test('supersedeFact links new fact to old', async () => {
    await supersedeFact({
      teamId: 't1',
      studentUid: '847293',
      oldFactId: 'f1',
      newFactText: 'no longer dysregulated after lunch',
      category: 'emotional',
      vault: {},
    });
    const { supabase } = require('../services/supabaseClient');
    expect(supabase.from).toHaveBeenCalledWith('kid_brain_facts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=brainSync 2>&1 | tail -20
```
Expected: FAIL with `Cannot find module '../services/brainSync'` or similar.

- [ ] **Step 3: Implement `brainSync.js`**

Path: `src/services/brainSync.js`

```js
// Brain facts sync — cloud-first, sanitized.
// Every fact text is stripped of real names (via sanitizeFact) before the
// row is inserted into Supabase. The kid is identified by student_uid (the
// 6-digit Para App Number), never by name.

import { supabase } from './supabaseClient';
import { sanitizeFact } from '../privacy/factSanitizer';

function requireClient() {
  if (!supabase) throw new Error('Supabase not configured. Check .env.local.');
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user?.id || null;
}

// List active facts for one student, newest first.
export async function listFacts({ teamId, studentUid, category = null }) {
  requireClient();
  if (!teamId) throw new Error('teamId required');
  if (!studentUid) throw new Error('studentUid required');

  let q = supabase
    .from('kid_brain_facts')
    .select('*')
    .eq('team_id', teamId)
    .eq('student_uid', studentUid)
    .is('superseded_by', null)
    .order('last_reinforced_at', { ascending: false });

  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

// Insert a new fact. Returns { fact, foundNames } so the UI can surface
// which names got stripped (transparency for the para).
export async function addFact({ teamId, studentUid, factText, category, vault, sourceLogId = null }) {
  requireClient();
  if (!teamId) throw new Error('teamId required');
  if (!studentUid) throw new Error('studentUid required');
  if (!factText || !factText.trim()) throw new Error('fact text required');

  const { sanitized, foundNames } = sanitizeFact(factText, vault);
  const userId = await currentUserId();

  const row = {
    team_id: teamId,
    student_uid: studentUid,
    fact: sanitized,
    category: category || 'other',
    confidence: 50,
    source_log_id: sourceLogId,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('kid_brain_facts')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { fact: data, foundNames };
}

// Update fact (confidence change, category change). Bumps last_reinforced_at.
export async function updateFact({ id, confidence, category }) {
  requireClient();
  if (!id) throw new Error('id required');
  const patch = { last_reinforced_at: new Date().toISOString() };
  if (typeof confidence === 'number') patch.confidence = Math.max(0, Math.min(100, confidence));
  if (category) patch.category = category;
  const { data, error } = await supabase
    .from('kid_brain_facts')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// "This fact isn't true anymore" — insert a new fact and link the old one
// as superseded. Both rows survive for audit.
export async function supersedeFact({ teamId, studentUid, oldFactId, newFactText, category, vault }) {
  requireClient();
  if (!oldFactId) throw new Error('oldFactId required');
  const { fact: newFact, foundNames } = await addFact({
    teamId, studentUid, factText: newFactText, category, vault,
  });
  const { error } = await supabase
    .from('kid_brain_facts')
    .update({ superseded_by: newFact.id })
    .eq('id', oldFactId);
  if (error) throw new Error(error.message);
  return { fact: newFact, foundNames };
}

// Realtime subscribe — caller passes onChange(payload) and gets back an
// unsubscribe function. Mirror of subscribeTeamStudents in teamSync.js.
export function subscribeBrain({ teamId, studentUid, onChange }) {
  requireClient();
  if (!teamId || !studentUid) throw new Error('teamId and studentUid required');
  const channel = supabase
    .channel(`kid_brain:${teamId}:${studentUid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kid_brain_facts',
        filter: `team_id=eq.${teamId}`,
      },
      (payload) => {
        const row = payload.new || payload.old;
        if (row?.student_uid === studentUid) onChange(payload);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=brainSync 2>&1 | tail -10
```
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full suite to make sure nothing else broke**

```bash
CI=true npm test -- --watchAll=false 2>&1 | tail -5
```
Expected: `Test Suites: 37 passed`, `Tests: 446 passed` (or whatever the running totals are — count must NOT decrease vs pre-flight).

- [ ] **Step 6: Commit**

```bash
git add src/services/brainSync.js src/__tests__/brainSync.test.js
git commit -m "feat(brain): brainSync service with sanitizer + realtime"
```

---

## Task 3: `useKidBrain` Hook

**Files:**
- Create: `src/hooks/useKidBrain.js`
- Test: `src/__tests__/useKidBrain.test.js`

Wraps `brainSync` for React components: load facts, subscribe to changes, expose add/update/supersede.

- [ ] **Step 1: Write the failing test**

Path: `src/__tests__/useKidBrain.test.js`

```js
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKidBrain } from '../hooks/useKidBrain';

jest.mock('../services/brainSync', () => ({
  listFacts: jest.fn().mockResolvedValue([
    { id: 'f1', fact: '[student] loves Pokémon', category: 'engagement', confidence: 80 },
  ]),
  addFact: jest.fn().mockResolvedValue({
    fact: { id: 'f2', fact: '[student] needs movement breaks', category: 'sensory', confidence: 50 },
    foundNames: [],
  }),
  updateFact: jest.fn().mockResolvedValue({}),
  supersedeFact: jest.fn().mockResolvedValue({ fact: {}, foundNames: [] }),
  subscribeBrain: jest.fn().mockReturnValue(() => {}),
}));

describe('useKidBrain', () => {
  test('loads facts on mount', async () => {
    const { result } = renderHook(() => useKidBrain({ teamId: 't1', studentUid: '847293', vault: {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facts).toHaveLength(1);
    expect(result.current.facts[0].fact).toBe('[student] loves Pokémon');
  });

  test('addFact appends to facts list', async () => {
    const { result } = renderHook(() => useKidBrain({ teamId: 't1', studentUid: '847293', vault: {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addFact({ factText: 'Marcus needs movement breaks', category: 'sensory' });
    });
    expect(result.current.facts).toHaveLength(2);
  });

  test('addFact returns foundNames so caller can show what was stripped', async () => {
    const { result } = renderHook(() => useKidBrain({ teamId: 't1', studentUid: '847293', vault: {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let r;
    await act(async () => {
      r = await result.current.addFact({ factText: 'Marcus is great', category: 'engagement' });
    });
    expect(r).toHaveProperty('foundNames');
  });

  test('skips network when teamId or studentUid missing', async () => {
    const { result } = renderHook(() => useKidBrain({ teamId: null, studentUid: '847293', vault: {} }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.facts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=useKidBrain 2>&1 | tail -15
```
Expected: FAIL with `Cannot find module '../hooks/useKidBrain'`.

- [ ] **Step 3: Implement the hook**

Path: `src/hooks/useKidBrain.js`

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import * as brainSync from '../services/brainSync';

// React hook — manages one student's Brain facts. Loads on mount, subscribes
// to realtime changes, exposes add/update/supersede that update local state
// optimistically and re-fetch on success.
export function useKidBrain({ teamId, studentUid, vault }) {
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Load + subscribe whenever teamId/studentUid changes.
  useEffect(() => {
    if (!teamId || !studentUid) {
      setFacts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);

    let unsubscribe = () => {};
    (async () => {
      try {
        const data = await brainSync.listFacts({ teamId, studentUid });
        if (mountedRef.current) setFacts(data);
      } catch (e) {
        if (mountedRef.current) setError(e.message || String(e));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    unsubscribe = brainSync.subscribeBrain({
      teamId, studentUid,
      onChange: async () => {
        try {
          const data = await brainSync.listFacts({ teamId, studentUid });
          if (mountedRef.current) setFacts(data);
        } catch (e) {
          if (mountedRef.current) setError(e.message || String(e));
        }
      },
    });

    return () => { unsubscribe(); };
  }, [teamId, studentUid]);

  const addFact = useCallback(async ({ factText, category, sourceLogId }) => {
    const r = await brainSync.addFact({
      teamId, studentUid, factText, category, vault, sourceLogId,
    });
    setFacts((prev) => [r.fact, ...prev]);
    return r;
  }, [teamId, studentUid, vault]);

  const updateFact = useCallback(async ({ id, confidence, category }) => {
    const updated = await brainSync.updateFact({ id, confidence, category });
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
    return updated;
  }, []);

  const supersedeFact = useCallback(async ({ oldFactId, newFactText, category }) => {
    const r = await brainSync.supersedeFact({
      teamId, studentUid, oldFactId, newFactText, category, vault,
    });
    setFacts((prev) => [r.fact, ...prev.filter((f) => f.id !== oldFactId)]);
    return r;
  }, [teamId, studentUid, vault]);

  return { facts, loading, error, addFact, updateFact, supersedeFact };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=useKidBrain 2>&1 | tail -10
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKidBrain.js src/__tests__/useKidBrain.test.js
git commit -m "feat(brain): useKidBrain hook with realtime + optimistic updates"
```

---

## Task 4: `BrainTab` UI Component

**Files:**
- Create: `src/components/modals/BrainTab.jsx`
- Test: `src/__tests__/BrainTab.test.js`

Self-contained tab content. Receives `teamId`, `studentUid`, `vault`, and the student's display label as props. List facts grouped by category, "Add fact" form, edit confidence with simple buttons, "this isn't true anymore" supersede flow.

- [ ] **Step 1: Write the failing test**

Path: `src/__tests__/BrainTab.test.js`

```js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrainTab } from '../components/modals/BrainTab';

jest.mock('../hooks/useKidBrain', () => ({
  useKidBrain: jest.fn(),
}));

import { useKidBrain } from '../hooks/useKidBrain';

describe('BrainTab', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows loading state', () => {
    useKidBrain.mockReturnValue({ facts: [], loading: true, error: null, addFact: jest.fn() });
    render(<BrainTab teamId="t1" studentUid="847293" vault={{}} studentLabel="847293" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows empty state with helpful copy', () => {
    useKidBrain.mockReturnValue({ facts: [], loading: false, error: null, addFact: jest.fn() });
    render(<BrainTab teamId="t1" studentUid="847293" vault={{}} studentLabel="847293" />);
    expect(screen.getByText(/no facts yet/i)).toBeInTheDocument();
  });

  test('renders facts grouped by category', () => {
    useKidBrain.mockReturnValue({
      facts: [
        { id: 'f1', fact: '[student] loves Pokémon', category: 'engagement', confidence: 80, last_reinforced_at: '2026-04-20T00:00:00Z' },
        { id: 'f2', fact: '[student] needs movement breaks', category: 'sensory', confidence: 60, last_reinforced_at: '2026-04-21T00:00:00Z' },
      ],
      loading: false, error: null, addFact: jest.fn(), updateFact: jest.fn(), supersedeFact: jest.fn(),
    });
    render(<BrainTab teamId="t1" studentUid="847293" vault={{}} studentLabel="847293" />);
    expect(screen.getByText('loves Pokémon', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('needs movement breaks', { exact: false })).toBeInTheDocument();
  });

  test('calls addFact when user submits the form', async () => {
    const addFact = jest.fn().mockResolvedValue({ fact: {}, foundNames: [] });
    useKidBrain.mockReturnValue({ facts: [], loading: false, error: null, addFact, updateFact: jest.fn(), supersedeFact: jest.fn() });
    render(<BrainTab teamId="t1" studentUid="847293" vault={{ '847293': 'Marcus' }} studentLabel="Marcus" />);
    fireEvent.change(screen.getByPlaceholderText(/something to remember/i), {
      target: { value: 'loves Pokémon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add fact/i }));
    await waitFor(() => expect(addFact).toHaveBeenCalled());
  });

  test('warns user when sanitizer found a name in their fact text', async () => {
    const addFact = jest.fn().mockResolvedValue({ fact: {}, foundNames: ['Marcus'] });
    useKidBrain.mockReturnValue({ facts: [], loading: false, error: null, addFact, updateFact: jest.fn(), supersedeFact: jest.fn() });
    render(<BrainTab teamId="t1" studentUid="847293" vault={{ '847293': 'Marcus' }} studentLabel="Marcus" />);
    fireEvent.change(screen.getByPlaceholderText(/something to remember/i), {
      target: { value: 'Marcus loves Pokémon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add fact/i }));
    await waitFor(() => expect(screen.getByText(/we removed: marcus/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=BrainTab 2>&1 | tail -15
```
Expected: FAIL with `Cannot find module '../components/modals/BrainTab'`.

- [ ] **Step 3: Implement the tab**

Path: `src/components/modals/BrainTab.jsx`

```jsx
import React, { useMemo, useState } from 'react';
import { useKidBrain } from '../../hooks/useKidBrain';

const CATEGORIES = [
  { id: 'engagement',  label: 'What gets them going' },
  { id: 'what_works',  label: 'What works' },
  { id: 'triggers',    label: 'What sets them off' },
  { id: 'sensory',     label: 'Sensory needs' },
  { id: 'social',      label: 'Social' },
  { id: 'academic',    label: 'Academic' },
  { id: 'emotional',   label: 'Emotional' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'other',       label: 'Other' },
];

function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label || 'Other';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BrainTab({ teamId, studentUid, vault, studentLabel }) {
  const { facts, loading, error, addFact, updateFact, supersedeFact } =
    useKidBrain({ teamId, studentUid, vault });

  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('what_works');
  const [stripWarning, setStripWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const f of facts) {
      const k = f.category || 'other';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    return Array.from(m.entries());
  }, [facts]);

  async function handleAdd() {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setStripWarning(null);
    try {
      const r = await addFact({ factText: draft, category: draftCat });
      if (r?.foundNames?.length) {
        setStripWarning(`We removed: ${r.foundNames.join(', ')}. Names stay on this computer only.`);
      }
      setDraft('');
    } catch (e) {
      setStripWarning(`Couldn't save: ${e.message || e}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        Loading {studentLabel}'s Brain…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--red)', fontSize: 13 }}>
        Couldn't load Brain: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add-fact form */}
      <div style={{
        padding: 'var(--space-3)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Add a fact about {studentLabel}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Something to remember about this student (e.g. 'loves Pokémon — use as a math hook')"
          rows={2}
          maxLength={500}
          style={{
            width: '100%', padding: 'var(--space-2)',
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
            fontSize: 13, lineHeight: 1.5, resize: 'vertical', minHeight: 60,
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={draftCat}
            onChange={(e) => setDraftCat(e.target.value)}
            style={{
              padding: '6px 10px', fontSize: 12,
              background: 'var(--bg-dark)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              minHeight: 32,
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim() || submitting}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            {submitting ? 'Saving…' : 'Add fact'}
          </button>
        </div>
        {stripWarning && (
          <div style={{
            fontSize: 11, color: 'var(--yellow)',
            background: 'var(--yellow-muted)',
            border: '1px solid rgba(251,191,36,0.45)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px', lineHeight: 1.4,
          }}>
            {stripWarning}
          </div>
        )}
      </div>

      {/* Empty state */}
      {facts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
          No facts yet. Add the first thing you've learned about {studentLabel} above —
          the team will see it within a second.
        </div>
      )}

      {/* Grouped facts */}
      {grouped.map(([cat, items]) => (
        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {categoryLabel(cat)}
          </div>
          {items.map((f) => (
            <FactRow
              key={f.id}
              fact={f}
              onConfidenceChange={(delta) => updateFact({ id: f.id, confidence: f.confidence + delta })}
              onSupersede={(newText) => supersedeFact({ oldFactId: f.id, newFactText: newText, category: f.category })}
              studentLabel={studentLabel}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function FactRow({ fact, onConfidenceChange, onSupersede, studentLabel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const display = (fact.fact || '').replace(/\[student\]/gi, studentLabel);

  return (
    <div style={{
      padding: 'var(--space-3)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
        {display}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>Confidence {fact.confidence}%</span>
        <button
          type="button"
          onClick={() => onConfidenceChange(+10)}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '2px 8px' }}
          aria-label="Mark more sure"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onConfidenceChange(-10)}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '2px 8px' }}
          aria-label="Mark less sure"
        >
          −
        </button>
        <span>·</span>
        <span>Updated {formatDate(fact.last_reinforced_at)}</span>
        <span>·</span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-secondary)' }}
        >
          {editing ? 'Cancel' : 'Not true anymore'}
        </button>
      </div>
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's true now instead?"
            rows={2}
            style={{
              width: '100%', padding: 'var(--space-2)',
              background: 'var(--bg-dark)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: 12, lineHeight: 1.5,
            }}
          />
          <button
            type="button"
            onClick={async () => {
              if (!draft.trim()) return;
              await onSupersede(draft);
              setDraft('');
              setEditing(false);
            }}
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-start', fontSize: 11 }}
          >
            Replace this fact
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=BrainTab 2>&1 | tail -10
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/BrainTab.jsx src/__tests__/BrainTab.test.js
git commit -m "feat(brain): BrainTab UI with sanitizer transparency"
```

---

## Task 5: Wire Brain tab into `StudentProfileModal`

**Files:**
- Modify: `src/components/modals/StudentProfileModal.jsx`

This is a small surgical edit. The modal already has a `tabs` array around line 185 and a render block for each tab id. Add a new entry + new render block, plus pull `teamId` and `vault` from existing context hooks.

- [ ] **Step 1: Find the existing tabs array**

```bash
grep -n "const tabs = \\[" src/components/modals/StudentProfileModal.jsx
```
Expected output: a single line number (currently 185 but verify before editing).

- [ ] **Step 2: Read the surrounding context**

Read `src/components/modals/StudentProfileModal.jsx` lines 175-200 and lines 440-460 so you understand the current tabs definition and the render-block style. Also check the file header for import statements — you'll add to those.

- [ ] **Step 3: Add the import**

Add this line near the existing modal imports at the top of `src/components/modals/StudentProfileModal.jsx`:

```jsx
import { BrainTab } from './BrainTab';
import { useTeam } from '../../context/TeamProvider';
import { useVault } from '../../context/VaultProvider';
```

(If `useTeam` or `useVault` are already imported, don't duplicate. Check first with `grep -n "useTeam\|useVault" src/components/modals/StudentProfileModal.jsx`.)

- [ ] **Step 4: Pull teamId + vault inside `StudentProfileModalInner`**

Right after the existing `useEscape(onClose);` line at the top of `StudentProfileModalInner` (currently line 97), add:

```jsx
  const teamCtx = useTeam();
  const vaultCtx = useVault();
  const teamId = teamCtx?.activeTeamId || null;
  const vault = vaultCtx?.vault || {};
```

- [ ] **Step 5: Add the Brain tab to the tabs array**

The current `tabs` definition is an array literal. Add this entry **between `accs` and `parent`** (so it sits with the other knowledge tabs, not the admin-only parent tab):

```jsx
    { id: 'brain',  label: '🧠 Brain' },
```

(If parent is admin-gated by a ternary, make sure `brain` is OUTSIDE that ternary so all roles see it.)

- [ ] **Step 6: Add the render block**

In the body where existing `{tab === "logs" && (...)}` blocks live, add (after `{tab === "support" && ...}` and before `{tab === "logs" && ...}`):

```jsx
          {tab === "brain" && (
            <BrainTab
              teamId={teamId}
              studentUid={s.pseudonym}
              vault={vault}
              studentLabel={resolveLabel(s, "compact")}
            />
          )}
```

- [ ] **Step 7: Verify the file still parses**

```bash
CI=true npm test -- --watchAll=false 2>&1 | tail -8
```
Expected: full suite still passes (compile errors here would surface as failed test files even if no test for the modal exists).

- [ ] **Step 8: Commit**

```bash
git add src/components/modals/StudentProfileModal.jsx
git commit -m "feat(brain): wire BrainTab into StudentProfileModal"
```

---

## Task 6: AI Chat Context Injection

**Files:**
- Modify: `src/context/buildContext.js`
- Modify or Create: `src/__tests__/buildContext.test.js`

When the para asks the AI a question about a specific student, inject the top 5 highest-confidence brain facts into the prompt context. The AI then answers grounded in that kid's accumulated knowledge instead of generic advice.

- [ ] **Step 1: Read the current `buildContext.js` to understand its shape**

```bash
cat src/context/buildContext.js
```
Find the function that builds the per-student context block. Note the existing format (probably a string builder concatenating student name, goals, accs, recent logs).

- [ ] **Step 2: Check if there's an existing test file**

```bash
ls src/__tests__/buildContext* 2>/dev/null
```
If empty: create `src/__tests__/buildContext.test.js` from scratch in step 3. If a file exists: add tests to it.

- [ ] **Step 3: Write the failing test**

Add (or create) `src/__tests__/buildContext.test.js`:

```js
import { buildStudentContext } from '../context/buildContext';

describe('buildStudentContext brain injection', () => {
  test('includes top brain facts when provided', () => {
    const student = { pseudonym: '847293', goals: [], accs: [], strategies: [] };
    const logs = [];
    const brainFacts = [
      { fact: '[student] loves Pokémon', category: 'engagement', confidence: 90 },
      { fact: '[student] needs movement breaks', category: 'sensory', confidence: 80 },
    ];
    const ctx = buildStudentContext({ student, logs, brainFacts });
    expect(ctx).toContain('Pokémon');
    expect(ctx).toContain('movement breaks');
  });

  test('omits brain section when no facts provided', () => {
    const student = { pseudonym: '847293', goals: [], accs: [], strategies: [] };
    const ctx = buildStudentContext({ student, logs: [], brainFacts: [] });
    expect(ctx).not.toMatch(/brain|things to remember/i);
  });

  test('limits to top 5 by confidence', () => {
    const student = { pseudonym: '847293', goals: [], accs: [], strategies: [] };
    const brainFacts = Array.from({ length: 10 }, (_, i) => ({
      fact: `fact ${i}`, category: 'other', confidence: i * 10,
    }));
    const ctx = buildStudentContext({ student, logs: [], brainFacts });
    expect(ctx).toContain('fact 9');
    expect(ctx).toContain('fact 5');
    expect(ctx).not.toContain('fact 4');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=buildContext 2>&1 | tail -15
```
Expected: FAIL — either `buildStudentContext is not a function` or assertion failures.

- [ ] **Step 5: Add brain-fact injection**

Modify `src/context/buildContext.js`. Locate the existing context-builder function and:

1. Add `brainFacts = []` to the destructured params
2. Insert a "Things to remember about this student" section in the output, listing the top 5 facts by confidence

If the existing function isn't named `buildStudentContext`, either rename it (and update its callers) OR add a new exported wrapper. Pick whichever produces a smaller diff.

The new section should look like:

```js
// Sort by confidence desc, take top 5, format as bullets
const topFacts = [...(brainFacts || [])]
  .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  .slice(0, 5);

if (topFacts.length > 0) {
  out += '\n\nThings to remember about this student:\n';
  for (const f of topFacts) {
    out += `- ${f.fact} (${f.category || 'note'}, ${f.confidence || 0}% confident)\n`;
  }
}
```

(Adapt variable names to whatever the existing function uses.)

- [ ] **Step 6: Run tests to verify they pass**

```bash
CI=true npm test -- --watchAll=false --testPathPattern=buildContext 2>&1 | tail -10
```
Expected: PASS (3 tests).

- [ ] **Step 7: Find the chat hook that calls `buildStudentContext`**

```bash
grep -rn "buildStudentContext\|buildContext" src/hooks/ src/features/ src/components/ | head -10
```
Find the call site (probably `useChat.js` or the dashboard chat handler).

- [ ] **Step 8: Pass brain facts to the context builder**

At the call site, add a `useKidBrain` call (if the chat is per-student) OR a one-shot `brainSync.listFacts()` call (if the chat is more dynamic). Pass the facts array into `buildStudentContext`.

This step varies by call site — look at it, decide which fits, then make the smallest edit. Show your reasoning to the user before committing.

- [ ] **Step 9: Run the full suite**

```bash
CI=true npm test -- --watchAll=false 2>&1 | tail -5
```
Expected: all suites pass; total test count went up by 3.

- [ ] **Step 10: Commit**

```bash
git add src/context/buildContext.js src/__tests__/buildContext.test.js <chat-call-site>
git commit -m "feat(brain): inject top-N brain facts into AI chat context"
```

---

## Final Checks

- [ ] **Run full test suite one more time**

```bash
CI=true npm test -- --watchAll=false 2>&1 | tail -8
```
Expected: 36 → at least 41 suites passing, 440 → at least 458 tests passing, 0 failures.

- [ ] **Confirm git log shows clean per-task commits**

```bash
git log --oneline -10
```
Expected: 6 commits, one per task, each with a `feat(brain):` prefix.

- [ ] **Confirm Vercel branch question is answered**

Before pushing: ask the user which branch you should push to. The repo has `feat/roster-reconnect` (where work has been landing) and `feat/ui-reskin` (REPO_CONTEXT says Vercel deploys from this). Do NOT guess.

```bash
git push origin <branch-the-user-told-you>
```

- [ ] **Confirm the migration ran in production Supabase**

If user pushes to a branch that triggers a Vercel deploy AND the Supabase project is the prod one: the SQL migration in `supabase/migrations/` does NOT auto-apply on Vercel deploy. The user has to run `npx supabase db push` (CLI) or paste the SQL into the Supabase dashboard. Surface this — the app will crash trying to query a nonexistent table otherwise.

---

## Deferred (not in this plan)

These were considered and explicitly cut from this plan to keep it shippable:

- **pgvector embeddings** for semantic retrieval. Phase 2. Current retrieval is simple top-N-by-confidence.
- **Auto-extract facts from logs** via Ollama. Phase 2. For now the para writes facts manually.
- **Decay/recycling** of low-confidence facts. Phase 2. For now nothing auto-deletes.
- **Per-fact "who said this"** display. Phase 2. The created_by FK is in the schema but the UI doesn't show it.
- **Brain export / backup**. Phase 2. Brain lives in cloud only and survives device loss naturally.

Each is a self-contained future plan.

---

## Dre-specific notes

- Cross-pollination: this is the same pattern as the per-conversation memory in your second-brain vault at `~/aidre/`, scoped per-kid. If you ever want semantic retrieval, the embedding model + chunker from your AI Dre setup port directly.
- VAL-BOT precedent: same shape as Discord per-user memory keyed by user_id with server-side RLS. Mental model carries over.
- Do NOT touch `src/privacy/realNameVault.js`. The Brain is cloud, the name vault stays local. They're separate systems that happen to render together.
