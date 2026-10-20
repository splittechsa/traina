import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyLocalAccount } from './verifiedAccount';
afterEach(() => vi.unstubAllGlobals());
describe('verified local account binding', () => {
  it('uses the authenticated server identity even if the caller supplies another identity', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      expect(init.headers.authorization).toBe('Bearer verified-access');
      return new Response(JSON.stringify({ userId: '90000000-0000-4000-8000-000000000002' }));
    }));
    const bound = await verifyLocalAccount({ accessToken: 'verified-access', refreshToken: 'refresh', userId: 'spoofed' });
    expect(bound.userId).toBe('90000000-0000-4000-8000-000000000002');
  });
  it('refuses unauthenticated and malformed identity responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await expect(verifyLocalAccount({ accessToken: 'a', refreshToken: 'r' })).rejects.toThrow('verify account');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ userId: 'not-a-user-id' }))));
    await expect(verifyLocalAccount({ accessToken: 'a', refreshToken: 'r' })).rejects.toThrow('Invalid account');
  });
});
