import { verifyRoster } from '../features/import/verifyRoster';

const makeStu = (id, paraAppNumber, periodId = 'p1') => ({
  id, paraAppNumber, periodId, pseudonym: `Stu ${id}`,
});

describe('verifyRoster', () => {
  test('matches CSV name + number against an imported student → linked', () => {
    const imported = { stu_a: makeStu('stu_a', '111111') };
    const vault = { '111111': 'Maria Garcia' };
    const csv = 'Name,ParaAppNumber\nMaria Garcia,111111\n';
    const { rows, summary } = verifyRoster({ imported, vault, csvText: csv });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('linked');
    expect(rows[0].realName).toBe('Maria Garcia');
    expect(rows[0].paraAppNumber).toBe('111111');
    expect(summary.linked).toBe(1);
  });

  test('CSV row whose number is not in app → missing', () => {
    const imported = {};
    const vault = {};
    const csv = 'Name,ParaAppNumber\nMaria Garcia,111111\n';
    const { rows, summary } = verifyRoster({ imported, vault, csvText: csv });
    expect(rows[0].status).toBe('missing');
    expect(summary.missing).toBe(1);
  });

  test('imported student whose number is not in the CSV → orphan', () => {
    const imported = {
      stu_a: makeStu('stu_a', '111111'),
      stu_b: makeStu('stu_b', '999999'),
    };
    const vault = { '111111': 'Maria Garcia', '999999': 'Old Kid' };
    const csv = 'Name,ParaAppNumber\nMaria Garcia,111111\n';
    const { rows, summary } = verifyRoster({ imported, vault, csvText: csv });
    const orphan = rows.find(r => r.status === 'orphan');
    expect(orphan).toBeDefined();
    expect(orphan.realName).toBe('Old Kid');
    expect(orphan.paraAppNumber).toBe('999999');
    expect(summary.orphan).toBe(1);
  });

  test('same number used by two CSV rows → collision', () => {
    const imported = { stu_a: makeStu('stu_a', '111111') };
    const vault = { '111111': 'Maria Garcia' };
    const csv = 'Name,ParaAppNumber\nMaria Garcia,111111\nDifferent Kid,111111\n';
    const { rows, summary } = verifyRoster({ imported, vault, csvText: csv });
    const collisions = rows.filter(r => r.status === 'collision');
    expect(collisions).toHaveLength(2);
    expect(summary.collision).toBe(2);
  });

  test('imported student with no periodId → noPeriod', () => {
    const imported = { stu_a: { ...makeStu('stu_a', '111111'), periodId: '' } };
    const vault = { '111111': 'Maria Garcia' };
    const csv = 'Name,ParaAppNumber\nMaria Garcia,111111\n';
    const { rows, summary } = verifyRoster({ imported, vault, csvText: csv });
    expect(rows[0].status).toBe('noPeriod');
    expect(summary.noPeriod).toBe(1);
  });

  test('unparseable CSV → returns informative error array', () => {
    const { rows, errors } = verifyRoster({ imported: {}, vault: {}, csvText: '' });
    expect(rows).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('summary aggregates across all statuses', () => {
    const imported = {
      stu_a: makeStu('stu_a', '111111'), // linked
      stu_b: { ...makeStu('stu_b', '222222'), periodId: '' }, // noPeriod
      stu_c: makeStu('stu_c', '333333'), // orphan
    };
    const vault = { '111111': 'A', '222222': 'B', '333333': 'C' };
    const csv = 'Name,ParaAppNumber\nA,111111\nB,222222\nD,444444\n';
    const { summary } = verifyRoster({ imported, vault, csvText: csv });
    expect(summary.linked).toBe(1);
    expect(summary.noPeriod).toBe(1);
    expect(summary.orphan).toBe(1);
    expect(summary.missing).toBe(1);
  });
});
