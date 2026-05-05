// How many auto-prompts the para gets before they're left alone:
// 1 initial fire + 1 retry after "Ask me later" = 2 total. After that
// the entry stays in the Follow-ups panel for manual entry only.
const MAX_ATTEMPTS = 2;

// Add `n` business days to a date — skip Saturday and Sunday. Used so
// follow-ups created on Friday don't expire over the weekend before the
// para is back in school. Uses UTC so the result is the same regardless
// of the device timezone.
export function addBusinessDays(date, n) {
  const d = new Date(date.getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  // Push to UTC end-of-day so the para gets the full final business day
  // even if their local timezone is east of UTC.
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

const RULES = [
  {
    reason: 'safety',
    delayMinutes: 5,
    pattern: /\b(unsafe|hit|hitting|kicked|punched|aggressive|eloped|bolted|ran\s*out|left\s*room|chair|throw|threw|throwing|destroying|flipped)\b/i,
  },
  {
    reason: 'task_refusal',
    delayMinutes: 10,
    pattern: /\b(refus\w*|would\s*not|won'?t|did\s*not\s*(start|do)|didn'?t\s*(start|do)|off[-\s]?task|shut\s*down|head\s*down)\b/i,
  },
  {
    reason: 'regulation',
    delayMinutes: 15,
    pattern: /\b(break|calm|breath\w*|sensory|headphones|quiet\s*space|dysregulated|crying|cried|meltdown)\b/i,
  },
  {
    reason: 'academic_support',
    delayMinutes: 20,
    pattern: /\b(chunk\w*|calculator|read\s*aloud|first[-\s]?then|worksheet|assignment|problems?|writing|reading|math|graphic\s*organizer)\b/i,
  },
  {
    reason: 'transition',
    delayMinutes: 30,
    pattern: /\b(transition|hallway|arrival|dismissal|pack\s*up|bell|next\s*class)\b/i,
  },
  {
    reason: 'next_day',
    delayMinutes: 18 * 60,
    pattern: /\b(parent|home|attendance|tomorrow|next\s*day|long[-\s]?term)\b/i,
  },
];

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function textFor({ incident, intervention }) {
  return [
    incident?.description,
    incident?.category,
    ...(incident?.tags || []),
    intervention?.strategyLabel,
    intervention?.staffNote,
    ...(intervention?.accommodationUsed || []),
  ].filter(Boolean).join(' ');
}

export function chooseFollowUpDelay({ incident, intervention } = {}) {
  const text = textFor({ incident, intervention });
  const matched = RULES.find(rule => rule.pattern.test(text));
  return matched || { reason: 'default', delayMinutes: 15 };
}

export function formatDelayLabel(minutes) {
  if (minutes >= 24 * 60) return 'tomorrow';
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? 'about 1 hour' : `about ${hours} hours`;
  }
  return `about ${minutes} minutes`;
}

export function createPendingFollowUp({ incident, intervention, currentDate, activePeriod, needsIntervention = false, now = new Date() }) {
  if (!incident?.id || !incident?.studentId) return null;
  if (!needsIntervention && !intervention?.id) return null;
  const { reason, delayMinutes } = needsIntervention
    ? { reason: 'needs_intervention', delayMinutes: 0 }
    : chooseFollowUpDelay({ incident, intervention });
  const nextPromptAt = addMinutes(now, delayMinutes);
  const label = intervention?.strategyLabel || intervention?.staffNote || 'what you tried';
  return {
    id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    incidentId: incident.id,
    interventionId: intervention?.id || null,
    studentId: incident.studentId,
    paraAppNumber: incident.paraAppNumber || intervention?.paraAppNumber || null,
    prompt: `What happened after ${label}?`,
    createdAt: now.toISOString(),
    nextPromptAt: nextPromptAt.toISOString(),
    expiresAt: addBusinessDays(now, 2).toISOString(),
    status: 'pending',
    attempts: 0,
    reason,
    delayMinutes,
    needsIntervention,
    currentDate: currentDate || incident.date || null,
    activePeriod: activePeriod || incident.periodId || null,
  };
}

export function getDueFollowUps(followUps, now = new Date()) {
  if (!Array.isArray(followUps)) return [];
  return followUps
    .filter(f => ['pending', 'snoozed'].includes(f.status))
    // Cap auto-prompts: para gets the initial fire plus one snoozed
    // retry. After that, the entry stays in the Follow-ups panel for
    // manual entry — no more banner / modal nags during class.
    .filter(f => (f.attempts || 0) < MAX_ATTEMPTS)
    .filter(f => new Date(f.expiresAt).getTime() > now.getTime())
    .filter(f => new Date(f.nextPromptAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.nextPromptAt).getTime() - new Date(b.nextPromptAt).getTime());
}

export function snoozeFollowUp(followUp, delayMinutes = 15, now = new Date()) {
  return {
    ...followUp,
    status: 'snoozed',
    attempts: (followUp.attempts || 0) + 1,
    nextPromptAt: addMinutes(now, delayMinutes).toISOString(),
  };
}

export function expireOldFollowUps(followUps, now = new Date()) {
  if (!Array.isArray(followUps)) return [];
  return followUps.map(f => {
    if (['answered', 'dismissed', 'expired'].includes(f.status)) return f;
    return new Date(f.expiresAt).getTime() <= now.getTime()
      ? { ...f, status: 'expired' }
      : f;
  });
}

// After 2 business days from creation, the entry is past its useful life
// — the para has already moved on and asking now would be guessing.
// Drop the row entirely so localStorage doesn't grow forever.
export function purgeExpiredFollowUps(followUps, now = Date.now()) {
  if (!Array.isArray(followUps)) return [];
  return followUps.filter(f => {
    if (['answered', 'dismissed'].includes(f.status)) return false;
    return new Date(f.expiresAt).getTime() > now;
  });
}
