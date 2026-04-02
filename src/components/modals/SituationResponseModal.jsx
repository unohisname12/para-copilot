import React from "react";
import { SUPPORT_CARDS, QUICK_ACTIONS, REG_TOOLS } from '../../data';
import { getStudentLabel } from '../../identity';

// ── Situation Response Modal ─────────────────────────────────
export function SituationResponseModal({ situation, students, onClose, onLog, onOpenCard, studentsMap }) {
  const cards = situation.recommendedCards.map(id => SUPPORT_CARDS.find(c => c.id === id)).filter(Boolean);
  const actions = situation.recommendedActions.map(id => QUICK_ACTIONS.find(a => a.id === id)).filter(Boolean);
  const tools = situation.recommendedTools.map(id => REG_TOOLS.find(t => t.id === id)).filter(Boolean);
  const lookup = studentsMap || {};
  const studs = students.map(id => ({ id, ...lookup[id] })).filter(s => s.pseudonym);
  const watchStudents = studs.filter(s => s.tags?.some(t => situation.tags.includes(t)));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "640px", maxWidth: "96vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: "#0c1a2e", borderBottom: "1px solid #1d4ed8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ fontSize: "28px" }}>{situation.icon}</span><div><div style={{ fontSize: "17px", fontWeight: "700" }}>{situation.title}</div><div style={{ fontSize: "12px", color: "#64748b" }}>{situation.tags.join(" · ")}{situation.score ? ` · ${situation.score} trigger match${situation.score > 1 ? "es" : ""}` : ""}</div></div></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>
          {watchStudents.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#fbbf24", marginBottom: "6px" }}>👀 Students to Watch</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{watchStudents.map(s => (<span key={s.id} style={{ fontSize: "12px", fontWeight: "600", color: s.color, background: s.color + "20", padding: "3px 10px", borderRadius: "20px" }}>{getStudentLabel(s, "compact")}</span>))}</div>
          </div>}
          <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#4ade80", marginBottom: "6px" }}>🎯 Recommended Moves</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>{actions.map(a => (
              <div key={a.id} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{a.icon} {a.label}</span>
                {studs.map(s => (<button key={s.id} onClick={() => onLog(s.id, a.defaultNote, a.logType)} className="btn btn-action" style={{ fontSize: "10px", padding: "2px 8px" }}>{getStudentLabel(s, "compact")}</button>))}
              </div>
            ))}</div>
          </div>
          {cards.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#60a5fa", marginBottom: "6px" }}>📋 Support Cards</div>
            {cards.map(c => (<div key={c.id} onClick={() => onOpenCard(c)} style={{ padding: "8px 12px", background: "#0f172a", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", borderLeft: "3px solid #3b82f6" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{c.title}</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{c.whenToUse}</div>
            </div>))}
          </div>}
          {tools.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#a78bfa", marginBottom: "6px" }}>🧰 Regulation Tools</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{tools.map(t => (<span key={t.id} style={{ fontSize: "12px", background: "#1a1a2e", color: "#a78bfa", padding: "4px 12px", borderRadius: "8px", border: "1px solid #4c1d95" }}>{t.icon} {t.name}</span>))}</div>
          </div>}
          {situation.followUp && <div style={{ background: "#1a1a0a", border: "1px solid #854d0e", borderRadius: "8px", padding: "10px 14px" }}><div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "600", marginBottom: "4px" }}>📝 Follow-up</div><div style={{ fontSize: "12px", color: "#fde68a" }}>{situation.followUp}</div></div>}
        </div>
      </div>
    </div>
  );
}
