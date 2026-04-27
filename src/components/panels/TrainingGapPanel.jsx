// ── Training-Gap Agenda — "Topics for our next check-in" ─────────────
// Para presses Generate → engine runs JSON rule descriptors over their logs
// and surfaces 1-3 EBP-gap topics for the next sped-teacher meeting.
// Audit panel (Approach A): rule + threshold + matching logs, no nudge.
// Spec: docs/superpowers/specs/2026-04-26-training-gap-agenda-design.md
import React, { useState } from "react";
import { runTrainingGapRules } from "../../engine";
import { resolveLabel } from "../../privacy/nameResolver";

const lbl = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "3px" };

function AuditPanel({ topic, studentLabel }) {
  return (
    <div style={{
      marginTop: 10, padding: 10, background: "#0f172a", borderRadius: 6,
      border: "1px solid #1e293b", fontSize: 12, color: "#cbd5e1",
    }}>
      <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: 6 }}>Why is this topic on our agenda?</div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "#94a3b8" }}>Rule:</span> {topic.plainEnglishRule}
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "#94a3b8" }}>Window:</span> last {topic.window.days} days &nbsp;·&nbsp;
        <span style={{ color: "#94a3b8" }}>Student:</span> {studentLabel}
      </div>
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "#94a3b8" }}>Matching logs ({topic.evidenceLogs.length}):</span>
        <ul style={{ margin: "4px 0 0 16px", padding: 0, color: "#cbd5e1" }}>
          {topic.evidenceLogs.map(l => (
            <li key={l.id} style={{ marginBottom: 2 }}>
              {new Date(l.timestamp).toLocaleDateString()} — tags: {(l.tags || []).join(", ")}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <span style={{ color: "#94a3b8" }}>Another approach to try:</span>
        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
          {topic.alternatives.map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
        </ul>
      </div>
    </div>
  );
}

function TopicCard({ topic, studentsMap, expanded, onToggle }) {
  const student = studentsMap[topic.studentId];
  const studentLabel = student ? resolveLabel(student, "compact") : topic.studentId;
  return (
    <div style={{
      padding: 12, background: "#1e293b", borderRadius: 8, marginBottom: 10,
      border: "1px solid #334155",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 16 }} title="Topic for next check-in">🔖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{topic.topicTitle}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>About: {studentLabel}</div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 1.5 }}>{topic.topicExplainer}</div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          onClick={onToggle}
          style={{
            background: "transparent", border: "1px solid #475569", color: "#93c5fd",
            fontSize: 11, padding: "4px 10px", borderRadius: 4, cursor: "pointer",
          }}
        >
          {expanded ? "Hide details" : "Why is this on our agenda?"}
        </button>
      </div>
      {expanded && <AuditPanel topic={topic} studentLabel={studentLabel} />}
    </div>
  );
}

export function TrainingGapPanel({ students, studentsMap, logs }) {
  const [generated, setGenerated] = useState(false);
  const [topics, setTopics] = useState([]);
  const [expanded, setExpanded] = useState({}); // { topicKey: bool }

  const generate = () => {
    const allStudentIds = students && students.length > 0 ? students : Object.keys(studentsMap || {});
    const result = runTrainingGapRules(logs || [], allStudentIds);
    setTopics(result.topics);
    setGenerated(true);
  };

  const reset = () => {
    setGenerated(false);
    setTopics([]);
    setExpanded({});
  };

  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }));

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
        Generate a short list of EBP topics worth bringing up at your next check-in
        with your sped teacher. Patterns only — no single log ever surfaces a topic.
        You and your sped teacher see the same view.
      </div>

      {!generated && (
        <button className="btn btn-primary" onClick={generate}>
          Generate Topics for Next Check-in
        </button>
      )}

      {generated && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
              {topics.length === 0
                ? "No topics surfaced — looks good!"
                : `Topics for our next check-in (${topics.length})`}
            </div>
            <button
              onClick={reset}
              style={{
                background: "transparent", border: "1px solid #475569", color: "#94a3b8",
                fontSize: 11, padding: "4px 10px", borderRadius: 4, cursor: "pointer",
              }}
            >
              Re-generate
            </button>
          </div>

          {topics.length === 0 ? (
            <div style={{
              padding: 12, fontSize: 12, color: "#cbd5e1",
              background: "#0f172a", borderRadius: 6, lineHeight: 1.5,
            }}>
              <span style={lbl}>What this means</span>
              No EBP-gap patterns were found in your recent logs. This either means
              your patterns look good, or you haven't logged enough yet for the rules
              to see a pattern (10+ logs per student needed).
            </div>
          ) : (
            topics.map((t, i) => {
              const key = `${t.ruleId}::${t.studentId}`;
              return (
                <TopicCard
                  key={key}
                  topic={t}
                  studentsMap={studentsMap}
                  expanded={!!expanded[key]}
                  onToggle={() => toggle(key)}
                />
              );
            })
          )}
        </>
      )}
    </div>
  );
}
