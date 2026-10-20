import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { attachPerformanceLab, lab, synthetic } from '../performance/lab';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { replaceTokens, setApiBaseOverride, setTokenMemory, setTokenPersistor, type StoredTokens } from '../api/tokens';
import { verifyLocalAccount } from './verifiedAccount';
import { transitionSession } from './sessionTransition';

const SESSION = 'sahhti.verifiedSession.v1';
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
  const record = await SecureStore.getItemAsync(SESSION);
  if (record !== null) {
    const value = JSON.parse(record) as StoredTokens;
    if (typeof value.accessToken === 'string' && typeof value.refreshToken === 'string' && typeof value.userId === 'string') return value;
  }
  const accessToken = await SecureStore.getItemAsync(ACCESS);
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (accessToken === null || refreshToken === null) {
    return null;
  }
  return { accessToken, refreshToken };
}

async function writeStored(tokens: StoredTokens | null): Promise<void> {
  if (tokens === null) {
    await SecureStore.deleteItemAsync(SESSION);
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
    return;
  }
  await SecureStore.setItemAsync(SESSION, JSON.stringify(tokens));
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const previous=useRef<StoredTokens|null|undefined>(undefined);
  useEffect(()=>{
    attachPerformanceLab();const current=lab();if(!current)return;
    current.enter=async next=>{
      const verified=await verifyLocalAccount(next);
      if(previous.current===undefined)previous.current=tokens;
      await transitionSession(()=>queryClient.clear(),replaceTokens,verified);synthetic(true);
    };
    current.leave=async()=>{
      if(previous.current===undefined)return;const restore=previous.current;
      await transitionSession(()=>queryClient.clear(),replaceTokens,restore);previous.current=undefined;synthetic(false);
    };
  },[queryClient,tokens]);

  useEffect(() => {
    setTokenPersistor(async (next) => {
      if (next === null) {
        queryClient.clear();
      }
      await writeStored(next);
      setTokens(next);
    });
    void Promise.all([readStored(), SecureStore.getItemAsync(API_URL_KEY)])
      .then(async ([stored, apiBase]) => {
        if (apiBase !== null && apiBase.length > 0) {
          setApiBaseOverride(apiBase);
        }
        if (stored && !stored.userId) {
          try { stored = await verifyLocalAccount(stored); await writeStored(stored); } catch { /* Unverified legacy credentials cannot open local account data. */ }
        }
        setTokenMemory(stored);
        setTokens(stored);
      })
      .catch(() => { setTokenMemory(null); setTokens(null); })
      .finally(() => setReady(true));
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      tokens,
      save: async (next) => {
        const verified = await verifyLocalAccount(next);
        await transitionSession(() => queryClient.clear(), replaceTokens, verified);
      },
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
