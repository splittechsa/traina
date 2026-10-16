import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { setApiBaseOverride, setTokenMemory, setTokenPersistor } from './tokens';

afterEach(() => {
  setApiBaseOverride(null);
  setTokenMemory(null);
  setTokenPersistor(async () => undefined);
  vi.unstubAllGlobals();
});

describe('apiRequest token refresh', () => {
  it('deduplicates concurrent refreshes and retries both requests', async () => {
    setApiBaseOverride('https://api.test');
    setTokenMemory({ accessToken: 'expired', refreshToken: 'refresh' });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(JSON.stringify({ accessToken: 'fresh', refreshToken: 'rotated' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      const headers = init?.headers as Headers;
      if (headers?.get('authorization') === 'Bearer fresh') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      apiRequest<{ ok: boolean }>('/v1/first'),
      apiRequest<{ ok: boolean }>('/v1/second'),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/v1/auth/refresh'))).toHaveLength(1);
  });
});
