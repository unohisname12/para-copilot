import {
  splitByStudents,
  buildBundleFromExtraction,
  buildMatchReport,
  stripNameFromSection,
  splitBundleMarkdown,
  assembleBundleFromFiles,
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

describe('splitBundleMarkdown', () => {
  test('splits per-student sections by H2 headings', () => {
    const md = `# Mr. Dre — Student IEP Summaries

intro text here

---

## Maria Garcia

**Eligibility:** SLD

### Strengths
Hardworking

---

## James Wilson

**Eligibility:** Speech

### Strengths
Curious
`;
    const sections = splitBundleMarkdown(md);
    expect(sections.size).toBe(2);
    expect(sections.has('Maria Garcia')).toBe(true);
    expect(sections.has('James Wilson')).toBe(true);
    expect(sections.get('Maria Garcia')).toContain('SLD');
    expect(sections.get('James Wilson')).toContain('Speech');
  });

  test('ignores H1 and H3 headings — only splits on H2', () => {
    const md = `# Title\n## Real Kid\n### IEP Goals\nGoals here\n## Other Kid\nstuff`;
    const sections = splitBundleMarkdown(md);
    expect([...sections.keys()]).toEqual(['Real Kid', 'Other Kid']);
  });

  test('returns empty map when no H2 sections exist', () => {
    expect(splitBundleMarkdown('').size).toBe(0);
    expect(splitBundleMarkdown('# Just a title').size).toBe(0);
  });
});

describe('assembleBundleFromFiles', () => {
  const SAMPLE_MD = `# Mr. Dre — Summaries

---

## Maria Garcia

**Eligibility:** SLD
**Case Manager:** Jones
**Grade:** 7th

### Strengths
Hardworking and motivated.

### IEP Goals
- **Reading** — Identify central idea in grade-level text
- **Writing** — Write 5-sentence paragraph

### Accommodations
- **Extended time** — 1.5x on tests
- **Graphic organizer** — for writing

---

## James Wilson

**Eligibility:** Speech
**Grade:** 6th

### Strengths
Funny, social.

### IEP Goals
- **Speech** — Articulate /r/ sound

### Accommodations
- **Preferential seating** — front of room
`;

  test('builds bundle from MD only with auto-generated paraAppNumbers', () => {
    const bundle = assembleBundleFromFiles({ md: SAMPLE_MD });
    expect(bundle.schemaVersion).toBe('2.0');
    expect(bundle.normalizedStudents.students).toHaveLength(2);
    expect(bundle.privateRosterMap.privateRosterMap).toHaveLength(2);

    const maria = bundle.privateRosterMap.privateRosterMap.find(p => p.realName === 'Maria Garcia');
    expect(maria).toBeTruthy();
    // Auto-generated paraAppNumbers must be 6-digit strings
    expect(maria.paraAppNumber).toMatch(/^\d{6}$/);

    // IEP fields parsed from the structured MD
    const mariaStu = bundle.normalizedStudents.students.find(
      s => s.paraAppNumber === maria.paraAppNumber
    );
    expect(mariaStu.eligibility).toBe('SLD');
    expect(mariaStu.caseManager).toBe('Jones');
    expect(mariaStu.goals.length).toBeGreaterThan(0);
    expect(mariaStu.accs.length).toBeGreaterThan(0);
  });

  test('paraAppNumbers from MD-only mode are deterministic across runs', () => {
    const a = assembleBundleFromFiles({ md: SAMPLE_MD });
    const b = assembleBundleFromFiles({ md: SAMPLE_MD });
    const aMaria = a.privateRosterMap.privateRosterMap.find(p => p.realName === 'Maria Garcia');
    const bMaria = b.privateRosterMap.privateRosterMap.find(p => p.realName === 'Maria Garcia');
    expect(aMaria.paraAppNumber).toBe(bMaria.paraAppNumber);
  });

  test('builds bundle from MD + CSV pair with paraAppNumbers from CSV', () => {
    const csv = `Name,ParaAppNumber\nMaria Garcia,847293\nJames Wilson,128456\n`;
    const bundle = assembleBundleFromFiles({ md: SAMPLE_MD, csv });

    const maria = bundle.privateRosterMap.privateRosterMap.find(p => p.realName === 'Maria Garcia');
    const james = bundle.privateRosterMap.privateRosterMap.find(p => p.realName === 'James Wilson');
    expect(maria.paraAppNumber).toBe('847293');
    expect(james.paraAppNumber).toBe('128456');

    // IEP data still parsed from MD
    const mariaStu = bundle.normalizedStudents.students.find(s => s.paraAppNumber === '847293');
    expect(mariaStu.eligibility).toBe('SLD');
  });

  test('CSV entries with no MD section still appear in roster (IEP fields blank)', () => {
    const md = `## Maria Garcia\n\n**Eligibility:** SLD\n`;
    const csv = `Name,ParaAppNumber\nMaria Garcia,847293\nNo IEP Yet,555555\n`;
    const bundle = assembleBundleFromFiles({ md, csv });
    expect(bundle.privateRosterMap.privateRosterMap).toHaveLength(2);
    const noIep = bundle.normalizedStudents.students.find(s => s.paraAppNumber === '555555');
    expect(noIep.eligibility).toBe('');
    expect(noIep.flags.iepNotYetOnFile).toBe(true);
  });

  test('throws if neither MD nor CSV provided', () => {
    expect(() => assembleBundleFromFiles({})).toThrow();
  });

  test('extracts periods from MD and stamps onto normalizedStudent + privateRosterMap', () => {
    const md = `## Maria Garcia\n\n**Eligibility:** SLD\n\n- Period 1 — Language Arts 7 — Ms. Lambard\n\n### Strengths\nHardworking.\n`;
    const bundle = assembleBundleFromFiles({ md });
    const stu = bundle.normalizedStudents.students[0];
    expect(stu.periodId).toBe('p1');
    expect(stu.classLabel).toBe('Language Arts 7');
    expect(stu.teacherName).toBe('Ms. Lambard');
    const pr = bundle.privateRosterMap.privateRosterMap[0];
    expect(pr.periodId).toBe('p1');
    expect(pr.classLabel).toBe('Language Arts 7');
  });

  test('cross-period kid gets one privateRosterMap row per period', () => {
    const md = `## Multi Kid\n\n**Eligibility:** SLD\n\n- Period 1 — ELA 7 — Mr. A\n- Period 4 — Science 8 — Ms. B\n`;
    const bundle = assembleBundleFromFiles({ md });
    expect(bundle.normalizedStudents.students).toHaveLength(1);
    expect(bundle.privateRosterMap.privateRosterMap).toHaveLength(2);
    const periodIds = bundle.privateRosterMap.privateRosterMap.map(r => r.periodId).sort();
    expect(periodIds).toEqual(['p1', 'p4']);
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
