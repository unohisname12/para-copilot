// ══════════════════════════════════════════════════════════════
// LOCAL BACKUP — write generated JSON files to the user's Downloads
// (or a chosen folder via File System Access API if supported).
//
// Two files are saved after a Smart Import so the admin can always
// SEE where the student data lives on disk:
//
//   1. supapara-bundle-YYYY-MM-DD-HHMM.json
//      The pseudonymous bundle (normalizedStudents + metadata).
//      Safe to email / share. No real names.
//
//   2. supapara-private-roster-YYYY-MM-DD-HHMM.json
//      The realName ↔ paraAppNumber map. Stays on the device.
//      Contains PII. Treat carefully.
//
// Also writes a README.txt explaining what each file is.
// ══════════════════════════════════════════════════════════════

// Choose a download directory handle (Chrome/Edge only) and remember
// it for future saves. Returns null on unsupported browsers — caller
// falls back to plain downloads.
const HANDLE_STORAGE_KEY = 'supapara_backup_dir_v1';

// File System Access API is behind a feature flag on some browsers
// and unavailable on Firefox/Safari. We always fall back gracefully.
const fsaSupported = () =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

// ── Helpers ──────────────────────────────────────────────────

function timestampSlug() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function writeToDirectory(dirHandle, filename, contents) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

// ── Public API ───────────────────────────────────────────────

// Prompt the user to pick a backup folder. Only works on Chromium browsers.
// Returns true if a folder was picked (and handle saved).
export async function pickBackupFolder() {
  if (!fsaSupported()) return false;
  try {
    const handle = await window.showDirectoryPicker({
      id: 'supapara-backup',
      mode: 'readwrite',
      startIn: 'documents',
    });
    // Persist the handle in IndexedDB so it survives refresh.
    await saveHandle(handle);
    return true;
  } catch (e) {
    // User cancelled
    return false;
  }
}

// Forget the chosen folder — next save will re-prompt or fall back to Downloads.
export async function clearBackupFolder() {
  try {
    const db = await openHandleDb();
    const tx = db.transaction('handles', 'readwrite');
    await requestToPromise(tx.objectStore('handles').delete(HANDLE_STORAGE_KEY));
  } catch {}
}

export async function getBackupFolderName() {
  try {
    const h = await loadHandle();
    return h?.name || null;
  } catch { return null; }
}

// Writes the backup files. Returns { method, folderName, filenames } so the UI
// can show the admin exactly where the files went.
export async function saveBundleLocally(bundle, privateRosterEntries) {
  const slug = timestampSlug();
  const bundleName = `supapara-bundle-${slug}.json`;
  const rosterName = `supapara-private-roster-${slug}.json`;
  const readmeName = `supapara-README.txt`;

  // Bundle: pseudonymous IEP data. Stripped of any real names just to be safe.
  const bundleBlob = new Blob(
    [JSON.stringify(sanitizeBundle(bundle), null, 2)],
    { type: 'application/json' }
  );

  // Private roster: real names + Para App Numbers. Local-only.
  const rosterPayload = {
    type: 'privateRoster',
    schemaVersion: '2.0',
    warning: 'This file contains real student names. Keep it on this device. Do not email, do not upload, do not sync to shared drives.',
    createdAt: new Date().toISOString(),
    students: privateRosterEntries,
  };
  const rosterBlob = new Blob(
    [JSON.stringify(rosterPayload, null, 2)],
    { type: 'application/json' }
  );

  // README: plain-text explanation for the admin.
  const readme = [
    'SupaPara — backup files',
    '=======================',
    '',
    'This folder contains two files created by SupaPara when you ran Smart Import:',
    '',
    `  1. ${bundleName}`,
    '     The pseudonymous student data — goals, accommodations, Para App Numbers.',
    '     Safe to share. No real names.',
    '',
    `  2. ${rosterName}`,
    '     The map of real student names to their 6-digit Para App Numbers.',
    '     KEEP THIS ON THIS DEVICE. It is the only file in the system that',
    '     can turn a Para App Number back into a real kid.',
    '',
    'To restore after a browser wipe:',
    '  1. Sign in again.',
    `  2. IEP Import → App Bundle JSON → upload ${bundleName}`,
    `  3. Sidebar → 👤 Private Roster → load ${rosterName}`,
    '',
    'Privacy check:',
    '  • The bundle file is safe.',
    '  • The private roster file contains real names. Treat it like a',
    '    confidential gradebook.',
    '  • If your device backs up Documents to the cloud automatically',
    '    (e.g. Google Drive, iCloud), consider moving the private roster',
    '    to a non-synced folder or disabling cloud backup for it.',
    '',
    `Created: ${new Date().toLocaleString()}`,
  ].join('\n');
  const readmeBlob = new Blob([readme], { type: 'text/plain' });

  // Try File System Access API first, fall back to downloads.
  const handle = await loadHandle().catch(() => null);
  if (handle) {
    try {
      // Verify we still have permission (user may have revoked).
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await handle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') throw new Error('permission denied');
      }
      await writeToDirectory(handle, bundleName, bundleBlob);
      await writeToDirectory(handle, rosterName, rosterBlob);
      await writeToDirectory(handle, readmeName, readmeBlob);
      return {
        method: 'folder',
        folderName: handle.name,
        filenames: [bundleName, rosterName, readmeName],
      };
    } catch (e) {
      // Fall through to downloads
      // eslint-disable-next-line no-console
      console.warn('[backup] folder write failed, falling back to downloads', e);
    }
  }

  downloadBlob(bundleBlob, bundleName);
  downloadBlob(rosterBlob, rosterName);
  downloadBlob(readmeBlob, readmeName);
  return {
    method: 'downloads',
    folderName: 'Downloads',
    filenames: [bundleName, rosterName, readmeName],
  };
}

// ── Belt-and-suspenders: scrub any realName leak from the bundle ─

function sanitizeBundle(bundle) {
  const clone = JSON.parse(JSON.stringify(bundle || {}));
  const UNSAFE_KEYS = /^(real_?name|student_?name|first_?name|last_?name|full_?name|display_?name)$/i;
  const walk = (v) => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    const out = {};
    Object.keys(v).forEach(k => {
      if (UNSAFE_KEYS.test(k)) return;
      out[k] = walk(v[k]);
    });
    return out;
  };
  // Only sanitize normalizedStudents — privateRosterMap is intentionally preserved
  // for the OTHER file, but this function only returns the pseudonymous bundle.
  return {
    schemaVersion: clone.schemaVersion || '2.0',
    datasetName: clone.datasetName || 'smart-import',
    normalizedStudents: walk(clone.normalizedStudents || {}),
  };
}

// ── IndexedDB persistence for the directory handle ───────────

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('supapara_backup_config', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveHandle(handle) {
  const db = await openHandleDb();
  const tx = db.transaction('handles', 'readwrite');
  await requestToPromise(tx.objectStore('handles').put(handle, HANDLE_STORAGE_KEY));
}
async function loadHandle() {
  try {
    const db = await openHandleDb();
    const tx = db.transaction('handles', 'readonly');
    return await requestToPromise(tx.objectStore('handles').get(HANDLE_STORAGE_KEY));
  } catch { return null; }
}

export { fsaSupported };
