import {
  resolveLabel,
  resolveExportName,
  resolveById,
  EXPORT_MODE,
  buildRealNameMap,
} from '../privacy/nameResolver';

// ── Fixtures ─────────────────────────────────────────────────

const studentWithIdentity = {
  id: 'stu_1',
  pseudonym: 'Red Student 1',
  color: '#ef4444',
  identity: {
    colorName: 'Red',
    color: '#ef4444',
    emoji: '🔥',
    codename: 'Ember',
    sequenceNumber: 1,
  },
};

const studentWithoutIdentity = {
  id: 'stu_2',
  pseudonym: 'Blue Student 2',
  color: '#3b82f6',
};

const allStudents = {
  stu_1: studentWithIdentity,
  stu_2: studentWithoutIdentity,
};

const registryEntry = {
  studentId: 'stu_1',
  realName: 'Jane Doe',
  pseudonym: 'Red Student 1',
};

// ── resolveLabel ──────────────────────────────────────────────

describe('resolveLabel — display label', () => {
  test('returns compact identity label when identity is present', () => {
    expect(resolveLabel(studentWithIdentity)).toBe('🔥 Ember 1');
  });

  test('returns full label when format is "full"', () => {
    expect(resolveLabel(studentWithIdentity, 'full')).toBe('Red • 🔥 Ember 1');
  });

  test('falls back to pseudonym when no identity', () => {
    expect(resolveLabel(studentWithoutIdentity)).toBe('Blue Student 2');
  });

  test('returns "Unknown" for null student', () => {
    expect(resolveLabel(null)).toBe('Unknown');
  });

  test('returns "Unknown" for undefined student', () => {
    expect(resolveLabel(undefined)).toBe('Unknown');
  });
});

// ── resolveExportName ─────────────────────────────────────────

describe('resolveExportName — safe mode', () => {
  test('returns identity label in SAFE mode', () => {
    expect(resolveExportName(studentWithIdentity, EXPORT_MODE.SAFE)).toBe('🔥 Ember 1');
  });

  test('returns pseudonym in SAFE mode when no identity', () => {
    expect(resolveExportName(studentWithoutIdentity, EXPORT_MODE.SAFE)).toBe('Blue Student 2');
  });

  test('ignores realNameMap in SAFE mode even if provided', () => {
    const map = new Map([['stu_1', 'Jane Doe']]);
    expect(resolveExportName(studentWithIdentity, EXPORT_MODE.SAFE, map)).toBe('🔥 Ember 1');
  });
});

describe('resolveExportName — private mode', () => {
  test('returns realName from map in PRIVATE mode when id is present', () => {
    const map = new Map([['stu_1', 'Jane Doe']]);
    expect(resolveExportName(studentWithIdentity, EXPORT_MODE.PRIVATE, map)).toBe('Jane Doe');
  });

  test('falls back to identity label in PRIVATE mode when id not in map', () => {
    const map = new Map([['stu_99', 'Other Person']]);
    expect(resolveExportName(studentWithIdentity, EXPORT_MODE.PRIVATE, map)).toBe('🔥 Ember 1');
  });

  test('falls back to identity label in PRIVATE mode when realNameMap is null', () => {
    expect(resolveExportName(studentWithIdentity, EXPORT_MODE.PRIVATE, null)).toBe('🔥 Ember 1');
  });

  test('falls back to pseudonym in PRIVATE mode when no identity and not in map', () => {
    const map = new Map();
    expect(resolveExportName(studentWithoutIdentity, EXPORT_MODE.PRIVATE, map)).toBe('Blue Student 2');
  });
});

// ── EXPORT_MODE constant ──────────────────────────────────────

describe('EXPORT_MODE', () => {
  test('SAFE is defined', () => {
    expect(EXPORT_MODE.SAFE).toBeDefined();
  });

  test('PRIVATE is defined', () => {
    expect(EXPORT_MODE.PRIVATE).toBeDefined();
  });

  test('SAFE and PRIVATE are distinct values', () => {
    expect(EXPORT_MODE.SAFE).not.toBe(EXPORT_MODE.PRIVATE);
  });
});

// ── resolveById ───────────────────────────────────────────────

describe('resolveById', () => {
  test('returns the student object for a known id', () => {
    expect(resolveById('stu_1', allStudents)).toBe(studentWithIdentity);
  });

  test('returns undefined for an unknown id', () => {
    expect(resolveById('stu_99', allStudents)).toBeUndefined();
  });

  test('returns undefined when allStudents is empty', () => {
    expect(resolveById('stu_1', {})).toBeUndefined();
  });
});

// ── buildRealNameMap ──────────────────────────────────────────

describe('buildRealNameMap', () => {
  test('builds a Map keyed by studentId with realName values', () => {
    const map = buildRealNameMap([registryEntry]);
    expect(map.get('stu_1')).toBe('Jane Doe');
  });

  test('skips entries with no studentId', () => {
    const map = buildRealNameMap([{ realName: 'No Id' }]);
    expect(map.size).toBe(0);
  });

  test('skips entries with no realName', () => {
    const map = buildRealNameMap([{ studentId: 'stu_1' }]);
    expect(map.size).toBe(0);
  });

  test('returns empty Map for empty registry', () => {
    const map = buildRealNameMap([]);
    expect(map.size).toBe(0);
  });

  test('handles multiple entries', () => {
    const registry = [
      { studentId: 'stu_1', realName: 'Jane Doe' },
      { studentId: 'stu_2', realName: 'John Smith' },
    ];
    const map = buildRealNameMap(registry);
    expect(map.size).toBe(2);
    expect(map.get('stu_2')).toBe('John Smith');
  });
});
