// Smart IEP Import — orchestrates:
//   1. Parse roster text  → [{ realName, paraAppNumber }, ...]
//   2. Split IEP text     → per-student sections by name match
//   3. Call Ollama per section → structured IEP JSON per student
//   4. Merge + emit a bundle-shaped object { privateRosterMap, normalizedStudents }
//
// Pure extraction logic. UI lives in SmartImport.jsx. Tested via unit tests
// for the parts that don't require Ollama (splitByStudents, buildBundle).
//
// All processing happens locally. Real names live only in the returned
// `privateRosterMap` — `normalizedStudents` is pseudonymous.

import { parseIEP, checkAiHealth } from '../../engine/aiProvider';
import { configurePdfWorker } from '../../utils/pdfWorker';
import { parseRosterCsv, dedupeAndValidate } from './rosterParsers';

// ── File → text ──────────────────────────────────────────────

import * as pdfjsLib from 'pdfjs-dist';
configurePdfWorker(pdfjsLib);

export async function readFileAsText(file) {
  if (!file) return '';
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file);
  // Everything else treated as text: .txt .md .json .csv and unrecognized
  return file.text();
}

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Reconstruct lines by y-coordinate (pdfjs returns items in reading order per page)
    const byY = {};
    content.items.forEach(it => {
      const y = Math.round((it.transform?.[5] ?? 0));
      if (!byY[y]) byY[y] = [];
      byY[y].push(it.str);
    });
    const ys = Object.keys(byY).map(Number).sort((a, b) => b - a);
    ys.forEach(y => { out += byY[y].join(' ') + '\n'; });
    out += '\n';
  }
  return out;
}

// ── Split multi-student IEP text into per-student sections ───
//
// Takes the raw IEP doc + the list of known names (from roster). Finds each
// name's position in the document and slices between them.
//
// Robust to: name variants ("Jordan Smith" vs "Jordan T. Smith"), extra
// whitespace, varying case. Falls back to a single blob if no names found.

export function splitByStudents(iepText, rosterNames) {
  if (!iepText || !rosterNames || rosterNames.length === 0) return new Map();
  const sections = new Map();

  // For each name, find its FIRST occurrence (case-insensitive, word boundary).
  const positions = [];
  rosterNames.forEach(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // match "First Last" with optional middle word/initial in between
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      const m = iepText.match(re);
      if (m) positions.push({ name, index: m.index, length: m[0].length });
      return;
    }
    const first = parts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const last = parts[parts.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow zero or more middle tokens (words or single-letter initials)
    const re = new RegExp(`\\b${first}\\b(?:\\s+\\w+\\.?)*\\s+\\b${last}\\b`, 'i');
    const m = iepText.match(re);
    if (m) positions.push({ name, index: m.index, length: m[0].length });
  });

  // Sort by position
  positions.sort((a, b) => a.index - b.index);

  // Slice between consecutive matches
  positions.forEach((p, i) => {
    const start = p.index;
    const end = i + 1 < positions.length ? positions[i + 1].index : iepText.length;
    sections.set(p.name, iepText.slice(start, end).trim());
  });

  return sections;
}

// ── Extract per-student IEP JSON via Ollama (one call per kid) ─
//
// Takes { name → section-text } and produces { name → parsed IEP object }.
// Calls onProgress(name, status) for UI feedback.

// Strip anything that looks like the student's real name (or common PII
// keys like "Student:", "Name:") from the section text BEFORE sending it
// to the AI. We already know the name from the roster — the model doesn't
// need it. With the cloud provider this matters for privacy; with local
// Ollama it doesn't, but the stripping is cheap and consistent.
export function stripNameFromSection(name, sectionText) {
  if (!sectionText) return '';
  let out = sectionText;
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0] ? parts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const last = parts.length > 1 ? parts[parts.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    // Full name patterns (with optional middle tokens)
    if (first && last) {
      const re = new RegExp(`\\b${first}\\b(?:\\s+\\w+\\.?)*\\s+\\b${last}\\b`, 'gi');
      out = out.replace(re, '[STUDENT]');
    } else if (first) {
      out = out.replace(new RegExp(`\\b${first}\\b`, 'gi'), '[STUDENT]');
    }
    // Individual first/last occurrences (for references later in the text)
    if (first) out = out.replace(new RegExp(`\\b${first}\\b`, 'gi'), '[STUDENT]');
    if (last)  out = out.replace(new RegExp(`\\b${last}\\b`, 'gi'), '[STUDENT]');
  }
  // Also strip common PII label lines: "Name: ...", "Student: ..."
  out = out.replace(/^\s*(Name|Student|Full\s*Name)\s*[:—-].*$/gim, '');
  return out.trim();
}

