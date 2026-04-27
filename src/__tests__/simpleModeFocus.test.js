import { commitFocusedDraft } from '../features/simple-mode/SimpleMode';

describe('commitFocusedDraft', () => {
  test('saves a non-empty draft as a General Observation log', () => {
    const addLog = jest.fn();
    const allStudents = { stu_a: { id: 'stu_a', pseudonym: 'Red Student 1' } };
    const result = commitFocusedDraft({
      draft: 'kicked the desk after long division',
      studentId: 'stu_a',
      allStudents,
      addLog,
    });
    expect(result).toBe(true);
    expect(addLog).toHaveBeenCalledTimes(1);
    expect(addLog).toHaveBeenCalledWith(
      'stu_a',
      'kicked the desk after long division',
      'General Observation',
      expect.objectContaining({
        source: 'simple_mode_focus',
        category: 'general',
        pseudonym: 'Red Student 1',
      })
    );
  });

  test('whitespace-only draft is a no-op', () => {
    const addLog = jest.fn();
    const result = commitFocusedDraft({
      draft: '   \n  ',
      studentId: 'stu_a',
      allStudents: { stu_a: {} },
      addLog,
    });
    expect(result).toBe(false);
    expect(addLog).not.toHaveBeenCalled();
  });

  test('missing studentId is a no-op', () => {
    const addLog = jest.fn();
    const result = commitFocusedDraft({
      draft: 'real text',
      studentId: null,
      allStudents: {},
      addLog,
    });
    expect(result).toBe(false);
    expect(addLog).not.toHaveBeenCalled();
  });

  test('missing addLog returns false without throwing', () => {
    const result = commitFocusedDraft({
      draft: 'real text',
      studentId: 'stu_a',
      allStudents: {},
      addLog: null,
    });
    expect(result).toBe(false);
  });

  test('mid-write swap commits the prior draft (no lost notes)', () => {
    // Para starts writing for stu_a, then taps stu_b before saving.
    // The swap logic should commit stu_a's draft first.
    const addLog = jest.fn();
    const allStudents = {
      stu_a: { id: 'stu_a', pseudonym: 'Red Student 1' },
      stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1' },
    };

    let focused = 'stu_a';
    let draft = 'started note for Red';

    // Simulate the swap transition that lives in SimpleMode's swapFocus().
    if (focused && draft.trim()) {
      commitFocusedDraft({ draft, studentId: focused, allStudents, addLog });
    }
    focused = 'stu_b';
    draft = '';

    expect(addLog).toHaveBeenCalledTimes(1);
    expect(addLog).toHaveBeenCalledWith(
      'stu_a',
      'started note for Red',
      'General Observation',
      expect.objectContaining({ pseudonym: 'Red Student 1' })
    );
  });

  test('swap with empty current draft does NOT save anything', () => {
    // Empty draft + swap → just changes focus, no orphan log.
    const addLog = jest.fn();
    const allStudents = {
      stu_a: { id: 'stu_a' },
      stu_b: { id: 'stu_b' },
    };
    let focused = 'stu_a';
    let draft = '';
    if (focused && draft.trim()) {
      commitFocusedDraft({ draft, studentId: focused, allStudents, addLog });
    }
    focused = 'stu_b';
    expect(addLog).not.toHaveBeenCalled();
  });

  test('handles a student with no pseudonym gracefully', () => {
    const addLog = jest.fn();
    const result = commitFocusedDraft({
      draft: 'note',
      studentId: 'stu_unknown',
      allStudents: {},
      addLog,
    });
    expect(result).toBe(true);
    expect(addLog).toHaveBeenCalledWith(
      'stu_unknown',
      'note',
      'General Observation',
      expect.objectContaining({ pseudonym: undefined })
    );
  });
});
