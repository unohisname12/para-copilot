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

// ── File → text ──────────────────────────────────────────────

import * as pdfjsLib from 'pdfjs-dist';
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

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

export async function extractAllStudents(sections, onProgress = () => {}) {
  const results = new Map();
  const errors = [];
  for (const [name, text] of sections.entries()) {
    onProgress(name, 'parsing');
    try {
      // Send the IEP body WITHOUT the student's real name. We already know
      // the name from the roster; the AI doesn't need to see it to extract
      // eligibility / goals / accs. This protects names from ever reaching
      // any third-party cloud provider on the Gemini path.
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
