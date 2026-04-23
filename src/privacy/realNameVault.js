// ══════════════════════════════════════════════════════════════
// REAL NAME VAULT
// Local-only map of { paraAppNumber → realName }. Never hits the network.
//
// Two modes:
//   - Session (default): in-memory only; cleared on refresh / close.
//   - Persisted (opt-in): IndexedDB on THIS device only, with a 14-day
//     inactivity auto-expire and a one-click purge.
//
// Real names never leave the device. Not serialized to localStorage
// (broader blast radius; IndexedDB is browser-scoped per origin).
// ══════════════════════════════════════════════════════════════

const DB_NAME = 'supapara_vault';
const DB_VERSION = 1;
const STORE = 'realNames';
const META_STORE = 'meta';
const META_KEY = 'state';

// Auto-purge if the vault hasn't been unlocked / touched in this many days.
export const INACTIVITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── IndexedDB plumbing ────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

// ── Meta: tracks whether persistence is on + last activity timestamp ──

async function readMeta() {
  try {
    const store = await tx(META_STORE);
    return await new Promise((resolve) => {
      const req = store.get(META_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function writeMeta(meta) {
  const store = await tx(META_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(meta, META_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Name store ────────────────────────────────────────────────

async function writeAllNames(map) {
  const store = await tx(STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const clear = store.clear();
    clear.onsuccess = () => {
      let pending = 0;
      if (!map || !Object.keys(map).length) { resolve(); return; }
      Object.entries(map).forEach(([key, name]) => {
        pending++;
        const req = store.put(name, key);
        req.onsuccess = () => { if (--pending === 0) resolve(); };
        req.onerror = () => reject(req.error);
      });
    };
    clear.onerror = () => reject(clear.error);
  });
}

async function readAllNames() {
  try {
    const store = await tx(STORE);
    return await new Promise((resolve) => {
      const keys = [];
      const values = [];
      const keyReq = store.getAllKeys();
      const valReq = store.getAll();
      keyReq.onsuccess = () => keys.push(...keyReq.result);
      valReq.onsuccess = () => {
        values.push(...valReq.result);
        const map = {};
        keys.forEach((k, i) => { map[k] = values[i]; });
        resolve(map);
      };
      valReq.onerror = () => resolve({});
    });
  } catch { return {}; }
}

async function wipeAll() {
  try {
    const store = await tx(STORE, 'readwrite');
    const metaStore = await tx(META_STORE, 'readwrite');
    return new Promise((resolve) => {
      let done = 0;
      const finish = () => { if (++done === 2) resolve(); };
      const a = store.clear();
      const b = metaStore.clear();
      a.onsuccess = finish; a.onerror = finish;
      b.onsuccess = finish; b.onerror = finish;
    });
  } catch { /* noop */ }
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

// Read saved state. Returns { enabled, lastActiveAt, names } or null.
export async function loadVault() {
  const meta = await readMeta();
  if (!meta?.enabled) return null;

  // Expire stale vaults
  if (meta.lastActiveAt && (Date.now() - meta.lastActiveAt) > INACTIVITY_DAYS * DAY_MS) {
    await wipeAll();
    return { expired: true };
  }

  const names = await readAllNames();
  return { enabled: true, lastActiveAt: meta.lastActiveAt || Date.now(), names };
}

// Enable persistence. Writes the provided names + a fresh lastActiveAt timestamp.
export async function enablePersistence(names) {
  await writeMeta({ enabled: true, lastActiveAt: Date.now(), enabledAt: Date.now() });
  await writeAllNames(names || {});
}

// Update the stored map (e.g. after an import loads additional names).
// Only writes if persistence is already enabled.
export async function updatePersistedNames(names) {
  const meta = await readMeta();
  if (!meta?.enabled) return false;
  await writeAllNames(names || {});
  await writeMeta({ ...meta, lastActiveAt: Date.now() });
  return true;
}

// Bump last-active timestamp (rolling expiry). Call on real user activity.
export async function touch() {
  const meta = await readMeta();
  if (!meta?.enabled) return;
  await writeMeta({ ...meta, lastActiveAt: Date.now() });
}

// Disable + wipe. Used by the purge button and sign-out.
export async function purge() {
  await wipeAll();
}

// Quick boolean — is persistence active?
export async function isPersistenceOn() {
  const meta = await readMeta();
  return Boolean(meta?.enabled);
}

// ── Session-mode helpers (pure) ───────────────────────────────
// These never touch IndexedDB; callers manage the in-memory map.

// Build { paraAppNumber → realName } map from an identity registry.
// Registry entries come from buildIdentityRegistry / normalizeIdentityEntries.
export function buildVaultFromRegistry(registry) {
  const out = {};
  (registry || []).forEach(e => {
    const key = (e.paraAppNumber || e.externalKey || '').toString().trim();
    if (key && e.realName) out[key] = e.realName;
  });
  return out;
}

// Look up a real name by Para App Number. Returns null if vault is empty or key missing.
export function resolveRealName(vault, paraAppNumber) {
  if (!vault || !paraAppNumber) return null;
  return vault[paraAppNumber.toString().trim()] || null;
}
