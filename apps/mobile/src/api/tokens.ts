export type StoredTokens = { accessToken: string; refreshToken: string; userId?: string };

let baseOverride: string | null = null;
let current: StoredTokens | null = null;
let epoch = 0;
export function sessionEpoch(): number { return epoch; }

export function getApiBaseOverride(): string | null {
  return baseOverride;
}

export function setApiBaseOverride(url: string | null): void {
  baseOverride = url === null || url.trim().length === 0 ? null : url.trim().replace(/\/$/, '');
}
let persist: (tokens: StoredTokens | null) => Promise<void> = async () => undefined;

export function getTokens(): StoredTokens | null {
  return current;
}

export function setTokenMemory(tokens: StoredTokens | null): void {
  if (current?.userId !== tokens?.userId || current === null || tokens === null || (!tokens.userId && current?.accessToken !== tokens.accessToken)) epoch++;
  current = tokens;
}

export function setTokenPersistor(next: (tokens: StoredTokens | null) => Promise<void>): void {
  persist = next;
}

export async function replaceTokens(tokens: StoredTokens | null): Promise<void> {
  setTokenMemory(tokens);
  await persist(tokens);
}
