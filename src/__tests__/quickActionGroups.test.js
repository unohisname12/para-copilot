import { buildQuickActionGroups, QA_CATEGORIES } from '../components/panels/quickActionGroups';
import { QUICK_ACTIONS } from '../data';

describe('buildQuickActionGroups', () => {
  test('every shipped QUICK_ACTION lands in exactly one category', () => {
    const groups = buildQuickActionGroups(QUICK_ACTIONS);
    const counts = {};
    groups.forEach(g => g.actions.forEach(a => { counts[a.id] = (counts[a.id] || 0) + 1; }));
    QUICK_ACTIONS.forEach(a => {
      expect(counts[a.id]).toBe(1);
    });
  });

  test('returns groups in the configured order', () => {
    const groups = buildQuickActionGroups(QUICK_ACTIONS);
    expect(groups.map(g => g.id)).toEqual(
      QA_CATEGORIES
        .filter(cat => cat.actionIds.some(id => QUICK_ACTIONS.find(a => a.id === id)))
        .map(c => c.id)
    );
  });

  test('drops categories with zero matching actions', () => {
    const partial = QUICK_ACTIONS.filter(a => a.id === 'qa_positive'); // only 1 action
    const groups = buildQuickActionGroups(partial);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('positive');
  });

  test('puts unmapped actions into an Other group rather than dropping them', () => {
    const fakeAction = { id: 'qa_unknown', label: 'New', icon: '?', logType: 'X', defaultNote: '', tags: [] };
    const groups = buildQuickActionGroups([...QUICK_ACTIONS, fakeAction]);
    const other = groups.find(g => g.id === 'other');
    expect(other).toBeTruthy();
    expect(other.actions.map(a => a.id)).toEqual(['qa_unknown']);
  });

  test('handles empty/null input safely', () => {
    expect(buildQuickActionGroups([])).toEqual([]);
    expect(buildQuickActionGroups(null)).toEqual([]);
  });
});
