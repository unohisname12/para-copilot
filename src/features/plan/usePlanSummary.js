import { useState, useCallback } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { geminiSummarizePlan } from '../../engine/cloudAI';

// Small string hash used as cache key. We re-summarize whenever the
// source text changes; identical text → same hash → use cached result.
function hashText(text) {
  let h = 5381;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

// Per-period-per-day persisted plan summary.
// Stored object: { hash, source, plan: { topic, objectives, vocab, activities, para_focus } }
export function usePlanSummary(activePeriod, currentDate) {
  const key = `planSummary_${activePeriod}_${currentDate}`;
  const [stored, setStored] = useLocalStorage(key, null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const summarize = useCallback(async (text, source = 'doc') => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      setStored(null);
      return null;
    }
    const hash = hashText(trimmed);
    if (stored && stored.hash === hash && stored.plan) {
      return stored.plan;
    }
    setLoading(true);
    setError(null);
    try {
      const plan = await geminiSummarizePlan(trimmed);
      if (plan) {
        const next = { hash, source, plan, generatedAt: Date.now() };
        setStored(next);
        return plan;
      }
      return null;
    } catch (e) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [stored, setStored]);

  const clear = useCallback(() => {
    setStored(null);
    setError(null);
  }, [setStored]);

  return {
    plan: stored?.plan || null,
    source: stored?.source || null,
    loading,
    error,
    summarize,
    clear,
  };
}
