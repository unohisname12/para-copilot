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

// Default to Flash — fastest + cheapest model that handles IEP extraction
// reliably. Users can override via setCloudModel().
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

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