// Fast-path: parse a section that's already structured Markdown without
// hitting the AI. Returns the same shape as parseIEP (eligibility, goals,
// accommodations, etc.) when the section matches our convention; returns
// null otherwise so the caller falls through to AI extraction.
//
// Supported headings (case-insensitive on the H3 lines):
//   **Eligibility:** <text>
//   **Case Manager:** <text>
//   **Grade:** <Nth>
//   ### Strengths
//   ### Health & Important Notes        (→ behaviorNotes)
//   ### Alert — Read First              (→ behaviorNotes prepended with ALERT:)
//   ### IEP Goals                        (bulleted list — extracts goal text per line)
//   ### Accommodations                   (bulleted list — accommodation names)
//   ### Watch For → Do This              (bulleted list — folded into strategies)
export function parseStructuredMarkdown(sectionText) {
  if (!sectionText || typeof sectionText !== 'string') return null;
  // Heuristic gate: must look structured. At minimum needs `**Eligibility:**`
  // OR at least one of the standard `### ` headings we know how to parse.
  const looksStructured =
    /\*\*\s*Eligibility\s*:\s*\*\*/i.test(sectionText) ||
    /^\s*###\s+(Strengths|IEP Goals|Accommodations|Watch For|Health|Alert)/im.test(sectionText);
  if (!looksStructured) return null;

  const out = {
    eligibility: '',
    caseManager: '',
    gradeLevel: '',
    strengths: '',
    behaviorNotes: '',
    triggers: '',
    accommodations: [],
    goals: [],
    strategies: [],
    tags: [],
    subject: 'General',
    // periods: [{ periodId: 'p1', classLabel: 'ELA 7', teacherName: 'Ms. X' }, ...]
    // Cross-period kids have multiple entries; single-period kids have one.
    periods: [],
  };

  // Extract `- Period N — Class — Teacher` lines anywhere in the section.
  // Matches both em-dash and hyphen separators; teacher segment is optional.
  const periodLineRe = /^\s*[-•*]\s*Period\s*(\d+)\s*[—\-:]\s*([^—\-\n]+?)(?:\s*[—\-]\s*(.+))?\s*$/gim;
  let pm;
  while ((pm = periodLineRe.exec(sectionText)) !== null) {
    out.periods.push({
      periodId: `p${pm[1].trim()}`,
      classLabel: (pm[2] || '').trim(),
      teacherName: (pm[3] || '').trim(),
    });
  }

  // Inline labeled fields (work anywhere in the section)
  const elig = sectionText.match(/\*\*\s*Eligibility\s*:\s*\*\*\s*(.+)/i);
  if (elig) out.eligibility = elig[1].trim().replace(/\\n.*/, '').trim();
  const cm = sectionText.match(/\*\*\s*Case Manager\s*:\s*\*\*\s*(.+)/i);
  if (cm) out.caseManager = cm[1].trim();
  const gl = sectionText.match(/\*\*\s*Grade\s*:\s*\*\*\s*(.+)/i);
  if (gl) out.gradeLevel = gl[1].trim();

  // Section-by-section walk via H3 headings
  const lines = sectionText.split(/\r?\n/);
  let cur = null;
  const buckets = { strengths: [], health: [], alert: [], goals: [], accs: [], watch: [] };
  for (const raw of lines) {
    const line = raw.trim();
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const t = h3[1].toLowerCase();
      if (t.includes('strength')) cur = 'strengths';
      else if (t.includes('health')) cur = 'health';
      else if (t.includes('alert')) cur = 'alert';
      else if (t.includes('goal')) cur = 'goals';
      else if (t.includes('accommodation')) cur = 'accs';
      else if (t.includes('watch')) cur = 'watch';
      else cur = null;
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('---')) { cur = null; continue; }
    if (cur && line) buckets[cur].push(line);
  }

  // Strengths / Health / Alert → flat text
  out.strengths = buckets.strengths.filter(l => !l.startsWith('**')).join(' ').trim();
  const healthText = buckets.health.filter(l => !l.startsWith('**')).join(' ').trim();
  const alertText = buckets.alert.filter(l => !l.startsWith('**')).join(' ').trim();
  if (healthText && alertText) out.behaviorNotes = `ALERT: ${alertText}\n\n${healthText}`;
  else if (alertText) out.behaviorNotes = `ALERT: ${alertText}`;
  else out.behaviorNotes = healthText;

  // Goals: first bullet of each list item is the goal name; sub-bullets carry
  // baseline/role. We capture text after the first **bold** label or after
  // the leading `- `.
  let curGoal = null;
  for (const raw of buckets.goals) {
    const trimmed = raw.replace(/^\s*[-•*]\s*/, '').trim();
    if (!trimmed) continue;
    if (raw.match(/^\s*-\s+\*\*/) || raw.match(/^\s*-\s+(?!\s)/)) {
      // Top-level bullet → new goal
      // "**Reading** — Identify central idea..." OR "Reading - Identify..."
      const labeled = trimmed.match(/^\*\*([^*]+)\*\*\s*(?:[—\-:]\s*)?(.+)?/);
      if (labeled) {
        curGoal = { area: labeled[1].trim(), text: (labeled[2] || labeled[1]).trim() };
      } else {
        curGoal = { area: 'General', text: trimmed };
      }
      out.goals.push(curGoal);
    }
  }
  // If no labeled bullets matched, fall back to one goal per non-empty line.
  if (out.goals.length === 0 && buckets.goals.length > 0) {
    out.goals = buckets.goals
      .filter(l => l.replace(/^\s*[-•*]\s*/, '').trim())
      .map(l => ({ area: 'General', text: l.replace(/^\s*[-•*]\s*/, '').trim() }));
  }

  // Accommodations: take the bold name per top-level bullet, fall back to
  // the whole line.
  for (const raw of buckets.accs) {
    if (!/^\s*[-•*]/.test(raw)) continue; // skip sub-bullets / paragraph wrap
    const stripped = raw.replace(/^\s*[-•*]\s*/, '').trim();
    if (!stripped) continue;
    const labeled = stripped.match(/^\*\*([^*]+)\*\*/);
    out.accommodations.push((labeled ? labeled[1] : stripped).trim());
  }
  // Watch → Do becomes strategies (free-text "watch ... → do ..." entries)
  for (let i = 0; i < buckets.watch.length; i++) {
    const raw = buckets.watch[i];
    const w = raw.match(/^\s*[-•*]\s*\*\*Watch:\*\*\s*(.+)$/i);
    if (w) {
      // Look ahead for the next `**Do:**` line
      const next = buckets.watch[i + 1] || '';
      const d = next.match(/^\s*[-•*]?\s*\*\*Do:\*\*\s*(.+)$/i);
      if (d) {
        out.strategies.push(`If ${w[1].trim()} → ${d[1].trim()}`);
      } else {
        out.strategies.push(w[1].trim());
      }
    }
  }
  return out;
}

