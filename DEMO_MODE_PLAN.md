# Demo Mode / Showcase — Design & Guide

## Purpose

Pre-seeded realistic data that makes the app look impressive for school demos. No premium features needed — the demo path shows full power.

## Entry Points

1. **Dashboard Banner** — "New here? Try the demo" banner shown when no logs or case data exist. Click "Load Demo" to populate everything.
2. **Import Tab** — The "Load Profiles" (prepared) tab has a "Load Demo Students" button at the bottom.
3. **ShowcaseLoader Component** — Reusable component at `src/features/showcase/ShowcaseLoader.jsx`.

## What Gets Loaded

| Data | Count | Storage Key |
|------|-------|-------------|
| Demo Logs | 26 entries | `paraLogsV1` |
| Demo Incidents | 8 cases | `paraIncidentsV1` |
| Demo Interventions | 12 strategies tried | `paraInterventionsV1` |
| Demo Outcomes | 12 results | `paraOutcomesV1` |

All demo students are the 9 pre-built DEMO_STUDENTS from `data.js`, already present in demo mode.

## Killer Demo Scenarios

### Scenario A — Sensory Overload (Period 3)
1. Navigate to Period 3
2. See Orange Student 1 (Autism)
3. Click Help → type "covering ears"
4. See past case: "headphones worked in 3 min last time"
5. Click "Try This Again" → pre-filled intervention

### Scenario B — Escalation (Period 5)
1. Navigate to Period 5
2. See Pink Student 1 (BIP Active)
3. Click Help → type "refusing work"
4. See past case: "silent break card worked" and "don't correct publicly"
5. Demonstrates BIP-aware recommendations

### Scenario C — Math Frustration (Period 3)
1. Stay on Period 3
2. See Purple Student 1 (SLD Math)
3. Click Help → type "stuck on fractions"
4. See past case: "chunking + calculator + graph paper worked"

## Clearing Demo Data

The ShowcaseLoader component shows a "Clear Demo Data" button when data is loaded. This calls:
- `caseMemory.clearCaseMemory()` — removes all incidents/interventions/outcomes
- `clearDemoLogs()` — removes logs with `source: "demo"`

## Files

| File | Purpose |
|------|---------|
| `src/data/demoSeedData.js` | 8 incidents, 12 interventions, 12 outcomes, 26 logs |
| `src/features/showcase/ShowcaseLoader.jsx` | ShowcaseLoader + ShowcaseBanner components |
| `src/features/showcase/index.js` | Barrel export |
