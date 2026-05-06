import React, { useRef, useState, useMemo } from 'react';
import { useEscape } from '../hooks/useEscape';
import { parseRosterFile, parseRosterCsv } from '../features/import/rosterParsers';
import {
  readManifestFromFile,
  manifestToVaultEntries,
} from '../utils/assignmentManifest';
import { claimPendingAssignments } from '../services/paraAssignments';
import { useVault } from '../context/VaultProvider';
import {
  groupByParaAppNumber,
  chooseCanonical,
  buildHiddenSet,
} from '../features/find-students/findStudentsLogic';
import { resolveLabel } from '../privacy/nameResolver';
import PrivacyName from './PrivacyName';

// One screen, one job: get the para's students loaded so they see
// real names + IEP info. Smart-routes based on what they hand it:
//   - CSV / TXT / MD / PDF / generic JSON → name-list parser
//   - JSON with type=paraAssignmentManifest → assignment manifest path
//
// Plain English throughout. The whole point is the para does the
// LEAST work for the MOST reward.

const TEMPLATE_CSV = `Name,ParaAppNumber
Maria Lopez,847293
James Chen,102938
Aiden Brown,449112
`;

export default function FindMyStudentsModal({
  open,
  onClose,
  onIdentityLoad,
  // Optional props that unlock the duplicate-scan tab. When omitted the
  // modal still works as a pure roster-import surface.
  allStudents = null,
  logs = null,
  hiddenStudentIds = null,
  onHideStudents = null,
  onUnhideStudents = null,
  onClearHidden = null,
  // Allowlist controls — when present, FMS treats the upload as the
  // authoritative roster. Cloud rows whose paraAppNumber isn't in the
  // allowlist are filtered out of the visible roster until the para
  // clears the lock.
  allowedKeys = null,
  onSetAllowlist = null,
  onClearAllowlist = null,
}) {
  const fileRef = useRef();
  const vault   = useVault();
  const [paste, setPaste]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null); // { found, errors }
  const [tab, setTab]         = useState('find'); // 'find' | 'scan'
  // { kind: 'success' | 'error' | 'info', message } — surfaced under the
  // active tab so the para sees the result of every action they take.
  const [feedback, setFeedback] = useState(null);

  // Counts logs per studentId so chooseCanonical can pick the row holding
  // the most history. Recomputed only when logs reference changes.
  const logCounts = useMemo(() => {
    const out = {};
    if (!Array.isArray(logs)) return out;
    for (const l of logs) {
      const id = l?.studentId || l?.student_id;
      if (!id) continue;
      out[id] = (out[id] || 0) + 1;
    }
    return out;
  }, [logs]);

  const hiddenSet = useMemo(
    () => new Set(Array.isArray(hiddenStudentIds) ? hiddenStudentIds : []),
    [hiddenStudentIds]
  );

  const dupScan = useMemo(() => {
    if (!allStudents) return { groups: [], unkeyed: [] };
    return groupByParaAppNumber(allStudents);
  }, [allStudents]);

  const visibleDupGroups = useMemo(
    () => dupScan.groups.map((g) => ({
      ...g,
      visibleRows: g.rows.filter((s) => !hiddenSet.has(s.id)),
    })).filter((g) => g.visibleRows.length >= 2),
    [dupScan.groups, hiddenSet]
  );

  const flashFeedback = (kind, message, ms = 4500) => {
    setFeedback({ kind, message });
    if (ms > 0) setTimeout(() => setFeedback((f) => (f && f.message === message ? null : f)), ms);
  };

  useEscape(open ? onClose : () => {});
  if (!open) return null;

  function close() {
    setResult(null); setPaste('');
    onClose?.();
  }

  async function handleEntries(entries, errors = []) {
    if (!entries || entries.length === 0) {
      setResult({ found: 0, errors: errors.length ? errors : ['No students found in that input.'] });
      flashFeedback('error', 'Nothing matched. Check the file format and try again.');
      return;
    }
    if (onIdentityLoad) onIdentityLoad(entries);
    try { await claimPendingAssignments(); } catch {}
    // Lock the visible roster to ONLY these paraAppNumbers — the upload is
    // the source of truth. Anything not in the upload is hidden until the
    // para clears the lock from this modal.
    const keys = entries
      .map((e) => e?.paraAppNumber || e?.externalKey || e?.key)
      .filter(Boolean);
    let lockedCount = 0;
    if (onSetAllowlist && keys.length > 0) {
      lockedCount = onSetAllowlist(keys);
    }
    setResult({ found: entries.length, errors, locked: lockedCount });
    flashFeedback(
      'success',
      lockedCount > 0
        ? `Loaded ${entries.length} student${entries.length === 1 ? '' : 's'} and locked your roster to ${lockedCount} key${lockedCount === 1 ? '' : 's'}. Anything not in your upload is now hidden.`
        : `Loaded ${entries.length} student${entries.length === 1 ? '' : 's'}.`
    );
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      // Try as assignment manifest first (JSON only, special type field).
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const manifest = await readManifestFromFile(file);
          await handleEntries(manifestToVaultEntries(manifest));
          return;
        } catch {
          // not a manifest — fall through to roster parser
        }
      }
      const { entries, errors } = await parseRosterFile(file);
      await handleEntries(entries, errors);
    } catch (err) {
      setResult({ found: 0, errors: [err.message || String(err)] });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handlePasteSubmit() {
    if (!paste.trim()) return;
    setBusy(true); setResult(null);
    const { entries, errors } = parseRosterCsv(paste);
    await handleEntries(entries, errors);
    setBusy(false);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-students-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay">
      {/* Backdrop click intentionally does NOT close — paras kept losing
          mid-import context when they tapped outside. Use X or Esc. */}
      <div
        className="modal-content"
        style={{ maxWidth: 600, width: '100%' }}
      >
        <div className="modal-header">
          <div>
            <div style={hat}>Para</div>
            <div style={title}>Find your students</div>
            <div style={sub}>
              Tell us who you support. We'll match them to the team's records and load their IEP info + real names — local to this computer only.
            </div>
          </div>
          <button onClick={close} className="close-btn" aria-label="Close">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Lock status — surfaces whether the visible roster is currently
              constrained to a previously-uploaded list */}
          {Array.isArray(allowedKeys) && allowedKeys.length > 0 && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(167,139,250,0.10)',
              border: '1px solid rgba(167,139,250,0.40)',
              color: '#c4b5fd',
              fontSize: 12, lineHeight: 1.55,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#c4b5fd' }}>
                  Roster locked to {allowedKeys.length} student{allowedKeys.length === 1 ? '' : 's'} from your last upload.
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Anything in the cloud that isn't in your list stays hidden. Re-upload to update the lock.
                </div>
              </div>
              {onClearAllowlist && (
                <button
                  type="button"
                  onClick={() => {
                    onClearAllowlist();
                    flashFeedback('info', 'Roster lock cleared. Every assigned student is back.');
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ minHeight: 36 }}
                >
                  Clear lock
                </button>
              )}
            </div>
          )}

          {/* Tab switcher — only shown when the duplicate-scan tab has props */}
          {allStudents && (
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              {[
                ['find', '🔎 Find / import students'],
                ['scan', `🧹 Clean up duplicates${dupScan.groups.length > 0 ? ` (${dupScan.groups.length})` : ''}`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setTab(id); setFeedback(null); }}
                  className="sm-qa-btn"
                  style={{
                    flex: 1, minHeight: 40, padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: tab === id ? 'var(--grad-primary)' : 'transparent',
                    color: tab === id ? '#fff' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >{label}</button>
              ))}
            </div>
          )}

          {feedback && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: feedback.kind === 'success' ? 'var(--green-muted)'
                : feedback.kind === 'error' ? 'var(--red-muted)'
                : 'var(--bg-surface)',
              border: `1px solid ${feedback.kind === 'success' ? 'var(--green)'
                : feedback.kind === 'error' ? 'var(--red)'
                : 'var(--border)'}55`,
              color: feedback.kind === 'success' ? 'var(--green)'
                : feedback.kind === 'error' ? 'var(--red)'
                : 'var(--text-primary)',
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>{feedback.kind === 'success' ? '✓ ' : feedback.kind === 'error' ? '⚠ ' : 'ℹ '}{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss"
                style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
              >×</button>
            </div>
          )}

          {tab === 'scan' && allStudents && (
            <DuplicateScan
              groups={visibleDupGroups}
              unkeyed={dupScan.unkeyed}
              hiddenSet={hiddenSet}
              logCounts={logCounts}
              onHide={(group) => {
                if (!onHideStudents) {
                  flashFeedback('error', 'Hide action is not wired up. Tell Dre.');
                  return;
                }
                const canon = chooseCanonical(group.visibleRows, logCounts);
                const ids = buildHiddenSet({ rows: group.visibleRows }, canon?.id);
                if (ids.length === 0) {
                  flashFeedback('info', 'Nothing to hide — only one copy left.');
                  return;
                }
                onHideStudents(ids);
                const keepLabel = canon ? resolveLabel(canon, 'compact') : 'one copy';
                flashFeedback('success', `Hid ${ids.length} duplicate${ids.length === 1 ? '' : 's'} of ${keepLabel}. Kept the row with the most history.`);
              }}
              onHideOne={(idToHide, keepRow) => {
                if (!onHideStudents) {
                  flashFeedback('error', 'Hide action is not wired up.');
                  return;
                }
                onHideStudents([idToHide]);
                const keepLabel = keepRow ? resolveLabel(keepRow, 'compact') : 'the other copy';
                flashFeedback('success', `Hidden. ${keepLabel} stays.`);
              }}
              onAutoHideAll={() => {
                if (!onHideStudents) {
                  flashFeedback('error', 'Hide action is not wired up.');
                  return;
                }
                let hiddenCount = 0;
                let groupCount = 0;
                const all = [];
                visibleDupGroups.forEach((g) => {
                  const canon = chooseCanonical(g.visibleRows, logCounts);
                  const ids = buildHiddenSet({ rows: g.visibleRows }, canon?.id);
                  if (ids.length > 0) {
                    all.push(...ids);
                    hiddenCount += ids.length;
                    groupCount += 1;
                  }
                });
                if (all.length === 0) {
                  flashFeedback('info', 'No duplicates left to clean up.');
                  return;
                }
                onHideStudents(all);
                flashFeedback('success', `Cleaned ${groupCount} duplicate group${groupCount === 1 ? '' : 's'} — hid ${hiddenCount} extra row${hiddenCount === 1 ? '' : 's'}.`);
              }}
              onUnhideAll={() => {
                if (!onClearHidden) {
                  flashFeedback('error', 'Unhide is not wired up.');
                  return;
                }
                onClearHidden();
                flashFeedback('info', 'Hidden list cleared. Every duplicate is back.');
              }}
              hiddenCount={hiddenSet.size}
            />
          )}

          {tab !== 'scan' && (<>

          {/* Path A — quick paste */}
          <section style={section}>
            <div style={sectionHat}>Easiest way</div>
            <div style={sectionTitle}>Type or paste names + Para App Numbers</div>
            <textarea
              spellCheck="false"
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder={'Maria Lopez, 847293\nJames Chen, 102938\nAiden Brown, 449112'}
              className="data-textarea"
              style={{ width: '100%', minHeight: 110, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!paste.trim() || busy}
                className="btn btn-primary"
              >
                {busy ? 'Looking…' : 'Find these students'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                One per line. Order doesn't matter — we figure out the 6-digit number.
              </span>
            </div>
          </section>

          <div style={divider}>or</div>

          {/* Path B — file upload */}
          <section style={section}>
            <div style={sectionHat}>Got a file from your sped teacher?</div>
            <div style={sectionTitle}>Drop it here</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              CSV, name list, assignment file, PDF — we figure it out.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.md,.txt,.pdf"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-secondary"
                disabled={busy}
              >
                {busy ? 'Reading…' : '📁 Pick a file'}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn btn-ghost"
                title="Download a CSV with example rows you can fill out"
              >
                ⬇ Download template
              </button>
            </div>
          </section>

          {/* Result */}
          {result && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: result.found > 0 ? 'var(--green-muted)' : 'var(--red-muted)',
                border: `1px solid ${result.found > 0 ? 'var(--green)' : 'var(--red)'}33`,
                color: result.found > 0 ? 'var(--green)' : 'var(--red)',
                fontSize: 13, lineHeight: 1.55,
              }}
            >
              {result.found > 0 ? (
                <strong>✓ Loaded {result.found} student{result.found === 1 ? '' : 's'}.</strong>
              ) : (
                <strong>Nothing was loaded.</strong>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul style={{ marginTop: 6, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12 }}>
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {result.found > 0 && (
                <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                  Real names show only on this computer. The cloud only sees the 6-digit numbers.
                </div>
              )}
            </div>
          )}

          {/* Persistence prompt — only after a successful load AND when
              the para isn't already remembering. Saves them from re-uploading
              every browser session. */}
          {result?.found > 0 && !vault?.persisted && vault?.requestEnablePersistence && (
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-light)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>💾</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Skip this next time?
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
                  Right now, names disappear when you close the browser. Turn on "Remember on this device" so they stick around. Auto-wipes after 14 days of inactivity. Real names still never leave this computer.
                </div>
              </div>
              <button
                type="button"
                onClick={() => vault.requestEnablePersistence()}
                className="btn btn-primary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                Remember on this device
              </button>
            </div>
          )}

          {/* Already-remembering badge — calm reassurance */}
          {result?.found > 0 && vault?.persisted && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--green-muted)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: 'var(--green)',
              fontSize: 12, lineHeight: 1.5,
            }}>
              💾 Names are remembered on this device — you won't have to re-upload next time.
            </div>
          )}

          </>)}
        </div>

        <div className="modal-footer">
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            flex: 1,
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>If a student isn't found:</strong> they probably haven't been loaded yet. Ask your sped teacher to load them, or import an IEP file yourself in <strong style={{ color: 'var(--text-secondary)' }}>IEP Import</strong>.
          </div>
          <button onClick={close} className="btn btn-secondary" style={{ minHeight: 44 }}>
            {result?.found > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

const hat = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.12em',
};
const title = { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginTop: 2 };
const sub   = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6, maxWidth: 460 };

