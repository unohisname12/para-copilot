# SupaPara Roadmap

## Current State (Demo-Ready)

- 9 demo students with full IEP profiles
- Help Button with case memory search (keyword scoring)
- Incident → Intervention → Outcome tracking
- Showcase mode with pre-seeded realistic data
- Prepared JSON import for quick profile loading
- 19 test suites, 255 tests passing
- Fully offline, FERPA-compliant

## Core vs Premium Split

### Always Free
- Local storage persistence
- Keyword-based case memory search (`searchCaseMemory()`)
- Manual JSON import (prepared profiles)
- Help button with case memory
- All classroom tools (timer, calculator, breathing, etc.)
- FERPA-compliant identity system
- CSV export

### Future Premium
1. **AI-Powered IEP Parsing** — raw PDF → AI extraction → review screen → approved profile
2. **Cloud Sync (Firebase)** — multi-device, team sharing
3. **AI Case Memory Insights** — `ollamaCaseInsight()` for smart recommendations
4. **Advanced Analytics** — trend charts, exportable IEP meeting reports
5. **Team Features** — multi-para log sharing (pseudonym-only in shared space)

## Architecture for Premium (Already Prepared)

- All Ollama functions in `engine/ollama.js`. Future cloud AI → separate `engine/cloudAI.js` with same signatures.
- Firebase would add: (a) `FirebaseProvider` wrapping tree, (b) sync methods on hooks, (c) `EXPORT_MODE.SAFE` enforced on all cloud-bound data
- `ollamaCaseInsight()` already exists in `engine/ollama.js` — just needs UI toggle

## Identity Future

- `externalStudentKey` field on student records — teacher-supplied trusted key
- Duplicate detection: match on externalKey OR (name + grade + school) fuzzy match
- Merge strategy: when duplicate found, keep older studentId, merge logs/incidents
