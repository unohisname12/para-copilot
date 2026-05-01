import {
  chooseFollowUpDelay,
  createPendingFollowUp,
  expireOldFollowUps,
  getDueFollowUps,
  snoozeFollowUp,
} from '../features/help/followUpScheduler';

const now = new Date('2026-05-01T10:00:00.000Z');

function incident(description, extra = {}) {
  return {
    id: 'inc_1',
    studentId: 'stu_001',
    description,
    date: '2026-05-01',
    periodId: 'p3',
    tags: [],
    ...extra,
  };
}

function intervention(staffNote, extra = {}) {
  return {
    id: 'intv_1',
    incidentId: 'inc_1',
    studentId: 'stu_001',
    staffNote,
    strategyLabel: '',
    accommodationUsed: [],
    ...extra,
  };
}

describe('follow-up scheduler', () => {
  test('uses 5 minutes for safety notes', () => {
    expect(chooseFollowUpDelay({
      incident: incident('Student ran out of room and threw chair'),
      intervention: intervention('Followed at distance'),
    })).toMatchObject({ reason: 'safety', delayMinutes: 5 });
  });

  test('uses 10 minutes for task refusal notes', () => {
    expect(chooseFollowUpDelay({
      incident: incident('Student did not start task'),
      intervention: intervention('Offered first then choice'),
    })).toMatchObject({ reason: 'task_refusal', delayMinutes: 10 });
  });

  test('uses 15 minutes for regulation notes', () => {
    expect(chooseFollowUpDelay({
      incident: incident('Student was crying at desk'),
      intervention: intervention('Offered calm space and breathing'),
    })).toMatchObject({ reason: 'regulation', delayMinutes: 15 });
  });

  test('uses 20 minutes for academic supports', () => {
    expect(chooseFollowUpDelay({
      incident: incident('Student stuck on worksheet'),
      intervention: intervention('Chunked assignment and used calculator'),
    })).toMatchObject({ reason: 'academic_support', delayMinutes: 20 });
  });

  test('creates a pending follow-up with a 5 day expiry', () => {
    const followUp = createPendingFollowUp({
      incident: incident('Student refused work'),
      intervention: intervention('Reduced task to problems 1-3'),
      currentDate: '2026-05-01',
      activePeriod: 'p3',
      now,
    });

    expect(followUp.status).toBe('pending');
    expect(followUp.studentId).toBe('stu_001');
    expect(followUp.nextPromptAt).toBe('2026-05-01T10:10:00.000Z');
    expect(followUp.expiresAt).toBe('2026-05-06T10:00:00.000Z');
  });

  test('creates immediate follow-up when note still needs what staff tried', () => {
    const followUp = createPendingFollowUp({
      incident: incident('Student threw chair'),
      intervention: null,
      currentDate: '2026-05-01',
      activePeriod: 'p3',
      needsIntervention: true,
      now,
    });

    expect(followUp.needsIntervention).toBe(true);
    expect(followUp.interventionId).toBe(null);
    expect(followUp.reason).toBe('needs_intervention');
    expect(followUp.nextPromptAt).toBe('2026-05-01T10:00:00.000Z');
  });

  test('finds due follow-ups and ignores future ones', () => {
    const due = { id: 'due', status: 'pending', nextPromptAt: '2026-05-01T09:59:00.000Z', expiresAt: '2026-05-06T10:00:00.000Z' };
    const future = { id: 'future', status: 'pending', nextPromptAt: '2026-05-01T10:30:00.000Z', expiresAt: '2026-05-06T10:00:00.000Z' };
    expect(getDueFollowUps([future, due], now).map(f => f.id)).toEqual(['due']);
  });

  test('snoozes follow-ups', () => {
    const snoozed = snoozeFollowUp({ id: 'fu_1', attempts: 1 }, 15, now);
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.attempts).toBe(2);
    expect(snoozed.nextPromptAt).toBe('2026-05-01T10:15:00.000Z');
  });

  test('expires old unanswered follow-ups', () => {
    const expired = { id: 'old', status: 'pending', expiresAt: '2026-05-01T09:59:00.000Z' };
    const active = { id: 'new', status: 'pending', expiresAt: '2026-05-02T09:59:00.000Z' };
    expect(expireOldFollowUps([expired, active], now)).toEqual([
      { ...expired, status: 'expired' },
      active,
    ]);
  });
});
