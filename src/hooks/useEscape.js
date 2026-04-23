import { useEffect } from 'react';

// Call onEscape() when the user presses Escape. Use in modals to guarantee
// a keyboard dismissal path (audit blocker if a modal stays open and
// intercepts all downstream pointer events).
export function useEscape(onEscape) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape]);
}
