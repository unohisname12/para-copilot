// Assignment manifest — the file the sped teacher gives a para.
//
// Contains: the para's name + email + their assigned students with
// real names attached (so the para's local Real Names vault gets
// populated immediately on import).
//
// The cloud copy of the assignment is created at the same time the
// manifest is exported (via assignStudents). The manifest itself
// stays on the device — it never uploads.

const MANIFEST_VERSION = '1.0';

export function buildAssignmentManifest({ paraName, paraEmail, students, teamLabel = '' }) {
  return {
    type: 'paraAssignmentManifest',
    version: MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    teamLabel,
    para: {
      name: paraName || '',
      email: (paraEmail || '').toLowerCase().trim(),
    },
    students: students.map(s => ({
      studentId: s.id,
      paraAppNumber: s.studentUid || s.student_uid || s.studentId || s.id,
      pseudonym: s.pseudonym || '',
      color: s.color || '',
      realName: s.realName || '',
      periodId: s.periodId || s.period_id || '',
    })),
  };
}

export function downloadManifest(manifest) {
  const safeName = (manifest.para?.name || 'para').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'para';
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supapara-students-for-${safeName}-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function validateManifest(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json))
    return 'That file does not look right.';
  if (json.type !== 'paraAssignmentManifest')
    return "That file isn't a SupaPara student assignment file.";
  if (!Array.isArray(json.students) || json.students.length === 0)
    return 'No students found in that file.';
  for (const s of json.students) {
    if (!s.studentId && !s.paraAppNumber)
      return 'A student in that file is missing a Para App Number.';
  }
  return null;
}

export async function readManifestFromFile(file) {
  const text = await file.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("Could not read that file. Make sure it's the assignment file the sped teacher sent you."); }
  const err = validateManifest(json);
  if (err) throw new Error(err);
  return json;
}

// Convert a manifest into entries the local Real Names vault accepts.
// Drops anything without a real name (the para can still see pseudonyms).
export function manifestToVaultEntries(manifest) {
  return (manifest.students || [])
    .filter(s => s.realName && s.realName.trim())
    .map(s => ({
      studentId: s.studentId || null,
      pseudonym: s.pseudonym || '',
      realName: s.realName.trim(),
      color: s.color || '',
      periodIds: s.periodId ? [s.periodId] : [],
      classLabels: {},
    }));
}
