import { runTrainingGapRules } from '../engine';
import { NEW_STUDENT_MIN_LOGS } from '../engine/trainingGapRules';

function log({ studentId = 'stu_001', tags = [], daysAgo = 0 } = {}) {
  const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { id: `log_${Math.random()}`, studentId, tags, timestamp: ts };
}

// Build N filler logs for a student so the new-student threshold is satisfied
// without polluting any rule's matching logic. Tag 'positive' is benign for all
// 3 v1 rules (presence side never includes it; counter side includes it for
// Rule 2 but with max:1, two extra positives would suppress it — so we use the
// neutral 'general' tag instead which no v1 rule references at all).
function fillerLogs(studentId, count, daysAgoStart = 30) {
  return Array.from({ length: count }, (_, i) =>
    log({ studentId, tags: ['general'], daysAgo: daysAgoStart + i })
  );
}

describe('runTrainingGapRules', () => {
  test('returns no topics for a student below the new-student log threshold', () => {
    const logs = [
      log({ tags: ['break', 'regulation'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
    ];
    const result = runTrainingGapRules(logs, ['stu_001']);
    expect(result.topics).toEqual([]);
  });

  test('Rule 1 (escape-reinforcement) fires when threshold met and student passes log threshold', () => {
    // Include a skill_teaching log so Rule 3 (reactive-without-skill-building)
    // doesn't co-fire — keeps this test focused on Rule 1 in isolation.
    const triggerLogs = [
      log({ tags: ['break', 'regulation'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
      log({ tags: ['skill_teaching', 'replacement'], daysAgo: 5 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'escape_reinforcement_pattern');
    expect(fired).toBeDefined();
    expect(fired.studentId).toBe('stu_001');
    expect(fired.evidenceLogs.length).toBeGreaterThanOrEqual(3);
  });

  test('Rule 1 does NOT fire if a counter (fct) log is present', () => {
    const triggerLogs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
      log({ tags: ['fct', 'replacement_skill'], daysAgo: 3 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'escape_reinforcement_pattern');
    expect(fired).toBeUndefined();
  });

  test('Rule 2 (attention-loop) fires when 3+ redirects + 0–1 positive logs', () => {
    const triggerLogs = [
      log({ tags: ['redirect', 'behavior'], daysAgo: 0 }),
      log({ tags: ['redirect', 'behavior'], daysAgo: 1 }),
      log({ tags: ['redirect', 'behavior'], daysAgo: 2 }),
      log({ tags: ['positive'], daysAgo: 3 }), // one positive — still fires
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'attention_loop_pattern');
    expect(fired).toBeDefined();
  });

  test('Rule 2 does NOT fire when 2+ positive logs balance the redirects', () => {
    const triggerLogs = [
      log({ tags: ['redirect'], daysAgo: 0 }),
      log({ tags: ['redirect'], daysAgo: 1 }),
      log({ tags: ['redirect'], daysAgo: 2 }),
      log({ tags: ['positive'], daysAgo: 3 }),
      log({ tags: ['praise'], daysAgo: 4 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'attention_loop_pattern');
    expect(fired).toBeUndefined();
  });

  test('Rule 3 (reactive-without-skill-building) fires on mixed reactive interventions with no skill teaching', () => {
    const triggerLogs = [
      log({ tags: ['redirect'], daysAgo: 0 }),
      log({ tags: ['deescalation'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'reactive_without_skill_building_pattern');
    expect(fired).toBeDefined();
  });

  test('Rule 3 does NOT fire if a skill_teaching log exists in the window', () => {
    const triggerLogs = [
      log({ tags: ['redirect'], daysAgo: 0 }),
      log({ tags: ['deescalation'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
      log({ tags: ['skill_teaching', 'replacement'], daysAgo: 3 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const fired = result.topics.find(t => t.ruleId === 'reactive_without_skill_building_pattern');
    expect(fired).toBeUndefined();
  });

  test('topics are scoped per-student and do not bleed across students', () => {
    // Stu_001 has the pattern; stu_002 only has 1 break — should not fire.
    const logs = [
      ...fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS),
      log({ studentId: 'stu_001', tags: ['break'], daysAgo: 0 }),
      log({ studentId: 'stu_001', tags: ['break'], daysAgo: 1 }),
      log({ studentId: 'stu_001', tags: ['break'], daysAgo: 2 }),
      ...fillerLogs('stu_002', NEW_STUDENT_MIN_LOGS),
      log({ studentId: 'stu_002', tags: ['break'], daysAgo: 0 }),
    ];
    const result = runTrainingGapRules(logs, ['stu_001', 'stu_002']);
    const firedFor002 = result.topics.find(
      t => t.studentId === 'stu_002' && t.ruleId === 'escape_reinforcement_pattern'
    );
    const firedFor001 = result.topics.find(
      t => t.studentId === 'stu_001' && t.ruleId === 'escape_reinforcement_pattern'
    );
    expect(firedFor001).toBeDefined();
    expect(firedFor002).toBeUndefined();
  });

  test('returned topic includes rule metadata for the audit panel', () => {
    const triggerLogs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
    ];
    const filler = fillerLogs('stu_001', NEW_STUDENT_MIN_LOGS);
    const result = runTrainingGapRules([...triggerLogs, ...filler], ['stu_001']);
    const topic = result.topics[0];
    expect(topic.topicTitle).toBeTruthy();
    expect(topic.topicExplainer).toBeTruthy();
    expect(topic.alternatives.length).toBeGreaterThan(0);
    expect(topic.plainEnglishRule).toBeTruthy();
    expect(topic.window).toEqual({ days: 7 });
  });
});
