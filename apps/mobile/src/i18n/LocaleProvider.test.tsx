import {useEffect} from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import TestRenderer, {act} from 'react-test-renderer';
import { LocaleProvider, useLocale } from './LocaleProvider';
const state=vi.hoisted(()=>({stored:'en' as string|null,rtl:false,force:vi.fn(),read:vi.fn()}));
vi.mock('react-native',()=>({I18nManager:{get isRTL(){return state.rtl;},forceRTL:state.force}}));
vi.mock('expo-secure-store',()=>({getItemAsync:()=>state.read(),setItemAsync:vi.fn(async()=>undefined)}));
vi.mock('../api/client',()=>({setApiLocale:vi.fn()}));
let current: ReturnType<typeof useLocale>,tree:TestRenderer.ReactTestRenderer;
function Probe(){const value=useLocale();useEffect(()=>{current=value;});return null;}
beforeEach(()=>{state.rtl=false;state.force.mockClear();state.read.mockImplementation(async()=>state.stored);(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;});
afterEach(async()=>{await act(async()=>tree?.unmount());});
it('restores English without forcing Arabic on restart',async()=>{state.stored='en';await act(async()=>{tree=TestRenderer.create(<LocaleProvider><Probe/></LocaleProvider>);});expect(current!.direction).toBe('ltr');expect(state.force).toHaveBeenLastCalledWith(false);expect(current!.restartRequired).toBe(false);});
it('cancels a pending native direction change when reverting to the native language',async()=>{state.stored='en';await act(async()=>{tree=TestRenderer.create(<LocaleProvider><Probe/></LocaleProvider>);});await act(async()=>current!.setLocale('ar'));expect(current!.restartRequired).toBe(true);await act(async()=>current!.setLocale('en'));expect(current!.restartRequired).toBe(false);expect(state.force).toHaveBeenLastCalledWith(false);});
it('does not let delayed saved-language loading overwrite a manual choice',async()=>{let resolve!:(value:string)=>void;state.read.mockImplementation(()=>new Promise<string>(r=>{resolve=r;}));await act(async()=>{tree=TestRenderer.create(<LocaleProvider><Probe/></LocaleProvider>);});await act(async()=>current!.setLocale('en'));await act(async()=>resolve('ar'));expect(current!.locale).toBe('en');});
