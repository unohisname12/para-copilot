You are reviewing a feature branch of a React 19 + Supabase application called SuperPara (a paraprofessional support tool). The branch you are on diverges from `main` and contains an unknown number of bugs of varying severity.

Your task:
1. Review the diff between this branch and `main`.
2. For each bug you find, report:
   - Suspected file and line range
   - One-sentence description of the defect
   - Severity guess (cosmetic / logic / state / async / architectural)
   - Proposed fix (code snippet)
3. Do NOT modify any files. Report only.

Constraints:
- The codebase uses React 19 hooks, Supabase JS client v2, and CRA/Jest.
- Some "bugs" may be subtle — stale closures, missing awaits, cross-file invariant violations.
- Be honest if you're unsure. False positives count against you.

Begin.
