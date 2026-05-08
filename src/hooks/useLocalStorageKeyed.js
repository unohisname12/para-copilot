import { useState, useEffect, useCallback, useRef } from 'react';

// localStorage-backed state where the storage KEY can change at runtime.
// On key change, re-reads from localStorage so the displayed value reflects
// the new key's stored content. Writes always target the current key.
//
// Existing useLocalStorage() in this repo is for STATIC keys; do not use it
// when the key is derived from props (e.g. activePeriod).
export function useLocalStorageKeyed(key, def) {
  // def intentionally captured at mount — change-of-default after mount
  // shouldn't retroactively re-init storage. Empty deps are correct here.
  const defRef = useRef(def);
  const read = useCallback((k) => {
    try {
      const s = localStorage.getItem(k);
      return s != null ? JSON.parse(s) : defRef.current;
    } catch { return defRef.current; }
  }, []);

  const [val, setVal] = useState(() => read(key));
  const lastKeyRef = useRef(key);

  useEffect(() => {
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setVal(read(key));
  }, [key, read]);

  const set = useCallback((v) => {
    setVal((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [val, set];
}