export async function extractAllStudents(sections, onProgress = () => {}) {
  const results = new Map();
  const errors = [];
  for (const [name, text] of sections.entries()) {
    onProgress(name, 'parsing');
    try {
      // Fast-path: if the section is already in our structured Markdown
      // format, parse it deterministically and skip the AI round-trip. Saves
      // ~1-3s per student on Gemini, ~5-30s per student on local Ollama.
      const fast = parseStructuredMarkdown(text);
      if (fast) {
        results.set(name, fast);
        onProgress(name, 'done');
        continue;
      }
      // Fallback: hand to AI. Strip the student's real name first so the
      // model never sees it (matters for the cloud Gemini path).
      const anonymized = stripNameFromSection(name, text);
      const parsed = await parseIEP(anonymized);
      if (parsed) {
        results.set(name, parsed);
        onProgress(name, 'done');
      } else {
        errors.push(`AI couldn't parse "${name}" — returned no JSON.`);
        onProgress(name, 'failed');
      }
    } catch (e) {
      errors.push(`"${name}": ${e.message}`);
      onProgress(name, 'failed');
    }
  }
  return { results, errors };
}

// ── Build the final bundle object ────────────────────────────
//
// Combines:
//   rosterPairs: [{ realName, paraAppNumber }]
//   parsedStudents: Map<realName, parsed IEP fields>
//
// Output matches the shape buildIdentityRegistry expects:
// {
//   schemaVersion: "2.0",
//   normalizedStudents: { students: [ ...pseudonymous students ] },
//   privateRosterMap:   { privateRosterMap: [ ...realName + paraAppNumber ] }
// }
//
// The actual pseudonym / color assignment happens later in buildIdentityRegistry —
// we just need to hand it clean roster pairs + per-student IEP fields tagged
// by a stable studentId.

