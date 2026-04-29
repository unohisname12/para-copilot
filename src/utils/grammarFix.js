// Light grammar cleanup for para-written notes / topic.
//
// Stays gentle on purpose: paras shouldn't have to fight the editor. Only
// fixes things that are almost certainly mistakes — first-letter casing,
// post-punctuation casing, standalone "i" → "I", and runs of spaces.
//
// Stops short of:
//   - re-flowing line breaks (paras format on purpose)
//   - touching slang, abbreviations, or names
//   - adding/removing punctuation

export function applyLightGrammarFix(text) {
  if (text == null || text === '') return text;
  let s = String(text);

  // 1. Capitalize the very first letter (skip leading whitespace)
  s = s.replace(/^(\s*)([a-z])/, (_, ws, c) => ws + c.toUpperCase());

  // 2. Capitalize after sentence-ending punctuation OR a line break.
  //    Paras tend to use newlines as sentence boundaries (one thought per line).
  s = s.replace(/([.!?]\s+|\n+\s*)([a-z])/g, (_, p, c) => p + c.toUpperCase());

  // 3. Standalone lowercase "i" → "I" — only when surrounded by whitespace,
  //    line edges, or sentence punctuation. Doesn't touch "i" inside words.
  s = s.replace(/(^|[\s])i(?=$|[\s.,!?;:'"`)\]}])/g, (_, pre) => pre + 'I');

  // 4. Collapse runs of plain spaces/tabs (newlines preserved — paras format
  //    line breaks on purpose). Two or more horizontal spaces → one.
  s = s.replace(/[ \t]{2,}/g, ' ');

  return s;
}

// Cursor-preserving fix. Runs the same grammar rules but maps the original
// cursor position into the post-fix text by walking both strings together.
// Because every rule we apply is either a 1:1 case change or a space-collapse,
// we can advance through both in lockstep and skip extra spaces in the old.
export function applyFixWithCursor(text, cursorPos) {
  if (text == null || text === '') {
    return { text: text == null ? text : '', cursor: 0 };
  }
  const fixed = applyLightGrammarFix(text);
  if (fixed === text) {
    return { text, cursor: Math.max(0, Math.min(cursorPos, text.length)) };
  }
  const target = Math.max(0, Math.min(cursorPos, text.length));
  let oldI = 0;
  let newI = 0;
  while (oldI < target && oldI < text.length && newI < fixed.length) {
    const a = text[oldI];
    const b = fixed[newI];
    if (a === b || a.toLowerCase() === b.toLowerCase()) {
      oldI++; newI++;
    } else if (a === ' ' || a === '\t') {
      // Old had a space that got collapsed in new — skip it on the old side only
      oldI++;
    } else {
      // Unexpected mismatch — advance both, best-effort
      oldI++; newI++;
    }
  }
  return { text: fixed, cursor: Math.min(newI, fixed.length) };
}
