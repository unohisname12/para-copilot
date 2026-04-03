# Identity System — Design & Contracts

## studentId Convention

All student records use a permanent `stu_` prefixed ID:

| Source | Format | Example |
|--------|--------|---------|
| Demo students | `stu_001` to `stu_009` | `stu_005` (Orange Student 1) |
| IEP Import | `stu_imp_<timestamp>` | `stu_imp_1711900000000` |
| Bundle generated | `stu_gen_<counter>` | `stu_gen_1` |
| Master roster | `stu_mr_<original_id>` | `stu_mr_J001` |
| Future external | `stu_ext_<externalKey>` | Planned, not built |

### Validation

`validateStudentId(id)` in `src/models/index.js`:
- Must be a string
- Must start with `stu_`
- Must be at least 5 characters

### Permanence Contract

Once assigned, a studentId NEVER changes. All data (logs, incidents, interventions, outcomes) link to students via studentId. Re-importing the same bundle produces the same IDs.

## Identity Palette

12-color system in `src/identity.js`:

| Color | Hex | Emoji | Codename |
|-------|-----|-------|----------|
| Red | #ef4444 | fire | Ember |
| Blue | #3b82f6 | wave | Wave |
| Green | #22c55e | fern | Fern |
| Purple | #a855f7 | butterfly | Dusk |
| Orange | #f97316 | orange | Tangerine |
| Teal | #14b8a6 | dolphin | Reef |
| Pink | #ec4899 | blossom | Bloom |
| Yellow | #eab308 | star | Nova |
| Violet | #8b5cf6 | crystal | Prism |
| Cyan | #06b6d4 | snowflake | Frost |
| Lime | #84cc16 | seedling | Sprout |
| Rose | #f43f5e | hibiscus | Coral |

## Privacy Layers

1. **Display names**: Always go through `resolveLabel(student, mode)` from `src/privacy/nameResolver.js`
2. **Private Roster**: Real names stored only in session memory (identityRegistry), never in localStorage
3. **Exports**: Use `resolveExportName()` — pseudonyms only in all exported data
4. **AI Context**: Uses `serializeForCopilotPrompt()` — pseudonyms only
5. **Case Memory**: Incidents/interventions/outcomes reference studentId, never real names

## Future: External Keys

Planned `externalStudentKey` field on student records for teacher-supplied trusted keys. Would enable duplicate detection and cross-system matching without exposing real names.
