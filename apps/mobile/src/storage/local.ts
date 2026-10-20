import { accountScope } from '../offline/resource';
// Small on-device preferences (step goal, macro estimate, recent foods, barcode→food links).
// SecureStore is already a dependency and is fine for these few-hundred-byte JSON blobs.
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

function scopedKey(key: string): string | null {
  const owner = accountScope();
  return owner === null ? null : 'sahhti.account.' + [...owner + '|' + key].map(char => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
}
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const scoped = scopedKey(key);
    if (scoped === null) return fallback;
    const raw = await SecureStore.getItemAsync(scoped);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const scoped = scopedKey(key); if (scoped === null) throw new Error('LOCAL_ACCOUNT_UNVERIFIED');
  await SecureStore.setItemAsync(scoped, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  const scoped = scopedKey(key); if (scoped !== null) await SecureStore.deleteItemAsync(scoped);
}

/** React Query-backed local value, so every screen reading it updates together. */
export function useLocalValue<T>(key: string, fallback: T) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['local', accountScope(), key], queryFn: () => readJson<T>(key, fallback), staleTime: Infinity });
  const save = useCallback(
    async (value: T) => {
      await writeJson(key, value);
      client.setQueryData(['local', accountScope(), key], value);
    },
    [client, key],
  );
  return { value: query.data ?? fallback, ready: query.isSuccess, save };
}

export const LOCAL_KEYS = {
  stepGoal: 'sahhti.stepGoal',
  macroTargets: 'sahhti.macroTargets',
  recentFoods: 'sahhti.recentFoods',
  offLink: (code: string) => `sahhti.off.${code.replace(/[^\w.-]/g, '')}`,
} as const;
