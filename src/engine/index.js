// ══════════════════════════════════════════════════════════════
// ENGINE LAYER — Pure logic, no React, no UI
// This is the brain. MCP calls THESE functions later.
// ══════════════════════════════════════════════════════════════

import { DB, SITUATIONS, SUPPORT_CARDS, QUICK_ACTIONS, REG_TOOLS, KW } from '../data';
import { getStudentLabel } from '../identity';

// ── KB keyword search ────────────────────────────────────────
export function searchKBDoc(doc, queryWords) {
  const sentences = doc.content.split(/[.!\n]+/).map(s => s.trim()).filter(s => s.length > 20);
  return sentences.filter(s => queryWords.some(w => s.toLowerCase().includes(w))).slice(0, 3);
}

// ── Parse Google Doc text for period lesson info ─────────────
export function parseDocForPeriod(docText, periodLabel) {
  if (!docText) return null;
  const lines = docText.split("\n").map(l => l.trim()).filter(Boolean);
  const periodIdx = lines.findIndex(l =>
    l.toLowerCase().includes(periodLabel.toLowerCase().split("—")[0].trim().toLowerCase()) ||
    l.toLowerCase().includes("period")
  );
  if (periodIdx === -1) return null;
  return lines.slice(periodIdx, periodIdx + 8).join(" ").slice(0, 400);
}

// ══════════════════════════════════════════════════════════════
// SITUATION ENGINE — with SCORING (upgrade from simple filter)
// Each trigger match adds 1 point. Sorted by confidence.
// ══════════════════════════════════════════════════════════════
export function detectSituation(text) {
  const t = text.toLowerCase();

  return SITUATIONS.map(sit => {
    let score = 0;
    const matchedTriggers = [];

    sit.triggers.forEach(trig => {
      if (t.includes(trig)) {
        score++;
        matchedTriggers.push(trig);
      }
    });

    // Bonus: if student tags overlap with situation tags, extra point
    // (this will matter more when we pass student context in)

    return { ...sit, score, matchedTriggers };
  })
  .filter(s => s.score > 0)
  .sort((a, b) => b.score - a.score);
}

