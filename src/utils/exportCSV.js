import { resolveExportName, buildRealNameMap, EXPORT_MODE } from '../privacy/nameResolver';

// Pure CSV builder — no DOM, no download — so it can be unit tested.
// Columns: Date, Period, Period ID, Student, Para App Number, Type, Category,
// Flagged, Tags, Observation. Para App Number is included in BOTH safe and
// private exports so a row can be retracted by ID even when the safe export
// is shared with someone who shouldn't see real names.
export function buildCsvText(logs, allStudents, currentDate, mode = EXPORT_MODE.SAFE, realNameMap = null) {
  const target = logs || [];
  const hdr = "Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation";
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = target.map(l => {
    const s = allStudents[l.studentId];
    // Prefer the student record's paraAppNumber so it stays current. Fall
    // back to the log's own paraAppNumber so logs whose student record went
    // away (orphaned by a roster regen) still emit the stable bridge value.
    const paraAppNumber = l.paraAppNumber || s?.paraAppNumber || "";
    return [
      escape(l.date || ""),
      escape(l.period || ""),
      escape(l.periodId || ""),
      escape(resolveExportName(s, mode, realNameMap) || l.studentId || ""),
      escape(paraAppNumber),
      escape(l.type || ""),
      escape(l.category || ""),
      escape(l.flagged ? "Yes" : "No"),
      escape((l.tags || []).join(";")),
      escape(l.note || l.text || ""),
    ].join(",");
  }).join("\n");
  return rows ? `${hdr}\n${rows}` : `${hdr}\n`;
}

export function exportCSV(logs, allStudents, currentDate, filteredLogs, mode = EXPORT_MODE.SAFE, realNameMap = null) {
  const target = filteredLogs || logs;
  if (!target.length) { alert("No data!"); return; }
  const text = buildCsvText(target, allStudents, currentDate, mode, realNameMap);
  const suffix = mode === EXPORT_MODE.PRIVATE ? "_private" : "";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = `MrDre_ParaData${suffix}_${currentDate}.csv`;
  a.click();
}

export function exportCSVPrivate(logs, allStudents, currentDate, identityRegistry, filteredLogs) {
  const realNameMap = buildRealNameMap(identityRegistry);
  exportCSV(logs, allStudents, currentDate, filteredLogs, EXPORT_MODE.PRIVATE, realNameMap);
}
