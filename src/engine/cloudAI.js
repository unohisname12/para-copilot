// ══════════════════════════════════════════════════════════════
// CLOUD AI — Google Gemini adapter for structured IEP extraction
//
// Uses the `responseSchema` feature (not prompt-engineered JSON).
// Gemini enforces the schema server-side → returns valid JSON or
// an HTTP error. Never returns "sort of JSON" or extra prose.
//
// Docs:
//   https://ai.google.dev/gemini-api/docs/structured-output
//
// The API key is user-provided, stored in the browser's localStorage
// only. Never committed, never sent anywhere except Google's endpoint.
// ══════════════════════════════════════════════════════════════

const GEMINI_ENDPOINT = (model, apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

// Default to Flash for heavier extraction. Flash-Lite is used for frequent,
// cheap testing calls like note classification and grammar cleanup.
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite';

// Schema the model is GUARANTEED to return. Matches the shape
// ollamaParseIEP produces so callers can treat both identically.
const IEP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    studentName:    { type: 'STRING', nullable: true },
    gradeLevel:     { type: 'STRING', nullable: true },
    classLabel:     { type: 'STRING', nullable: true },
    subject:        { type: 'STRING', nullable: true },
    teacherName:    { type: 'STRING', nullable: true },
    caseManager:    { type: 'STRING', nullable: true },
    eligibility:    { type: 'STRING' },
    accommodations: { type: 'ARRAY', items: { type: 'STRING' } },
    goals:          { type: 'ARRAY', items: { type: 'STRING' } },
    behaviorNotes:  { type: 'STRING', nullable: true },
    strengths:      { type: 'STRING', nullable: true },
    triggers:       { type: 'STRING', nullable: true },
    strategies:     { type: 'ARRAY', items: { type: 'STRING' } },
    tags:           { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['eligibility', 'accommodations', 'goals', 'strategies', 'tags'],
};

const SYS_IEP_PARSE = `You are a special education document parser.
Given the IEP summary text for ONE student, extract the structured fields.
Use null for any unknown single-value field. Use [] for any unknown array field.
Do NOT invent facts. If a field isn't in the input, omit it / return null.`;

// ── Custom errors ────────────────────────────────────────────

export class CloudAIKeyMissingError extends Error {
  constructor() { super('Gemini API key not configured. Paste a key in Smart Import → Settings.'); this.name = 'CloudAIKeyMissingError'; }
}
export class CloudAIKeyInvalidError extends Error {
  constructor() { super('Gemini API key was rejected by Google (403/401). Check that the key is valid and billing is enabled.'); this.name = 'CloudAIKeyInvalidError'; }
}
export class CloudAIQuotaError extends Error {
  constructor() { super('Gemini API quota exceeded (429). Wait a moment and retry, or upgrade your Google AI Studio plan.'); this.name = 'CloudAIQuotaError'; }
}
export class CloudAIResponseError extends Error {
  constructor(status, body) { super(`Gemini HTTP ${status}: ${body}`); this.name = 'CloudAIResponseError'; }
}

// ── Config storage (localStorage) ────────────────────────────

const KEY_STORAGE_KEY = 'supapara_gemini_api_key_v1';
const MODEL_STORAGE_KEY = 'supapara_gemini_model_v1';
const DAILY_CAP_STORAGE_KEY = 'supapara_gemini_daily_cap_v1';
const USAGE_STORAGE_KEY = 'supapara_gemini_usage_v1';

const MODEL_PRICES = {
  'gemini-2.5-flash-lite': { inputPerMillion: 0.10, outputPerMillion: 0.40 },
  'gemini-2.5-flash': { inputPerMillion: 0.30, outputPerMillion: 2.50 },
};

export function getCloudApiKey() {
  try { return localStorage.getItem(KEY_STORAGE_KEY) || ''; }
  catch { return ''; }
}
export function setCloudApiKey(key) {
  try {
    if (!key) localStorage.removeItem(KEY_STORAGE_KEY);
    else localStorage.setItem(KEY_STORAGE_KEY, key);
  } catch {}
}
export function getCloudModel() {
  try { return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL; }
  catch { return DEFAULT_GEMINI_MODEL; }
}
export function setCloudModel(model) {
  try {
    if (!model) localStorage.removeItem(MODEL_STORAGE_KEY);
    else localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {}
}

export function getDailyCapDollars() {
  try {
    const raw = localStorage.getItem(DAILY_CAP_STORAGE_KEY);
    const n = raw == null ? 1 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 1;
  } catch { return 1; }
}

export function setDailyCapDollars(value) {
  try {
    const n = Math.max(0, Number(value) || 0);
    localStorage.setItem(DAILY_CAP_STORAGE_KEY, String(n));
  } catch {}
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyUsage() {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '{}');
    const today = todayKey();
    return usage.date === today ? usage : { date: today, estimatedCost: 0, calls: 0 };
  } catch {
    return { date: todayKey(), estimatedCost: 0, calls: 0 };
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function estimateCost(model, inputText, outputTextOrTokens) {
  const price = MODEL_PRICES[model] || MODEL_PRICES[DEFAULT_GEMINI_MODEL];
  const inputTokens = estimateTokens(inputText);
  const outputTokens = typeof outputTextOrTokens === 'number'
    ? outputTextOrTokens
    : estimateTokens(outputTextOrTokens);
  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}

export function canSpendGemini(model, inputText, maxOutputTokens = 300) {
  const usage = getDailyUsage();
  const projected = usage.estimatedCost + estimateCost(model, inputText, maxOutputTokens);
  return {
    ok: projected <= getDailyCapDollars(),
    usage,
    projected,
    cap: getDailyCapDollars(),
  };
}

function recordGeminiUsage(model, inputText, outputText) {
  try {
    const usage = getDailyUsage();
    const next = {
      date: todayKey(),
      estimatedCost: usage.estimatedCost + estimateCost(model, inputText, outputText),
      calls: usage.calls + 1,
    };
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

// ── Health check — verifies the key works, one cheap call ────

export async function checkCloudHealth() {
  const key = getCloudApiKey();
  if (!key) return { online: false, reason: 'no_key' };
  const model = getCloudModel();
  try {
    // Cheapest possible call: 1 token in, 1 token out.
    const res = await fetch(GEMINI_ENDPOINT(model, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say OK.' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    if (res.status === 401 || res.status === 403) return { online: false, reason: 'invalid_key' };
    if (res.status === 429) return { online: false, reason: 'quota' };
    if (!res.ok) return { online: false, reason: `http_${res.status}` };
    return { online: true, model };
  } catch (e) {
    return { online: false, reason: 'network' };
  }
}

// ── IEP parse — the main call ────────────────────────────────

export async function geminiParseIEP(documentText) {
  const key = getCloudApiKey();
  if (!key) throw new CloudAIKeyMissingError();
  const model = getCloudModel();
  const spend = canSpendGemini(model, documentText, 1500);
  if (!spend.ok) throw new CloudAIQuotaError();

  const res = await fetch(GEMINI_ENDPOINT(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS_IEP_PARSE }] },
      contents: [{ parts: [{ text: documentText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: IEP_SCHEMA,
        temperature: 0.2,  // lower = more deterministic extraction
        maxOutputTokens: 1500,
      },
    }),
  });

  if (res.status === 401 || res.status === 403) throw new CloudAIKeyInvalidError();
  if (res.status === 429) throw new CloudAIQuotaError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloudAIResponseError(res.status, text.slice(0, 300));
  }

  const data = await res.json();
  // Gemini returns the JSON string as candidates[0].content.parts[0].text
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  recordGeminiUsage(model, documentText, jsonText || '');
  if (!jsonText) {
    // Blocked / empty — log full response for debugging and return null
    // eslint-disable-next-line no-console
    console.warn('[cloudAI] empty response', data);
    return null;
  }
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    // Should be impossible with responseSchema, but catch anyway.
    // eslint-disable-next-line no-console
    console.warn('[cloudAI] failed to parse schema-enforced JSON', jsonText);
    return null;
  }
}

const NOTE_CLASSIFIER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    needsFollowUp: { type: 'BOOLEAN' },
    askWhatTriedNow: { type: 'BOOLEAN' },
    delayMinutes: { type: 'INTEGER' },
    category: { type: 'STRING' },
    reason: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
  },
  required: ['needsFollowUp', 'askWhatTriedNow', 'delayMinutes', 'category', 'reason', 'confidence'],
};

const SYS_NOTE_CLASSIFIER = `You classify paraprofessional classroom notes.
Return whether the note needs a follow-up check-in.
Use plain categories: safety, walk_out, refusal, escalation, regulation, academic, transition, other.
If the note describes a concerning event but does not say what staff tried, set askWhatTriedNow true and delayMinutes 0.
If it includes what staff tried, choose when to ask what happened after.
Safety/walk-out/aggression: 5 minutes. Refusal/task start: 10. Regulation: 15. Academic: 20. Transition: 30.
Do not over-trigger on positive or routine notes.`;

export async function geminiClassifyNoteForFollowUp(note, context = {}) {
  const key = getCloudApiKey();
  if (!key || !note || !String(note).trim()) return null;
  const model = GEMINI_FLASH_LITE_MODEL;
  const input = JSON.stringify({
    note,
    type: context.type || null,
    tags: context.tags || [],
  });
  const spend = canSpendGemini(model, input, 220);
  if (!spend.ok) return null;

  const res = await fetch(GEMINI_ENDPOINT(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS_NOTE_CLASSIFIER }] },
      contents: [{ parts: [{ text: input }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: NOTE_CLASSIFIER_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 220,
      },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  recordGeminiUsage(model, input, jsonText || '');
  if (!jsonText) return null;
  try { return JSON.parse(jsonText); }
  catch { return null; }
}

const SYS_POLISH_TEXT = `Fix spelling, grammar, capitalization, and spacing only.
Preserve meaning, names, abbreviations, line breaks, and the writer's voice.
Do not add new facts.
Return only the corrected text.`;

export async function geminiPolishText(text) {
  const key = getCloudApiKey();
  const input = String(text || '');
  if (!key || !input.trim()) return input;
  const model = GEMINI_FLASH_LITE_MODEL;
  const spend = canSpendGemini(model, input, 320);
  if (!spend.ok) return input;

  try {
    const res = await fetch(GEMINI_ENDPOINT(model, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS_POLISH_TEXT }] },
        contents: [{ parts: [{ text: input }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 320 },
      }),
    });
    if (!res.ok) return input;
    const data = res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    recordGeminiUsage(model, input, out || '');
    if (!out || out.length > input.length * 2.5) return input;
    return out.replace(/^["']|["']$/g, '');
  } catch {
    return input;
  }
}

async function geminiTextCall({ system, prompt, maxOutputTokens = 700, model = DEFAULT_GEMINI_MODEL }) {
  const key = getCloudApiKey();
  const input = `${system}\n\n${prompt}`;
  if (!key || !String(prompt || '').trim()) return null;
  const spend = canSpendGemini(model, input, maxOutputTokens);
  if (!spend.ok) throw new CloudAIQuotaError();

  const res = await fetch(GEMINI_ENDPOINT(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens },
    }),
  });
  if (res.status === 401 || res.status === 403) throw new CloudAIKeyInvalidError();
  if (res.status === 429) throw new CloudAIQuotaError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CloudAIResponseError(res.status, text.slice(0, 300));
  }
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  recordGeminiUsage(model, input, out);
  return out;
}

