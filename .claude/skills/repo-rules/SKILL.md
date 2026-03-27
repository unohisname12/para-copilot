# Repo Rules

This repository follows strict data, identity, and privacy rules.

## Core rules

- `studentId` is the primary key for all logic and lookups
- `pseudonym` is NOT a reliable key and must not be used for core logic
- `getStudentLabel()` is display-only and must not be used for logic
- real student names must NEVER exist in app-safe state, logs, analytics, or AI context
- real names may only exist in a private roster map and must remain local-only
- identity (emoji, codename, color) is the primary display system
- all name resolution must go through a centralized resolver (no inline name logic)

## Export rules

- **Safe Export** (default): pseudonyms only
- **Private Export**: real names only if private roster is loaded
- do not mix real names and pseudonyms in the same export

## UI rules

- Simple Mode is the primary para-facing mode
- Simple Mode must prioritize:
  - low cognitive load
  - fast actions
  - situation-first thinking
- avoid exposing unnecessary tools in Simple Mode

## General

- do not introduce duplicate systems
- prefer extending existing models and helpers
- keep logic out of UI components when possible
