// ══════════════════════════════════════════════════════════════
// NAME RESOLVER — Single auditable gate for all name formatting
// and export decisions.
//
// Rules:
//   - resolveLabel  → the ONLY place display names are formatted
//   - resolveExportName → explicit export mode required (SAFE or PRIVATE)
//   - Real names may only appear in PRIVATE mode via a transient realNameMap
//   - realNameMap must be built at export time and disposed immediately
// ══════════════════════════════════════════════════════════════

import { getStudentLabel } from '../identity';

/**
 * EXPORT MODES
 * 'safe'    — pseudonym / identity label only (FERPA-safe, shareable)
 * 'private' — real name allowed (requires private roster loaded, local-only)
 */
export const EXPORT_MODE = {
  SAFE:    'safe',
  PRIVATE: 'private',
};

/**
 * Resolve a student's display label.
 * This is the canonical path for all display-facing name formatting.
 *
 * @param {object|null|undefined} student  — allStudents entry { id, pseudonym, identity }
 * @param {string} format                  — 'compact' | 'full'
 * @returns {string}
 */
export function resolveLabel(student, format = 'compact') {
  return getStudentLabel(student, format);
}

/**
 * Resolve a student's name for export.
 *
 * SAFE mode  → identity label / pseudonym (always available)
 * PRIVATE mode → realName from realNameMap if student.id is present;
 *                falls back to resolveLabel when not found
 *
 * @param {object}   student          — allStudents entry { id, pseudonym, identity }
 * @param {string}   mode             — EXPORT_MODE.SAFE | EXPORT_MODE.PRIVATE
 * @param {Map|null} [realNameMap]    — Map<studentId, realName>; required for PRIVATE mode
 * @returns {string}
 */
export function resolveExportName(student, mode, realNameMap = null) {
  if (mode === EXPORT_MODE.PRIVATE && realNameMap?.has(student?.id)) {
    return realNameMap.get(student.id);
  }
  return resolveLabel(student, 'compact');
}

/**
 * Resolve a student by studentId.
 * Prefer this over pseudonym-keyed lookups.
 *
 * @param {string} studentId
 * @param {object} allStudents — map keyed by studentId
 * @returns {object|undefined}
 */
export function resolveById(studentId, allStudents) {
  return allStudents[studentId];
}

/**
 * Build a transient Map<studentId, realName> from identityRegistry.
 * Build at export time only. Dispose immediately after use.
 * Never store in app state.
 *
 * @param {Array} identityRegistry — [{ studentId, realName, ... }]
 * @returns {Map<string, string>}
 */
export function buildRealNameMap(identityRegistry) {
  const map = new Map();
  identityRegistry.forEach(entry => {
    if (entry.studentId && entry.realName) {
      map.set(entry.studentId, entry.realName);
    }
  });
  return map;
}
