import { resolveExportName, buildRealNameMap, EXPORT_MODE } from '../privacy/nameResolver';

export function exportCSV(logs, allStudents, currentDate, filteredLogs, mode = EXPORT_MODE.SAFE, realNameMap = null) {
  const target = filteredLogs || logs; if (!target.length) { alert("No data!"); return; }
  const hdr = "Date,Period,Student,Type,Category,Flagged,Tags,Observation\n";
  const rows = target.map(l => { const s = allStudents[l.studentId]; return `"${l.date}","${l.period}","${resolveExportName(s, mode, realNameMap) || l.studentId}","${l.type}","${l.category || ""}","${l.flagged ? "Yes" : "No"}","${(l.tags || []).join(";")}","${(l.note || l.text || "").replace(/"/g, '""')}"`; }).join("\n");
  const suffix = mode === EXPORT_MODE.PRIVATE ? "_private" : "";
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([hdr + rows], { type: "text/csv" })); a.download = `MrDre_ParaData${suffix}_${currentDate}.csv`; a.click();
}

export function exportCSVPrivate(logs, allStudents, currentDate, identityRegistry, filteredLogs) {
  const realNameMap = buildRealNameMap(identityRegistry);
  exportCSV(logs, allStudents, currentDate, filteredLogs, EXPORT_MODE.PRIVATE, realNameMap);
}
