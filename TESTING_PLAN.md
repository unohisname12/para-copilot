# Testing Plan — SupaPara

## Unit Tests (Jest)

**19 suites, 255 tests** — all passing.

| Suite | Tests | Area |
|-------|-------|------|
| identity.test.js | Identity palette, assignIdentity, patchIdentity |  |
| identityPermanence.test.js | studentId validation, DEMO_STUDENTS stability, factory IDs |  |
| identityRegistry.test.js | Registry normalization, buildIdentityRegistry |  |
| nameResolver.test.js | resolveLabel modes, stealth, export names |  |
| rosterLookups.test.js | buildRosterLookups, validate, partition |  |
| IEPImport.test.js | resolveStudentSlot, color cycling |  |
| incident.test.js | createIncident, createIntervention, createOutcome factories |  |
| caseMemory.test.js | searchCaseMemory scoring, ranking, filtering |  |
| helpFlow.test.js | Full incident→intervention→outcome cycle, search integration |  |
| showcase.test.js | Demo data cross-references, ID uniqueness, volume |  |
| quickLog.test.js | Quick action logging |  |
| situationHint.test.js | Situation detection |  |
| simpleMode.test.js | SimpleMode rendering |  |
| sidebarVisibility.test.js | Sidebar visibility rules |  |
| demoMode.test.js | Demo mode toggle |  |
| phase5.test.js | Phase 5 specific |  |
| phase6a/b/c.test.js | Phase 6 specific |  |

## E2E Tests (Playwright)

| Script | What it checks |
|--------|---------------|
| `e2e/uiAudit.mjs` | Full UI audit — 39 checks across all surfaces |
| `e2e/helpButtonAudit.mjs` | Help FAB, panel open/close, search, case results, intervention logger |
| `e2e/showcaseAudit.mjs` | Demo data loading, storage verification, banner behavior |

Run E2E: Start dev server on port 3456, then `node e2e/helpButtonAudit.mjs`

## Pre-Demo Smoke Test (Manual)

1. Fresh browser, clear localStorage
2. Click "Load Demo Experience" on dashboard banner
3. Navigate to Period 3 → verify Purple + Orange students visible
4. Click student card → verify profile modal (goals, accs, strategies)
5. Click Help → type "covering ears" → verify sensory tags detected
6. Verify case memory shows past result for Orange Student
7. Click "Try This Again" → verify intervention logger pre-fills
8. Save intervention, select "Worked" → verify outcome logged
9. Check Data Vault → verify new log entries
10. Navigate to Period 5 → verify Pink Student with BIP alert
11. Click Help → type "refusing work" → verify behavior tags
12. Toggle Stealth Mode → verify no student data visible
13. Exit Stealth → verify restored
14. Open Import → verify "Load Profiles" is default tab
15. Check "Load Demo Students" button works

## Running Tests

```bash
# Unit tests
npx react-scripts test --watchAll=false

# Build check
npx react-scripts build

# E2E (requires dev server)
PORT=3456 npx react-scripts start &
node e2e/uiAudit.mjs
node e2e/helpButtonAudit.mjs
node e2e/showcaseAudit.mjs
```