export function geminiSummarizePatterns(serializedContext) {
  return geminiTextCall({
    system: `Write a concise student pattern summary for a paraprofessional.
Use only code names or Para App Numbers. Keep under 200 words.
Cover: what is working, what needs attention, and one practical next step.`,
    prompt: serializedContext,
    maxOutputTokens: 650,
  });
}

export function geminiGenerateHandoff(serializedContext) {
  return geminiTextCall({
    system: `Write a short paraprofessional handoff note.
Use only code names or Para App Numbers. Be factual, practical, and under 150 words.`,
    prompt: serializedContext,
    maxOutputTokens: 500,
  });
}

export function geminiDraftEmail(contextBlock) {
  return geminiTextCall({
    system: `Draft a professional email for a paraprofessional to a case manager.
Use only code names or Para App Numbers. Do not add facts. Keep under 200 words.`,
    prompt: contextBlock,
    maxOutputTokens: 650,
  });
}

// ── Lesson plan summarizer ───────────────────────────────────
//
// Takes raw text from a teacher's lesson doc (Google Doc fetch or
// uploaded PDF) and returns a structured summary the para can act on:
// today's topic, learning objectives, vocab, activities, and a
// para-specific "what to watch for" focus line.
//
// Schema-enforced — Gemini guarantees valid JSON with these fields.
const PLAN_SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic:      { type: 'STRING' },
    objectives: { type: 'ARRAY', items: { type: 'STRING' } },
    vocab:      { type: 'ARRAY', items: { type: 'STRING' } },
    activities: { type: 'ARRAY', items: { type: 'STRING' } },
    para_focus: { type: 'STRING' },
  },
  required: ['topic', 'objectives', 'vocab', 'activities', 'para_focus'],
};

