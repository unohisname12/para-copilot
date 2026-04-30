import { useEffect, useRef, useCallback } from 'react';

// Draft persistence for any textarea. Save while typing, hydrate on mount,
// clear explicitly when the para finishes the action (successful save).
//
// Why this exists:
//   Paras click around screens — they tap a different student, the modal
//   closes when they click outside it, the browser tab reloads on a flaky
//   wifi reconnect — and lose whatever they were typing. Every logging
//   textarea uses this hook so partial drafts always survive.
//
// Usage:
//   const draft = useDraft('logNote:p3:stu_001', value, setValue);
//   // ... <textarea value={value} onChange={...} />
//   // After successful save:
//   draft.clear();
//
// Storage:
//   Each draft lives at `paraDraftV1:<key>` in localStorage. Empty drafts
//   are removed (no orphan junk). Debounce is 300ms so typing isn't a
//   write storm. Hydration only runs once on mount, only when the
//   current value is empty (so "edit existing topic" still wins).
const PREFIX = 'paraDraftV1:';

export function draftStorageKey(key) {
  return `${PREFIX}${key}`;
}

export function useDraft(key, value, setValue, { debounceMs = 300 } = {}) {
  const initialMountRef = useRef(true);

  // Hydrate on mount AND whenever the key changes — same hook instance is
  // reused when a parent swaps the key per student/action, so the saved
  // draft for the new key needs to load (and any leftover text from the
  // previous key needs to clear). On the initial mount only, a non-empty
  // value wins so caller-supplied initial data isn't clobbered.
  useEffect(() => {
    if (!key || typeof setValue !== 'function') return;
    const isMount = initialMountRef.current;
    initialMountRef.current = false;
    if (isMount && value && String(value).trim() !== '') return;
    try {
      const saved = globalThis.localStorage?.getItem(draftStorageKey(key));
      if (saved && saved.trim()) setValue(saved);
      else if (!isMount) setValue('');
    } catch { /* localStorage may be disabled — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-save while typing (debounced).
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => {
      try {
        const k = draftStorageKey(key);
        if (value && String(value).trim()) {
          globalThis.localStorage?.setItem(k, value);
        } else {
          globalThis.localStorage?.removeItem(k);
        }
      } catch { /* ignore */ }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key, value, debounceMs]);

  // Explicit clear — call after the para successfully saves the action so
  // we don't keep stale text around for the next session.
  const clear = useCallback(() => {
    if (!key) return;
    try { globalThis.localStorage?.removeItem(draftStorageKey(key)); } catch { /* ignore */ }
  }, [key]);

  return { clear };
}

// Direct synchronous reader for places where we need the saved draft outside
// of a React render cycle (e.g., showing a "you had unsaved content" notice).
export function readDraft(key) {
  if (!key) return '';
  try { return globalThis.localStorage?.getItem(draftStorageKey(key)) || ''; }
  catch { return ''; }
}

export function clearDraft(key) {
  if (!key) return;
  try { globalThis.localStorage?.removeItem(draftStorageKey(key)); } catch { /* ignore */ }
}
