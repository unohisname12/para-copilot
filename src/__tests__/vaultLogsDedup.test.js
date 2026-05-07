import { mergeVaultLogs } from '../App';

const noopResolve = () => null;

describe('mergeVaultLogs', () => {
  test('cloud echo of local mass-log entry does NOT produce a duplicate', () => {
    const ts = '2026-05-07T18:00:00.000Z';
    const local = [{
      id: 'log_local_1',
      studentId: 'stu_gen_001',
      paraAppNumber: '847293',
      timestamp: ts,
      type: 'Participation',
      note: 'on task',
    }];
    const shared = [{
      id: 'cloud_uuid_xyz',
      student_id: 'team_student_uuid_abc',
      external_key: '847293',
      timestamp: ts,
      type: 'Participation',
      note: 'on task',
      user_id: 'me',
    }];
    const out = mergeVaultLogs({
      logs: local,
      sharedLogs: shared,
      tombstones: new Set(),
      allStudents: {},
      currentUserId: 'me',
      resolveStudentByParaAppNumber: noopResolve,
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('log_local_1');
  });

  test('cloud-only log from teammate still surfaces', () => {
    const out = mergeVaultLogs({
      logs: [],
      sharedLogs: [{
        id: 'cloud_only_1',
        student_id: 'team_student_uuid_abc',
        external_key: '999',
        timestamp: '2026-05-07T19:00:00.000Z',
        type: 'Behavior Incident',
        note: 'kicked chair',
        user_id: 'teammate',
      }],
      tombstones: new Set(),
      allStudents: {},
      currentUserId: 'me',
      resolveStudentByParaAppNumber: noopResolve,
    });
    expect(out).toHaveLength(1);
    expect(out[0].sharedFromTeammate).toBe(true);
  });

  test('tombstone wins over cloud echo', () => {
    const out = mergeVaultLogs({
      logs: [],
      sharedLogs: [{
        id: 'cloud_dead_1',
        student_id: 'x',
        external_key: '111',
        timestamp: 't',
        type: 'X',
        user_id: 'me',
      }],
      tombstones: new Set(['cloud_dead_1']),
      allStudents: {},
      currentUserId: 'me',
      resolveStudentByParaAppNumber: noopResolve,
    });
    expect(out).toHaveLength(0);
  });

  test('logs with no paraAppNumber dedupe by timestamp+type+note', () => {
    const ts = '2026-05-07T20:00:00.000Z';
    const out = mergeVaultLogs({
      logs: [{ id: 'L', studentId: 'stu_001', paraAppNumber: null, timestamp: ts, type: 'Note', note: 'hello' }],
      sharedLogs: [{ id: 'C', student_id: null, external_key: null, timestamp: ts, type: 'Note', note: 'hello', user_id: 'me' }],
      tombstones: new Set(),
      allStudents: {},
      currentUserId: 'me',
      resolveStudentByParaAppNumber: noopResolve,
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('L');
  });
});
