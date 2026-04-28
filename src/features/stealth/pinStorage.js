// ── Stealth-mode PIN storage ──────────────────────────────────
// 4-digit PIN gate for exiting Stealth Mode. Stops a curious kid who
// grabs the para's Chromebook from poking back into the real app.
//
// THIS IS A UX GATE, NOT A SECURITY BOUNDARY. A determined kid with
// DevTools can clear localStorage. The threat model is the curious 4th
// grader who picks up the laptop during recess — not a forensic attacker.
//
// PINs are SHA-256 hashed (Web Crypto) and base64-encoded before
// localStorage. Plaintext never hits storage. Web Crypto requires a secure
// context (HTTPS or localhost) — both prod (supapara.vercel.app) and dev
// (npm start on localhost) qualify.

const KEY = 'supapara_stealth_pin_v1';
// Marker so verifyPin() can tell "no PIN set" vs "PIN set but wrong."
const NO_PIN = null;

function isCryptoAvailable() {
  return typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.subtle !== 'undefined';
}

async function hash(pin) {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto unavailable — Stealth PIN requires HTTPS or localhost.');
  }
  const data = new TextEncoder().encode(String(pin));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  // base64-encode so it's a reasonable-length string in localStorage
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return globalThis.btoa(bin);
}

function readStored() {
  try { return globalThis.localStorage?.getItem(KEY) ?? NO_PIN; }
  catch { return NO_PIN; }
}

function writeStored(value) {
  try {
    if (value === null || value === undefined) globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, value);
    return true;
  } catch { return false; }
}

// Validate a candidate PIN string. Accepts 4 digits, all numeric.
export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// Store the hash of `pin`. Resolves true on success, false on validation
// failure. Throws if Web Crypto is unavailable.
export async function setPin(pin) {
  if (!isValidPin(pin)) return false;
  const h = await hash(pin);
  return writeStored(h);
}

// Compare a candidate PIN against the stored hash. Returns:
//   true  — PIN matches
//   false — PIN doesn't match, OR no PIN is set, OR input is invalid
// Note: if no PIN is set, this returns false — callers should check
// hasPin() first to differentiate "no PIN" from "wrong PIN."
export async function verifyPin(pin) {
  if (!isValidPin(pin)) return false;
  const stored = readStored();
  if (!stored) return false;
  const h = await hash(pin);
  return h === stored;
}

// True if a PIN is set on this device.
export function hasPin() {
  return Boolean(readStored());
}

// Wipe the stored PIN. Returns true if successful.
export function clearPin() {
  return writeStored(null);
}

// Test-only: expose the storage key. Don't use in app code.
export const _STORAGE_KEY = KEY;
