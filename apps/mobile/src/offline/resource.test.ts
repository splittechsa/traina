import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountResource } from './resource';
import { ApiClientError } from '../api/client';
import { setTokenMemory, setApiBaseOverride } from '../api/tokens';
const data = vi.hoisted(() => new Map<string, unknown>());
const cache = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('./sqlite', () => ({
  readAccountSnapshot: async (owner: string, key: string) => data.get(owner + key) ?? null,
  writeAccountSnapshot: async (owner: string, key: string, value: unknown) => { await cache.write(); data.set(owner + key, value); },
}));
afterEach(() => { setTokenMemory(null); setApiBaseOverride(null); data.clear(); cache.write.mockReset(); vi.unstubAllGlobals(); });
describe('cold-start resource fallback', () => {
  it('restores only the signed-in account and rejects authorization failures instead of falling back', async () => {
    setApiBaseOverride('https://test'); setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ session: { id: 'workout-a' } }))));
    await accountResource('/v1/training/sessions/a');
    await vi.dynamicImportSettled();
    await vi.waitFor(() => expect(data.size).toBe(1));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network'); }));
    expect(await accountResource('/v1/training/sessions/a')).toEqual({ session: { id: 'workout-a' } });
    setTokenMemory({ accessToken: 'b', refreshToken: 'r', userId: 'account-b' });
    await expect(accountResource('/v1/training/sessions/a')).rejects.toMatchObject({ code: 'OFFLINE' });
    setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })));
    await expect(accountResource('/v1/training/sessions/a')).rejects.toBeInstanceOf(ApiClientError);
  });
});

it('returns authoritative network data even while the optional snapshot cache is stalled', async()=>{
  setApiBaseOverride('https://test'); setTokenMemory({accessToken:'a',refreshToken:'r',userId:'account-a'});
  cache.write.mockImplementation(()=>new Promise(()=>undefined));
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{"ok":true}')));
  await expect(accountResource('/v1/home')).resolves.toEqual({ok:true});
});
it('does not display a false request failure if persisting a read cache fails',async()=>{
  setApiBaseOverride('https://test');setTokenMemory({accessToken:'a',refreshToken:'r',userId:'account-a'});
  cache.write.mockRejectedValue(new Error('disk unavailable'));
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{"ok":true}')));
  await expect(accountResource('/v1/home')).resolves.toEqual({ok:true});
});
