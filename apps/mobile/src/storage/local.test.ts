import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTokenMemory, setApiBaseOverride } from '../api/tokens';
import { readJson, writeJson } from './local';
const values = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({ getItemAsync: async (key: string) => values.get(key) ?? null, setItemAsync: async (key: string, value: string) => { values.set(key, value); }, deleteItemAsync: async (key: string) => { values.delete(key); } }));
afterEach(() => { setTokenMemory(null); setApiBaseOverride(null); values.clear(); });
describe('account-bound local preferences and drafts', () => {
  it('never adopts unowned legacy drafts and isolates accounts and API environments', async () => {
    values.set('sahhti.onboarding.draft', JSON.stringify({ name: 'legacy owner unknown' }));
    setApiBaseOverride('https://first'); setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    expect(await readJson('sahhti.onboarding.draft', null)).toBeNull();
    await writeJson('macro-targets', { energy: 2000 });
    setTokenMemory({ accessToken: 'b', refreshToken: 'r', userId: 'account-b' });
    expect(await readJson('macro-targets', null)).toBeNull();
    await writeJson('macro-targets', { energy: 2500 });
    setTokenMemory({ accessToken: 'a', refreshToken: 'r', userId: 'account-a' });
    expect(await readJson('macro-targets', null)).toEqual({ energy: 2000 });
    setApiBaseOverride('https://other'); expect(await readJson('macro-targets', null)).toBeNull();
    setTokenMemory(null); await expect(writeJson('macro-targets', {})).rejects.toThrow('LOCAL_ACCOUNT_UNVERIFIED');
  });
});
