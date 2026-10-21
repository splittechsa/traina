import { apiBaseUrl, apiRequest, ApiClientError } from '../api/client';
import { getTokens, sessionEpoch } from '../api/tokens';
export function accountScope(): string | null {
  const id = getTokens()?.userId;
  return id ? apiBaseUrl() + '|' + id : null;
}
/** Cache only successful owned reads. Never substitute local data for authorization errors. */
export async function accountResource<T>(path: string, decode?: (value: unknown) => T): Promise<T> {
  const owner = accountScope(); const epoch = sessionEpoch();
  try {
    const response = await apiRequest<T>(path);
    const value = decode ? decode(response) : response;
    if (owner !== null && epoch === sessionEpoch()) await (await import('./sqlite')).writeAccountSnapshot(owner, 'resource:' + path, value);
    return value;
  } catch (error) {
    if (owner && epoch === sessionEpoch() && error instanceof ApiClientError && ['OFFLINE', 'TIMEOUT'].includes(error.code)) {
      const value = await (await import('./sqlite')).readAccountSnapshot<T>(owner, 'resource:' + path);
      if (value !== null) return decode ? decode(value) : value;
    }
    throw error;
  }
}
