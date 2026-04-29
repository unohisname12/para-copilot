// Build a Google-Sheets-friendly .xlsx workbook for "today's class snapshot".
//
// One sheet per period that has students, with:
//   - Title row: "Period 1 — ELA 7  /  Ms. Lambard"
//   - Date row:  "Today: 2026-04-28"
//   - Header row (bold, colored fill)
//   - Student rows, alternating row backgrounds
//   - Auto-fit column widths (clamped)
//
// Pure data → workbook; the UI layer triggers the download with `xlsx.writeBuffer`.

import ExcelJS from 'exceljs';

const HEADER = ['Student', 'Eligibility', 'Goals', "Today's Notes"];

const COLOR = {
  title:        'FF1E1B4B', // deep purple
  titleText:    'FFA78BFA',
  header:       'FF0F172A',
  headerText:   'FFE2E8F0',
  rowZebra:     'FFF8FAFC',
  rowZebraDark: 'FF111827',
  border:       'FFCBD5E1',
};

function pickGoalsText(student) {
  const goals = student?.goals || [];
  if (!goals.length) return '';
  return goals
    .map(g => (typeof g === 'string' ? g : (g.text || g.summary || '')))
    .filter(Boolean)
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');
}

function pickTodayLogsText(studentId, logs, currentDate) {
  const todays = (logs || []).filter(l => l.studentId === studentId && l.date === currentDate);
  if (!todays.length) return '(none)';
  return todays
    .map(l => `[${l.type || 'Note'}] ${l.text || ''}`.trim())
    .join('\n');
}

export async function buildTodayWorkbook({
  periods, periodMap, allStudents, logs, currentDate,
} = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SupaPara';
  wb.created = new Date();

  const orderedPids = Object.keys(periods || {}).sort();
  for (const pid of orderedPids) {
    const periodInfo = periods[pid];
    const studentIds = (periodMap && periodMap[pid]) || [];
    if (!studentIds.length) continue; // skip empty periods

    const sheetName = (periodInfo.label || pid).slice(0, 31); // Excel limit
    const sheet = wb.addWorksheet(sheetName, {
      properties: { tabColor: { argb: COLOR.titleText } },
    });

    // Row 1 — title
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${periodInfo.label || pid}${periodInfo.teacher ? '  /  ' + periodInfo.teacher : ''}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: COLOR.titleText } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.title } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(1).height = 26;

    // Row 2 — date
    sheet.mergeCells('A2:D2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Today: ${currentDate}`;
    dateCell.font = { italic: true, color: { argb: 'FF94A3B8' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Row 3 — spacer (intentionally blank)

    // Row 4 — header
    const headerRow = sheet.getRow(4);
    HEADER.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: COLOR.headerText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.header } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLOR.border } },
      };
    });
    headerRow.height = 22;

    // Student rows
    studentIds.forEach((sid, i) => {
      const stu = allStudents[sid];
      if (!stu) return;
      const r = sheet.getRow(5 + i);
      r.getCell(1).value = stu.pseudonym || sid;
      r.getCell(2).value = stu.eligibility || '';
      r.getCell(3).value = pickGoalsText(stu);
      r.getCell(4).value = pickTodayLogsText(sid, logs, currentDate);
      const zebra = i % 2 === 0;
      [1, 2, 3, 4].forEach(c => {
        const cell = r.getCell(c);
        cell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: zebra ? COLOR.rowZebra : COLOR.rowZebraDark },
        };
        cell.font = { color: { argb: zebra ? 'FF111827' : 'FFE2E8F0' } };
      });
      r.height = 60; // tall enough for goals/notes wrap
    });

    // Column widths — modest auto-fit by sampling content lengths
    const widths = [22, 18, 40, 50];
    HEADER.forEach((_, i) => { sheet.getColumn(i + 1).width = widths[i]; });
  }

  return wb;
}

// Helper used by the UI: turn the workbook into a Blob the browser can download.
export async function downloadWorkbook(wb, filename = 'supapara-today.xlsx') {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