const section = { display: 'flex', flexDirection: 'column', gap: 8 };
const sectionHat   = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' };
const sectionTitle = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' };

const divider = {
  alignSelf: 'center',
  fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.2em',
};

// ── Duplicate scan UI ─────────────────────────────────────────
//
// One card per duplicate group. Each card lists every copy of that kid
// with its log count, period(s), and student id. The "Keep this one"
// action stamps the rest into the hidden list. "Auto-clean all" wipes
// every visible duplicate at once using the chooseCanonical heuristic.
function DuplicateScan({ groups, unkeyed, hiddenSet, logCounts, onHide, onHideOne, onAutoHideAll, onUnhideAll, hiddenCount }) {
  if (groups.length === 0 && hiddenCount === 0) {
    return (
      <div style={{
        padding: '20px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--green-muted)',
        border: '1px solid rgba(34,197,94,0.25)',
        color: 'var(--green)',
        fontSize: 14, fontWeight: 600,
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        ✓ No duplicate students detected on this device.
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontWeight: 400 }}>
          {unkeyed.length > 0
            ? `${unkeyed.length} student${unkeyed.length === 1 ? ' has' : 's have'} no Para App Number — those can't be deduped automatically.`
            : 'Every student has a unique Para App Number.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {groups.length === 0 ? 'No active duplicates' : `${groups.length} duplicate group${groups.length === 1 ? '' : 's'} found`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Same kid imported twice. Hidden rows stay in the database — only this device hides them.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {groups.length > 0 && (
            <button type="button" onClick={onAutoHideAll} className="btn btn-primary btn-sm" style={{ minHeight: 36 }}>
              Auto-clean all ({groups.length})
            </button>
          )}
          {hiddenCount > 0 && (
            <button type="button" onClick={onUnhideAll} className="btn btn-ghost btn-sm" style={{ minHeight: 36 }} title="Restore every hidden student to the dashboard.">
              Restore {hiddenCount} hidden
            </button>
          )}
        </div>
      </div>

      {groups.map((g) => (
        <DuplicateCard
          key={g.key}
          group={g}
          logCounts={logCounts}
          hiddenSet={hiddenSet}
          onHide={() => onHide(g)}
          onHideOne={onHideOne}
        />
      ))}

      {unkeyed.length > 0 && (
        <div style={{
          marginTop: 6,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-light)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
        }}>
          ⚠ {unkeyed.length} student{unkeyed.length === 1 ? ' has' : 's have'} no Para App Number — those can't be auto-deduped. Re-import them with a number to fix.
        </div>
      )}
    </div>
  );
}

