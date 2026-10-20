import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountResource } from './resource';
import { ApiClientError } from '../api/client';
import { setTokenMemory, setApiBaseOverride } from '../api/tokens';
const data = vi.hoisted(() => new Map<string, unknown>());
vi.mock('./sqlite', () => ({
  readAccountSnapshot: async (owner: string, key: string) => data.get(owner + key) ?? null,
  writeAccountSnapshot: async (owner: string, key: string, value: unknown) => { data.set(owner + key, value); },
}));
afterEach(() => { setTokenMemory(null); setApiBaseOverride(null); data.clear(); vi.unstubAllGlobals(); });
describe('cold-start resource fallback', () => {
  it('restores only the signed-in account and rejects authorization failures instead of falling back', async () => {
    setApiBaseOverride('https://test'); setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ session: { id: 'workout-a' } }))));
    await accountResource('/v1/training/sessions/a');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network'); }));
    expect(await accountResource('/v1/training/sessions/a')).toEqual({ session: { id: 'workout-a' } });
    setTokenMemory({ accessToken: 'b', refreshToken: 'r', userId: 'account-b' });
    await expect(accountResource('/v1/training/sessions/a')).rejects.toMatchObject({ code: 'OFFLINE' });
    setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })));
    await expect(accountResource('/v1/training/sessions/a')).rejects.toBeInstanceOf(ApiClientError);
  });
});
