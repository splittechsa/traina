// Small on-device preferences (step goal, macro estimate, recent foods, barcode→food links).
// SecureStore is already a dependency and is fine for these few-hundred-byte JSON blobs.
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

/** React Query-backed local value, so every screen reading it updates together. */
export function useLocalValue<T>(key: string, fallback: T) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['local', key], queryFn: () => readJson<T>(key, fallback), staleTime: Infinity });
  const save = useCallback(
    async (value: T) => {
      client.setQueryData(['local', key], value);
      await writeJson(key, value);
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
