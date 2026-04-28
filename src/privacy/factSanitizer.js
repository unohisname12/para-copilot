// Strip real student names from Brain fact text before it gets written to
// Supabase. The Brain table is shared across the team and keyed by Para App
// Number, never by name — but a fact text like "Marcus loves Pokémon" would
// leak the real name into the cloud row. This module is the gate between
// what the para types and what the database sees.
//
// Same regex pattern as iepExtractor.stripNameFromSection, extended to walk
// every name in the local vault and substitute [student] (lowercase, since
// fact text is conversational).

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const escape = (s) => s.replace(ESCAPE_RE, '\\$&');

// Replace any token in `vault` that appears in `text` with [student].
// Returns { sanitized, foundNames } so the UI can show the para what got
// stripped before saving — transparency builds trust.
export function sanitizeFact(text, vault) {
  if (!text) return { sanitized: '', foundNames: [] };
  if (!vault || typeof vault !== 'object') return { sanitized: text, foundNames: [] };

  const names = Object.values(vault).filter(Boolean);
  if (names.length === 0) return { sanitized: text, foundNames: [] };

  let out = text;
  const found = new Set();

  for (const fullName of names) {
    const parts = String(fullName).split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;

    const first = escape(parts[0]);
    const last = parts.length > 1 ? escape(parts[parts.length - 1]) : '';

    // 1) Full name (with optional middle tokens, possessive ok)
    if (first && last) {
      const fullRe = new RegExp(`\\b${first}\\b(?:\\s+\\w+\\.?)*\\s+\\b${last}\\b('s)?`, 'gi');
      if (fullRe.test(out)) found.add(fullName);
      out = out.replace(fullRe, '[student]');
    }

    // 2) Individual first name occurrences (with possessive)
    if (first) {
      const firstRe = new RegExp(`\\b${first}('s)?\\b`, 'gi');
      if (firstRe.test(out)) found.add(fullName);
      out = out.replace(firstRe, '[student]');
    }

    // 3) Individual last name occurrences (with possessive)
    if (last) {
      const lastRe = new RegExp(`\\b${last}('s)?\\b`, 'gi');
      if (lastRe.test(out)) found.add(fullName);
      out = out.replace(lastRe, '[student]');
    }
  }

  // Collapse adjacent placeholders ("[student] [student]" → "[student]")
  // that arise when first + last both match in sequence.
  out = out.replace(/(\[student\]\s+){2,}/gi, '[student] ');

  return { sanitized: out.trim(), foundNames: Array.from(found) };
}

// Convenience wrapper for places that just want the safe string.
export function stripNamesFromFact(text, vault) {
  return sanitizeFact(text, vault).sanitized;
}
