import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { applyFixWithCursor } from '../utils/grammarFix';
import { polishText } from '../utils/spellPolish';
import { ollamaPolishText } from '../engine/ollama';

// Single source of truth for the auto-grammar-fix toggle. Read it anywhere
// to know whether to apply the cleanup; write through setEnabled to flip.
// Persisted under paraAutoGrammarFixV1 (default: on).
export function useGrammarFixSetting() {
  const [enabled, setEnabled] = useLocalStorage('paraAutoGrammarFixV1', true);
  return [enabled, setEnabled];
}

// Reusable cursor-preserving auto-grammar-fix for any controlled textarea.
//
// Usage:
//   const ref = useRef(null);
//   const [autoFix] = useGrammarFixSetting();
//   useAutoGrammarFix({ value: text, setValue: setText, ref, enabled: autoFix });
//   // <textarea ref={ref} value={text} onChange={e => setText(e.target.value)} ... />
//
// Behavior:
//   - 1.5s after the user stops typing, runs applyFixWithCursor on the text
//   - If the fix changes anything, updates value AND restores selection on the
//     next animation frame so the cursor doesn't visibly jump
//   - Ignores empty input, disabled state, and missing ref (safe no-op)
export function useAutoGrammarFix({ value, setValue, ref, enabled, delayMs = 1500 }) {
  useEffect(() => {
    if (!enabled || !value || typeof setValue !== 'function') return;
    let cancelled = false;
    const t = setTimeout(() => {
      const ta = ref?.current;
      const cursor = ta && typeof ta.selectionStart === 'number' ? ta.selectionStart : value.length;
      const firstPass = polishText(value).polished;
      const { text: fixed, cursor: newCursor } = applyFixWithCursor(firstPass, Math.min(cursor, firstPass.length));
      if (fixed !== value) {
        setValue(fixed);
        requestAnimationFrame(() => {
          if (ref?.current && typeof ref.current.setSelectionRange === 'function') {
            ref.current.setSelectionRange(newCursor, newCursor);
          }
        });
      }
      if (String(value).trim().length < 12 || String(value).length > 700) return;
      ollamaPolishText(fixed).then(aiFixed => {
        if (cancelled || !aiFixed || aiFixed === fixed) return;
        setValue(aiFixed);
        requestAnimationFrame(() => {
          if (ref?.current && typeof ref.current.setSelectionRange === 'function') {
            const pos = Math.min(aiFixed.length, newCursor);
            ref.current.setSelectionRange(pos, pos);
          }
        });
      }).catch(() => {});
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, enabled, delayMs]);
}
