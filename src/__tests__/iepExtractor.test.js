import {
  splitByStudents,
  buildBundleFromExtraction,
  buildMatchReport,
  stripNameFromSection,
} from '../features/import/iepExtractor';

describe('splitByStudents', () => {
  test('splits a 2-student doc by name', () => {
    const doc = `
Jordan Smith
Eligibility: Speech/Language
Goals: Speech clarity
Accommodations: Extended time

Taylor Johnson
Eligibility: SLD
Goals: Reading fluency
Accommodations: Large print`;
    const sections = splitByStudents(doc, ['Jordan Smith', 'Taylor Johnson']);
    expect(sections.size).toBe(2);
    expect(sections.get('Jordan Smith')).toContain('Speech/Language');
    expect(sections.get('Taylor Johnson')).toContain('SLD');
  });

  test('handles middle name / initial', () => {
    const doc = `Jordan T. Smith\nEligibility: Speech\n\nTaylor Johnson\nEligibility: SLD`;
    const sections = splitByStudents(doc, ['Jordan Smith', 'Taylor Johnson']);
    expect(sections.has('Jordan Smith')).toBe(true);
    expect(sections.get('Jordan Smith')).toContain('Speech');
  });

  test('returns empty when no names found', () => {
    const sections = splitByStudents('Blah blah unrelated text', ['Jordan Smith']);
    expect(sections.size).toBe(0);
  });

  test('case-insensitive name match', () => {
    const doc = `JORDAN SMITH\nEligibility: Speech`;
    const sections = splitByStudents(doc, ['Jordan Smith']);
    expect(sections.size).toBe(1);
  });

  test('preserves order by document position (not input order)', () => {
    const doc = `Zack Wilson\nEligibility: X\n\nAmy Parker\nEligibility: Y`;
    const sections = splitByStudents(doc, ['Amy Parker', 'Zack Wilson']);
    const keys = [...sections.keys()];
    // Document order: Zack first (at index 0), then Amy.
    expect(keys[0]).toBe('Zack Wilson');
    expect(keys[1]).toBe('Amy Parker');
  });
});

describe('buildBundleFromExtraction', () => {
  test('assembles bundle with matching paraAppNumber and IEP data', () => {
    const roster = [
      { realName: 'Maria Garcia', paraAppNumber: '847293' },
      { realName: 'James Wilson', paraAppNumber: '128456' },
    ];
    const parsed = new Map([
      ['Maria Garcia', { eligibility: 'SLD', accommodations: ['Extended time'], goals: ['Reading fluency'], caseManager: 'Smith' }],
      ['James Wilson', { eligibility: 'Speech', accommodations: ['Graphic organizer'], goals: ['Articulation'] }],
    ]);

    const bundle = buildBundleFromExtraction(roster, parsed);
    expect(bundle.schemaVersion).toBe('2.0');
    expect(bundle.normalizedStudents.students).toHaveLength(2);
    expect(bundle.privateRosterMap.privateRosterMap).toHaveLength(2);

    const first = bundle.normalizedStudents.students[0];
    expect(first.eligibility).toBe('SLD');
    expect(first.accs).toEqual(['Extended time']);
    expect(first.goals[0].text).toBe('Reading fluency');
    expect(first.paraAppNumber).toBe('847293');
    expect(first.sourceMeta.importType).toBe('smart_import');

    const firstPrivate = bundle.privateRosterMap.privateRosterMap[0];
    expect(firstPrivate.realName).toBe('Maria Garcia');
    expect(firstPrivate.paraAppNumber).toBe('847293');
  });

  test('students missing from parsed map get iepNotYetOnFile flag', () => {
    const roster = [{ realName: 'Missing Kid', paraAppNumber: '111111' }];
    const bundle = buildBundleFromExtraction(roster, new Map());
    expect(bundle.normalizedStudents.students[0].flags.iepNotYetOnFile).toBe(true);
    expect(bundle.normalizedStudents.students[0].eligibility).toBe('');
  });
});

describe('stripNameFromSection', () => {
  test('replaces full name with [STUDENT]', () => {
    const input = 'Jordan Smith\nEligibility: Speech\nJordan needs extra time.';
    const out = stripNameFromSection('Jordan Smith', input);
    expect(out).not.toMatch(/Jordan/i);
    expect(out).not.toMatch(/Smith/i);
    expect(out).toMatch(/STUDENT/);
    expect(out).toMatch(/Eligibility: Speech/);
  });

  test('handles first name or last name references later in the text', () => {
    const input = 'Jordan Smith\nBackground\nSmith has struggled with articulation. Jordan will attend speech therapy.';
    const out = stripNameFromSection('Jordan Smith', input);
    expect(out).not.toMatch(/\bJordan\b/);
    expect(out).not.toMatch(/\bSmith\b/);
  });

  test('strips "Name:" and "Student:" lines', () => {
    const input = 'Name: Jordan Smith\nGrade: 7\nStudent: Jordan\nGoals: articulation';
    const out = stripNameFromSection('Jordan Smith', input);
    expect(out).not.toMatch(/^Name:/m);
    expect(out).not.toMatch(/^Student:/m);
    expect(out).toMatch(/Grade: 7/);
    expect(out).toMatch(/Goals:/);
  });

  test('is safe with no name given', () => {
    const input = 'Some unrelated text.';
    expect(stripNameFromSection('', input)).toBe('Some unrelated text.');
  });
});

describe('buildMatchReport', () => {
  test('tags each kid as ok / section_but_no_ai / no_section', () => {
    const roster = [
      { realName: 'A', paraAppNumber: '111111' },
      { realName: 'B', paraAppNumber: '222222' },
      { realName: 'C', paraAppNumber: '333333' },
    ];
    const sections = new Map([['A', 'text'], ['B', 'text']]);
    const parsed   = new Map([['A', { eligibility: 'SLD' }]]);
    const report   = buildMatchReport(roster, sections, parsed);

    expect(report[0].status).toBe('ok');               // A: section + parsed
    expect(report[1].status).toBe('section_but_no_ai'); // B: section only
    expect(report[2].status).toBe('no_section');       // C: nothing
  });
});
