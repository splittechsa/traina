import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { getTokens, setApiBaseOverride, setTokenMemory, setTokenPersistor } from './tokens';

afterEach(() => {
  setApiBaseOverride(null);
  setTokenMemory(null);
  setTokenPersistor(async () => undefined);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiRequest token refresh', () => {
  it('bounds a stalled refresh and preserves offline credentials on temporary failure', async () => {
    vi.useFakeTimers();
    setTokenMemory({ accessToken: 'expired', refreshToken: 'refresh', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/v1/auth/refresh')) return new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
      return new Response('{}', { status: 401 });
    }));
    const request = apiRequest('/v1/me'); const rejected = expect(request).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(12001); await rejected;
    expect(getTokens()?.userId).toBe('account-a');
  });
  it('does not erase durable account identity when refresh service returns 503', async () => {
    setTokenMemory({ accessToken: 'expired', refreshToken: 'refresh', userId: 'account-a' });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response('{}', { status: url.endsWith('/refresh') ? 503 : 401 })));
    await expect(apiRequest('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(getTokens()?.userId).toBe('account-a');
  });
  it('rejects a late account A response after switching to B', async () => {
    setTokenMemory({ accessToken: 'a', refreshToken: 'ra', userId: 'account-a' });
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const response = apiRequest('/v1/me');
    const rejected = expect(response).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    setTokenMemory({ accessToken: 'b', refreshToken: 'rb', userId: 'account-b' });
    finish(new Response(JSON.stringify({ userId: 'account-a' })));
    await rejected;
  });
  it('does not resurrect old credentials when a delayed refresh finishes after logout', async () => {
    setTokenMemory({ accessToken: 'expired', refreshToken: 'ra', userId: 'account-a' });
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/v1/auth/refresh') ? new Promise<Response>(resolve => { finish = resolve; }) : new Response('{}', { status: 401 })));
    const response = apiRequest('/v1/me'); const rejected = expect(response).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    setTokenMemory(null); finish(new Response(JSON.stringify({ accessToken: 'late', refreshToken: 'late' })));
    await rejected;
  });
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

it('retries a late old-token 401 with the already rotated token instead of rotating again',async()=>{
  setTokenMemory({accessToken:'old',refreshToken:'refresh',userId:'account-a'});
  let finish!: (response:Response)=>void;let refreshes=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
    if(url.endsWith('/refresh')){refreshes++;return new Response(JSON.stringify({accessToken:'new',refreshToken:'rotated'}));}
    if((init.headers as Headers).get('authorization')==='Bearer new')return new Response('{"ok":true}');
    if(url.endsWith('/late'))return new Promise<Response>(resolve=>{finish=resolve;});
    return new Response('{}',{status:401});
  }));
  const late=apiRequest('/v1/late');await expect(apiRequest('/v1/early')).resolves.toEqual({ok:true});
  finish(new Response('{}',{status:401}));await expect(late).resolves.toEqual({ok:true});expect(refreshes).toBe(1);
});
it('bounds a stalled successful response body by the request deadline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => ({
    status: 200, ok: true,
    json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('body aborted')))),
  })));
  const rejected = expect(apiRequest('/v1/me', { timeoutMs: 100 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  await vi.advanceTimersByTimeAsync(101); await rejected;
});
it('bounds a stalled refresh response body and preserves account identity', async () => {
  vi.useFakeTimers(); setTokenMemory({ accessToken: 'expired', refreshToken: 'refresh', userId: 'account-a' });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => url.endsWith('/refresh') ? {
    status: 200, ok: true,
    json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('body aborted')))),
  } : new Response('{}', { status: 401 })));
  const rejected = expect(apiRequest('/v1/me')).rejects.toMatchObject({ status: 401 });
  await vi.advanceTimersByTimeAsync(12001); await rejected; expect(getTokens()?.userId).toBe('account-a');
});
