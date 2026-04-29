// Parent Notes panel — visible only to team admins (owner / sped_teacher).
// RLS on parent_notes enforces the same rule server-side; this is the UI gate.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTeamOptional } from '../context/TeamProvider';
import { listParentNotes, addParentNote, deleteParentNote } from '../services/teamSync';
import { useAutoGrammarFix, useGrammarFixSetting } from '../hooks/useAutoGrammarFix';

export default function ParentNotesSection({ studentDbId, studentLabel }) {
  const team = useTeamOptional();
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const draftRef = useRef(null);
  const [autoFix] = useGrammarFixSetting();
  useAutoGrammarFix({ value: draft, setValue: setDraft, ref: draftRef, enabled: autoFix });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = team?.isAdmin;
  const teamId = team?.activeTeamId;

  const refresh = useCallback(async () => {
    if (!isAdmin || !teamId || !studentDbId) { setNotes([]); return; }
    setLoading(true); setErr(null);
    try {
      const rows = await listParentNotes(teamId, studentDbId);
      setNotes(rows);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  }, [isAdmin, teamId, studentDbId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true); setErr(null);
    try {
      await addParentNote(teamId, studentDbId, draft.trim());
      setDraft('');
      await refresh();
    } catch (e2) {
      setErr(e2.message || String(e2));
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this parent note? Cannot be undone.')) return;
    try {
      await deleteParentNote(id);
      await refresh();
    } catch (e) { setErr(e.message); }
  }

  if (!team) return null;

  if (!isAdmin) {
    return (
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--bg-dark)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 12, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        Parent notes are visible only to the Special Ed Teacher for this team.
      </div>
    );
  }

  if (!studentDbId) {
    return (
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--bg-dark)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        This student doesn't have a cloud record yet, so parent notes can't be saved.
        (Imports push students to the team on save — once imported, this section becomes active.)
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)',
      }}>
        <span className="pill pill-violet" style={{ fontSize: 10 }}>🔒 Sped-only</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Only visible to Owner / Sped Teacher roles.
        </span>
      </div>

      <form onSubmit={handleAdd} style={{ marginBottom: 'var(--space-4)' }}>
        <textarea
          ref={draftRef}
          spellCheck="true"
          lang="en"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Notes from parent communication about ${studentLabel || 'this student'}…`}
          className="data-textarea"
          style={{ height: 80 }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? 'Saving…' : '+ Add parent note'}
          </button>
        </div>
      </form>

      {err && (
        <div style={{
          padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
          background: 'var(--red-muted)', color: 'var(--red)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 'var(--radius-md)', fontSize: 12,
        }}>{err}</div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>}

      {!loading && notes.length === 0 && (
        <div style={{
          padding: 'var(--space-4)', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic',
        }}>No parent notes yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {notes.map((n) => (
          <div key={n.id} className="panel" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 'var(--space-2)',
              marginBottom: 6,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(n.created_at).toLocaleString()}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, color: 'var(--red)', padding: '2px 8px' }}
                aria-label="Delete note"
                title="Delete note"
              >✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {n.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
