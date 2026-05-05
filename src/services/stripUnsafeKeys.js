// FERPA guard. Removes keys that might carry real student names from any
// payload destined for the cloud. Used by teamSync.js before every write.

const UNSAFE_KEY_RE = /(?:real|student|first|last|full|display)[_-]?name/i;

export function containsUnsafeKey(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsUnsafeKey);
  for (const k of Object.keys(value)) {
    if (UNSAFE_KEY_RE.test(k)) return true;
    if (containsUnsafeKey(value[k])) return true;
  }
  return false;
}

export function stripUnsafeKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUnsafeKeys);
  const out = {};
  for (const k of Object.keys(value)) {
    if (UNSAFE_KEY_RE.test(k)) continue;
    out[k] = stripUnsafeKeys(value[k]);
  }
  return out;
}

// Dev-only assertion. Call in teamSync.js write paths.
// In production, silently strips; in development, throws so bugs show up in tests.
export function assertSafe(payload, label = 'payload') {
  if (containsUnsafeKey(payload)) {
    const msg = `FERPA guard: ${label} contains a real-name key. Strip before sending to cloud.`;
    if (process.env.NODE_ENV !== 'production') throw new Error(msg);
    // eslint-disable-next-line no-console
    console.error(msg);
  }
}
