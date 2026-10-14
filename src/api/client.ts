import { getApiBaseOverride, getTokens, replaceTokens } from './tokens';

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
};

async function refreshAccess(): Promise<boolean> {
  const tokens = getTokens();
  if (tokens === null) {
    return false;
  }
  const response = await fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': localeHeader },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!response.ok) {
    await replaceTokens(null);
    return false;
  }
  const body = (await response.json()) as { accessToken: string; refreshToken: string };
  await replaceTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return true;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
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
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiClientError(0, 'OFFLINE', 'Network unavailable');
  }
  if (response.status === 401 && options.auth !== false && !retried && !path.startsWith('/v1/auth/')) {
    const refreshed = await refreshAccess().catch(() => false);
    if (refreshed) {
      return apiRequest<T>(path, options, true);
    }
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) {
    throw new ApiClientError(response.status, payload.error?.code ?? 'HTTP', payload.error?.message ?? 'Request failed');
  }
  return payload as T;
}
