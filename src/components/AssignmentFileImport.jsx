import React, { useRef, useState } from 'react';
import { readManifestFromFile, manifestToVaultEntries } from '../utils/assignmentManifest';
import { claimPendingAssignments } from '../services/paraAssignments';

// Para's "Load my students" widget. They drop the file the sped teacher
// emailed them. The local Real Names vault populates immediately so they
// see real names. The cloud already has the assignment — server-side
// RLS shows them only their assigned students once they're signed in.

export default function AssignmentFileImport({ collapsed = false, onIdentityLoad, onImported }) {
  const fileRef = useRef();
  const [status, setStatus] = useState(null); // { tone, text } | null

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    try {
      const manifest = await readManifestFromFile(file);
      const entries  = manifestToVaultEntries(manifest);
      if (entries.length && onIdentityLoad) onIdentityLoad(entries);
      await claimPendingAssignments();
      setStatus({
        tone: 'ok',
        text: `Loaded ${manifest.students.length} student${manifest.students.length === 1 ? '' : 's'}.`,
      });
      if (onImported) onImported(manifest);
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || String(err) });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="nav-btn"
        title="Load the student assignment file your sped teacher sent you"
        style={collapsed ? { justifyContent: 'center', padding: '8px 6px' } : null}
      >
        <span style={{ fontSize: 14 }}>📁</span>
        {!collapsed && <span style={{ marginLeft: 8 }}>Load my students</span>}
      </button>
      {status && !collapsed && (
        <div style={{
          marginTop: 4, marginBottom: 6,
          fontSize: 11, lineHeight: 1.5,
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          background: status.tone === 'ok' ? 'var(--green-muted)' : 'var(--red-muted)',
          color:      status.tone === 'ok' ? 'var(--green)'      : 'var(--red)',
        }}>
          {status.text}
        </div>
      )}
    </>
  );
}