const SYS_PLAN_SUMMARY = `You read a teacher's lesson plan or class notes and
summarize it for a paraprofessional working with special-education students.

Return JSON with:
- topic: 1 short sentence — what is being taught today
- objectives: 1–4 bullet learning goals, plain language
- vocab: any key terms students must know (max 8); empty array if none
- activities: ordered list of what students will do (worksheets, stations, group work, etc.)
- para_focus: 1–2 sentences on what the para should specifically watch for or
  support — e.g., students who struggle with X, transitions, regulation cues,
  pre-teach hints. This is the most valuable field.

Be concrete and short. No fluff. Do not invent details that aren't in the source.
If the source is too thin to answer a field meaningfully, return an empty array
or a brief honest note (e.g., "Source too brief — ask the teacher for activities.").`;

export async function geminiSummarizePlan(documentText, { model } = {}) {
  const key = getCloudApiKey();
  if (!key) throw new CloudAIKeyMissingError();
  const text = String(documentText || '').trim();
  if (!text) return null;
  const useModel = model || getCloudModel();
  const spend = canSpendGemini(useModel, text, 800);
  if (!spend.ok) throw new CloudAIQuotaError();

  const res = await fetch(GEMINI_ENDPOINT(useModel, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYS_PLAN_SUMMARY }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: PLAN_SUMMARY_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    }),
  });

  if (res.status === 401 || res.status === 403) throw new CloudAIKeyInvalidError();
  if (res.status === 429) throw new CloudAIQuotaError();
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new CloudAIResponseError(res.status, body.slice(0, 300));
  }

  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  recordGeminiUsage(useModel, text, jsonText || '');
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

// Lighter call — used when the para has only typed a short topic and
// wants the "what to watch for" tip without parsing a full doc. Uses
// Flash-Lite for cost.
export async function geminiQuickFocusTips(topicText) {
  const text = String(topicText || '').trim();
  if (!text) return null;
  const out = await geminiTextCall({
    system: `You are advising a paraprofessional supporting special-education students.
Given a brief lesson topic line, give 2–3 short, concrete things the para should
watch for or pre-teach today. Plain language. No filler. No bullets in output.`,
    prompt: `Today's topic: ${text}`,
    maxOutputTokens: 220,
    model: GEMINI_FLASH_LITE_MODEL,
  });
  return out;
}
