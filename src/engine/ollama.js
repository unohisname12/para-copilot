// ══════════════════════════════════════════════════════════════
// OLLAMA SERVICE — Local AI via qwen2.5:7b-instruct
// Replaces all Anthropic/Claude API calls.
// Zero external network — all inference runs on localhost.
// ══════════════════════════════════════════════════════════════

const OLLAMA_BASE  = "http://127.0.0.1:11434";
const OLLAMA_MODEL = "qwen2.5:7b-instruct";
const TIMEOUT_MS   = 60000; // 60s — local inference can be slow

// ── Custom error types ────────────────────────────────────────
export class OllamaOfflineError  extends Error { constructor() { super("Ollama is offline. Run: ollama serve"); this.name = "OllamaOfflineError"; } }
export class OllamaTimeoutError  extends Error { constructor() { super("Ollama timed out — model may still be loading."); this.name = "OllamaTimeoutError"; } }
export class OllamaResponseError extends Error { constructor(status) { super(`Ollama returned HTTP ${status}`); this.name = "OllamaResponseError"; } }

// ── Health check ─────────────────────────────────────────────
export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { online: false, model: null };
    const data = await res.json();
    const found = (data.models || []).find(m => m.name?.startsWith("qwen2.5"));
    return { online: true, model: found?.name || null };
  } catch {
    return { online: false, model: null };
  }
}

// ── Core fetch wrapper ────────────────────────────────────────
export async function callOllama(systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.4, num_predict: 800 },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new OllamaResponseError(res.status);
    const data = await res.json();
    return data.message?.content?.trim() || "No response generated.";
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError" || err.message === "timeout") throw new OllamaTimeoutError();
    if (err instanceof OllamaResponseError) throw err;
    throw new OllamaOfflineError();
  }
}

// ══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — tuned for qwen2.5:7b-instruct
// ══════════════════════════════════════════════════════════════

const SYS_PARA_COPILOT = `You are a special education paraprofessional assistant for Mr. Dre.
Rules:
- Use ONLY student pseudonyms — never real names
- Give 2-4 specific, immediately actionable strategies
- Reference IEP accommodations and goals by name when relevant
- Be concise — this is used in real-time during class
- Do not repeat info already stated in the prompt`;

const SYS_PATTERN_SUMMARY = `You are a special education data analyst assistant.
Given a student's IEP data and recent observation logs, write a concise pattern summary.
Structure your response as:
1. What is working (positive patterns from logs)
2. What needs attention (recurring challenges)
3. One IEP-aligned next step

Rules:
- Use only the student pseudonym
- Be specific — reference actual accommodation types and goal areas
- Plain language a para can act on immediately
- If fewer than 3 logs, say data is limited
- Keep total response under 200 words`;

const SYS_HANDOFF = `You are a special education paraprofessional writing a handoff note.
Write one short paragraph (4-6 sentences):
1. What happened today (key observations)
2. Student's current status
3. What the next staff member should know or do next

Rules:
- Use only pseudonyms
- Be specific about strategies and accommodations used
- If urgency is URGENT, start the note with "URGENT:"
- Audience "next_para" = informal tone, "teacher" = professional tone, "end_of_day" = factual summary
- Only reference events that appear in the logs provided
- Keep under 150 words`;

const SYS_SUGGESTIONS = `You are a special education paraprofessional assistant giving in-the-moment classroom support.
Given a detected classroom situation and student IEP profiles, give 3-5 numbered support moves.
Each move must:
- Be doable in under 60 seconds
- Name the specific student(s) by pseudonym
- Reference their exact IEP accommodation or strategy
- Be written in imperative form (e.g., "Offer Purple Student 1 the chunked version...")

Rules:
- Do not suggest anything not supported by the IEP data
- Do not repeat the IEP accommodation verbatim — contextualize it to the situation
- Keep total response under 250 words`;

const SYS_EMAIL = `You are a paraprofessional writing a professional email to a special education case manager.
Write 3-4 short paragraphs:
1. Brief intro about the observation period
2. Student progress and any concerns
3. Specific next steps or requests

Rules:
- Use only the student pseudonym
- Professional but warm tone
- Reference IEP goals and accommodations by name
- Keep under 200 words
- End with a clear ask or next step`;

const SYS_PDF_EXTRACT = `Extract all readable text from this document. Return only the raw text content.
No commentary, no headers, no formatting beyond line breaks. If a section is unclear, include it as-is.`;

const SYS_IEP_PARSE = `You are a special education document parser. Extract structured IEP data from the provided text.
Return a valid JSON object with these exact fields (use null for any missing fields):
{
  "studentName": string or null,
  "gradeLevel": string or null,
  "classLabel": string or null,
  "subject": string or null,
  "teacherName": string or null,
  "caseManager": string or null,
  "eligibility": string,
  "accommodations": string[],
  "goals": string[],
  "behaviorNotes": string or null,
  "strengths": string or null,
  "triggers": string or null,
  "strategies": string[],
  "tags": string[]
}
Return ONLY the JSON object. No explanation, no markdown, no code blocks.`;

// ══════════════════════════════════════════════════════════════
// FEATURE FUNCTIONS
// ══════════════════════════════════════════════════════════════

// Feature 0: Para Copilot "Ask AI" — replaces callClaude in askAI()
export async function ollamaAskAI(contextBlock) {
  return callOllama(SYS_PARA_COPILOT, contextBlock);
}

// Feature 1: Pattern Summary
export async function summarizeStudentPatterns(serializedContext) {
  return callOllama(SYS_PATTERN_SUMMARY, serializedContext);
}

// Feature 2: Handoff Note
export async function generateHandoffNote(serializedContext) {
  return callOllama(SYS_HANDOFF, serializedContext);
}

// Feature 3: Teaching Suggestions
export async function generateTeachingSuggestions(serializedContext) {
  return callOllama(SYS_SUGGESTIONS, serializedContext);
}

// Feature 4: Email Draft — replaces callClaude in draftEmail()
export async function ollamaDraftEmail(contextBlock) {
  return callOllama(SYS_EMAIL, contextBlock);
}

// Feature 5: PDF text extraction
export async function ollamaExtractPDF(rawText) {
  return callOllama(SYS_PDF_EXTRACT, rawText);
}

// Feature 6: Case Memory Insight — AI-powered recommendations from past cases
const SYS_CASE_INSIGHT = `You are a special education case memory analyst.
Given a student's current situation and their past incidents with interventions and outcomes,
provide 2-3 specific recommendations based on what has worked before.

Rules:
- Reference specific past interventions that succeeded
- Note patterns (time of day, triggers, what helps)
- If nothing has worked, suggest trying something new based on the IEP
- Use only pseudonyms, never real names
- Keep under 150 words
- Be practical and actionable for a para in the moment`;

export async function ollamaCaseInsight(serializedContext) {
  return callOllama(SYS_CASE_INSIGHT, serializedContext);
}

// Feature 7: IEP document parsing — replaces Claude in IEPImport
export async function ollamaParseIEP(documentText) {
  const raw = await callOllama(SYS_IEP_PARSE, documentText);
  // Strip any accidental markdown fencing
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return null; // caller handles null as parse failure
  }
}
