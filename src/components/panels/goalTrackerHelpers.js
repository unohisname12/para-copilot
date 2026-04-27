// Pure helpers for the visual GoalTracker. No React, no data imports —
// all inputs come from the caller so these are easy to test.

import { GOAL_PROGRESS_OPTIONS } from '../../data';

const POSITIVE_OPTION_IDS = new Set(['gp_progress', 'gp_support', 'gp_mastery']);
const NEGATIVE_OPTION_IDS = new Set(['gp_concern', 'gp_notattempt']);

// Returns logs whose `tags` array contains the given goalProgress option id
// (e.g. 'gp_progress'). Goal-progress logs from GoalTracker carry the option
// id as a tag.
function logsForGoal(logs, goalId, windowDays) {
  if (!Array.isArray(logs) || !goalId) return [];
  const cutoff = Date.now() - (windowDays * 86400000);
  return logs.filter(l =>
    l.goalId === goalId &&
    l.timestamp &&
    new Date(l.timestamp).getTime() >= cutoff
  );
}

// Returns { totalCount, latestOptionId, positive, negative, neutral, latestTimestamp }
// for one goal in a given window. Used to drive the status chip + progress bar.
export function summarizeGoalProgress(logs, goalId, windowDays = 14) {
  const inWindow = logsForGoal(logs, goalId, windowDays);
  if (inWindow.length === 0) {
    return {
      totalCount: 0,
      latestOptionId: null,
      positive: 0,
      negative: 0,
      neutral: 0,
      latestTimestamp: null,
    };
  }
  let positive = 0, negative = 0, neutral = 0;
  inWindow.forEach(l => {
    const optTag = (l.tags || []).find(t => t && t.startsWith('gp_'));
    if (POSITIVE_OPTION_IDS.has(optTag)) positive++;
    else if (NEGATIVE_OPTION_IDS.has(optTag)) negative++;
    else neutral++;
  });
  // sort by timestamp desc to find latest
  const sorted = [...inWindow].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latest = sorted[0];
  const latestOptionId = (latest.tags || []).find(t => t && t.startsWith('gp_')) || null;
  return {
    totalCount: inWindow.length,
    latestOptionId,
    positive,
    negative,
    neutral,
    latestTimestamp: latest.timestamp,
  };
}

// Looks up a GOAL_PROGRESS_OPTIONS entry by id. Returns null when no match.
export function optionForId(optionId) {
  if (!optionId) return null;
  return GOAL_PROGRESS_OPTIONS.find(o => o.id === optionId) || null;
}

// Returns up to `max` recent support tags pulled from any logs for this
// student in the window, deduped, ordered by recency. Used to show
// "supports tried recently" chips under each student.
export function recentSupportTagsForStudent(logs, studentId, windowDays = 7, max = 4) {
  if (!Array.isArray(logs) || !studentId) return [];
  const cutoff = Date.now() - (windowDays * 86400000);
  const sorted = logs
    .filter(l =>
      l.studentId === studentId &&
      l.timestamp &&
      new Date(l.timestamp).getTime() >= cutoff
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const seen = new Set();
  const out = [];
  for (const l of sorted) {
    for (const t of (l.tags || [])) {
      if (!t) continue;
      // Skip the goal-progress tag prefix and the meta tags
      if (t === 'goal' || t === 'handoff' || t.startsWith('gp_')) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

// "Next best support" — heuristic. Picks one Strategy from the strategies
// library whose tags overlap with the goal's area or the student's tags.
// Returns null when no overlap. The caller passes the strategies array so
// this function stays free of imports.
export function pickNextBestSupport({ student, goal, strategies }) {
  if (!student || !goal || !Array.isArray(strategies)) return null;
  const goalArea = (goal.area || '').toLowerCase();
  const studentTags = (student.tags || []).map(t => String(t).toLowerCase());
  const goalText = (goal.text || '').toLowerCase();

  // Score each strategy by tag overlap + area-name match in tags
  const scored = strategies
    .map(s => {
      const sTags = (s.tags || []).map(t => String(t).toLowerCase());
      const overlap = sTags.filter(t => studentTags.includes(t)).length;
      const areaMatch = goalArea && sTags.some(t => t === goalArea) ? 2 : 0;
      const textMatch = sTags.some(t => goalText.includes(t)) ? 1 : 0;
      return { strategy: s, score: overlap + areaMatch + textMatch };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.strategy || null;
}

// Bundles the per-student render data for the visual tracker.
// Returns: [{ student, goals: [{ goal, summary, latestOption, recentSupports, suggestion }] }]
export function buildVisualGoalData({ studentIds, studentsMap, logs, strategies, windowDays = 14 }) {
  if (!Array.isArray(studentIds)) return [];
  return studentIds
    .map(id => studentsMap?.[id])
    .filter(Boolean)
    .map(student => {
      const goals = (student.goals || []).map(goal => {
        const summary = summarizeGoalProgress(logs, goal.id, windowDays);
        return {
          goal,
          summary,
          latestOption: optionForId(summary.latestOptionId),
          recentSupports: recentSupportTagsForStudent(logs, student.id, 7, 4),
          suggestion: pickNextBestSupport({ student, goal, strategies }),
        };
      });
      return { student, goals };
    });
}
