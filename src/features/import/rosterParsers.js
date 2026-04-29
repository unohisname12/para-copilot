// Parsers for roster-only files (realName + paraAppNumber pairs).
// Each parser returns { entries: [{ realName, paraAppNumber }], errors: [] }.
//
// Formats supported:
//   - JSON: array of objects OR object with `students` / `roster` / `entries`
//   - CSV: two columns; auto-detects header row; trims quoted values
//   - Markdown: pipe-tables, "Name: 123456" lines, "Name — 123456" lines
//   - TXT:     same rules as Markdown
//   - PDF:     extract text with pdfjs-dist, then Markdown rules

import * as pdfjsLib from 'pdfjs-dist';
import { configurePdfWorker } from '../../utils/pdfWorker';

configurePdfWorker(pdfjsLib);

// ── Shared: pull a 6-digit number from any of many possible fields ──

const NAME_FIELDS = ['realName', 'fullName', 'name', 'displayName', 'student', 'studentName'];
const NUM_FIELDS = ['paraAppNumber', 'externalKey', 'external_key', 'externalStudentKey', 'paraNumber', 'number', 'id', 'studentNumber'];

function pickField(obj, fields) {
  for (const f of fields) {
    const v = obj?.[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function isSixDigit(s) {
  return /^\d{6}$/.test(String(s || '').trim());
}

function cleanName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

// ── JSON parser ──

export function parseRosterJson(text) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { entries: [], errors: [`Invalid JSON: ${e.message}`] };
  }

  const list = Array.isArray(data)
    ? data
    : data.students || data.roster || data.entries || data.privateRosterMap?.privateRosterMap || [];

  if (!Array.isArray(list)) {
    return { entries: [], errors: ['JSON must be an array or contain `students` / `roster` / `entries`'] };
  }

  const entries = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${i + 1}: not an object`);
      return;
    }
    const realName = cleanName(pickField(item, NAME_FIELDS));
    const paraAppNumber = pickField(item, NUM_FIELDS);
    if (!realName) { errors.push(`Row ${i + 1}: missing name`); return; }
    if (!paraAppNumber) { errors.push(`Row ${i + 1} (${realName}): missing para app number`); return; }
    if (!isSixDigit(paraAppNumber)) {
      errors.push(`Row ${i + 1} (${realName}): "${paraAppNumber}" is not a 6-digit number`);
      return;
    }
    entries.push({ realName, paraAppNumber });
  });

  return { entries, errors };
}

// ── CSV parser (simple; two columns; tolerates quotes) ──

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Coerce a "Period" cell into the canonical "p<N>" form. Accepts:
//   "p1", "P3", "1", "  4 ", "" → returns "p1" / "p3" / "p1" / "p4" / null.
// Anything that doesn't end in a digit (e.g. "ELA 7", "Math") returns null
// so we don't accidentally label class subjects as period IDs.
function normalizePeriodCell(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^[Pp]?(\d+)$/);
  if (!m) return null;
  return `p${parseInt(m[1], 10)}`;
}

export function parseRosterCsv(text) {
  const errors = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { entries: [], errors: ['Empty file'] };

  // Detect header row: if any column is a 6-digit number, it's data, not a header.
  const firstCols = splitCsvLine(lines[0]);
  const looksLikeHeader = !firstCols.some(c => isSixDigit(c));
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  // If the header has a third "Period" column (case-insensitive), capture which
  // column that is — usually 2 (0-indexed) for "Name,ParaAppNumber,Period".
  let periodColIdx = -1;
  if (looksLikeHeader) {
    firstCols.forEach((h, i) => {
      if (/period/i.test(h.trim())) periodColIdx = i;
    });
  }

  const entries = [];
  dataLines.forEach((line, i) => {
    const cols = splitCsvLine(line);
    if (cols.length < 2) { errors.push(`Row ${i + 1}: expected 2 columns`); return; }

    // Figure out which col is name vs number — whichever matches 6 digits
    let name, number;
    if (isSixDigit(cols[0]) && !isSixDigit(cols[1])) { number = cols[0]; name = cols[1]; }
    else if (isSixDigit(cols[1]) && !isSixDigit(cols[0])) { name = cols[0]; number = cols[1]; }
    else {
      errors.push(`Row ${i + 1}: couldn't find a 6-digit number in "${line}"`);
      return;
    }

    const realName = cleanName(name);
    if (!realName) { errors.push(`Row ${i + 1}: missing name`); return; }

    const entry = { realName, paraAppNumber: number };
    if (periodColIdx >= 0 && cols[periodColIdx] != null) {
      const periodId = normalizePeriodCell(cols[periodColIdx]);
      if (periodId) entry.periodId = periodId;
    }
    entries.push(entry);
  });

  return { entries, errors };
}

// ── Markdown / TXT parser ──
//
// Matches:
//   | Maria Garcia  | 847293 |      (markdown table row, name-then-number or number-then-name)
//   Maria Garcia: 847293
//   Maria Garcia — 847293
//   Maria Garcia - 847293
//   Maria Garcia 847293
//   847293 Maria Garcia
//   847293: Maria Garcia

