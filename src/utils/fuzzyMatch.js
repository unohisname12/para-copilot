// Tiny fuzzy-match utilities for legacy import. Two functions:
//   normalizeName(s) — case-fold, strip diacritics, drop punctuation,
//   collapse whitespace. Idempotent. Used as the comparison key.
//   jaroWinkler(a, b) — similarity in [0,1]. Used for "did the user
//   misspell this?" decisions on rows that don't normalize-equal any
//   vault entry.
//
// No external deps — Jaro-Winkler is small enough to ship inline.

export function normalizeName(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .toLowerCase()
    .replace(/[\s\-]+/g, ' ')          // normalize hyphens and whitespace to spaces
    .replace(/[^\w\s]/g, '')           // drop all other punctuation
    .replace(/\s+/g, ' ')              // collapse runs of whitespace
    .trim();
}

// ── Jaro-Winkler similarity ─────────────────────────────────────────
// Jaro: matching window = floor(max(len)/2) - 1, transpositions /= 2.
// Winkler bonus: +0.1 * commonPrefix (up to 4 chars).

function jaro(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (bMatched[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  // count transpositions
  let transpositions = 0;
  let bIdx = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[bIdx]) bIdx++;
    if (a[i] !== b[bIdx]) transpositions++;
    bIdx++;
  }
  transpositions /= 2;
  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const j = jaro(a, b);
  if (j < 0.7) return j; // standard Winkler skip threshold
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}