// ── Accommodation matcher — maps topics to IEP accommodations ─
function matchAccommodations(topic, accs) {
  return accs.filter(a => {
    if (topic === "behavior" || topic === "escalation") return /Break|BIP|Fidget|De-esc|headphone/i.test(a);
    if (topic === "math" || topic === "computation") return /Calc|Chart|Chunk|Anchor|Graph/i.test(a);
    if (topic === "reading" || topic === "writing" || topic === "academic") return /Organizer|Word Bank|Strip|Print|Speech|Oral|Reduce|Chunk/i.test(a);
    if (topic === "science") return /Reduce|Speech|Extra|Verbal|Tactile/i.test(a);
    if (topic === "transition") return /Schedule|Warning|Timer|Advance/i.test(a);
    if (topic === "sensory") return /Fidget|headphone|Noise|Tactile/i.test(a);
    return false;
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN LOCAL ENGINE — the core brain, zero API calls
// Takes text + context, returns structured recommendations
// ══════════════════════════════════════════════════════════════
export function runLocalEngine(text, studentIds, knowledgeBase, activePeriod, docContent, periodLabel, recentLogs, allStudents = DB.students) {
  const t = text.toLowerCase();
  const situations = detectSituation(text);
  const studs = studentIds.map(id => ({ id, ...(allStudents[id] || {}) }));
  const moves = [], actions = [], sources = [], kbHits = [];
  const iepStudentsUsed = [];

  // No matches at all — fallback
  if (situations.length === 0) {
    const topic = Object.keys(KW).find(k => KW[k].some(w => t.includes(w)));
    if (!topic) {
      return {
        topic: "unknown", situations: [], score: 0,
        moves: ["No keyword matched. What subject or situation? I can search your IEPs and Knowledge Base once I know."],
        actions: studs.map(s => ({ label:`Log note: ${getStudentLabel(s)}`, studentId:s.id, note:text, type:"General Note" })),
        sources: [{ label:"IEP Database", icon:"📋", detail:"No match yet — give me more info" }],
        kbHits: [], followUp: "Try describing the subject or what you see.", docSnippet: null, needsNoteBuilding: true,
        recommendedCards: [], recommendedTools: [],
      };
    }
  }

  // Gather recommendations from top situations
  const allCardIds = [...new Set(situations.flatMap(s => s.recommendedCards))];
  const allActionIds = [...new Set(situations.flatMap(s => s.recommendedActions))];
  const allToolIds = [...new Set(situations.flatMap(s => s.recommendedTools))];
  const recCards = allCardIds.map(id => SUPPORT_CARDS.find(c => c.id === id)).filter(Boolean);
  const recActions = allActionIds.map(id => QUICK_ACTIONS.find(a => a.id === id)).filter(Boolean);
  const recTools = allToolIds.map(id => REG_TOOLS.find(t => t.id === id)).filter(Boolean);

  if (situations.length > 0) {
    const topSit = situations[0];
    const confidence = topSit.score >= 3 ? "high" : topSit.score === 2 ? "medium" : "low";
    moves.push(`Situation detected: ${situations.map(s => `${s.icon} ${s.title} (${s.score} match${s.score>1?"es":""})`).join(", ")}`);
    sources.push({ label:"Situation Engine", icon:"🧠", detail:`${situations.length} situation(s) · confidence: ${confidence}` });
  }

  // IEP cross-reference
  const topic = situations.length > 0 ? situations[0].tags[0] : Object.keys(KW).find(k => KW[k].some(w => t.includes(w))) || "general";

  studs.forEach(s => {
    const relevantAccs = matchAccommodations(topic, s.accs);
    if (relevantAccs.length > 0) {
      moves.push(`• ${getStudentLabel(s)} — provide: ${relevantAccs.slice(0,2).join(", ")}`);
      iepStudentsUsed.push(getStudentLabel(s));
      actions.push({ label:`Log: ${relevantAccs[0]} for ${getStudentLabel(s)}`, studentId:s.id, note:`Support provided: ${relevantAccs.join(", ")}`, type:"Accommodation Used" });
    }
  });

  // Quick-action buttons from situation engine
  recActions.forEach(qa => {
    studs.forEach(s => {
      if (!actions.find(a => a.label.includes(qa.label) && a.studentId === s.id)) {
        actions.push({ label:`${qa.icon} ${qa.label}: ${getStudentLabel(s)}`, studentId:s.id, note:qa.defaultNote, type:qa.logType });
      }
    });
  });

  if (iepStudentsUsed.length > 0) {
    sources.push({ label:"IEP Database", icon:"📋", detail:`${iepStudentsUsed.join(", ")}` });
  }

  // KB search
  const queryWords = t.split(/\s+/).filter(w => w.length > 3);
  const relevantDocs = knowledgeBase.filter(k => k.period === activePeriod || k.period === "all");
  relevantDocs.forEach(doc => {
    const hits = searchKBDoc(doc, queryWords);
    if (hits.length > 0) {
      kbHits.push({ docTitle: doc.title, docType: doc.docType, snippets: hits });
      sources.push({ label:`KB: ${doc.title}`, icon:"📚", detail:`${hits.length} passage(s)` });
    }
  });

  // Doc check
  let docSnippet = null;
  if (docContent) {
    const parsed = parseDocForPeriod(docContent, periodLabel);
    if (parsed) { docSnippet = parsed; sources.push({ label:"Class Notes 4 Paras", icon:"📄", detail:"Today's lesson context" }); }
  }

  // Recent logs
  const recentForPeriod = recentLogs.filter(l => studentIds.includes(l.studentId)).slice(0, 5);
  if (recentForPeriod.length > 0) {
    sources.push({ label:"Past Observations", icon:"🗄️", detail:`${recentForPeriod.length} recent log(s)` });
  }

  const followUp = situations.map(s => s.followUp).filter(Boolean).join(" ");
  const topScore = situations.length > 0 ? situations[0].score : 0;

  return { topic, situations, score: topScore, moves, actions, sources, kbHits, docSnippet,
    needsNoteBuilding: !docContent || !docSnippet, recommendedCards: recCards,
    recommendedTools: recTools, followUp: followUp || null };
}

// ── Case Memory Search ──────────────────────────────────────
// Retrieves past incidents for a student (or similar students) ranked by relevance.
// Returns composite records: incident + interventions with outcomes.
export function searchCaseMemory(studentId, currentContext, allIncidents, allInterventions, allOutcomes, options = {}) {
  const { maxResults = 5, includeOtherStudents = false } = options;
  const { category, tags: contextTags = [], situationId } = currentContext || {};

  let candidates = allIncidents.filter(inc => inc.id !== currentContext?.id);
  if (!includeOtherStudents) {
    candidates = candidates.filter(inc => inc.studentId === studentId);
  }

  const scored = candidates.map(inc => {
    let score = 0;
    const reasons = [];

    // Same student is strongest signal
    if (inc.studentId === studentId) { score += 3; reasons.push("same_student"); }

    // Same category
    if (category && inc.category === category) { score += 2; reasons.push("same_category"); }

    // Tag overlap
    const tagOverlap = (inc.tags || []).filter(t => contextTags.includes(t)).length;
    if (tagOverlap > 0) { score += tagOverlap; reasons.push("similar_tags"); }

    // Same situation
    if (situationId && inc.situationId === situationId) { score += 2; reasons.push("same_situation"); }

    // Recency bonus (within 7 days)
    const daysSince = Math.floor((Date.now() - new Date(inc.timestamp).getTime()) / 86400000);
    if (daysSince <= 7) { score += 1; reasons.push("recent"); }

    // Build composite record with linked interventions + outcomes
    const intvsForInc = allInterventions.filter(i => i.incidentId === inc.id);
    const compositeInterventions = intvsForInc.map(intv => ({
      intervention: intv,
      outcome: allOutcomes.find(o => o.interventionId === intv.id) || null,
    }));

    // Boost for interventions that worked
    const workedCount = compositeInterventions.filter(c => c.outcome?.result === "worked").length;
    score += workedCount * 2;
    if (workedCount > 0) reasons.push("has_success");

    return { incident: inc, interventions: compositeInterventions, relevanceScore: score, matchReasons: reasons };
  });

  return scored
    .filter(s => s.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

// ── Inline Case Memory — simple keyword matching ────────────
const _stopwords = new Set(['the','and','was','for','that','with','this','from','but','not','are','has','had','have','been','were','being','she','her','his','him','they','them','then','than']);
function _normalize(s) { return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !_stopwords.has(w)); }

export function matchCaseKeywords(text, incidents, interventions, outcomes, maxResults = 3) {
  if (!text || text.trim().length < 3) return [];
  const inputWords = _normalize(text);
  if (inputWords.length === 0) return [];

  const scored = incidents.map(inc => {
    const descWords = _normalize(inc.description);
    const overlap = inputWords.filter(w => descWords.some(dw => dw.includes(w) || w.includes(dw))).length;
    if (overlap === 0) return null;

    const intv = interventions.find(i => i.incidentId === inc.id);
    const out = intv ? outcomes.find(o => o.interventionId === intv.id) : null;

    return {
      behavior: inc.description,
      intervention: intv?.strategyLabel || intv?.staffNote || null,
      outcome: out?.studentResponse || (out?.result === 'worked' ? 'Resolved' : out?.result) || null,
      score: overlap,
    };
  }).filter(Boolean);

  return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// ── Help-worthy keyword detection ──────────────────────────
const _helpPatterns = /\b(threw|throw|hit|hitting|yelling|yelled|ran\s*out|refused|shut\s*down|escalat\w*|crying|cried|unsafe|aggressive|left\s*room|meltdown|dysregulated|kicked|punched|screaming|eloped|bolted|destroying|flipped)\b/i;
export function isHelpWorthy(text) {
  if (!text || text.trim().length < 5) return false;
  return _helpPatterns.test(text);
}

// callClaude removed — all AI now runs through src/engine/ollama.js (local Ollama)
