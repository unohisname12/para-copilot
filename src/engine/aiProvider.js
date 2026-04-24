// ══════════════════════════════════════════════════════════════
// AI PROVIDER ROUTER
//
// Single source of truth for which AI backend handles IEP parsing:
//   - 'local'  → Ollama on 127.0.0.1 (free, private, slower)
//   - 'cloud'  → Google Gemini (paid, faster, guaranteed JSON)
//
// Setting is stored in localStorage and edited from the UI.
// When you flip the toggle, new calls go to the new backend immediately.
// ══════════════════════════════════════════════════════════════

import { ollamaParseIEP, checkOllamaHealth } from './ollama';
import {
  geminiParseIEP, checkCloudHealth,
  getCloudApiKey, setCloudApiKey,
  getCloudModel, setCloudModel,
  DEFAULT_GEMINI_MODEL,
} from './cloudAI';

const PROVIDER_STORAGE_KEY = 'supapara_ai_provider_v1';

export const AI_PROVIDERS = {
  local: {
    id: 'local',
    label: 'Local AI (Ollama)',
    tag: 'Free',
    description: 'Runs on the device via Ollama. No cost, no data leaves the computer. Slower (3–8 s per student).',
  },
  cloud: {
    id: 'cloud',
    label: 'Google Gemini',
    tag: 'Paid',
    description: 'Google Gemini 2.5 Flash with schema-enforced JSON. Perfect JSON guaranteed. ~$0.01 per full roster. Requires a free API key from Google AI Studio.',
  },
};

export function getAiProvider() {
  try {
    const v = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return v === 'cloud' ? 'cloud' : 'local';
  } catch { return 'local'; }
}

export function setAiProvider(id) {
  try {
    if (id !== 'local' && id !== 'cloud') return;
    localStorage.setItem(PROVIDER_STORAGE_KEY, id);
  } catch {}
}

// ── Unified API: callers use these, never the per-provider fns ─

export async function parseIEP(documentText) {
  const provider = getAiProvider();
  if (provider === 'cloud') return geminiParseIEP(documentText);
  return ollamaParseIEP(documentText);
}

export async function checkAiHealth() {
  const provider = getAiProvider();
  if (provider === 'cloud') {
    const s = await checkCloudHealth();
    return { ...s, provider: 'cloud' };
  }
  const s = await checkOllamaHealth();
  return { ...s, provider: 'local' };
}

// Re-export provider-specific config setters so UI has one place to import from.
export {
  getCloudApiKey, setCloudApiKey,
  getCloudModel, setCloudModel,
  DEFAULT_GEMINI_MODEL,
};
