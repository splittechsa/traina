import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { replaceTokens, setApiBaseOverride, setTokenMemory, setTokenPersistor, type StoredTokens } from '../api/tokens';
import { transitionSession } from './sessionTransition';

const ACCESS = 'sahhti.access';
const REFRESH = 'sahhti.refresh';
export const API_URL_KEY = 'sahhti.apiBase';

type SessionValue = {
  ready: boolean;
  tokens: StoredTokens | null;
  save: (tokens: StoredTokens) => Promise<void>;
  clear: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

async function readStored(): Promise<StoredTokens | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS);
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (accessToken === null || refreshToken === null) {
    return null;
  }
  return { accessToken, refreshToken };
}

async function writeStored(tokens: StoredTokens | null): Promise<void> {
  if (tokens === null) {
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
    return;
  }
  await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<StoredTokens | null>(null);

  useEffect(() => {
    setTokenPersistor(async (next) => {
      if (next === null) {
        queryClient.clear();
      }
      await writeStored(next);
      setTokens(next);
    });
    void Promise.all([readStored(), SecureStore.getItemAsync(API_URL_KEY)])
      .then(([stored, apiBase]) => {
        if (apiBase !== null && apiBase.length > 0) {
          setApiBaseOverride(apiBase);
        }
        setTokenMemory(stored);
        setTokens(stored);
      })
      .finally(() => setReady(true));
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      tokens,
      save: (next) => transitionSession(() => queryClient.clear(), replaceTokens, next),
      clear: () => transitionSession(() => queryClient.clear(), replaceTokens, null),
    }),
    [queryClient, ready, tokens],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('SessionProvider is missing');
  }
  return value;
}
