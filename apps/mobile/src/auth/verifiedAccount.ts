import { apiBaseUrl } from '../api/client';
import type { StoredTokens } from '../api/tokens';
export async function verifyLocalAccount(tokens: StoredTokens): Promise<StoredTokens> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(apiBaseUrl() + '/v1/me', { headers: { authorization: 'Bearer ' + tokens.accessToken }, signal: controller.signal });
    if (!response.ok) throw new Error('Could not verify account identity');
    const me = await response.json() as { userId: unknown };
    if (typeof me.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me.userId)) throw new Error('Invalid account identity');
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userId: me.userId };
  } finally { clearTimeout(timeout); }
}
