# Phase Execution

This project uses strict phase-based execution.

## Rules

- implement only the approved phase
- do not expand scope beyond what is requested
- do not refactor unrelated systems
- reuse existing logic instead of rebuilding
- prefer additive, low-risk changes

## Execution behavior

- do not ask for permission prompts for routine work
- run tests after implementation
- ensure no regressions
- summarize file-by-file changes clearly

## Stopping condition

After completing the phase:

1. summarize changes
2. explain behavior impact
3. report test results
4. stop and wait for approval

## Quality

- prefer simple, maintainable solutions
- avoid clever but fragile code
- ensure backward compatibility unless explicitly told otherwise
