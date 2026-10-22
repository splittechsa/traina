import { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './SessionProvider';
import { apiBaseUrl } from '../api/client';
import { getTokens, setApiBaseOverride, setTokenMemory, setTokenPersistor } from '../api/tokens';
vi.mock('expo-secure-store',()=>({
  getItemAsync:async(key:string)=>key==='sahhti.apiBase'?'http://192.168.8.39:3040':key==='sahhti.verifiedSession.v1'?JSON.stringify({userId:'synthetic-owner',accessToken:'synthetic-access',refreshToken:'synthetic-refresh'}):null,
  setItemAsync:vi.fn(async()=>undefined),deleteItemAsync:vi.fn(async()=>undefined),
}));
let tree: TestRenderer.ReactTestRenderer | undefined;
let ready = false;
function Probe(){const session=useSession();useEffect(()=>{ready=session.ready;},[session.ready]);return null;}
afterEach(async()=>{await act(async()=>tree?.unmount());setTokenMemory(null);setApiBaseOverride(null);setTokenPersistor(async()=>undefined);vi.unstubAllEnvs();});
it('restores the account but ignores a retired developer LAN endpoint in a release binary',async()=>{
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubEnv('EXPO_PUBLIC_API_URL','https://release.example.test');setApiBaseOverride(null);
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  await act(async()=>{tree=TestRenderer.create(<QueryClientProvider client={client}><SessionProvider><Probe/></SessionProvider></QueryClientProvider>);});
  expect(ready).toBe(true);expect(getTokens()?.userId).toBe('synthetic-owner');expect(apiBaseUrl()).toBe('https://release.example.test');client.clear();
});
