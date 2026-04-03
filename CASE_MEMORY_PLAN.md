# Case Memory System — Design & Implementation

## Overview

The Case Memory System is the flagship feature of SupaPara. When a para encounters a challenging situation with a student, they press the Help button and the app retrieves prior incidents, what was tried, and whether it worked.

## Data Model

```
Incident (inc_*)          Intervention (intv_*)       Outcome (out_*)
┌─────────────────┐      ┌──────────────────┐       ┌──────────────────┐
│ studentId        │──┐   │ incidentId       │──┐    │ interventionId   │
│ description      │  │   │ studentId        │  │    │ incidentId       │
│ category         │  │   │ strategyLabel    │  │    │ studentId        │
│ tags[]           │  │   │ accommodationUsed│  │    │ result           │
│ status           │  │   │ staffNote        │  │    │ wouldRepeat      │
│ interventionIds[]│  │   │ source           │  │    │ studentResponse  │
└─────────────────┘  │   └──────────────────┘  │    └──────────────────┘
                     │                          │
                     └──── Links to Incident ───┘
```

### ID Conventions
- `inc_<timestamp>_<counter>` — Incidents
- `intv_<timestamp>_<counter>` — Interventions
- `out_<timestamp>_<counter>` — Outcomes

### Storage
- `paraIncidentsV1` — localStorage key for incidents
- `paraInterventionsV1` — localStorage key for interventions
- `paraOutcomesV1` — localStorage key for outcomes

## Search Algorithm: `searchCaseMemory()`

Located in `src/engine/index.js`. Scoring:

| Signal | Score | Reason |
|--------|-------|--------|
| Same student | +3 | Strongest signal |
| Same category | +2 | behavior matches behavior |
| Tag overlap | +1 per tag | sensory + shutdown |
| Same situationId | +2 | Exact situation match |
| Recent (≤7 days) | +1 | Recency bonus |
| Intervention worked | +2 per | Success boosts relevance |

Returns top N results sorted by relevance, each containing: `{ incident, interventions: [{ intervention, outcome }], relevanceScore, matchReasons }`.

## Help Button UX Flow

1. Para on Dashboard → sees student having difficulty
2. Taps Help FAB (bottom-right "?" button)
3. HelpPanel slides up from bottom
4. Description auto-populated from last chat message, or para types manually
5. Auto-tags detected from description (sensory, escalation, math, etc.)
6. Panel shows past cases from `searchCaseMemory()` with color-coded outcomes
7. Para taps "Try This Again" → InterventionLogger opens pre-filled
8. Para saves intervention → OutcomeLogger prompts "Did it work?"
9. Para taps result → outcome saved, companion Log entry created

## Components

| Component | File | Purpose |
|-----------|------|---------|
| HelpButton | `src/features/help/HelpButton.jsx` | Circular FAB, badge shows open incidents |
| HelpPanel | `src/features/help/HelpPanel.jsx` | Search + results + intervention/outcome logging |
| CaseMemoryCard | `src/features/help/CaseMemoryCard.jsx` | Single past case with color-coded outcome |
| InterventionLogger | `src/features/help/InterventionLogger.jsx` | Strategy dropdown + accommodation toggles |
| OutcomeLogger | `src/features/help/OutcomeLogger.jsx` | 4-button result + optional details |

## Hook: `useCaseMemory()`

File: `src/hooks/useCaseMemory.js`

Returns: `{ incidents, interventions, outcomes, addIncident, addIntervention, addOutcome, resolveIncident, getStudentCaseHistory, loadDemoCaseMemory, clearCaseMemory }`

- `addOutcome` auto-resolves incident when result is "worked"
- `addIntervention` links to parent incident's `interventionIds` array
- Companion Log entries created via `addLog()` with `source: "help_button"`

## Demo Data

File: `src/data/demoSeedData.js`

8 hand-crafted incidents across 5 students with 12 interventions and 12 outcomes. Covers key demo scenarios:
- Orange Student (Autism): Sensory overload → headphones worked
- Pink Student (BIP): Escalation → silent break card worked
- Purple Student (SLD Math): Fraction frustration → chunking + tools worked
- Red Student (SLD+ELL): Writing shutdown → graphic organizer worked
- Green Student (ADHD): Off-task → chunking + movement break worked
