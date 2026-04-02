import React from "react";
import { getStudentLabel } from '../../identity';

// ── Email Modal ──────────────────────────────────────────────
export function EmailModal({ studentId, emailLoading, emailDraft, setEmailDraft, onClose, studentData }) {
  const s = studentData;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "560px" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div><div style={{ fontWeight: "700", fontSize: "16px" }}>AI Email Draft</div><div style={{ fontSize: "12px", color: s.color }}>{getStudentLabel(s, "compact")} → {s.caseManager}</div></div><button className="close-btn" onClick={onClose}>×</button></div>
        <div className="modal-body">{emailLoading ? (<div style={{ textAlign: "center", padding: "40px", color: "#4ade80" }}>AI drafting...</div>) : (<textarea value={emailDraft} onChange={e => setEmailDraft(e.target.value)} className="data-textarea" style={{ height: "260px", fontFamily: "inherit", lineHeight: "1.6" }} />)}</div>
        {!emailLoading && (<div className="modal-footer"><button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(emailDraft); alert("Copied!"); }}>Copy to Clipboard</button><button className="btn btn-secondary" onClick={onClose}>Close</button></div>)}
      </div>
    </div>
  );
}