const LINE_PATTERNS = [
  // "Name: 123456" / "Name — 123456" / "Name - 123456" / "Name 123456"
  /^([^|\d][^|]*?)\s*(?::|—|-|\t+|\s{2,}|\s+)\s*(\d{6})\s*$/,
  // "123456: Name" / "123456 — Name" / "123456 Name"
  /^(\d{6})\s*(?::|—|-|\t+|\s{2,}|\s+)\s*([^|].*?)\s*$/,
];

function parseTableRow(line) {
  // Pipe table row: | col1 | col2 | col3 |
  const cols = line.split('|').map(c => c.trim()).filter(c => c !== '');
  if (cols.length < 2) return null;
  // Find the 6-digit column and the name column (anything that's not pure digits and not empty)
  let num, name;
  cols.forEach(c => {
    if (!num && isSixDigit(c)) num = c;
    else if (!name && /[a-z]/i.test(c) && !/^-+$/.test(c)) name = c;
  });
  return (num && name) ? { name, num } : null;
}

export function parseRosterMarkdown(text) {
  const errors = [];
  const entries = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    if (/^#{1,6}\s/.test(line)) return; // skip headings
    if (/^[-=]{3,}$/.test(line)) return; // skip --- rules
    if (/^\|[\s\-|:]+\|?\s*$/.test(line)) return; // skip | --- | --- | separator rows

    // Pipe table row
    if (line.includes('|')) {
      const row = parseTableRow(line);
      if (row) {
        entries.push({ realName: cleanName(row.name), paraAppNumber: row.num });
        return;
      }
    }

    // Inline patterns
    for (const re of LINE_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const first = m[1].trim(), second = m[2].trim();
        const number = isSixDigit(first) ? first : second;
        const name = isSixDigit(first) ? second : first;
        entries.push({ realName: cleanName(name), paraAppNumber: number });
        return;
      }
    }

    // Line has a 6-digit number but didn't match a pattern — probably noise
    if (/\b\d{6}\b/.test(line)) {
      errors.push(`Line ${i + 1}: saw a 6-digit number but couldn't extract a name from "${line.slice(0, 80)}"`);
    }
  });

  return { entries, errors };
}

// ── PDF parser — extract text, then run Markdown rules ──

export async function parseRosterPdf(file) {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // pdfjs returns items in reading order on each page; rebuild lines by y-coordinate
      const byY = {};
      content.items.forEach(it => {
        const y = Math.round((it.transform?.[5] ?? 0));
        if (!byY[y]) byY[y] = [];
        byY[y].push(it.str);
      });
      const ys = Object.keys(byY).map(Number).sort((a, b) => b - a);
      ys.forEach(y => { text += byY[y].join(' ') + '\n'; });
      text += '\n';
    }
    return parseRosterMarkdown(text);
  } catch (e) {
    return { entries: [], errors: [`PDF parse failed: ${e.message}`] };
  }
}

// ── Top-level: dispatch by file extension ──

export async function parseRosterFile(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.json'))  return parseRosterJson(await file.text());
  if (name.endsWith('.csv'))   return parseRosterCsv(await file.text());
  if (name.endsWith('.md'))    return parseRosterMarkdown(await file.text());
  if (name.endsWith('.txt'))   return parseRosterMarkdown(await file.text());
  if (name.endsWith('.pdf'))   return parseRosterPdf(file);
  return { entries: [], errors: [`Unsupported file type: ${name || 'unknown'}. Use .json, .csv, .md, .txt, or .pdf`] };
}

// ── Dedup + normalize (same name twice → same para number; conflicts flagged) ──

export function dedupeAndValidate(entries) {
  const byName = new Map();        // name → first paraAppNumber seen
  const byNumber = new Map();      // paraAppNumber → first name seen
  const seenAppearance = new Set(); // (name|number|periodId) — collapses exact dupes
  const errors = [];
  const out = [];

  entries.forEach((e, i) => {
    const key = e.realName.toLowerCase();
    const existing = byName.get(key);
    if (existing && existing !== e.paraAppNumber) {
      errors.push(`"${e.realName}" has two different para numbers: ${existing} and ${e.paraAppNumber}`);
      return;
    }
    const nameForNum = byNumber.get(e.paraAppNumber);
    if (nameForNum && nameForNum.toLowerCase() !== key) {
      errors.push(`Para number ${e.paraAppNumber} is used by two students: "${nameForNum}" and "${e.realName}"`);
      return;
    }
    byName.set(key, e.paraAppNumber);
    byNumber.set(e.paraAppNumber, e.realName);
    // Cross-period rows share name+number but have different periodIds, so the
    // dedupe key has to include period — otherwise we'd collapse them and
    // lose the multi-class assignment the user explicitly provided.
    const appearanceKey = `${key}|${e.paraAppNumber}|${e.periodId || ''}`;
    if (seenAppearance.has(appearanceKey)) return;
    seenAppearance.add(appearanceKey);
    out.push(e);
  });

  return { entries: out, errors };
}
