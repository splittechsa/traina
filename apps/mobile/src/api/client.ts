import { getApiBaseOverride, getTokens, replaceTokens, sessionEpoch } from './tokens';
import { perfMark, safeResource } from '../performance/lab';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let localeHeader: 'ar' | 'en' = 'ar';
let refreshPromise: Promise<boolean> | null = null;

export function setApiLocale(locale: 'ar' | 'en'): void {
  localeHeader = locale;
}

export function apiBaseUrl(): string {
  const override = getApiBaseOverride();
  const configured = override ?? process.env.EXPO_PUBLIC_API_URL;
  return configured !== undefined && configured.length > 0 ? configured.replace(/\/$/, '') : 'http://127.0.0.1:3040';
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

async function refreshAccess(): Promise<boolean> {
  const tokens = getTokens();
  if (tokens === null) {
    return false;
  }
  const refreshEpoch = sessionEpoch();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': localeHeader },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      signal: controller.signal,
    });
  } finally { clearTimeout(timer); }
  if (sessionEpoch() !== refreshEpoch) return false;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) await replaceTokens(null);
    return false;
  }
  const body = (await response.json()) as { accessToken: string; refreshToken: string };
  if (sessionEpoch() !== refreshEpoch) return false;
  await replaceTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken, userId: tokens.userId });
  return true;
}

function refreshAccessOnce(): Promise<boolean> {
  if (refreshPromise !== null) {
    return refreshPromise;
  }
  refreshPromise = refreshAccess().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const requestEpoch = sessionEpoch();
  const headers = new Headers();
  headers.set('accept-language', localeHeader);
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (options.auth !== false) {
    const access = getTokens()?.accessToken;
    if (access !== undefined) {
      headers.set('authorization', `Bearer ${access}`);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  const started=performance.now();
  let observedStatus=0;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    observedStatus=response.status;
  } catch (caught) {
    const aborted = caught instanceof Error && caught.name === 'AbortError';
    throw new ApiClientError(0, aborted ? 'TIMEOUT' : 'OFFLINE', aborted ? 'Request timed out' : 'Network unavailable');
  } finally {
    perfMark('api',safeResource(path),performance.now()-started,observedStatus);
    clearTimeout(timer);
  }
  if (options.auth !== false && requestEpoch !== sessionEpoch()) throw new ApiClientError(409, 'ACCOUNT_CHANGED', 'Account changed during request');
  if (response.status === 401 && options.auth !== false && !retried && !path.startsWith('/v1/auth/')) {
    const refreshed = await refreshAccessOnce().catch(() => false);
    if (refreshed) {
      return apiRequest<T>(path, options, true);
    }
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (options.auth !== false && requestEpoch !== sessionEpoch()) throw new ApiClientError(409, 'ACCOUNT_CHANGED', 'Account changed during request');
  if (!response.ok) {
    throw new ApiClientError(response.status, payload.error?.code ?? 'HTTP', payload.error?.message ?? 'Request failed');
  }
  return payload as T;
}
