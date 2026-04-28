jest.mock('../services/supabaseClient', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

import {
  signInWithGoogle,
  signOut,
  createTeam,
  joinTeamByCode,
  pushStudents,
  getMyAssignedStudents,
} from '../services/teamSync';
import { supabase } from '../services/supabaseClient';

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
});

describe('teamSync auth + teams', () => {
  test('signInWithGoogle calls OAuth with google provider', async () => {
    await signInWithGoogle();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  test('signOut calls supabase.auth.signOut', async () => {
    await signOut();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('createTeam calls create_team RPC and returns team', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { id: 't1', name: 'Lincoln MS', invite_code: 'ABC123' },
      error: null,
    });
    const t = await createTeam('Lincoln MS', 'Alice');
    expect(t.name).toBe('Lincoln MS');
    expect(supabase.rpc).toHaveBeenCalledWith('create_team', {
      team_name: 'Lincoln MS',
      display: 'Alice',
    });
  });

  test('joinTeamByCode throws on invalid code', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Invalid invite code' } });
    await expect(joinTeamByCode('BAD', 'Alice')).rejects.toThrow('Invalid invite code');
  });

  test('joinTeamByCode returns team on success', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: { id: 't1', name: 'Team', invite_code: 'ABC123' },
      error: null,
    });
    const t = await joinTeamByCode('ABC123', 'Alice');
    expect(t.id).toBe('t1');
  });
});

describe('pushStudents', () => {
  test('maps app-shape student to DB row with correct field names', async () => {
    const insertMock = jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    }));
    supabase.from.mockReturnValueOnce({ insert: insertMock });

    const students = [{
      pseudonym: 'Red 1',
      color: '#ef4444',
      periodId: 'p1',
      classLabel: 'Period 1 — Language Arts 7',
      goals: [{ id: 'g1', text: 'reading' }],
      accs: ['Extended time'],
      caseManager: 'Smith',
    }];
    await pushStudents('t1', students, 'u1');

    const rows = insertMock.mock.calls[0][0];
    expect(rows[0]).toMatchObject({
      team_id: 't1',
      pseudonym: 'Red 1',
      color: '#ef4444',
      period_id: 'p1',
      class_label: 'Period 1 — Language Arts 7',
      accs: ['Extended time'],
      case_manager: 'Smith',
      created_by: 'u1',
    });
  });

  test('FERPA guard throws in dev when realName leaks into input', async () => {
    const students = [{
      pseudonym: 'Red 1',
      color: '#ef4444',
      goals: [{ id: 'g1', realName: 'Jane Doe', text: 'reading' }],
    }];
    await expect(pushStudents('t1', students, 'u1')).rejects.toThrow(/FERPA/);
  });

  test('returns empty array when no students', async () => {
    const result = await pushStudents('t1', [], 'u1');
    expect(result).toEqual([]);
  });

  test('upserts students with stable external keys', async () => {
    const selectMock = jest.fn().mockResolvedValue({ data: [{ id: 'db1' }], error: null });
    const upsertMock = jest.fn(() => ({ select: selectMock }));
    supabase.from.mockReturnValueOnce({ upsert: upsertMock });

    await pushStudents('t1', [{
      pseudonym: 'Blue 1',
      color: '#3b82f6',
      paraAppNumber: '123456',
    }], 'u1');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ team_id: 't1', external_key: '123456' }),
      ]),
      { onConflict: 'team_id,external_key' }
    );
  });
});

describe('assigned students', () => {
  test('reads from my_assigned_students view', async () => {
    const orderMock = jest.fn().mockResolvedValue({ data: [{ id: 's1' }], error: null });
    const selectMock = jest.fn(() => ({ order: orderMock }));
    supabase.from.mockReturnValueOnce({ select: selectMock });

    const rows = await getMyAssignedStudents();

    expect(supabase.from).toHaveBeenCalledWith('my_assigned_students');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('period_id', { ascending: true });
    expect(rows).toEqual([{ id: 's1' }]);
  });
});
