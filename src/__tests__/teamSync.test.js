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