export function buildBundleFromExtraction(rosterPairs, parsedStudents) {
  const normalizedStudents = [];
  const privateRosterMap = [];

  rosterPairs.forEach((pair, i) => {
    const stuId = `stu_smart_${String(i + 1).padStart(3, '0')}`;
    const parsed = parsedStudents.get(pair.realName) || {};
    normalizedStudents.push({
      id: stuId,
      // pseudonym left blank — buildIdentityRegistry will assign it
      // deterministically from paraAppNumber via generatePseudonymSet.
      pseudonym: '',
      color: '',
      periodId: '',
      classLabel: '',
      eligibility: parsed.eligibility || '',
      accs: parsed.accommodations || [],
      goals: (parsed.goals || []).map((g, j) => ({
        id: `g_${i + 1}_${j + 1}`,
        text: typeof g === 'string' ? g : (g.text || ''),
        area: parsed.subject || 'General',
        subject: parsed.subject || '',
        baselineToTarget: '',
        yourRole: '',
      })),
      caseManager: parsed.caseManager || '',
      gradeLevel: parsed.gradeLevel || '',
      behaviorNotes: parsed.behaviorNotes || '',
      strengths: parsed.strengths || '',
      triggers: parsed.triggers || '',
      strategies: parsed.strategies || [],
      tags: parsed.tags || [],
      flags: {
        alert: false,
        iepNotYetOnFile: Object.keys(parsed).length === 0,
        profileMissing: false,
        crossPeriod: false,
      },
      sourceMeta: { importType: 'smart_import', schemaVersion: '2.0' },
      // paraAppNumber flows through normalizeImportedStudent on the app side.
      paraAppNumber: pair.paraAppNumber,
    });
    privateRosterMap.push({
      studentId: stuId,
      realName: pair.realName,
      pseudonym: '',
      periodId: '',
      classLabel: '',
      paraAppNumber: pair.paraAppNumber,
    });
  });

  return {
    schemaVersion: '2.0',
    datasetName: 'smart-import',
    normalizedStudents: { students: normalizedStudents },
    privateRosterMap: { schemaVersion: '2.0', privateRosterMap },
  };
}

