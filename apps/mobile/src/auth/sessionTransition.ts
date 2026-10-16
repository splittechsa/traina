import type { StoredTokens } from '../api/tokens';

export async function transitionSession(
  clearUserCache: () => void,
  persistTokens: (tokens: StoredTokens | null) => Promise<void>,
  next: StoredTokens | null,
): Promise<void> {
  clearUserCache();
  await persistTokens(next);
}
