import { buildTodayWorkbook } from '../features/export/exportWorkbook';

const ALL_STUDENTS = {
  stu_a: { id: 'stu_a', pseudonym: 'Red Student 1', color: '#ef4444', periodId: 'p1', eligibility: 'SLD', goals: [{ id: 'g1', text: 'Read at grade level' }, { id: 'g2', text: 'Write 5 sentences' }] },
  stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1', color: '#3b82f6', periodId: 'p2', eligibility: 'Speech', goals: [] },
  stu_cross: { id: 'stu_cross', pseudonym: 'Green Student 1', color: '#22c55e', periodId: 'p1', eligibility: 'OHI', goals: [{ id: 'g3', text: 'Stay on task' }] },
};

const PERIODS = {
  p1: { label: 'Period 1 — ELA 7', teacher: 'Ms. Lambard', subject: 'ELA 7', students: [] },
  p2: { label: 'Period 2 — Math 8', teacher: 'Mr. K', subject: 'Math 8', students: [] },
};

const PERIOD_MAP = {
  p1: ['stu_a', 'stu_cross'],
  p2: ['stu_b'],
};

const TODAY = '2026-04-28';
const LOGS = [
  { id: 'l1', studentId: 'stu_a', date: TODAY, type: 'Behavior Incident', text: 'tired today, headphones helped' },
  { id: 'l2', studentId: 'stu_a', date: TODAY, type: 'Goal Progress', text: 'finished 4/5 sentences' },
  { id: 'l3', studentId: 'stu_b', date: TODAY, type: 'Participation', text: 'raised hand twice' },
  { id: 'l4', studentId: 'stu_a', date: '2026-04-27', type: 'General Note', text: 'should not appear — yesterday' },
];

describe('buildTodayWorkbook', () => {
  test('returns an ExcelJS Workbook with one sheet per period that has students', async () => {
    const wb = await buildTodayWorkbook({
      periods: PERIODS,
      periodMap: PERIOD_MAP,
      allStudents: ALL_STUDENTS,
      logs: LOGS,
      currentDate: TODAY,
    });
    expect(wb).toBeDefined();
    const sheetNames = wb.worksheets.map(s => s.name);
    // Every period that has at least one student gets a tab
    expect(sheetNames).toContain('Period 1 — ELA 7');
    expect(sheetNames).toContain('Period 2 — Math 8');
  });

  test('header row has the expected columns and is bold', async () => {
    const wb = await buildTodayWorkbook({
      periods: PERIODS,
      periodMap: PERIOD_MAP,
      allStudents: ALL_STUDENTS,
      logs: LOGS,
      currentDate: TODAY,
    });
    const sheet = wb.getWorksheet('Period 1 — ELA 7');
    // Find the header row — it lives below the title block
    const headerRowNum = findHeaderRow(sheet);
    expect(headerRowNum).toBeGreaterThan(0);
    const headerCells = sheet.getRow(headerRowNum).values.filter(Boolean);
    expect(headerCells).toEqual(['Student', 'Eligibility', 'Goals', "Today's Notes"]);
    const firstCell = sheet.getRow(headerRowNum).getCell(1);
    expect(firstCell.font?.bold).toBe(true);
  });

  test('only logs from currentDate appear in the output', async () => {
    const wb = await buildTodayWorkbook({
      periods: PERIODS,
      periodMap: PERIOD_MAP,
      allStudents: ALL_STUDENTS,
      logs: LOGS,
      currentDate: TODAY,
    });
    const sheet = wb.getWorksheet('Period 1 — ELA 7');
    const allText = collectSheetText(sheet);
    expect(allText).toContain('tired today');
    expect(allText).toContain('finished 4/5 sentences');
    expect(allText).not.toContain('should not appear');
  });

  test('students appear under the right period; cross-period kid only in their listed period', async () => {
    const wb = await buildTodayWorkbook({
      periods: PERIODS,
      periodMap: { p1: ['stu_a', 'stu_cross'], p2: ['stu_b', 'stu_cross'] },
      allStudents: ALL_STUDENTS,
      logs: LOGS,
      currentDate: TODAY,
    });
    const p1Text = collectSheetText(wb.getWorksheet('Period 1 — ELA 7'));
    const p2Text = collectSheetText(wb.getWorksheet('Period 2 — Math 8'));
    expect(p1Text).toContain('Green Student 1');
    expect(p2Text).toContain('Green Student 1'); // appears in both per the periodMap
  });

  test('skips periods with no students entirely', async () => {
    const wb = await buildTodayWorkbook({
      periods: { ...PERIODS, p9: { label: 'Period 9 — Empty', teacher: 'X', subject: '', students: [] } },
      periodMap: PERIOD_MAP, // no p9 entry
      allStudents: ALL_STUDENTS,
      logs: LOGS,
      currentDate: TODAY,
    });
    const sheetNames = wb.worksheets.map(s => s.name);
    expect(sheetNames).not.toContain('Period 9 — Empty');
  });
});

// ── helpers ──
function findHeaderRow(sheet) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    const v = sheet.getRow(r).getCell(1).value;
    if (v === 'Student') return r;
  }
  return 0;
}
function collectSheetText(sheet) {
  if (!sheet) return '';
  const out = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    sheet.getRow(r).eachCell({ includeEmpty: false }, cell => {
      if (cell.value != null) out.push(String(cell.value));
    });
  }
  return out.join('\n');
}