// ── Split a structured-MD bundle into per-student sections ───
//
// The MD format the smart extractor + the docx parser write looks like:
//
//   # Document title
//   intro paragraphs
//   ---
//   ## Maria Garcia
//   **Eligibility:** SLD
//   ### Strengths ...
//   ---
//   ## James Wilson
//   ...
//
// Each H2 starts a new student section. H1 / H3 don't split. Returns a
// Map<realName, sectionText> where sectionText is the slice between this H2
// and the next (or EOF).
export function splitBundleMarkdown(text) {
  const sections = new Map();
  if (!text || typeof text !== 'string') return sections;
  const lines = text.split(/\r?\n/);
  let curName = null;
  let curBody = [];
  for (const raw of lines) {
    // H2 header — exactly two leading hashes, captures the rest of the line
    const m = raw.match(/^##\s+(?!#)(.+?)\s*$/);
    if (m) {
      if (curName) sections.set(curName, curBody.join('\n').trim());
      curName = m[1].trim();
      curBody = [];
    } else if (curName) {
      curBody.push(raw);
    }
  }
  if (curName) sections.set(curName, curBody.join('\n').trim());
  return sections;
}

// Deterministic 6-digit paraAppNumber from a student name. Mirrors the
// algorithm used in /tmp/docx-extract/parse2.py so re-running on the same
// roster reproduces the same numbers.
function deterministicParaAppNumber(name) {
  // Simple stable hash without crypto: same shape as SHA-256 % 900000 + 100000
  // but works in any browser/Jest. Inputs are short student names; collision
  // is rare and the user can override via the CSV when they care.
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  // unsigned, then map into [100000, 999999]
  const n = (h >>> 0) % 900000 + 100000;
  return String(n).padStart(6, '0');
}

// ── Bundle assembler: builds a bundle from MD (+ optional roster CSV) ─
//
// Inputs:
//   md  — structured Markdown text where each `## Name` heading starts
//         a per-student section parseable by parseStructuredMarkdown
//   csv — optional roster CSV (`Name,ParaAppNumber` two-col format that
//         rosterParsers.parseRosterCsv accepts)
//
// Behavior:
//   - With csv: roster set = CSV entries; paraAppNumbers come from CSV
//   - Without csv: roster set = student names found in MD H2 headings;
//     paraAppNumbers generated deterministically from name
//   - Names present in CSV but not in MD still appear in the bundle, with
//     iepNotYetOnFile flag set (no IEP fields yet)
//
// Output: same shape as buildBundleFromExtraction → buildIdentityRegistry
// can consume it directly.
export function assembleBundleFromFiles({ md, csv } = {}) {
  if (!md && !csv) {
    throw new Error('assembleBundleFromFiles needs at least an MD or CSV file.');
  }

  // 1. Parse MD into per-student structured fields (skips when MD missing)
  const parsedByName = new Map();
  if (md) {
    const sections = splitBundleMarkdown(md);
    sections.forEach((sectionText, name) => {
      const parsed = parseStructuredMarkdown(sectionText);
      if (parsed) parsedByName.set(name, parsed);
      else parsedByName.set(name, null); // section exists but unparseable
    });
  }

  // 2. Build the rosterPairs list — preferring CSV when present
  let rosterPairs = [];
  if (csv) {
    const { entries: rawEntries } = parseRosterCsv(csv);
    const { entries } = dedupeAndValidate(rawEntries);
    rosterPairs = entries.map(e => ({
      realName: e.realName,
      paraAppNumber: e.paraAppNumber,
    }));
  } else {
    // Generate paraAppNumbers deterministically from each MD H2 name
    rosterPairs = [...parsedByName.keys()].map(name => ({
      realName: name,
      paraAppNumber: deterministicParaAppNumber(name),
    }));
  }

  // 3. Hand to existing assembler — non-MD names map to {} so they're
  // marked profileMissing/iepNotYetOnFile by buildBundleFromExtraction
  const cleanParsed = new Map();
  rosterPairs.forEach(p => {
    const v = parsedByName.get(p.realName);
    if (v) cleanParsed.set(p.realName, v);
  });

  const bundle = buildBundleFromExtraction(rosterPairs, cleanParsed);

  // Stamp period info onto each normalizedStudent + privateRosterMap entry.
  // buildBundleFromExtraction left periodId blank; the MD has it.
  // For cross-period kids, expand the privateRosterMap into one entry per
  // period so buildIdentityRegistry adds them to every period they belong to.
  const expandedRoster = [];
  bundle.normalizedStudents.students.forEach((stu, i) => {
    const parsed = cleanParsed.get(rosterPairs[i].realName);
    const periods = (parsed && parsed.periods) || [];
    if (periods.length > 0) {
      // Stamp primary period onto the normalizedStudent
      stu.periodId = periods[0].periodId;
      stu.classLabel = periods[0].classLabel;
      stu.teacherName = periods[0].teacherName;
      // Emit one privateRosterMap row per period appearance
      periods.forEach(p => {
        expandedRoster.push({
          studentId: stu.id,
          realName: rosterPairs[i].realName,
          pseudonym: '',
          periodId: p.periodId,
          classLabel: p.classLabel,
          paraAppNumber: rosterPairs[i].paraAppNumber,
        });
      });
    } else {
      // No period info — keep the single empty roster row buildBundleFromExtraction produced
      expandedRoster.push(bundle.privateRosterMap.privateRosterMap[i]);
    }
  });
  bundle.privateRosterMap.privateRosterMap = expandedRoster;

  return bundle;
}

// ── Pre-flight: is Ollama reachable? ─────────────────────────

export async function checkAvailability() {
  return checkAiHealth();
}

// ── Report — "who matched what" for the preview UI ───────────

export function buildMatchReport(rosterPairs, sections, parsedStudents) {
  return rosterPairs.map(p => {
    const hasSection = sections.has(p.realName);
    const hasParsed = parsedStudents.has(p.realName);
    let status;
    if (hasParsed) status = 'ok';
    else if (hasSection) status = 'section_but_no_ai';
    else status = 'no_section';
    return {
      realName: p.realName,
      paraAppNumber: p.paraAppNumber,
      status,
      parsed: parsedStudents.get(p.realName) || null,
    };
  });
}
