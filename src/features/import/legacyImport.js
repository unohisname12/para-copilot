// Pure-functional core for legacy CSV import. No React. No DOM. No async.
// Input: CSV text (and supporting context). Output: structured rows ready
// for the modal to display + ingest.
//
// Three exported functions:
//   parseLegacyCsv(text)          → { rows, skipped, error }
//   matchRowsToVault(rows, ...)   → matchedRows[]   (Task 3)
//   dedupeAgainstLogs(rows, ...)  → { fresh, duplicates }  (Task 4)

const PRE_FIX_HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
const POST_FIX_HEADER = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation';

// RFC 4180 line splitter: respects quoted fields containing newlines, commas,
// and "" escapes. Returns array of cell arrays, one per logical row.
function splitCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cell += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      // skip \r if part of \r\n
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      // ignore fully-empty lines
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseLegacyCsv(text) {
  if (!text || typeof text !== 'string') {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — empty file." };
  }
  const allRows = splitCsv(text);
  if (!allRows.length) {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — no data." };
  }
  const headerCells = allRows[0];
  const headerStr = headerCells.join(',');
  let schema;
  if (headerStr === PRE_FIX_HEADER) schema = 'pre';
  else if (headerStr === POST_FIX_HEADER) schema = 'post';
  else {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — header doesn't match." };
  }

  const idx = (name) => headerCells.indexOf(name);
  const I = {
    date: idx('Date'),
    period: idx('Period'),
    student: idx('Student'),
    type: idx('Type'),
    category: idx('Category'),
    flagged: idx('Flagged'),
    tags: idx('Tags'),
    observation: idx('Observation'),
    periodId: idx('Period ID'),               // -1 in pre-fix
    paraAppNumberFromCsv: idx('Para App Number'), // -1 in pre-fix
  };

  const rows = [];
  const skipped = [];
  for (let r = 1; r < allRows.length; r++) {
    const cells = allRows[r];
    const date = (cells[I.date] || '').trim();
    const student = (cells[I.student] || '').trim();
    const observation = (cells[I.observation] || '').trim();
    if (!date)        { skipped.push({ rowIndex: r, reason: 'missing date' });        continue; }
    if (!student)     { skipped.push({ rowIndex: r, reason: 'missing student name' }); continue; }
    if (!observation) { skipped.push({ rowIndex: r, reason: 'missing observation' }); continue; }
    const tagsRaw = I.tags >= 0 ? (cells[I.tags] || '') : '';
    const tags = tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [];
    rows.push({
      rowIndex: r,
      date,
      period: (cells[I.period] || '').trim(),
      periodId: I.periodId >= 0 ? (cells[I.periodId] || '').trim() : '',
      student,
      type: (cells[I.type] || '').trim() || 'General Observation',
      category: (cells[I.category] || '').trim() || null,
      flagged: ((cells[I.flagged] || '').trim().toLowerCase() === 'yes'),
      tags,
      observation,
      // post-fix exports may already carry paraAppNumber; matcher honors it
      // before doing name lookup.
      csvParaAppNumber: I.paraAppNumberFromCsv >= 0 ? ((cells[I.paraAppNumberFromCsv] || '').trim() || null) : null,
    });
  }
  return { rows, skipped, error: null, schema };
}
