import {
  parseRosterJson, parseRosterCsv, parseRosterMarkdown, dedupeAndValidate,
} from '../features/import/rosterParsers';

describe('parseRosterJson', () => {
  test('array of objects with realName + paraAppNumber', () => {
    const { entries, errors } = parseRosterJson(JSON.stringify([
      { realName: 'Maria Garcia', paraAppNumber: '847293' },
      { realName: 'James Wilson', paraAppNumber: '128456' },
    ]));
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ realName: 'Maria Garcia', paraAppNumber: '847293' });
  });

  test('object wrapper with students key', () => {
    const { entries } = parseRosterJson(JSON.stringify({
      students: [{ name: 'Test Kid', number: '123456' }],
    }));
    expect(entries).toEqual([{ realName: 'Test Kid', paraAppNumber: '123456' }]);
  });

  test('accepts fullName and externalKey as alternates', () => {
    const { entries } = parseRosterJson(JSON.stringify([
      { fullName: 'Alice', externalKey: '111111' },
    ]));
    expect(entries).toEqual([{ realName: 'Alice', paraAppNumber: '111111' }]);
  });

  test('flags non-6-digit numbers', () => {
    const { entries, errors } = parseRosterJson(JSON.stringify([
      { realName: 'Bad', paraAppNumber: '99' },
    ]));
    expect(entries).toHaveLength(0);
    expect(errors[0]).toMatch(/not a 6-digit/);
  });

  test('bad JSON returns error', () => {
    const { errors } = parseRosterJson('not json');
    expect(errors[0]).toMatch(/Invalid JSON/);
  });
});

describe('parseRosterCsv', () => {
  test('name,number with header', () => {
    const { entries } = parseRosterCsv('Name,ParaAppNumber\nMaria Garcia,847293\nJames Wilson,128456');
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ realName: 'James Wilson', paraAppNumber: '128456' });
  });

  test('number,name order auto-detected', () => {
    const { entries } = parseRosterCsv('847293,Maria Garcia\n128456,James Wilson');
    expect(entries[0]).toEqual({ realName: 'Maria Garcia', paraAppNumber: '847293' });
  });

  test('quoted names with commas', () => {
    const { entries } = parseRosterCsv('Name,Number\n"Smith, Jane",111111');
    expect(entries[0].realName).toBe('Smith, Jane');
  });

  test('reports rows missing a 6-digit number', () => {
    const { entries, errors } = parseRosterCsv('Name,Number\nNo Number,abc');
    expect(entries).toHaveLength(0);
    expect(errors[0]).toMatch(/6-digit/);
  });
});

describe('parseRosterMarkdown', () => {
  test('colon-separated lines', () => {
    const text = `Maria Garcia: 847293\nJames Wilson: 128456`;
    const { entries } = parseRosterMarkdown(text);
    expect(entries).toEqual([
      { realName: 'Maria Garcia', paraAppNumber: '847293' },
      { realName: 'James Wilson', paraAppNumber: '128456' },
    ]);
  });

  test('em-dash separator', () => {
    const { entries } = parseRosterMarkdown('Maria Garcia — 847293');
    expect(entries[0]).toEqual({ realName: 'Maria Garcia', paraAppNumber: '847293' });
  });

  test('markdown table', () => {
    const md = `| Name | Para # |
| --- | --- |
| Maria Garcia | 847293 |
| James Wilson | 128456 |`;
    const { entries } = parseRosterMarkdown(md);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ realName: 'Maria Garcia', paraAppNumber: '847293' });
  });

  test('number-first order', () => {
    const { entries } = parseRosterMarkdown('847293: Maria Garcia');
    expect(entries[0]).toEqual({ realName: 'Maria Garcia', paraAppNumber: '847293' });
  });

  test('ignores markdown headings and hrules', () => {
    const md = `# Roster\n\n---\n\nMaria Garcia: 847293`;
    const { entries } = parseRosterMarkdown(md);
    expect(entries).toHaveLength(1);
  });
});

describe('dedupeAndValidate', () => {
  test('deduplicates same-name same-number', () => {
    const { entries, errors } = dedupeAndValidate([
      { realName: 'Maria Garcia', paraAppNumber: '847293' },
      { realName: 'Maria Garcia', paraAppNumber: '847293' },
    ]);
    expect(entries).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('flags same name with different numbers', () => {
    const { errors } = dedupeAndValidate([
      { realName: 'Maria Garcia', paraAppNumber: '111111' },
      { realName: 'Maria Garcia', paraAppNumber: '222222' },
    ]);
    expect(errors[0]).toMatch(/two different para numbers/);
  });

  test('flags same number assigned to different names', () => {
    const { errors } = dedupeAndValidate([
      { realName: 'Alice', paraAppNumber: '111111' },
      { realName: 'Bob', paraAppNumber: '111111' },
    ]);
    expect(errors[0]).toMatch(/two students/);
  });
});