function DuplicateCard({ group, logCounts, hiddenSet, onHide, onHideOne }) {
  const visible = group.rows.filter((s) => !hiddenSet.has(s.id));
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-surface)',
      border: '2px solid rgba(251,191,36,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {visible.length} copies · key {group.key}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            <PrivacyName>{resolveLabel(visible[0] || group.rows[0], 'compact')}</PrivacyName>
          </div>
        </div>
        <button type="button" onClick={onHide} className="btn btn-primary btn-sm" style={{ minHeight: 36 }}>
          Keep best, hide the rest
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((s) => {
          const periods = Array.isArray(s.periodIds) && s.periodIds.length
            ? s.periodIds.join(', ')
            : (s.periodId || '—');
          const logs = logCounts[s.id] || 0;
          const keepRow = visible.find((r) => r.id !== s.id) || null;
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-dark)',
              fontSize: 12, color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: '1 1 200px', minWidth: 0, color: 'var(--text-primary)' }}>
                <PrivacyName>{resolveLabel(s, 'compact')}</PrivacyName>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                period {periods} · {logs} log{logs === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => onHideOne(s.id, keepRow)}
                className="btn btn-ghost btn-sm"
                style={{ minHeight: 32, fontSize: 11, color: 'var(--text-muted)' }}
                title={`Hide this copy on this device. The other copy stays.`}
              >
                Hide this one
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
