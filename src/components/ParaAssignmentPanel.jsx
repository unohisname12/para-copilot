import React, { useState, useMemo, useEffect } from 'react';
import { resolveLabel } from '../privacy/nameResolver';
import { listAssignments, assignStudents, unassignStudents } from '../services/paraAssignments';
import { buildAssignmentManifest, downloadManifest, downloadAssignmentCsv } from '../utils/assignmentManifest';

// Sped teacher / owner screen. Pick a para, check student boxes, save.
// Pre-register a para by email if they haven't signed in yet — the
// assignment binds when they sign in for the first time.
//
// Real names show locally only (pulled from VaultProvider via resolveLabel).
// The cloud only ever sees student IDs + email.

export default function ParaAssignmentPanel({ teamId, teamLabel = '', members = [], allStudents = {}, vaultNames = {} }) {
  const [pickedPara, setPickedPara]       = useState(null);  // { user_id, name, email } | null
  const [preRegName, setPreRegName]       = useState('');
  const [preRegEmail, setPreRegEmail]     = useState('');
  const [pickedStudents, setPickedStudents] = useState(new Set());
  const [assignments, setAssignments]     = useState([]);
  const [busy, setBusy]                   = useState(false);
  const [msg, setMsg]                     = useState(null);
  const [showMoreExports, setShowMoreExports] = useState(false);

  useEffect(() => { refresh(); }, [teamId]);

  async function refresh() {
    if (!teamId) return;
    const { data, error } = await listAssignments(teamId);
    if (error) { setMsg({ tone: 'error', text: error.message }); return; }
    setAssignments(data);
  }

  // What students are already assigned to the picked para?
  const currentlyAssigned = useMemo(() => {
    if (!pickedPara) return new Set();
    return new Set(
      assignments
        .filter(a => {
          if (pickedPara.user_id) return a.para_user_id === pickedPara.user_id;
          if (pickedPara.email)   return (a.pending_email || '').toLowerCase() === pickedPara.email.toLowerCase();
          return false;
        })
        .map(a => a.student_id)
    );
  }, [assignments, pickedPara]);

  // Pre-fill checkboxes with what's already assigned the moment a para is picked.
  useEffect(() => { setPickedStudents(new Set(currentlyAssigned)); }, [pickedPara]); // eslint-disable-line

  function toggleStudent(id) {
    setPickedStudents(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    if (!pickedPara) return;
    setBusy(true); setMsg(null);

    const targetUid   = pickedPara.user_id || null;
    const targetEmail = !targetUid ? pickedPara.email : null;
    const want   = pickedStudents;
    const have   = currentlyAssigned;
    const toAdd    = [...want].filter(id => !have.has(id));
    const toRemove = [...have].filter(id => !want.has(id));

    try {
      if (toAdd.length) {
        const { error } = await assignStudents({ teamId, paraUserId: targetUid, paraEmail: targetEmail, studentIds: toAdd });
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await unassignStudents({ teamId, paraUserId: targetUid, paraEmail: targetEmail, studentIds: toRemove });
        if (error) throw error;
      }
      setMsg({ tone: 'ok', text: `Saved. ${toAdd.length} added, ${toRemove.length} removed.` });
      await refresh();
    } catch (e) {
      setMsg({ tone: 'error', text: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  // Build the student records used by both export formats (JSON manifest + CSV).
  function pickedStudentRecords() {
    return [...pickedStudents]
      .map(id => allStudents[id])
      .filter(Boolean)
      .map(s => ({
        ...s,
        realName: vaultNames[s.id] || s.realName || '',
      }));
  }

  function exportManifestForPicked() {
    if (!pickedPara) return;
    const manifest = buildAssignmentManifest({
      paraName:  pickedPara.name || preRegName,
      paraEmail: pickedPara.email || preRegEmail,
      students:  pickedStudentRecords(),
      teamLabel,
    });
    downloadManifest(manifest);
    setMsg({ tone: 'ok', text: 'Assignment file downloaded. Email it to the para — they pick it up in "Find my students".' });
  }

  function exportCsvForPicked() {
    if (!pickedPara) return;
    const records = pickedStudentRecords();
    if (records.length === 0) {
      setMsg({ tone: 'error', text: 'Pick at least one student first.' });
      return;
    }
    const paraName = pickedPara.name || preRegName || pickedPara.email || 'para';
    downloadAssignmentCsv(paraName, records);
    setMsg({ tone: 'ok', text: `CSV downloaded with ${records.length} student${records.length === 1 ? '' : 's'}. The para can paste rows into "Find my students" or upload the file.` });
  }

  function pickExistingMember(m) {
    setPreRegName(''); setPreRegEmail('');
    setPickedPara({ user_id: m.user_id, name: m.display_name || m.name || '', email: m.email || '' });
  }
  function pickPreReg() {
    if (!preRegEmail.trim()) return;
    setPickedPara({ user_id: null, name: preRegName.trim(), email: preRegEmail.trim().toLowerCase() });
  }

  const studentList = Object.values(allStudents);

  return (
    <div style={{
      background: 'var(--panel-bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Step 1
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
          Pick a para
        </h3>
      </div>

      {/* Existing members */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {members.filter(m => m.role === 'para' || m.role === 'sub').map(m => {
          const active = pickedPara?.user_id === m.user_id;
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => pickExistingMember(m)}
              className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              style={{ minHeight: 36 }}
            >
              {m.display_name || m.name || m.email || 'para'}
            </button>
          );
        })}
        {members.filter(m => m.role === 'para' || m.role === 'sub').length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            No paras have joined yet. Pre-register one below 👇
          </div>
        )}
      </div>

      {/* Pre-registration */}
      <div style={{
        padding: 'var(--space-3)',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          ...or pre-register a para who hasn't signed in yet
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            value={preRegName}
            onChange={e => setPreRegName(e.target.value)}
            placeholder="Their name (optional)"
            className="chat-input"
            style={{ flex: '1 1 160px', minWidth: 140 }}
          />
          <input
            value={preRegEmail}
            onChange={e => setPreRegEmail(e.target.value)}
            placeholder="Their school email"
            className="chat-input"
            style={{ flex: '1 1 200px', minWidth: 180 }}
            type="email"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={pickPreReg}
            className={pickedPara && !pickedPara.user_id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            disabled={!preRegEmail.trim()}
          >
            Use this email
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          When the para signs in with this exact email, they'll auto-get the students you assign here.
        </div>
      </div>

      {/* Step 2 — students */}
      {pickedPara && (
        <>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Step 2
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              Pick their students
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {pickedStudents.size} of {studentList.length} selected · for {pickedPara.name || pickedPara.email}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 6,
            maxHeight: 360,
            overflowY: 'auto',
            padding: 4,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-dark)',
          }}>
            {studentList.map(s => {
              const checked = pickedStudents.has(s.id);
              const realName = vaultNames[s.id] || '';
              const display = realName || resolveLabel(s, 'compact');
              const num = s.studentUid || s.student_uid || s.id?.slice(0, 6);
              return (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: checked ? 'var(--accent-glow)' : 'transparent',
                    border: `1px solid ${checked ? 'var(--accent-border)' : 'transparent'}`,
                    cursor: 'pointer',
                    minHeight: 40,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStudent(s.id)}
                    style={{ flexShrink: 0 }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {display}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      #{num}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button onClick={save} disabled={busy} className="btn btn-primary">
              {busy ? 'Saving…' : 'Save assignment'}
            </button>
            <button
              onClick={exportCsvForPicked}
              disabled={pickedStudents.size === 0}
              className="btn btn-secondary"
              title="CSV — fastest, easy to edit in any spreadsheet"
            >
              📊 CSV — fastest, easy to edit later
            </button>
            {!showMoreExports && pickedStudents.size > 0 && (
              <button
                onClick={() => setShowMoreExports(true)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: 'var(--text-muted)' }}
                title="See another export format"
              >
                More options ▾
              </button>
            )}
            {showMoreExports && (
              <button
                onClick={exportManifestForPicked}
                disabled={pickedStudents.size === 0}
                className="btn btn-secondary"
                title="Full file — para gets real names auto-loaded when they drop it"
              >
                📦 Full file — para gets real names auto-loaded
              </button>
            )}
            <button
              onClick={() => { setPickedPara(null); setPickedStudents(new Set()); }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {msg && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          background: msg.tone === 'ok' ? 'var(--green-muted)' : 'var(--red-muted)',
          color:      msg.tone === 'ok' ? 'var(--green)'      : 'var(--red)',
          border: `1px solid ${msg.tone === 'ok' ? 'var(--green)' : 'var(--red)'}33`,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
