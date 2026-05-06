import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'paraCompactViewV1';
export const COMPACT_THRESHOLD_PX = 1366;

function readWidth() {
  if (typeof window === 'undefined') return 1920;
  return window.innerWidth || document.documentElement.clientWidth || 1920;
}

export function useCompactView() {
  const [override, setOverride] = useLocalStorage(STORAGE_KEY, 'auto');
  const [width, setWidth] = useState(readWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let raf = null;
    const handler = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(readWidth()));
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const compact = useMemo(() => {
    if (override === 'compact') return true;
    if (override === 'roomy') return false;
    return width < COMPACT_THRESHOLD_PX;
  }, [override, width]);

  const setMode = useCallback((mode) => {
    if (mode !== 'auto' && mode !== 'compact' && mode !== 'roomy') return;
    setOverride(mode);
  }, [setOverride]);

  return { compact, mode: override, setMode, width };
}

export function resolveCompactFromInputs({ override, width }) {
  if (override === 'compact') return true;
  if (override === 'roomy') return false;
  return width < COMPACT_THRESHOLD_PX;
}
