// Pure. No Supabase, no network. Works off logs already in memory.
//
// Input:  studentId (string), logs (array — app log shape)
// Output: { commonBehaviors, successfulSupports, failedSupports, recentPatterns }
//
// Classification is keyword-based so it runs instantly offline. If AI is
// available later, it can refine these signals — but this alone is enough
// to show a para "what worked before" the moment they log.

const SUCCESS_WORDS = [
  'worked', 'calmed', 'calm', 'improved', 'better', 'settled',
  'engaged', 'success', 'great', 'helped', 'good', 'focused',
  're-engaged', 'cooperated', 'finished', 'completed', 'on task',
];

const FAIL_WORDS = [
  "didn't work", "didnt work", 'did not work', 'escalated',
  'refused', 'worse', 'harder', 'failed', 'shutdown', 'shut down',
  'walked out', 'eloped', 'aggressive', 'melted down', 'meltdown',
];

const SUPPORT_LOG_TYPES = new Set([
  'Academic Support', 'Accommodation Used', 'Support Provided',
]);

const BEHAVIOR_LOG_TYPES = new Set([
  'Behavior Note', 'Behavior Incident', 'Escalation',
]);

function classify(note) {
  const n = (note || '').toLowerCase();
  const hasFail = FAIL_WORDS.some(w => n.includes(w));
  if (hasFail) return 'failed';
  const hasSuccess = SUCCESS_WORDS.some(w => n.includes(w));
  if (hasSuccess) return 'successful';
  return 'neutral';
}

function labelForLog(log) {
  // Prefer a human tag, fall back to category, then type.
  const tag = Array.isArray(log.tags) && log.tags[0];
  return (tag || log.category || log.type || 'note').toString();
}

export function getStudentPatterns(studentId, logs, { limit = 40 } = {}) {
  const empty = {
    commonBehaviors: [],
    successfulSupports: [],
    failedSupports: [],
    recentPatterns: [],
  };
  if (!studentId || !Array.isArray(logs)) return empty;

  const mine = logs
    .filter(l => l.studentId === studentId)
    .sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''))
    .slice(0, limit);

  if (!mine.length) return empty;

  const behaviorCount = new Map();
  const successCount  = new Map();
  const failCount     = new Map();

  mine.forEach(l => {
    const label = labelForLog(l);
    const tone  = classify(l.note || l.text);

    if (BEHAVIOR_LOG_TYPES.has(l.type)) {
      behaviorCount.set(label, (behaviorCount.get(label) || 0) + 1);
    }

    if (SUPPORT_LOG_TYPES.has(l.type)) {
      if (tone === 'successful') {
        successCount.set(label, (successCount.get(label) || 0) + 1);
      } else if (tone === 'failed') {
        failCount.set(label, (failCount.get(label) || 0) + 1);
      }
    }
  });

  const top = (map) => [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const recentPatterns = mine.slice(0, 5).map(l => ({
    date: l.date,
    type: l.type,
    category: l.category || null,
    tone: classify(l.note || l.text),
  }));

  return {
    commonBehaviors:     top(behaviorCount).slice(0, 3),
    successfulSupports:  top(successCount).slice(0, 3),
    failedSupports:      top(failCount).slice(0, 3),
    recentPatterns,
  };
}

// Count a student's logs within the last N hours. Used for "Needs attention"
// signaling in the Vault.
export function logsInLastHours(studentId, logs, hours = 24) {
  if (!studentId || !Array.isArray(logs)) return 0;
  const cutoff = Date.now() - hours * 3600 * 1000;
  return logs.reduce((n, l) => {
    if (l.studentId !== studentId) return n;
    const t = l.timestamp ? new Date(l.timestamp).getTime()
            : l.date ? new Date(l.date + 'T12:00:00').getTime()
            : 0;
    return t >= cutoff ? n + 1 : n;
  }, 0);
}
